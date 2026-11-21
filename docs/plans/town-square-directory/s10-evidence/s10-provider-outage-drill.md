# S10 provider-outage drill

Run on 2026-11-19 against the local Docker deployment (`optimistic-tanuki` compose project, `directory` profile). It closes the ledger row "Provider-outage drill" and the runbook section 5 row "Provider outage or overspend", which until now said only that the kill switch was verified and that a real outage was not simulated. The scripts used print row counts, status codes and run states only; no secrets or personal data were printed.

## Method

No code change was needed to cause the outage. The worker reaches providers by fixed host name (Overture STAC, the Overture S3 bucket through DuckDB `httpfs`, the AllThePlaces archive host, Geoapify). A compose override (kept out of the repo, in the drill scratchpad) added `extra_hosts` to `directory-worker` pointing those five names at `127.0.0.1`:

```
stac.overturemaps.org
overturemaps-us-west-2.s3.amazonaws.com
overturemaps-us-west-2.s3.us-west-2.amazonaws.com
alltheplaces-data.openaddresses.io
api.geoapify.com
```

The result is a real network failure at the transport layer: connection refused, with no provider answering. Inside the container `fetch` to STAC failed with `ECONNREFUSED`, and DuckDB `read_parquet` on the S3 host failed with `Could not establish connection error for HTTP HEAD`. The directory API, the gateway, Local Hub and PostgreSQL were untouched, so the outage hit only the acquisition side. The worker was recreated with `up -d --no-deps --no-build directory-worker` to apply the override, and again without the override to end the outage.

A pre-drill backup was taken with `scripts/directory-backup.sh --databases ot_directory` (9 s). Neither DB rows nor the schema were edited by hand. Two towns were nudged with the documented operator step, "run this town now" (`POST /internal/acquisition/towns/<id>/run`, `confirm: "RUN"`), so that the outage hit real provider reads instead of waiting for the sweep to pick towns.

## Timeline (UTC)

| Time     | Event                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 12:29:05 | Backup taken, baseline snapshot started.                                                                                             |
| 12:30:23 | Outage starts: worker recreated with the override.                                                                                   |
| 12:30:37 | First sweep: AllThePlaces run for one town ends `failed_retryable`, `fetch failed`.                                                  |
| 12:33:16 | Operator "run this town now" for two towns (San Antonio `7d8239cb`, Boston `d33d391f`).                                              |
| 12:33:33 | Overture run for San Antonio ends `failed_retryable`, `Remote source HEAD mismatch: 502` (the classified DuckDB connection failure). |
| 12:34:58 | AllThePlaces run for Boston ends `failed_retryable`, `fetch failed`.                                                                 |
| 12:36:01 | Outage ends: worker recreated without the override.                                                                                  |
| 12:36:14 | AllThePlaces picks San Antonio up again (the container recreate lost the 3 GB archive cache, so the first run downloads it again).   |
| 12:41:29 | AllThePlaces San Antonio run `succeeded`: 2,644 observed, 882 accepted.                                                              |
| 12:43:47 | Operator "run this town now" again for San Antonio.                                                                                  |
| 12:48:52 | Overture San Antonio run `succeeded` after a real S3 read: 85,652 observed, 15,857 accepted. Recovery of both providers is proven.   |

## Observations

Snapshot script output, before, during and after. "Hash" is an md5 over the per-town listing identity counts.

| Measure                             | Before (12:30:18)                  | During (12:36:01, end of outage) | After AllThePlaces (12:41:36) |
| ----------------------------------- | ---------------------------------- | -------------------------------- | ----------------------------- |
| Towns / listing identities          | 264 / 13,248                       | 264 / 13,248                     | 264 / 13,248                  |
| Per-town identity hash              | `7a9ae34ddc0b41b60f7148e91fe606eb` | identical                        | identical                     |
| Budget attempts / reserved cents    | 1,324 / 1,324                      | 1,324 / 1,324                    | 1,324 / 1,324                 |
| Geoapify credits today              | 2,950                              | 2,950                            | 2,950                         |
| Runs `failed_retryable` (last 45 m) | 0                                  | AllThePlaces 2, Overture 1       | AllThePlaces 2, Overture 1    |

After the Overture San Antonio swap (12:48:58) San Antonio went from 618 to 632 identities and every other town's identity counts were unchanged (hash `2f2b40330147731395764eeda24029c9` over all other towns, same before and after the swap). Budget and credit counters did not move across the whole drill.

### Goal 1: serving continues from PostgreSQL

During the outage the public listing route through the gateway (`/api/directory/towns/<id>/local-evaluation-listings`) answered 200 with 25 listings for San Antonio and for Boston, Local Hub answered 200, the worker readiness answered 200 and `directory` stayed healthy. Serving never touches a provider, so nothing waited on the outage.

### Goal 2: acquisition fails safely

- Every failed run ended `failed_retryable` with `observedCount`, `acceptedCount` and `budgetReservedCents` all 0. No `failed_permanent`, no `partial`.
- The sweep stops at its first failure (`if (result.status === 'failed_retryable') break`), so an outage costs one town per sweep, not a burst. The log showed `acquisition sweep: ok examined=1 succeeded=0 ... failed=1`.
- Listing identity counts per town did not change while the providers were unreachable, so no partial refresh was swapped in and no town lost listings.
- The provider budget ledger (`directory_provider_budget_attempt`) and the Geoapify credit ledger (`directory_provider_credit_attempt`) had the same row counts and sums before, during and after.
- Geoapify itself could not be exercised live: its 3,000 daily credits were already used up (`budget_blocked`), so its sweep never reached the network. Reading `geoapify-enrichment.ts`, a credit is reserved before the call and is not refunded when the call fails; the loop breaks on the first failure, so an outage costs at most one credit per sweep. That is conservative by design (the provider may have counted a request that timed out) and was left alone.

### Goal 3: the failure is visible

- Run ledger: `directory_acquisition_run` holds each failed run with `status='failed_retryable'` and a `lastError`; the Operations page and the run list read from it.
- `directory_provider_status` carried the Geoapify state; `acquisition sweep` log lines showed `failed=1`.
- **Gap found.** The Operations metrics (`/internal/ops/metrics`, Prometheus form) had no signal for retryable run failures. `directory_runs_failed_quality` counts only `failed_permanent` runs, and the queue gauges cover export, taxonomy and withdrawal jobs. During the outage every metric looked normal. See Fix below.

### Goal 4: recovery

No operator action was needed for AllThePlaces: once the override was gone, the next sweep picked San Antonio up, re-downloaded the archive and the run succeeded 5 minutes later (12:41:29). The exponential backoff on `failed_retryable` runs delayed the other two failed towns, which is the intended behaviour; a manual "run this town now" bypasses the backoff, and that single operator step was enough to get the Overture San Antonio run through a real S3 read (12:48:52).

## Fix: retryable failures in the Operations metrics

`apps/directory/src/ops-metrics.ts` now counts runs with `status='failed_retryable'` in the existing `runQuality` section and exposes `directory_runs_retryable_failures{window="last1h"|"last24h"}`. The contract (`libs/social/contracts/src/lib/directory.ts`) gets two optional fields, so older consumers are unaffected. `apps/directory/test/ops-routes.test.js` has a new test for the Prometheus output; `node --test` on that file passes (6 of 6) and `tsc --noEmit -p apps/directory/tsconfig.json` is clean. The query was also run read-only against the live database (3 in the last hour, 21 in the last 24 h; the older ones are `Worker interrupted` runs from earlier restarts). The live `directory` image was not rebuilt, so the metric is not on the running stack yet; the run ledger was the live evidence for goal 3.

## Not fixed

- Fixed afterwards: the San Antonio listing 503 (see "San Antonio listing 503" below). The metric above is deployed and `directory_runs_retryable_failures` is live on the ops metrics route.
- The per-run effect of recreating the worker: the AllThePlaces snapshot cache (`/tmp/directory-atp`) lives in the container, so the first run after a recreate downloads the 3 GB archive again.

## San Antonio listing 503

Cause, from `EXPLAIN (ANALYZE, BUFFERS)` of the real listing statement (read-only, San Antonio and its live change token): the served-row join was planned from default statistics. The small control tables (`directory_overture_private_revocation` is empty and was never analyzed, so autovacuum never touches it) made the planner assume every scan is revoked and estimate one served row for the town. It then chose nested loops against 631 completion rows and 638 membership rows (21.6 M and 11.5 M join-filter rejections) and the read took 6.3 s, over the 2 s bound. `ANALYZE` on the row table could not help, because the bad estimate came from the other tables. With those tables analyzed the join is memoized index lookups and execution drops to 0.37 s, but the plan cost was then high enough to trigger JIT, which added 0.84 s of compilation, 1.2 s in total. Retired scans are not the problem: San Antonio holds 34,336 rows, 17.6 k of them revoked by the swap, and each is rejected by a primary-key probe (about 2 microseconds).

Fix: `apps/directory/src/planner-statistics.ts` analyzes the served-row control tables when the API starts; the API pool sets `jit=off`; `directory_overture_private_row` gets an index on `regionId` (generated migration `1795092881826-DirectoryServedRowRegionIndex`). Live after deploy: San Antonio answered 200 on five consecutive requests at 0.20 to 0.27 s (was 503 at 2.01 s). The five other largest towns answered 200 at 0.08 to 0.95 s (Boston, 87 k rows, the slowest).

## Restore

The worker was recreated without the override (`ExtraHosts` empty, image unchanged). At 12:43 it was `Up (healthy)`, `directory`, `ot_gateway` and `town-square-directory-db` were up, and the geometry and duplicate sweeps were running. The pre-drill backup remains in the drill scratchpad.
