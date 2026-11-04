# UNKNOWN moderation operations runbook

**Status: NOT OPERATIONAL — do not advertise reports as human-reviewed.**

This runbook defines the minimum manual process required before public launch. It does not itself staff moderators, create a secure dashboard, or prove that a report has been reviewed.

## 1. Required staffing and ownership

Before accepting public users, appoint:
- A named moderation lead accountable for queue health and escalations.
- At least two trained moderators so coverage does not depend on one person.
- A backup owner for urgent safety reports.
- A documented schedule, response targets, escalation contacts, and handover process.

If no trained moderator is on duty, disable new matching or keep the service in a closed test. Do not imply 24/7 monitoring.

## 2. Report handling workflow

1. Acknowledge receipt in-product without promising a review time that cannot be met.
2. An authorized moderator checks the report queue using an authenticated, least-privilege administrative route. Do not expose the queue publicly or share database credentials.
3. Review the selected report reason, report timestamp, and minimum session references needed to investigate. The current system does not retain message transcripts, so moderators must not claim to have reviewed missing chat content.
4. Classify severity: urgent threat/imminent danger; exploitation or sexual safety; targeted harassment/hate; scam/spam; other.
5. Record a disposition: no action, warning, temporary restriction, session revocation, escalation, or referred for specialist/legal review. Record reviewer, timestamp, rationale code, and any expiry.
6. Escalate credible imminent threats, suspected exploitation, and legally sensitive cases to the designated safety lead and appropriate authorities/advisers under a counsel-approved protocol.
7. Close the case only after a second-person check for high-severity cases. Keep an auditable, access-controlled action log.
8. Review queue age and unresolved cases at each shift handover.

## 3. Response targets to adopt before launch

These are proposed internal service targets, not current promises:
- Imminent safety concern: immediate on-call escalation while staffed.
- High-severity report: triage within 1 hour during published coverage.
- Standard report: triage within 24 hours during published coverage.
- Unstaffed periods: clearly disclose expected delay and pause new matching if urgent coverage cannot be maintained.

Do not publish these targets until staffing and drills demonstrate they can be met.

## 4. Data and privacy controls

- Keep access limited to named moderators with individual accounts and MFA.
- Never place chat transcripts, IP addresses, or identity documents in ordinary issue trackers.
- Access only the minimum data needed. Current reports store reason and temporary session references, not chat content.
- Log moderator access and actions; review access regularly.
- Define retention and deletion rules with privacy/legal review. Current report rows expire after 90 days and session-level blocks after 180 days; do not silently extend retention.
- Provide a process for lawful requests and data-subject requests, approved by counsel.

## 5. Session-level block limitation

A block currently excludes the two temporary session IDs. A person can evade it by creating another guest session. Explain this limitation accurately; do not describe blocks as permanent identity-level bans.

## 6. Operational readiness drill

Before launch, run a tabletop and live test with synthetic reports:
- Submit every report reason.
- Verify queue visibility is restricted.
- Assign and hand over cases.
- Record dispositions and audit events.
- Test urgent escalation and moderator unavailability.
- Verify expiry/deletion behavior.
- Confirm the user-facing acknowledgement does not imply a human has already reviewed the report.

**Go/no-go:** A named, trained, scheduled team; secure queue access; audit trail; escalation coverage; and a successful drill are all required. Until then, moderation operations are not ready.
