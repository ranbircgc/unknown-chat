interface Env {
  DB: D1Database;
  MATCHMAKER: DurableObjectNamespace;
  SESSION_LIMITER: DurableObjectNamespace;
  APP_ORIGIN?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
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

type AccessClaims = { iss?: string; aud?: string | string[]; exp?: number; nbf?: number; email?: string; sub?: string };
let accessKeysCache: { expiresAt: number; keys: JsonWebKey[] } | null = null;
function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function verifyAccessJwt(request: Request, env: Env): Promise<AccessClaims | null> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0]))) as { alg?: string; kid?: string };
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))) as AccessClaims;
    const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\\/$/, "");
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== "RS256" || !header.kid || claims.iss !== issuer || !claims.exp || claims.exp <= now || (claims.nbf && claims.nbf > now)) return null;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(env.ACCESS_AUD)) return null;
    if (!accessKeysCache || accessKeysCache.expiresAt < Date.now()) {
      const response = await fetch(issuer + "/cdn-cgi/access/certs", { headers: { accept: "application/json" } });
      if (!response.ok) return null;
      const data = await response.json() as { keys?: JsonWebKey[] };
      if (!Array.isArray(data.keys)) return null;
      accessKeysCache = { keys: data.keys, expiresAt: Date.now() + 5 * 60 * 1000 };
    }
    const jwk = accessKeysCache.keys.find((key) => (key as JsonWebKey & { kid?: string }).kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBase64Url(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
    return valid ? claims : null;
  } catch { return null; }
}
async function requireModerator(request: Request, env: Env) {
  return verifyAccessJwt(request, env);
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

    if (url.pathname.startsWith("/api/admin/")) {
      const moderator = await requireModerator(request, env);
      if (!moderator) return json({ error: "Moderator authentication required" }, 401);
      const reviewer = (moderator.email ?? moderator.sub ?? "moderator").slice(0, 254);
      if (url.pathname === "/api/admin/reports" && request.method === "GET") {
        const status = url.searchParams.get("status") ?? "pending";
        if (!["pending", "reviewed", "actioned", "dismissed", "all"].includes(status)) return json({ error: "Invalid status filter" }, 400);
        const query = status === "all"
          ? "SELECT id, reason, status, created_at, expires_at, reviewed_at, reviewer, resolution_code FROM conversation_reports ORDER BY created_at DESC LIMIT 100"
          : "SELECT id, reason, status, created_at, expires_at, reviewed_at, reviewer, resolution_code FROM conversation_reports WHERE status = ? ORDER BY created_at ASC LIMIT 100";
        const result = status === "all" ? await env.DB.prepare(query).all() : await env.DB.prepare(query).bind(status).all();
        return json({ reports: result.results ?? [] });
      }
      const match = url.pathname.match(/^\\/api\\/admin\\/reports\\/([a-f0-9-]{36})\\/action$/i);
      if (match && request.method === "POST") {
        let body: { action?: string; note?: string };
        try { body = await request.json() as { action?: string; note?: string }; } catch { return json({ error: "Invalid JSON body" }, 400); }
        const allowed = new Set(["reviewed", "actioned", "dismissed"]);
        if (!body.action || !allowed.has(body.action)) return json({ error: "Invalid action" }, 400);
        const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
        const now = Math.floor(Date.now() / 1000);
        const reportId = match[1];
        const existing = await env.DB.prepare("SELECT id, status FROM conversation_reports WHERE id = ? LIMIT 1").bind(reportId).first<{ id: string; status: string }>();
        if (!existing) return json({ error: "Report not found" }, 404);
        await env.DB.batch([
          env.DB.prepare("UPDATE conversation_reports SET status = ?, reviewer = ?, reviewed_at = ?, resolution_code = ?, moderator_note = ? WHERE id = ?")
            .bind(body.action, reviewer, now, body.action, note, reportId),
          env.DB.prepare("INSERT INTO moderation_audit (id, report_id, reviewer, action, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(crypto.randomUUID(), reportId, reviewer, body.action, note, now),
        ]);
        return json({ ok: true, status: body.action, reviewedAt: now });
      }
      return json({ error: "Not found" }, 404);
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
