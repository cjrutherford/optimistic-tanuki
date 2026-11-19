# S9 operations runbook: Town Square business directory

This runbook covers deploy, upgrade, rollback, backup and restore, operating controls, metrics and recovery for the directory services:

- `directory`, the API on :3120;
- `directory-worker`, on :3121;
- `directory-migrate`;
- the gateway and Owner Console routes that front them;
- the `town-square-directory-db` PostgreSQL/PostGIS container.

**Scope.** Everything here was verified on the local Docker deployment only. No production environment, credentials or ACL exist yet. See [Gaps](#gaps-and-deferrals).

Evidence:

- [restart and outage drill](s9-evidence/restart-outage-drill.md)
- [backup and restore drill](s9-evidence/backup-restore-drill.md)
- [live operations evidence](s9-evidence/s9-live-outcome.json), with screenshots `s9-evidence/s9-0*.jpg`

## Conventions

- Put pnpm on the PATH: `export PATH=$HOME/.local/share/pnpm:$PATH`.
- Run Nx with the daemon and plugin isolation off: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx ...`.
- Compose prefix for every command below: `docker compose -p optimistic-tanuki --profile directory --env-file .env.directory.local`, written `$DC`.
- Never print `.env.directory.local`. To use its values, source it in a subshell: `( set -a; . ./.env.directory.local; set +a; ... )`.

## 1. Deploy or upgrade

1. **Back up.** Run `scripts/directory-backup.sh`, which writes to `~/.cache/optimistic-tanuki/directory-backups/<ts>/`. See §3.
2. **Tag rollback images** for each service you will rebuild:

   ```
   docker tag optimistic-tanuki-<svc>:latest optimistic-tanuki-<svc>:pre-<slice>
   ```

   The services are `directory`, `directory-worker`, `gateway` and `owner-console`.

3. **Build one service at a time.** Parallel builds time out against the npm registry. Retry a timeout as it is:

   ```
   for s in directory directory-worker gateway owner-console; do
     BUILDX_CONFIG=/tmp/ot-buildx BUILDX_BUILDER=ot-hostnet $DC build "$s"
   done
   ```

4. **Migrate:** `$DC run --rm --no-deps directory-migrate`. Migrations are generated from entities, never hand-written. After migrating, `migration:generate` must report "No changes in database schema".
5. **Start:** `$DC up -d --no-deps --no-build --force-recreate directory directory-worker gateway owner-console`.
6. **Verify.** Check that:
   - `/health/ready` returns 200 on both services;
   - Owner Console → Directory → Operations shows the expected migration head;
   - the Operations page shows no "Sections that failed to collect".

Measured timings:

| Step                                     | Measured               |
| ---------------------------------------- | ---------------------- |
| Fresh database, all 47 migrations        | 1.05 s                 |
| Upgrade from the pre-S8 backup (45 → 47) | 0.77 s                 |
| Directory API, from restart to ready     | 0.3 s restart + 1.2 s  |
| Worker, from restart to ready            | 0.3 s restart + 10.1 s |

**Rollback.**

1. Re-tag `:pre-<slice>` as `:latest`, then run step 5.
2. If a migration must be undone, restore the pre-deploy backup instead of running `migration:revert` on live data. Follow §3.

Rollback tags currently exist up to `:pre-s9`; the worker also has `:pre-s9-probe`.

## 2. Operating controls

There is one global row per control in `directory_operating_control`. Each change is versioned and recorded in `directory_operating_control_event`, with actor, reason and time.

Change controls from the Owner Console Operations page, or through the gateway:

- `POST /directory/operations/controls/:key`, body `{ paused, reason, expectedVersion }`;
- the caller needs the `directory.operate` permission;
- the actor is taken from the session, and a body that supplies `actorId` gets 400;
- a stale `expectedVersion` gets 409 `stale_version`.

| Key                    | Pausing it                                                                                                                                                                                                            | Resuming it                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `provider_acquisition` | The **provider kill switch**. Budget reservation and anonymous Overture attempts refuse after taking the advisory lock, so no paid call starts. New runs fail with `provider_paused`, and a paused run cannot resume. | New runs are allowed; resume blocked runs explicitly.                            |
| `export_worker`        | `runExportPass` claims nothing. Jobs stay `queued`, and the queue age shows in metrics.                                                                                                                               | The backlog drains on the next pass. In the live drill, 2 jobs drained in 2.7 s. |
| `taxonomy_worker`      | `runTaxonomyBatch` does nothing.                                                                                                                                                                                      | Work continues from where it stopped.                                            |

**Withdrawals cannot be paused**, and there is no `withdrawal_worker` key (requests for it get 404). A withdrawal always runs to completion.

**Resume.** Controls are global and stored in the database, so a restart of any service keeps the paused state. Nothing resumes on a timer: an operator resumes. "Automatic resume" in the plan is met because the API and worker reconnect to PostgreSQL by themselves after an outage (§5). Resuming a control is a separate operator action.

## 3. Backup and restore

**Backup.** Run `scripts/directory-backup.sh [--out DIR]`. It produces:

- `pg_dump -Fc` of `ot_directory` and `ot_directory_census_stage`, both taken from one exported REPEATABLE READ snapshot, so evidence and outbox rows are consistent with each other;
- a tar of the export volume;
- `manifest.json`, with a sha256 for each file, row counts and the migration head.

The script refuses an output path inside the repository.

**Restore.** Run `scripts/directory-restore.sh <dir> --target-db NAME [--replace] [--live]`. It:

- verifies checksums first;
- validates the database name;
- refuses a live database name unless `--live` is passed and the directory containers are stopped;
- prints the fence requirement.

The legacy v1 path is fenced by `restore-fence.ts`.

**Verify.** Run `node scripts/directory-restore-verify.cjs`. It compares row counts and the migration head with the manifest, checks the sha256 of complete export artifacts, and checks budget ledger totals and receipt, slot and export-job invariants.

**Drill results.** Backup took 6.8 s and restore 4 s. Verification passed for all 58 tables.

## 4. Metrics

Endpoints:

- Gateway: `GET /directory/operations/metrics`, and `/metrics/prometheus` for 41 gauges. Both need `directory.operate` and send `Cache-Control: no-store`. Anonymous requests get 401 (verified live).
- Directory internal: `GET /internal/ops/metrics`, bearer-authenticated, not exposed publicly.

Each section collects independently with a 3.5 s timeout. A section that fails is listed under `errors`; the rest still return.

| Section        | What it distinguishes                                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| infrastructure | Infrastructure readiness: database reachable, PostGIS present, migration count and head, export storage configured.                                                                          |
| towns          | Onboarded towns (status `onboarded`) against the total, by status.                                                                                                                           |
| coverage       | Acquired coverage: towns with at least one published listing, and published listing count.                                                                                                   |
| freshness      | Stale data. Listings due for refresh (over 90 days), stale (over 120 days), and **unknown**: listings with no upstream `lastModified` evidence. Unknown listings are never counted as fresh. |
| policy         | Blocked policy: active and revoked policies, open rights and taxonomy cases. `publicationPaused` means no active policy exists; it is not the S5 census publication hold.                    |
| spend          | Monthly reservations against the $25.00 limit (`MONTHLY_LIMIT_CENTS`), plus `alert` and `exhausted` flags.                                                                                   |
| queues         | For export, taxonomy and withdrawal: queued, running, failed in the last 24 h, and age of the oldest queued job.                                                                             |
| controls       | Paused state, reason and version for each control.                                                                                                                                           |

**Cost alert.** `DIRECTORY_SPEND_ALERT_CENTS` takes an integer from 1 to 2500 and defaults to 2000 (80%). When reservations reach it, the Operations page shows an alert and the `directory_spend_alert` gauge reads 1. When the limit is used up, reservation refuses: the budget is enforced, not only reported.

**Last live reading (2026-11-17):**

- 261 towns, 0 onboarded (all `pending`);
- 69 towns with listings, 1,688 published listings, all with unknown freshness;
- 10 active and 4 revoked policies;
- 6 open rights cases and 1 open taxonomy case;
- $12.24 of $25.00 reserved, no alert.

## 5. Failure behaviour and recovery

| Failure                      | Behaviour                                                                                                                                                                                 | Measured or verified                                                                                                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL down              | Both services stay live (`/health/live` 200) and report ready 503. Neither crashes or restarts; both reconnect on their own.                                                              | Down 34.6 s. Ready again 1.2 s after PostgreSQL accepted connections. 0 restarts, no state change.                                                                                                                     |
| API or worker restart        | Job and ledger state lives in PostgreSQL, so a restart duplicates nothing and loses nothing.                                                                                              | Row counts identical before and after.                                                                                                                                                                                 |
| Redis down                   | Not used by the live `register-pending-v1` runtime.                                                                                                                                       | Code path checked; see the drill notes.                                                                                                                                                                                |
| Provider outage or overspend | Pause `provider_acquisition`. Published listings keep being served from the last published projection in PostgreSQL. Acquisition adds to that projection but is never needed to serve it. | Kill switch verified live. Real outage drilled 2026-11-19: runs ended `failed_retryable`, nothing swapped in, ledgers unmoved, recovery without intervention ([S10 drill](s10-evidence/s10-provider-outage-drill.md)). |
| Export backlog               | Jobs stay `queued` and the oldest-age gauge rises. Resuming drains them.                                                                                                                  | 2 jobs held 14 s; drained in 2.7 s after resume.                                                                                                                                                                       |
| Retention task failure       | Not drilled.                                                                                                                                                                              | Gap.                                                                                                                                                                                                                   |

**Recovery timeline for a database outage:**

| Time       | Event                             |
| ---------- | --------------------------------- |
| T0         | PostgreSQL stops.                 |
| T0 + 5 s   | Both readiness probes report 503. |
| T + 34.6 s | PostgreSQL starts.                |
| + 1.2 s    | PostgreSQL accepts connections.   |
| + 1.2 s    | Directory API is ready.           |
| + 0.1 s    | Worker is ready.                  |

No operator action was needed.

## 6. Service levels against approved targets

| Target (DECISIONS-2026-11-07)                                          | Status                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Daily town reconciliation                                              | The worker sweep runs every 60 s. Daily reconciliation is not yet measured end to end.                                         |
| 99% of eligible changes queued within 24 h                             | Not measured: no change feed has run against live data.                                                                        |
| Refresh at least every 90 days; stale after 120 days                   | The thresholds are implemented in metrics. 1,688 listings are "unknown" because no upstream freshness evidence was captured.   |
| Withdrawn information off public surfaces within 24 h, alert if missed | Withdrawals cannot be paused. The queue age is exposed, but no alert rule is wired to an alerting system.                      |
| Pending onboarding within 15 min                                       | One isolated observation: 46.2 s.                                                                                              |
| $25/month across all providers and retries                             | Enforced by reservation. $12.24 reserved this period. Reservations are estimates: there is no provider invoice reconciliation. |

**Capacity.** The deployment holds 261 towns and 1,688 listings in two databases, with dumps of 35.8 MB and 25.3 MB. Backup takes 6.8 s and restore 4 s. Nothing here is near a resource limit on a single host. Capacity for a broad rollout has not been reviewed.

## 7. Security

- Provider and service secrets live only in server-side env (`.env.directory.local`) and never reach the browser.
- Acquisition errors pass through `redactError` before they are stored or logged. It replaces URLs, file paths, IP addresses, host names and any token of 24 or more characters, and caps the message at 200 characters.
- Metrics and controls are restricted to `directory.operate` and never cached.
- The legacy queue is namespaced by `DIRECTORY_QUEUE_PREFIX` with a Redis ACL (S1).

## Gaps and deferrals

- No production environment, credentials, ACL or TLS. Everything above is local Docker.
- Provider prices are estimates. There is no invoice reconciliation.
- Retention task failure was not drilled (the provider outage was, see the S10 drill). The San Antonio listing 503 after a large Overture load was a planner problem (never-analyzed empty control tables, then JIT), fixed by analyzing them at API start, `jit=off` on the API pool and a `regionId` index; see the S10 provider outage drill. Legacy Redis suites were not rerun, because they need disposable Redis.
- Backups are not encrypted, and there is no off-host copy.
- A restore does not rotate the source epoch.
- `shellcheck` has not been run on the scripts.
- Metrics are pull-only, with no external alerting, so the cost alert and the withdrawal-latency alert appear only on the Operations page.
- 0 towns are onboarded, because all geometry is pending.
- All 1,688 listings lack freshness evidence.
- Publication is on for the local stack (owner decision D9, 2026-11-18; [evidence](s10-evidence/s10-d9-publication.json)). There is no runtime switch for it: public surfaces serve while an active private policy exists, and the withdrawal path is policy revocation. Production release remains a separate gate.
