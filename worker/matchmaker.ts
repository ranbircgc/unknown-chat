interface MatchAttachment {
  sessionId: string;
  nickname: string;
  mode: "random" | "interests";
  interests: string[];
  language: string;
  roomId: string | null;
}

export class MatchmakerDO {
  private readonly ctx: DurableObjectState;

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

    let interests: string[] = [];
    try { interests = JSON.parse(request.headers.get("x-unknown-interests") ?? "[]") as string[]; }
    catch { return new Response("Invalid interests", { status: 400 }); }

    const mode = request.headers.get("x-unknown-mode") === "interests" ? "interests" : "random";
    const language = (request.headers.get("x-unknown-language") ?? "Any language").slice(0, 24);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const attachment: MatchAttachment = { sessionId, nickname, mode, interests: interests.slice(0, 5), language, roomId: null };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);
    this.tryMatch(server, attachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  private tryMatch(socket: WebSocket, current: MatchAttachment) {
    const waiting = this.ctx.getWebSockets().find((candidate) => {
      if (candidate === socket || candidate.readyState !== WebSocket.READY_STATE_OPEN) return false;
      const data = candidate.deserializeAttachment() as MatchAttachment | null;
      if (!data || data.roomId !== null || data.sessionId === current.sessionId) return false;
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

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string" || message.length > 5000) {
      socket.send(JSON.stringify({ type: "error", message: "Invalid message payload." }));
      return;
    }

    let event: { type?: string; text?: string };
    try { event = JSON.parse(message) as { type?: string; text?: string }; }
    catch { socket.send(JSON.stringify({ type: "error", message: "Invalid JSON." })); return; }

    const attachment = socket.deserializeAttachment() as MatchAttachment | null;
    if (!attachment) return;
    const peer = this.ctx.getWebSockets().find((candidate) => {
      if (candidate === socket || candidate.readyState !== WebSocket.READY_STATE_OPEN) return false;
      const data = candidate.deserializeAttachment() as MatchAttachment | null;
      return Boolean(attachment.roomId && data?.roomId === attachment.roomId);
    });

    if (event.type === "message.send") {
      const text = (event.text ?? "").trim();
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
      if (peer) peer.send(JSON.stringify({ type: event.type }));
      return;
    }

    if (event.type === "room.end") {
      if (peer) {
        peer.send(JSON.stringify({ type: "room.closed", reason: "The other person left." }));
        const peerData = peer.deserializeAttachment() as MatchAttachment;
        peer.serializeAttachment({ ...peerData, roomId: null });
      }
      socket.serializeAttachment({ ...attachment, roomId: null });
      socket.send(JSON.stringify({ type: "room.closed", reason: "You left the conversation." }));
      return;
    }

    socket.send(JSON.stringify({ type: "error", message: "Unsupported event." }));
  }

  async webSocketClose(socket: WebSocket) {
    this.closePeerRoom(socket);
  }

  async webSocketError(socket: WebSocket) {
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
      peer.serializeAttachment({ ...data, roomId: null });
    }
  }
}