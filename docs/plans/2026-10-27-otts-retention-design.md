# OT/TS retention — R2-01 through R2-03

Scope is Optimistic Tanuki (`client-interface`), Towne Square (`local-hub`)
and their required shared services. Existing slice IDs and the 13-slice local
release denominator remain in place until acceptance.

R2-01 makes the shared Auth database authoritative for seven days of inactivity.
OT/TS session JWTs remain signed, app-bound and tied to revocable token rows;
new ones have no absolute JWT lifetime. Existing scoped tokens can transition
only while their signed issuance time is within the idle window; migration
must not mark old sessions active today. A nullable last-activity column provides
that safe bootstrap. The exact seven-day boundary is expired. Authentication
checks account/profile row binding, current account deletion fences and the DB
clock before activity can advance. Internal owner/job validation and server
pushes check validity without refreshing it. Successfully authenticated inbound
HTTP requests, socket connections and client commands count as activity. A
cookie's seven-day age is renewed on eligible HTTP activity; bearer credentials
use the same authoritative idle rule. Other products keep their current expiry.

R2-02 uses a shared bounded runner for the declared N04 database audit/history
sinks in Profile, Assets, Social and Forum. It captures one UTC cutoff, removes
rows at or before 90 days, runs at startup and on a timer, retries failures, and
reports independent remaining-row counts rather than claiming success after a
DELETE alone. Already-redacted history is subject to the same age limit. No
forwarded collectors or retained legacy/manual OT/TS logs exist per the user's
confirmed local inventory; payload-free diagnostics and browser-managed copies
must retain their explicit dispositions. Future OTEL/Grafana remains docs only.

R2-03 verifies retention cannot bypass a permanent deletion fence, extend an
idle session through background jobs, or restore removed rows. A blocked
retention batch is a retriable failure, not a retained-data exception. Deletion
continues independently and public status must never report completion from a
retention result alone. Session status uses the authoritative idle expiry.
Private PostgreSQL/real-process checks cover exact cutoffs, replicas, restart,
revocation, cleanup failure/retry and deletion precedence. External provider,
backup and deployment execution remains X evidence.

## Accepted local result — 2026-10-27

R2-01–R2-03 are locally verified. The final inventory adds Authentication’s
guardian notice history and terminal export-job history to the nine original
audit/history sources: eleven sources, five owners. Artifact custody must be
clear before terminal history pruning. Active operations and permanent
deidentified fence markers retain their explicit operational roles.

Real session and audit PostgreSQL boundary tests, current builds/lint, bounded
source review and the coupled twelve-owner replica/browser/deletion run passed.
The final run is `.runtime-artifacts/account-rights/deletion/d27-live-4dfe9347992b`;
it includes seven post-deletion sweepers and late activity denial across Auth
replicas. See the R2 findings/receipts and operator retention notes. Ten local
release slices remain, beginning R4-01; X01–X04 remain separate.
