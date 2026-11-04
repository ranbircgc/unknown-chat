# Moderation console setup and limitations

The console is served at `/moderation.html` and calls authenticated `/api/admin/reports` endpoints. Authentication uses Cloudflare Access JWT validation in the Worker; it is not a shared password or client-side gate.

## Required Cloudflare configuration
1. Create a Cloudflare Access self-hosted application for the exact moderation hostname/path. Restrict it to individually named moderator identities, require MFA, and deny everyone else by default.
2. Configure Worker vars `ACCESS_TEAM_DOMAIN` (issuer URL, e.g. `https://<team>.cloudflareaccess.com`) and `ACCESS_AUD` (the Access application's AUD tag). Never put these in frontend code.
3. Apply the same Access policy to `/moderation.html` and `/api/admin/*`. Worker JWT verification independently checks signature, issuer, audience, expiry and not-before.
4. Apply D1 migrations before deployment. Test denied access from an unauthenticated browser and successful access from a named moderator.
5. Keep the operator list small, review membership monthly, and remove access immediately when a moderator leaves.

## What the console can and cannot do
- Lists report reason, status, timestamp and reviewer metadata; it does not expose chat transcripts or raw session identifiers.
- Records moderator disposition and an audit event. It does not automatically ban accounts, identify a person, or prove the moderator made a correct decision.
- Existing reports intentionally do not store message content. Reviewers cannot inspect a transcript that was never retained.
- The existing status constraint permits `pending`, `reviewed`, and `dismissed`; action taken is recorded as `reviewed` with a separate `resolution_code` and audit action.
- This code does not create human staff, shifts, escalation coverage, legal advice, or a guaranteed response SLA. Do not claim reports are reviewed until trained people are actually assigned and using it.

## Deployment gate
Do not deploy the admin route until Access is configured and the Worker vars are set. Without them the endpoints fail closed with 401. Do not add a public bypass or hard-coded admin email allowlist.
