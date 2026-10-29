# J21 — Notification recipient and provenance

J20 is locally accepted at `a3a3bc5e9d896dd5426a9b95cb3c9dc246ccbaf6`. J21 closes public notification forgery and limits what a recipient can see when historical rows have no trustworthy provenance. It does not capture Notification for export; J23/J24 settle that boundary.

## Decisions

Reject authenticated public notification creation, including creation for oneself. Keep the internal Social producer command at the existing trusted TCP boundary. HTTP list/count/read-all and mutations require the signed selected profile to still belong to the authenticated account. A route cannot select another profile. Notification subscriptions and delivery also check current ownership; existing session-revocation checks remain.

Project all stored rows through shared deterministic templates. Emit only notification ID, recipient profile ID, known type, generic title/body, read state and creation time. Drop historical sender/resource references, arbitrary text, URLs and unknown properties. Unknown historical types become generic system notifications. Without a provenance column, even a syntactically valid resource UUID does not authorize a deep link. New notifications store template text, not caller-provided content. No schema change or historical rewrite is required.

Performance notifications target the actual owner-console profile UUID. Preserve one email per account, even when that account has several eligible profiles. Never reinterpret an account UUID as a profile destination.

## Ownership and checks

One Luna worker owns Social notification service and shared contract projection/tests. A second owns Gateway HTTP policy, recipient proof, notification socket checks and performance recipients. Root owns private real-service E2E, the existing RR04 fixture adaptation and documentation. No nested delegation or worktrees. Preserve the 43 excluded Directory/root Compose/tsconfig files.

Run narrow Nx tests and affected production build/lint gates before private runtime. The private fixture must show allowed self reads/mutations, rejected public forgery and foreign access, stale signed-profile denial, safe legacy projection, real internal producer creation, authenticated notification room isolation and cleanup. Record test counts, configured bounds versus exercised expiry, source/image provenance and zero private resources.

## Explicit limits

The shared notification UI still uses a stale raw WebSocket transport, and normal Social producers do not have proven push wiring. J21 does not establish browser realtime delivery. Keep those gaps explicit in the feature documentation and remaining-work register; do not infer delivery from source or a direct server broadcast test. No new UI component is needed. Downloads, full Social capture and deletion remain later slices. External flows and production qualification stay outside this local loop.

## Local result

Locally verified at the bounded runtime scope: 68 focused tests, owning production gates and one real-service API/Socket.IO case passed, with seven zero database cleanup readbacks and zero private resources. See the [finding](../release-readiness/findings/DF-007-J21.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-j21.json) for exact proof and limits. Browser notification transport remains DEFER. J22 follows.
