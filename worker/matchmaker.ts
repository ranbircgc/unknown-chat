interface MatchAttachment {
  sessionId: string;
  nickname: string;
  mode: "random" | "interests";
  interests: string[];
  language: string;
  roomId: string | null;
}

interface EventPayload {
  type?: unknown;
  text?: unknown;
}

interface MessageWindow {
  startedAt: number;
  messages: number;
  typing: number;
}

export class MatchmakerDO {
  private readonly ctx: DurableObjectState;
  private readonly activity = new Map<WebSocket, MessageWindow>();

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
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
    this.activity.set(server, { startedAt: Date.now(), messages: 0, typing: 0 });
    this.tryMatch(server, attachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  private compatibleLanguage(a: string, b: string) {
    return a.toLowerCase() === "any language" || b.toLowerCase() === "any language" || a.toLowerCase() === b.toLowerCase();
  }

  private tryMatch(socket: WebSocket, current: MatchAttachment) {
    const waiting = this.ctx.getWebSockets().find((candidate) => {
      if (candidate === socket || candidate.readyState !== WebSocket.READY_STATE_OPEN) return false;
      const data = candidate.deserializeAttachment() as MatchAttachment | null;
      if (!data || data.roomId !== null || data.sessionId === current.sessionId) return false;
      if (!this.compatibleLanguage(current.language, data.language)) return false;
      if (current.mode === "interests" || data.mode === "interests") {
        return current.interests.some((interest) => data.interests.includes(interest));
      }
      return true;
    });

    if (!waiting) {
      socket.send(JSON.stringify({ type: "queue.waiting", message: "Looking for someone to talk to…" }));
      return;
    }

    const other = waiting.deserializeAttachment() as MatchAttachment;
    const roomId = crypto.randomUUID();
    socket.serializeAttachment({ ...current, roomId });
    waiting.serializeAttachment({ ...other, roomId });
    socket.send(JSON.stringify({ type: "match.found", roomId, stranger: { nickname: other.nickname } }));
    waiting.send(JSON.stringify({ type: "match.found", roomId, stranger: { nickname: current.nickname } }));
  }

  private consume(socket: WebSocket, kind: "message" | "typing") {
    const now = Date.now();
    const state = this.activity.get(socket) ?? { startedAt: now, messages: 0, typing: 0 };
    if (now - state.startedAt >= 10_000) {
      state.startedAt = now;
      state.messages = 0;
      state.typing = 0;
    }
    const key = kind === "message" ? "messages" : "typing";
    const limit = kind === "message" ? 8 : 20;
    if (state[key] >= limit) {
      this.activity.set(socket, state);
      return false;
    }
    state[key] += 1;
    this.activity.set(socket, state);
    return true;
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string" || message.length > 5000) {
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

    if (event.type === "typing.start" || event.type === "typing.stop") {
      if (!this.consume(socket, "typing")) return;
      if (peer) peer.send(JSON.stringify({ type: event.type }));
      return;
    }

    if (event.type === "room.end") {
      if (peer) {
        peer.send(JSON.stringify({ type: "room.closed", reason: "The other person left." }));
        const peerData = peer.deserializeAttachment() as MatchAttachment;
        const waitingPeer = { ...peerData, roomId: null };
        peer.serializeAttachment(waitingPeer);
        this.tryMatch(peer, waitingPeer);
      }
      socket.serializeAttachment({ ...attachment, roomId: null });
      socket.send(JSON.stringify({ type: "room.closed", reason: "You left the conversation." }));
      return;
    }

    socket.send(JSON.stringify({ type: "error", message: "Unsupported event." }));
  }

  async webSocketClose(socket: WebSocket) {
    this.activity.delete(socket);
    this.closePeerRoom(socket);
  }

  async webSocketError(socket: WebSocket) {
    this.activity.delete(socket);
    this.closePeerRoom(socket);
  }

  private closePeerRoom(socket: WebSocket) {
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
      this.tryMatch(peer, waitingPeer);
    }
  }
}
