# S10 retention-task failure drill

Run on 2026-11-19 against the local Docker deployment (`optimistic-tanuki` compose project, `directory` profile). It closes the ledger row "Retention-task failure drill" and the runbook section 5 row "Retention task failure". The drill found a real gap (a failed file delete was silent and the file was kept forever), which is fixed and re-drilled below.

## Tasks covered

| Retention task                                                                                                                                                                                          | Drilled live?                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export artifact retention: `sweep` in `export-job.ts` (expires `complete` jobs past `expiresAt`, deletes the file of every expired, withdrawn or revoked job). Runs every 5 s in the directory process. | Yes, twice (before and after the fix).                                                                                                                                                                                           |
| Geoapify enrichment retention: `runGeoapifyRetention`, first step of each Geoapify sweep in the worker. One atomic `DELETE ... RETURNING` statement.                                                    | No. None of the 3,000 stored rows is due (earliest `expiresAt` is 2026-12-19), and making one due would mean editing rows by hand. Fail-safe by construction: a single statement is all or nothing. Not claimed as live-drilled. |
| Queue job retention (Redis, `DIRECTORY_QUEUE_RETENTION_MS`) and account-deletion snapshot purge                                                                                                         | No (they need Redis and the Authentication runner; out of this drill).                                                                                                                                                           |

## Method

No code change was needed to cause the failure. The services connect as the `postgres` superuser, so a `REVOKE` on the table would not bite. Instead the export directory (`/var/lib/directory/exports`, named volume `optimistic-tanuki_directory_exports`, owned by `node`) was made read-only for its owner: `chmod 555` from inside the directory container. Removing a file needs write permission on the directory, so every `unlink` fails with `EACCES`, which is what a read-only or full volume looks like to the sweep. The original mode was recorded first (`755`, `node:node`) and restored with `chmod 755` afterwards.

To make a retention window pass in minutes, a compose override kept in the drill scratchpad (not in the repo) set the existing knob `DIRECTORY_EXPORT_RETENTION_HOURS=0.03` (108 s) on the directory service. It was removed at the end and the service recreated with the original `24`.

A real export was produced through the documented operator route (`POST /internal/exports`, release `2026-10-21.0`): 372,176 rows, 328.8 MB. A pre-drill backup was taken with `scripts/directory-backup.sh --databases ot_directory`. No row was edited or deleted by hand.

## Run 1: before the fix (UTC)

| Time     | Event                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 13:00:51 | Backup taken.                                                                                                                   |
| 13:01:00 | Directory recreated with the 108 s retention override.                                                                          |
| 13:01:56 | Export `e4af8481` complete, file on the volume, `expiresAt` 13:03:44.                                                           |
| 13:02:11 | Directory made read-only (`555`).                                                                                               |
| 13:03:51 | Job is `expired` and `artifactName` is NULL, but the file `e4af8481....jsonl` is still on the volume. Logs show nothing useful. |
| 13:04:31 | Mode restored to `755`. The file stays: nothing will ever delete it.                                                            |

**Gap found.** `removeFile` swallowed every error, and the sweep then cleared `artifactName` unconditionally. Its own comment said "the sweep retries while artifactName is set", but the name was cleared even though the file was not deleted. After a failed delete the artifact was orphaned: data past its retention window stayed on disk with no job row pointing to it and no signal anywhere. The same pattern existed in the revoke and withdrawal paths (withdrawal is a rights obligation). In addition a throwing sweep would have stopped the same pass from claiming queued export jobs, and the worker log only says `diagnostic.rejected` (logs are payload-free by design), so there was no operator signal at all.

## Fix

- `export-job.ts`: `removeFile` treats only `ENOENT` as gone. `removeExportFiles` returns the names that are really gone, and the sweep, revoke and withdrawal paths clear `artifactName` only for those. A file that could not be deleted keeps its name, so the next sweep (5 s) retries it.
- The sweep finishes its whole list, then throws `Export sweep could not delete N artifact file(s)`. `runExportPass` runs the queued jobs first and then rethrows, so a failed sweep never starves job processing.
- New `removeOrphanArtifacts` pass: a final-named file in the export directory whose job is `expired`, `withdrawn` or `revoked` and no longer names it is deleted (files of queued, running, complete or unknown jobs are never touched). It heals orphans like the one left by run 1.
- Visibility: `ops-metrics.ts` and the contract add `exportRetention` and two Prometheus gauges: `directory_export_artifacts_pending_deletion` and `directory_export_artifact_oldest_pending_deletion_seconds`. They count artifacts past retention whose file is not yet deleted, and are zero in a healthy system.
- Tests: `apps/directory/test/export-retention-failure.postgres.test.js` (read-only directory: sweep fails, due job keeps its name and file, unexpired job and file untouched, queued job still runs, metric reports 1, orphan kept; after the permission returns both files are deleted and the metric is 0) and a Prometheus case in `ops-routes.test.js`. They pass, as do `exports.postgres`, `export-rights-public.postgres`, `export-job` and `ops-routes` tests. The `ops.postgres` suite could not be judged: the shared template DB is one migration behind (it fails on the latest migration name, unrelated to this change).

## Run 2: after the fix (UTC)

The directory image was rebuilt and redeployed at 13:08:01. The orphan from run 1 was deleted at startup (the volume was empty at 13:08:31), which shows the healing pass works on real data.

| Time     | Event                                                                                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13:08:37 | Export `2647a3f0` requested.                                                                                                                                                     |
| 13:09:05 | Complete (`expiresAt` 13:10:43). Directory made read-only (`555`).                                                                                                               |
| 13:10:46 | Job turns `expired`. The file cannot be deleted.                                                                                                                                 |
| 13:11:17 | Job is `expired` and still names its file; the file is on disk; ops metrics show `exportRetention: {pendingDeletion: 1, oldestPendingSeconds: 31}`. `directory` stays `healthy`. |
| 13:11:52 | Cause removed: mode restored to `755`.                                                                                                                                           |
| 13:12:00 | File gone, `artifactName` NULL, metric `pendingDeletion: 0` (within 8 s, the 5 s sweep interval).                                                                                |
| 13:12:30 | Directory recreated without the override (`DIRECTORY_EXPORT_RETENTION_HOURS=24`, mode `755`), healthy.                                                                           |

## Results

1. **Fail-safe.** The failure deleted nothing it should keep and left no partial state. The job was marked `expired` (a status change that is correct: the artifact is unservable from that moment, downloads return 410) and the file stayed whole, still named by its row. Other loops kept running: `directory` stayed healthy, the API served, and the failed sweep does not block queued jobs (test). Run 1 showed the failure mode this fix removes: a file kept with no row.
2. **Visible.** Operations metrics (`/internal/ops/metrics` and the Prometheus form) now show `directory_export_artifacts_pending_deletion` above zero and its age, and the job row stays `expired` with `artifactName` set, which is the DB-level signal. The log line is deliberately payload-free (`diagnostic.rejected`), so it is not the signal. The gateway Operations route proxies the same metrics; only the directory-internal route was read in this drill.
3. **Self-recovery.** No operator step: 8 seconds after the permission came back the next sweep deleted the file, cleared the name and the metric returned to 0.
4. **Nothing left behind.** After both runs the export volume was empty and no job in `expired`, `withdrawn` or `revoked` held an artifact name. The healing pass removed the run 1 orphan with no hand deletion.

## Not covered

- Geoapify enrichment retention and queue or snapshot retention were not failed live (see Tasks covered).
- A held table lock on `directory_export_job` was not drilled: the sweep would wait on the lock rather than fail, and the metrics query would wait with it (its section times out and is listed in `errors`).
- The deployed image differs from the committed source only by an added log argument that was reverted before commit (the logger rejects free text anyway).

## Restore

`chmod 755` on the export volume (original mode), the compose override removed and the directory service recreated with `DIRECTORY_EXPORT_RETENTION_HOURS=24`. `directory`, `directory-worker`, `ot_gateway` and the DB are healthy, and the San Antonio listing route returns 200 in 0.28 s. The pre-drill backup remains in the drill scratchpad.
