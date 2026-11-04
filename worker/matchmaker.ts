interface MatchAttachment {
  sessionId: string;
  nickname: string;
  mode: "random" | "interests";
  interests: string[];
  language: string;
  roomId: string | null;
  rateWindowStartedAt?: number;
  messageCount?: number;
  typingCount?: number;
  voiceCount?: number;
  reportedRoomId?: string | null;
  pendingVoice?: { roomId: string; mimeType: string; durationMs: number; createdAt: number } | null;
}

interface EventPayload {
  type?: unknown;
  text?: unknown;
  reason?: unknown;
  url?: unknown;
  alt?: unknown;
  mimeType?: unknown;
  durationMs?: unknown;
}

interface Env {
  DB: D1Database;
}

const REPORT_REASONS = new Set(["Harassment or bullying", "Threats or violence", "Hate speech", "Sexual harassment or exploitation", "Scam or spam", "Sharing private information", "Other"]);

export class MatchmakerDO {
  private readonly ctx: DurableObjectState;
  private readonly env: Env;
  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const sessionId = request.headers.get("x-unknown-session-id");
    const nickname = request.headers.get("x-unknown-nickname");
    if (!sessionId || !nickname) return new Response("Unauthorized", { status: 401 });

    let interests: unknown;
    try { interests = JSON.parse(request.headers.get("x-unknown-interests") ?? "[]"); }
    catch { return new Response("Invalid interests", { status: 400 }); }
    if (!Array.isArray(interests) || interests.length > 5 || interests.some((item) => typeof item !== "string" || item.length > 40)) {
      return new Response("Invalid interests", { status: 400 });
    }

    // A guest session may have only one active socket. A reconnect replaces the old socket.
    for (const existing of this.ctx.getWebSockets()) {
      const data = existing.deserializeAttachment() as MatchAttachment | null;
      if (data?.sessionId === sessionId) {
        existing.send(JSON.stringify({ type: "session.replaced", message: "This session connected elsewhere." }));
        existing.close(4001, "Session reconnected");
      }
    }

    const mode = request.headers.get("x-unknown-mode") === "interests" ? "interests" : "random";
    const language = (request.headers.get("x-unknown-language") ?? "Any language").slice(0, 24);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const attachment: MatchAttachment = { sessionId, nickname, mode, interests, language, roomId: null };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);
    await this.tryMatch(server, attachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  private compatibleLanguage(a: string, b: string) {
    return a.toLowerCase() === "any language" || b.toLowerCase() === "any language" || a.toLowerCase() === b.toLowerCase();
  }

  private async isBlocked(first: string, second: string) {
    const row = await this.env.DB.prepare(
      "SELECT 1 AS blocked FROM user_blocks WHERE expires_at > ? AND ((blocker_session_id = ? AND blocked_session_id = ?) OR (blocker_session_id = ? AND blocked_session_id = ?)) LIMIT 1",
    ).bind(Math.floor(Date.now() / 1000), first, second, second, first).first<{ blocked: number }>();
    return Boolean(row);
  }

  private async tryMatch(socket: WebSocket, current: MatchAttachment) {
    for (const candidate of this.ctx.getWebSockets()) {
      if (candidate === socket || candidate.readyState !== WebSocket.READY_STATE_OPEN) continue;
      const data = candidate.deserializeAttachment() as MatchAttachment | null;
      if (!data || data.roomId !== null || data.sessionId === current.sessionId) continue;
      if (!this.compatibleLanguage(current.language, data.language)) continue;
      if ((current.mode === "interests" || data.mode === "interests") &&
          !current.interests.some((interest) => data.interests.includes(interest))) continue;
      if (await this.isBlocked(current.sessionId, data.sessionId)) continue;

      const roomId = crypto.randomUUID();
      socket.serializeAttachment({ ...current, roomId });
      candidate.serializeAttachment({ ...data, roomId });
      socket.send(JSON.stringify({ type: "match.found", roomId, stranger: { nickname: data.nickname } }));
      candidate.send(JSON.stringify({ type: "match.found", roomId, stranger: { nickname: current.nickname } }));
      return;
    }

    socket.send(JSON.stringify({ type: "queue.waiting", message: "Looking for someone to talk to…" }));
  }

  private consume(socket: WebSocket, kind: "message" | "typing" | "voice") {
    const now = Date.now();
    const attachment = socket.deserializeAttachment() as MatchAttachment | null;
    if (!attachment) return false;
    if (!attachment.rateWindowStartedAt || now - attachment.rateWindowStartedAt >= 10_000) {
      attachment.rateWindowStartedAt = now;
      attachment.messageCount = 0;
      attachment.typingCount = 0;
      attachment.voiceCount = 0;
    }
    const key = kind === "message" ? "messageCount" : kind === "typing" ? "typingCount" : "voiceCount";
    const limit = kind === "message" ? 8 : kind === "typing" ? 20 : 2;
    const count = attachment[key] ?? 0;
    if (count >= limit) {
      socket.serializeAttachment(attachment);
      return false;
    }
    attachment[key] = count + 1;
    socket.serializeAttachment(attachment);
    return true;
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer | Blob) {
    if (typeof message !== "string") {
      const attachment = socket.deserializeAttachment() as MatchAttachment | null;
      const pending = attachment?.pendingVoice;
      const peer = this.ctx.getWebSockets().find((candidate) => {
        if (candidate === socket || candidate.readyState !== WebSocket.READY_STATE_OPEN) return false;
        const data = candidate.deserializeAttachment() as MatchAttachment | null;
        return Boolean(pending && pending.roomId === attachment?.roomId && data?.roomId === pending.roomId);
      });
      const byteLength = message instanceof Blob ? message.size : message.byteLength;
      if (!attachment || !pending || !peer || (!(message instanceof ArrayBuffer) && !(message instanceof Blob)) || byteLength < 1 || byteLength > 1_500_000 || Date.now() - pending.createdAt > 10_000) {
        if (attachment) socket.serializeAttachment({ ...attachment, pendingVoice: null });
        socket.send(JSON.stringify({ type: "error", message: "Voice note was invalid or expired." }));
        return;
      }
      socket.serializeAttachment({ ...attachment, pendingVoice: null });
      peer.send(JSON.stringify({ type: "voice.new", mimeType: pending.mimeType, durationMs: pending.durationMs, size: byteLength, sentAt: Date.now() }));
      peer.send(message);
      socket.send(JSON.stringify({ type: "voice.sent", sentAt: Date.now() }));
      return;
    }
    if (message.length > 5000) {
      socket.send(JSON.stringify({ type: "error", message: "Invalid message payload." }));
      return;
    }

    let event: EventPayload;
    try { event = JSON.parse(message) as EventPayload; }
    catch { socket.send(JSON.stringify({ type: "error", message: "Invalid JSON." })); return; }
    if (!event || typeof event !== "object" || typeof event.type !== "string") {
      socket.send(JSON.stringify({ type: "error", message: "Invalid event." }));
      return;
    }

    const attachment = socket.deserializeAttachment() as MatchAttachment | null;
    if (!attachment) return;
    const peer = this.ctx.getWebSockets().find((candidate) => {
      if (candidate === socket || candidate.readyState !== WebSocket.READY_STATE_OPEN) return false;
      const data = candidate.deserializeAttachment() as MatchAttachment | null;
      return Boolean(attachment.roomId && data?.roomId === attachment.roomId);
    });

    if (event.type === "message.send") {
      if (!this.consume(socket, "message")) {
        socket.send(JSON.stringify({ type: "error", message: "You're sending messages too quickly. Please slow down." }));
        return;
      }
      const text = typeof event.text === "string" ? event.text.trim() : "";
      if (!attachment.roomId || !peer) {
        socket.send(JSON.stringify({ type: "error", message: "You are not in an active chat." }));
        return;
      }
      if (!text || text.length > 2000) {
        socket.send(JSON.stringify({ type: "error", message: "Messages must contain 1–2000 characters." }));
        return;
      }
      peer.send(JSON.stringify({ type: "message.new", text, sender: attachment.nickname, sentAt: Date.now() }));
      return;
    }

    if (event.type === "gif.send") {
      if (!this.consume(socket, "message")) {
        socket.send(JSON.stringify({ type: "error", message: "You're sending media too quickly. Please slow down." }));
        return;
      }
      if (!attachment.roomId || !peer) {
        socket.send(JSON.stringify({ type: "error", message: "You are not in an active chat." }));
        return;
      }
      const rawUrl = typeof event.url === "string" ? event.url : "";
      let gifUrl: URL;
      try { gifUrl = new URL(rawUrl); } catch { socket.send(JSON.stringify({ type: "error", message: "Invalid GIF URL." })); return; }
      if (gifUrl.protocol !== "https:" || !(gifUrl.hostname === "giphy.com" || gifUrl.hostname.endsWith(".giphy.com")) || rawUrl.length > 2048) {
        socket.send(JSON.stringify({ type: "error", message: "Only approved GIPHY media links can be sent." }));
        return;
      }
      const alt = typeof event.alt === "string" ? event.alt.trim().slice(0, 120) : "GIF";
      peer.send(JSON.stringify({ type: "gif.new", url: gifUrl.toString(), alt, sender: attachment.nickname, sentAt: Date.now() }));
      return;
    }

    if (event.type === "voice.begin") {
      if (!this.consume(socket, "voice")) {
        socket.send(JSON.stringify({ type: "error", message: "Please wait before sending another voice note." }));
        return;
      }
      const mimeType = typeof event.mimeType === "string" ? event.mimeType : "";
      const durationMs = typeof event.durationMs === "number" ? event.durationMs : 0;
      if (!attachment.roomId || !peer) {
        socket.send(JSON.stringify({ type: "error", message: "You are not in an active chat." }));
        return;
      }
      if (!["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].includes(mimeType) || !Number.isFinite(durationMs) || durationMs < 500 || durationMs > 30_000) {
        socket.send(JSON.stringify({ type: "error", message: "Voice notes must be 0.5 to 30 seconds in a supported audio format." }));
        return;
      }
      socket.serializeAttachment({ ...attachment, pendingVoice: { roomId: attachment.roomId, mimeType, durationMs, createdAt: Date.now() } });
      socket.send(JSON.stringify({ type: "voice.ready" }));
      return;
    }

    if (event.type === "typing.start" || event.type === "typing.stop") {
      if (!this.consume(socket, "typing")) return;
      if (peer) peer.send(JSON.stringify({ type: event.type }));
      return;
    }

    if (event.type === "report.submit") {
      const reason = typeof event.reason === "string" ? event.reason : "";
      if (!attachment.roomId || !peer) {
        socket.send(JSON.stringify({ type: "error", message: "There is no active conversation to report." }));
        return;
      }
      if (!REPORT_REASONS.has(reason)) {
        socket.send(JSON.stringify({ type: "error", message: "Choose a valid report reason." }));
        return;
      }
      if (attachment.reportedRoomId === attachment.roomId) {
        socket.send(JSON.stringify({ type: "error", message: "You have already reported this conversation." }));
        return;
      }
      await this.env.DB.prepare(
        "INSERT INTO conversation_reports (id, reporter_session_id, reported_session_id, reason, status, created_at, expires_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
      ).bind(crypto.randomUUID(), attachment.sessionId, (peer.deserializeAttachment() as MatchAttachment).sessionId, reason, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60).run();
      socket.serializeAttachment({ ...attachment, reportedRoomId: attachment.roomId });
      socket.send(JSON.stringify({ type: "report.received", message: "Report recorded. If you feel unsafe, leave the conversation." }));
      return;
    }

    if (event.type === "block.add") {
      if (!attachment.roomId || !peer) {
        socket.send(JSON.stringify({ type: "error", message: "There is no active person to block." }));
        return;
      }
      const peerData = peer.deserializeAttachment() as MatchAttachment;
      await this.env.DB.prepare(
        "INSERT OR REPLACE INTO user_blocks (blocker_session_id, blocked_session_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      ).bind(attachment.sessionId, peerData.sessionId, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60).run();
      peer.send(JSON.stringify({ type: "room.closed", reason: "The other person left the conversation." }));
      const waitingPeer = { ...peerData, roomId: null };
      const waitingBlocker = { ...attachment, roomId: null };
      peer.serializeAttachment(waitingPeer);
      socket.serializeAttachment(waitingBlocker);
      await this.tryMatch(peer, waitingPeer);
      await this.tryMatch(socket, waitingBlocker);
      socket.send(JSON.stringify({ type: "block.saved", message: "This person is blocked for this guest session." }));
      return;
    }

    if (event.type === "room.end") {
      if (peer) {
        peer.send(JSON.stringify({ type: "room.closed", reason: "The other person left." }));
        const peerData = peer.deserializeAttachment() as MatchAttachment;
        const waitingPeer = { ...peerData, roomId: null };
        peer.serializeAttachment(waitingPeer);
        await this.tryMatch(peer, waitingPeer);
      }
      socket.serializeAttachment({ ...attachment, roomId: null });
      socket.send(JSON.stringify({ type: "room.closed", reason: "You left the conversation." }));
      return;
    }

    socket.send(JSON.stringify({ type: "error", message: "Unsupported event." }));
  }

  async webSocketClose(socket: WebSocket) {
    await this.closePeerRoom(socket);
  }

  async webSocketError(socket: WebSocket) {
    await this.closePeerRoom(socket);
  }

  private async closePeerRoom(socket: WebSocket) {
    const attachment = socket.deserializeAttachment() as MatchAttachment | null;
    if (!attachment?.roomId) return;
    const peer = this.ctx.getWebSockets().find((candidate) => {
      if (candidate === socket || candidate.readyState !== WebSocket.READY_STATE_OPEN) return false;
      const data = candidate.deserializeAttachment() as MatchAttachment | null;
      return data?.roomId === attachment.roomId;
    });
    if (peer) {
      peer.send(JSON.stringify({ type: "room.closed", reason: "The other person disconnected." }));
      const data = peer.deserializeAttachment() as MatchAttachment;
      const waitingPeer = { ...data, roomId: null };
      peer.serializeAttachment(waitingPeer);
      await this.tryMatch(peer, waitingPeer);
    }
  }
}
