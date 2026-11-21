# S3 pending-only boundary assessment — 2026-11-05

## Finding

A pending-only response can avoid the proposed cross-database authority protocol, but it is **not automatic directory onboarding**. The public gateway already asks Social for eligibility and returns only the requested UUID and `pending`, with `no-store`; it currently also requires a running Directory service. Social's eligibility query currently calls `withActiveDirectoryAuthority`, whose trusted epochs are unavailable, so that lookup also fails closed in the present implementation. It does not establish durable capture, and eligibility can change after any read. No geometry, listing, or provider result can be treated as authorized by this pending response.

The existing peer experiment cannot safely authorize ACK or a Social commit: loss of its Directory connection releases the advisory lock before the Social transaction necessarily completes. A final liveness query cannot close that interval. Delayed messages and lost commit replies also make receipt and cleanup outcomes ambiguous. Keep the experiment unwired and the startup and ACK guards closed.

## Simplest candidate boundary

A future small slice could make an eligible town's pending response depend only on a current, authenticated Social eligibility lookup, without requiring Directory availability. It would return no town metadata, boundary, listings, or provider status. An unavailable Social service would fail closed; HTTP responses must remain uncached. This gives a useful availability signal, not evidence that a town was captured, queued, geographically resolved, or will ever become ready. An eligibility change concurrent with the read can still make the response stale by the time it reaches the caller; it must not be used as an authorization token or durable proof. It does not satisfy S3's onboarding acceptance or establish a privacy-withdrawal delivery SLO.

A periodic census could separately populate a rebuildable private projection, with no destructive ACK and no dependence on a finite event outbox. However, ordinary paginated reads are not a point-in-time snapshot: inserts behind a cursor, delayed commits, privacy transitions between scans, process failure, and deletions require subsequent reconciliation. Such a projection cannot authorize public data or guarantee observation of every intermediate transition. Persisted stale rows must never drive public serving or provider work. A fresh Social read at a serving boundary narrows staleness but does not make a concurrent privacy change atomic with a response or external side effect.

## Consequences for operation and recovery

- Peer loss: the pending-only lookup may still work if Social is available; Directory-derived state and cleanup remain unavailable. No cross-store lock is claimed.
- Delayed notifications: a census can eventually repair current state after successful complete passes, but provides neither a bounded latency nor proof of intermediate changes. A durable event mechanism is needed for stronger guarantees.
- Independent restore or failover: local epochs and a scan cannot detect every rollback. Stop and drain all Social and Directory serving processes, workers, and direct writers under an external operator fence, then reconcile or rebuild from a coordinated source before enabling dependent work. Do not treat an old cached projection as authority.
- Social availability: current `lockCommunityDirectoryWrite` permits inactive mode only while no source authority row exists; active mode has no trusted runtime epochs. Thus an initialized or active installation can reject community mutations even with the optional directory unavailable. Do not remove this guard without an explicit capture/transition design: doing so could silently lose events or allow an old projection to survive privacy changes.

## Decision needed before implementation

Choose the desired guarantee for the next slice: (1) a Social-only **pending indication**, explicitly without onboarding, or (2) durable automatic onboarding with a specified operator fence, recovery procedure, retention/capacity policy and delivery/privacy guarantees. The latter requires more than a pending status and must preserve normal Social operation when the optional directory is unavailable. Neither option authorizes provider calls or public business data. The handoff calls for human-reviewable slices; this assessment changes no runtime behavior.

## Evidence and limits

Inspected `directory-peer-authority.ts`, `social-authority.ts`, `community-directory-outbox.ts`, `restore-fence.ts`, the gateway directory controller, and the S3 handoff and evidence notes. This is a source-level assessment only: no fresh database, Redis, race, restart, browser, or end-to-end test was run. Prior test results do not prove current runtime acceptance.
