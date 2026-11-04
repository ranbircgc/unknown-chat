# UNKNOWN Worker API (foundation)

This folder contains an early Cloudflare Workers backend foundation.

## Endpoints

- `GET /api/health` — health response
- `POST /api/sessions` — create an anonymous guest session; JSON body: `{"ageAttested":true}`
- `GET /api/sessions/me` — inspect the current guest session
- `DELETE /api/sessions/me` — revoke the current session
- `GET /api/chat?mode=random|interests&language=...&interests=AI,Music` — authenticated WebSocket upgrade

## Local setup

1. Install Wrangler: `npm install -D wrangler`
2. Create a Cloudflare D1 database and replace `database_id` in `wrangler.toml`.
3. Apply the schema locally: `npx wrangler d1 migrations apply unknown-chat-db --local`.
4. Start the Worker: `npx wrangler dev`.

The frontend is not wired to these endpoints yet.

## Important limitations

- The age field is self-attestation only. It is not age verification and is not sufficient for a public 18+ launch.
- Matching is an early single-coordinator prototype. Interest matching requires at least one shared interest; language preferences are enforced as exact matches unless either guest selects Any language.
- Messages are relayed in memory through the Durable Object and are not intentionally written to D1.
- Report, block, staffed moderation, advanced abuse prevention, abuse evidence handling, retention automation, and legal workflows are not implemented. Baseline session-creation and WebSocket event throttles are present, but are not a substitute for edge protections or moderation.
- A production launch requires security review, capacity testing, age-assurance design, moderation operations, and legal review.
- Free-tier quotas are finite; this project does not promise unlimited traffic or guaranteed availability.