# OT/TS retention

Scope: Optimistic Tanuki (`client-interface`), Towne Square (`local-hub`) and
these applications’ required shared services. No other product enters this
release’s acceptance count.

## Sessions

Authentication’s database clock enforces seven days since session activity.
The exact seven-day boundary is expired. Active sessions have no absolute
lifetime cap; revocation, deletion fences and current identity binding still
apply. New OT/TS JWTs omit an absolute expiry. A signature alone never grants
access: the stored, unrevoked session and its inactivity window are required.

The nullable `token.lastActivityAt` migration does not reactivate existing
sessions. Until first eligible activity, a legacy row uses the verified JWT’s
issuance time. An old session without recent persisted activity is denied.
An expired legacy JWT can pass only when its signed scope is OT/TS and the
same authoritative inactivity check succeeds.

Authenticated inbound HTTP requests and socket client actions advance activity.
Internal export/capture validation, job polling over internal RPC and outgoing
socket broadcasts do not. Cookie sessions receive seven-day cookies on eligible
HTTP activity. The shared browser helper also renews through `/session` after
trusted input, at most hourly; it has no idle heartbeat timer. Bearer sessions
use the same database rule. Other applications keep their previous lifetime.

Apply Authentication migrations before starting the updated services. Use the
owning Nx migration target and validate the migration inventory. Never backfill
`lastActivityAt` with deployment time.

## Activity and operational history

The [inventory](../release-readiness/evidence/df-007/r2-retention-inventory.json)
records every reconciled source. The shared runner starts at service startup,
then polls at sixty seconds when clear, one second with a backlog and five
seconds after failure. Each source batch is limited to 200 rows. Database cutoffs
retain microsecond precision and treat `createdAt`/`viewedAt` at or before ninety
days as due. Timestamp-without-zone columns are interpreted as UTC.

Profile, Assets, Social, Forum and Authentication use their registered entity
metadata. Deidentified shared audit history also ages out; deidentification is
not a retention exemption. Locked rows are skipped and remain visible in
readback. Failed sources remain blocked and retry. No deletion-operation context
is invented to bypass a permanent fence.

Terminal OT/TS export-job history uses `completedAt`, then `updatedAt`, then
`createdAt`. Batches contain at most 25 rows. The artifact retention sweep prunes
history only after private artifact custody is clear and no live lease remains.
Malformed descriptors or cleanup intent keep the row and make overdue history
visible as pending. Active queued/running jobs are operational work, rather than
terminal activity history. Artifact expiry and account deletion remain separate
cleanup triggers.

The internal `ActivityRetentionStatusService` reads all five owners and export
history afresh. An unavailable owner or invalid readback blocks verification;
nonempty overdue history is pending. This is an internal operational seam, not
a new public admin screen or erasure authority.

## Deletion and topology

Deletion’s permanent account/profile fences take precedence over session or
retention windows. Retention never recreates rows, renews deletion leases or
restores identities. The real twelve-owner deletion protocol still owns immediate
account cleanup and finalization. No one waits ninety days to erase an account.
All replicas use the same owning databases; each may run the bounded sweeper.
Database locks and independent readback coordinate concurrent passes.

The operator confirmed no retained legacy/manual OT/TS logs and no forwarded
capture destination. Current application/browser diagnostic boundaries are
payload-free. These declarations do not qualify another deployment or a future
collector. Before enabling one, follow the [OpenTelemetry/Grafana setup](./ot-ts-observability.md)
and add its cleanup/readback contract. No collector is installed by this work.

The local evidence does not qualify external providers, backups, live S3,
offline devices, production load or deployment topology. Those remain separately
owned external acceptance.
