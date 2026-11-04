interface Env {
  DB: D1Database;
  MATCHMAKER: DurableObjectNamespace;
  SESSION_LIMITER: DurableObjectNamespace;
  APP_ORIGIN?: string;
}

interface SessionRow {
  id: string;
  nickname: string;
  status: string;
  expires_at: number;
}

const SESSION_COOKIE = "unknown_session";
const SESSION_TTL_SECONDS = 60 * 60 * 4;
const NICKNAMES = ["QuietComet", "BlueEcho", "CuriousFox", "SilverOrbit", "PixelNomad", "KindStranger", "MoonlitWave", "SoftSignal"];

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
      "cross-origin-resource-policy": "same-origin",
      ...headers,
    },
  });
}

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

function cookieHeader(token: string, requestUrl: URL, maxAge = SESSION_TTL_SECONDS) {
  const secure = requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1" ? "" : "; Secure";
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function clearCookie(requestUrl: URL) {
  const secure = requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1" ? "" : "; Secure";
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function originAllowed(request: Request, env: Env, url: URL) {
  const origin = request.headers.get("Origin");
  if (!origin) return request.method === "GET" || request.method === "HEAD";
  return origin === (env.APP_ORIGIN ?? url.origin);
}

async function findSession(request: Request, env: Env): Promise<SessionRow | null> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  return env.DB.prepare(
    "SELECT id, nickname, status, expires_at FROM guest_sessions WHERE token_hash = ? AND status = 'active' AND expires_at > ? LIMIT 1",
  ).bind(tokenHash, now).first<SessionRow>();
}

function createNickname() {
  const index = crypto.getRandomValues(new Uint32Array(1))[0] % NICKNAMES.length;
  return NICKNAMES[index];
}

async function allowSessionCreation(request: Request, env: Env) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return { allowed: false, retryAfter: 600 };
  const key = await sha256(ip);
  const id = env.SESSION_LIMITER.idFromName(key);
  const response = await env.SESSION_LIMITER.get(id).fetch("https://rate-limit.internal/check", { method: "POST" });
  if (!response.ok) return { allowed: false, retryAfter: 60 };
  return response.json() as Promise<{ allowed: boolean; retryAfter: number }>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);

    const isWebSocket = url.pathname === "/api/chat" && request.headers.get("Upgrade")?.toLowerCase() === "websocket";
    if (isWebSocket) {
      const origin = request.headers.get("Origin");
      if (!origin || origin !== (env.APP_ORIGIN ?? url.origin)) return json({ error: "Origin not allowed" }, 403);
    } else if (!originAllowed(request, env, url)) {
      return json({ error: "Origin not allowed" }, 403);
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ status: "ok", service: "unknown-api", mode: "prototype" });
    }

    if (url.pathname === "/api/sessions" && request.method === "POST") {
      const limit = await allowSessionCreation(request, env);
      if (!limit.allowed) {
        return json({ error: "Too many session attempts. Please wait before trying again." }, 429, {
          "retry-after": String(limit.retryAfter),
        });
      }

      let body: { ageAttested?: boolean };
      try { body = await request.json() as { ageAttested?: boolean }; }
      catch { return json({ error: "Invalid JSON body" }, 400); }
      if (body.ageAttested !== true) return json({ error: "18+ confirmation is required" }, 400);

      const token = randomToken();
      const tokenHash = await sha256(token);
      const id = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + SESSION_TTL_SECONDS;
      const nickname = createNickname();

      await env.DB.prepare(
        "INSERT INTO guest_sessions (id, token_hash, nickname, status, age_attested_at, created_at, expires_at) VALUES (?, ?, ?, 'active', ?, ?, ?)",
      ).bind(id, tokenHash, nickname, now, now, expiresAt).run();

      return json(
        { session: { id, nickname, expiresAt }, notice: "Age confirmation is self-attestation, not age verification." },
        201,
        { "set-cookie": cookieHeader(token, url) },
      );
    }

    if (url.pathname === "/api/sessions/me" && request.method === "GET") {
      const session = await findSession(request, env);
      if (!session) return json({ error: "Session not found or expired" }, 401);
      return json({ session: { id: session.id, nickname: session.nickname, expiresAt: session.expires_at } });
    }

    if (url.pathname === "/api/sessions/me" && request.method === "DELETE") {
      const token = getCookie(request, SESSION_COOKIE);
      if (token) {
        await env.DB.prepare("UPDATE guest_sessions SET status = 'revoked' WHERE token_hash = ?")
          .bind(await sha256(token)).run();
      }
      return json({ ok: true }, 200, { "set-cookie": clearCookie(url) });
    }

    if (isWebSocket) {
      const session = await findSession(request, env);
      if (!session) return json({ error: "A valid guest session is required" }, 401);

      const mode = url.searchParams.get("mode") === "interests" ? "interests" : "random";
      const language = (url.searchParams.get("language") ?? "Any language").slice(0, 24);
      const interests = (url.searchParams.get("interests") ?? "")
        .split(",").map((item) => item.trim().slice(0, 40)).filter(Boolean).slice(0, 5);

      const id = env.MATCHMAKER.idFromName("global-matchmaker");
      const stub = env.MATCHMAKER.get(id);
      const headers = new Headers(request.headers);
      headers.set("x-unknown-session-id", session.id);
      headers.set("x-unknown-nickname", session.nickname);
      headers.set("x-unknown-mode", mode);
      headers.set("x-unknown-language", language);
      headers.set("x-unknown-interests", JSON.stringify(interests));
      return stub.fetch(new Request(request, { headers }));
    }

    return json({ error: "Not found" }, 404);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const now = Math.floor(Date.now() / 1000);
    ctx.waitUntil(env.DB.batch([
      env.DB.prepare("DELETE FROM conversation_reports WHERE expires_at <= ?").bind(now),
      env.DB.prepare("DELETE FROM user_blocks WHERE expires_at <= ?").bind(now),
      env.DB.prepare("DELETE FROM guest_sessions WHERE expires_at <= ? OR status = 'revoked'").bind(now),
    ]));
  },
};

export { MatchmakerDO } from "./matchmaker";
export { RateLimiterDO } from "./rate-limiter";
