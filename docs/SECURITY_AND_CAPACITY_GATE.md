# UNKNOWN security and capacity launch gate

**Status: NOT REVIEWED / NOT LOAD-TESTED — public promotion is blocked.**

Passing unit, build, or browser tests does not establish production security, resilience, or capacity.

## Security review checklist

A reviewer who did not implement the feature should verify and record evidence for:
- Threat model: anonymous abuse, session theft, WebSocket abuse, spam, denial of service, moderator compromise, data exposure, and Cloudflare account compromise.
- Authentication and authorization for every HTTP and WebSocket route; origin validation; cookie flags; CSRF considerations; session expiry/revocation.
- Rate limits across session creation, messages, typing, reports, blocks, reconnects, and expensive operations; behavior under distributed/bot traffic.
- Input validation, payload limits, output encoding, dependency vulnerabilities, secret handling, and secure headers.
- D1 queries, access boundaries, migrations, backups/recovery, deletion, retention, and least-privilege access.
- Durable Object coordination, reconnect races, duplicate sockets, queue growth, failure recovery, and cross-user data isolation.
- Privacy review of IP handling, logs, analytics, cookies, report metadata, and third-party scripts/ads.
- Abuse escalation and incident response, including credential rotation and service shutdown.
- Cloudflare configuration, WAF/bot controls, DDoS posture, quota/limit behavior, and account recovery.

Record reviewer, date, commit/deployment reviewed, findings, severity, remediation PRs, and explicit sign-off. Critical/high findings must be closed and retested before launch.

## Capacity test plan

Run only against a staging environment with synthetic accounts and explicit test limits. Do not load-test the public production service without provider approval.

Measure:
- Concurrent connected guests and match rate.
- Match latency (p50/p95/p99), WebSocket delivery latency, reconnect success, and disconnect recovery.
- Message throughput and report/block event throughput.
- Durable Object CPU/latency, D1 read/write latency, error rates, queue/backlog growth, and Cloudflare quota consumption.
- Behavior at expected peak, 2x expected peak, and controlled overload.
- Graceful rejection, retry/backoff, and recovery after dependency failures.

Define expected launch traffic, acceptable latency/error thresholds, a stop condition, and rollback plan before running tests. Capture raw results and deployment/config versions. The single global matchmaker Durable Object is a known coordination and scaling constraint; do not assume horizontal scale.

## Required evidence

Attach a signed review report, reproducible test scripts, results, quota calculations, incident/rollback runbook, and remediation references. If capacity cannot be demonstrated within the selected Cloudflare plan's limits, reduce launch scope or choose a different architecture before promotion.

**Go/no-go:** No public promotion until independent security review is signed, high/critical findings are resolved, capacity targets are demonstrated, and operational owners approve the results.
