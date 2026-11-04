interface RateLimitState {
  windowStartedAt: number;
  count: number;
}

export class RateLimiterDO {
  private readonly ctx: DurableObjectState;

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const limit = 5;

    const result = await this.ctx.storage.transaction(async (txn) => {
      const current = await txn.get<RateLimitState>("window");
      const state: RateLimitState = !current || now - current.windowStartedAt >= windowMs
        ? { windowStartedAt: now, count: 0 }
        : current;

      if (state.count >= limit) {
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((state.windowStartedAt + windowMs - now) / 1000)) };
      }

      state.count += 1;
      await txn.put("window", state);
      return { allowed: true, retryAfter: 0 };
    });

    return Response.json(result, { headers: { "cache-control": "no-store" } });
  }
}
