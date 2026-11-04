interface Env {
  UNKNOWN_API: Fetcher;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  // Forward REST and WebSocket requests to the Worker through a same-origin
  // Pages service binding. This keeps the guest cookie first-party in browsers.
  return context.env.UNKNOWN_API.fetch(context.request);
};