# UNKNOWN age-assurance decision

**Current state: self-attestation only. Public 18+ launch is blocked.**

The current `ageAttested` checkbox records that a visitor says they are 18 or older. It does not establish age, prevent a minor from entering, or constitute age verification.

## Decision

Do not treat a checkbox, date-of-birth field, or warning banner as sufficient age assurance for a public service restricted to adults.

Before public launch, the product owner and qualified India-focused counsel must decide:
- Whether UNKNOWN should be adults-only and what legal basis and obligations apply.
- Which proportionate age-assurance method is appropriate for the service's risk profile and current law.
- Whether an independent age-assurance provider is required and affordable.
- How to handle failed checks, appeals, accessibility, false positives, and users without supported documents.
- What evidence is retained, for how long, and how it is separated from chat/session data.

## Privacy and design requirements

Any selected approach must:
- Minimize collection and avoid retaining identity documents or full dates of birth unless counsel confirms necessity.
- Prefer a provider response or age-band/over-18 assertion over receiving raw identity documents.
- Use a provider with documented security, deletion, breach-response, and data-processing terms.
- Prevent bypass through direct API calls; enforcement must be server-side.
- Define retry limits, fraud controls, appeal handling, and a fail-closed behavior.
- Be tested for accessibility, accuracy, spoofing resistance, and data deletion.
- Be reviewed against current Indian law and any other markets before enabling those markets.

## No-budget constraint

A reliable third-party age-assurance service may have a cost. If the project cannot fund an appropriate solution, keep UNKNOWN private to controlled testing and do not open it to the public as an 18+ service. Do not invent an in-house identity check or claim the existing checkbox verifies age.

## Required sign-off

Record the chosen approach, provider (if any), data-flow diagram, retention schedule, legal review, test evidence, owner, and approval date here before launch. Until those fields are completed, status remains **BLOCKED**.
