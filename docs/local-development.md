# Local development

## Prerequisites

- Node.js 20.19+ (or a supported newer LTS)
- npm
- A free Cloudflare account for remote deployment; local development can use Wrangler's local D1.

## Install and run

```bash
npm install
npm run dev:worker
```

In a second terminal:

```bash
npm run dev
```

Vite serves the website on `http://localhost:5173` and proxies `/api/*` plus WebSocket upgrades to Wrangler on `http://127.0.0.1:8787`.

Apply the local D1 migration before testing sessions:

```bash
npx wrangler d1 migrations apply unknown-chat-db --local
```

## Production same-origin API proxy

The website uses same-origin `/api` requests so the HttpOnly guest cookie remains first-party. For Cloudflare Pages:

1. Deploy the Worker named `unknown-chat-api`.
2. In the Pages project's **Settings → Functions → Service bindings**, add binding name `UNKNOWN_API` pointing to service `unknown-chat-api`.
3. Set the Worker variable `APP_ORIGIN` to the exact Pages origin, for example `https://your-project.pages.dev`.
4. Keep the `functions/api/[[path]].ts` proxy in the Pages project and redeploy Pages.

Do not expose the Worker endpoint directly to the browser unless cookie, CORS, and origin settings are deliberately redesigned. Do not commit real credentials or database identifiers.

## Build check

```bash
npm run build
```

The current chat service is an early prototype. Reporting, blocking enforcement, robust rate limiting, bot mitigation, language matching, abuse operations, defensible age assurance, and security review remain before any public launch.
