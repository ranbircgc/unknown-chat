# UNKNOWN

**Talk freely. Stay unknown.**

UNKNOWN is a website-only, anonymous stranger-chat prototype. It is being built as a responsive browser experience for desktop, tablet, and mobile browsers. No native Android, iOS, or desktop app is in scope.

## Current status

The repository contains an early real-time prototype with guest sessions, WebSocket matching, and text messaging. Recent hardening adds:
- Per-IP session-creation throttling (5 attempts per 10-minute window; the IP is hashed before use as a Durable Object key)
- Single active WebSocket per guest session
- Per-socket message and typing-event throttles
- Strict WebSocket Origin checks, bounded payloads, and safer API response headers
- Language compatibility checks during matching
- Static security headers, robots.txt, sitemap, canonical and social metadata

These controls are a baseline, not a security certification or production abuse-prevention system. The 18+ checkbox remains self-attestation only. Reports and blocks are not yet connected to a staffed moderation workflow.

The frontend foundation includes:
- Responsive landing page and product positioning
- Random and interest-based onboarding UI
- Language preference and 18+ self-attestation UI
- Simulated chat interface with text composer
- Report, block, and next-stranger interaction previews
- Safety and privacy messaging

**Important:** This is currently a frontend prototype. It does not connect real strangers, verify age, submit reports, enforce blocks, or provide production security. Do not use it as a live chat service.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Lucide icons

## Run locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Product principles

- Website only; no native app or PWA requirement
- Guest-first identity; no public profile
- Text-first conversations
- Visible report, block, and leave controls
- No fabricated live-user counts or fake matching claims
- Free-tier infrastructure only; quotas and limitations must be respected

## Planned backend

Cloudflare Workers, Durable Objects, D1, and Turnstile are planned for a later phase. Real-time messaging, secure sessions, moderation workflows, defensible age assurance, privacy/retention controls, and legal review are required before a public launch.
