# Remaining release work: local delivery sequence

The owner selected items 1, 2, 4 and 6 from the release status summary, in that order. Real external flows (item 3) and production release qualification (item 5) will be handled separately. Their evidence remains required for release claims, but does not prevent completing and testing the local implementation.

Use the existing account-rights implementation plan, master audit and execution map as the scope and acceptance authorities. Preserve the excluded Directory stubs and root configuration edits. Use existing shared UI; add reusable library components when existing controls cannot meet the need. Work in the current checkout with flat Luna delegation.

## 1. Account export and deletion

Current baseline: Authentication, Profile, Permissions, Social and Forum have locally verified **partial internal previews**. They are not a portable account export or deletion workflow.

Complete these deliverables:

1. Reconcile the ownership register across database and non-database stores. Give every store explicit account/profile/tenant ownership rules, counterpart preservation rules and an owning participant. Unknown ownership remains a blocker, rather than an empty-data success.
2. Add Authentication's durable operation ledger: account authorization, idempotency, serialized concurrent requests, fenced leases, retry after interruption and truthful coverage/status. Do not persist bearer credentials or partial exported content in the ledger. Existing previews remain compatible; incomplete coverage cannot unlock an artifact.
3. Finish owning-service export, deletion and independent readback adapters against that register. Preserve other people's contributions and conversation placeholders. Fence concurrent writes, revoke account sessions, and order key removal after media and dependent cleanup can recover safely.
4. Produce portable JSON and associated image/video bytes with bounded streaming, an artifact manifest, authorized access and expiry. Do not fetch arbitrary user-supplied URLs or call encrypted storage bytes a portable export.
5. Connect existing shared account/settings UI to real backend status, confirmation, download and retry behavior. Verify both products, authorization, counterpart preservation, injected failures, restart/retry and exact fixture cleanup.

The J1 durable job foundation, J2 Authentication DB-reader component, J3 staging/job integration, J4 current Profile reader and J5 legacy Profile adapters are locally verified. J5 includes the retained goal/project stores and Timeline links found during J4; the temporary legacy-data guard has been replaced. J6 now locally verifies secure same-snapshot identity transport and Profile job integration over real services, including restart recovery and cleanup. J7 adds a locally tested Assets consumer for all fenced identity pages; it is not wired to Assets capture. J8 locally verifies Assets table/byte capture against a private database and encrypted storage; Auth/Profile RPC is simulated. J9 now locally verifies Assets provider/transport/job integration through three selected real-service cases, including encrypted media and failure/retry. J10 now locally verifies the seven-table Videos DB component with five real PostgreSQL cases. J11 now locally verifies Videos transport/jobs and shared snapshot infrastructure over four real-service cases. J12 now locally verifies HLS capture and offline rewriting. Remaining owner coverage, durable portable files/downloads, deletion and shared controls remain. These components do not complete item 1. Deletion and downloads stay unavailable until their required coverage closes.

External provider, storage retention/versioning, backup and deployment evidence is separately owned. Record locally tested adapter behavior separately from those operational acceptance checks. DF-007 and RR-11 stay open while either implementation or required external evidence is missing.

## 2. Inactivity and activity-log retention

After the local account-rights implementation, finish seven-day rolling inactivity expiry with no absolute lifetime cap. Verify natural expiry, refresh/activity boundaries, revocation and cross-replica behavior.

Inventory every account-activity log sink and implement removal after 90 days with no retained-data exceptions. Test cutoff boundaries, retries, scheduling and independent readback. Document the required operator checks for external sinks, backups and actual execution; a source fix or scheduled task alone is not operational acceptance.

## 4. Integrated journeys, accessibility and reliability

Close the remaining local OT/Towne Square account switching, locality/membership/owner and buyer/seller journeys. Cover keyboard/focus/error announcements and shared lifecycle UI, plus upload retry, error recovery, deep links and realtime recovery. Use the primary client-interface, forgeofwill and business-site validation targets where affected; include Towne Square for its owned flows.

Keep real OAuth/email/invitation delivery and production provider/load qualification in their separately owned registers. Exercise the corresponding local failure contracts without describing mocks as external acceptance.

## 6. Claims, onboarding and launch materials

Reconcile every surviving public claim with accepted behavior. Complete first-session guidance, public policy text, screenshots/demos of verified workflows and the launch checklist. Use VERIFY, COMPLETE, REWORD, RETRACT or DEFER consistently. Do not advertise incomplete account rights or deferred reputation/federation capabilities.

Keep the launch decision separate from finishing local implementation. Link the externally owned checks and record the evidence still required from them.

## Verification and progress

At each implementation checkpoint, inspect the affected CI requirements, run the narrowest meaningful checks for the changed owners and then the relevant integration case. Do not repeat unchanged broad suites. Schema changes use the owning Nx migration-generation target and fresh-database migration checks.

Record command, source identity, actual execution/caching, results, skips and exact cleanup. Synchronize findings, the master audit and execution map at each verified milestone. A passing preview or compile does not close its larger deliverable.

J12 locally verifies bounded HLS playlist/segment capture and offline rewriting: nine private PostgreSQL/encrypted-storage cases and 38 focused tests passed, with affected pre-E2E gates and cleanup. See [J12 findings](../release-readiness/findings/DF-007-J12.md). Next: complete Permissions, Social, Forum and remaining owners, then encrypted artifacts/downloads; deletion and shared controls remain required. DF-007/RR-11 stay open.
