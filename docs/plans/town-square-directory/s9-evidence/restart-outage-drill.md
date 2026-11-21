# S9 restart, outage and migration drills

Run on 2026-11-17 against the local Docker deployment (`optimistic-tanuki` compose project, `directory` profile). Transcripts below are copied from the drill output. The script prints row counts and HTTP status codes only; it prints no secrets or personal data.

## Fresh install and upgrade (scratch databases)

Both runs used throwaway databases (`s9_scratch_*`), which were dropped afterwards.

```
fresh: 47 migrations in 1.053993810s
pre-upgrade head: DirectoryFoundation1794951718340 rows=45
upgrade: 2 migrations in .774082734s
s9_scratch_fresh head: 47 DirectoryOperatingControls1794971660195
s9_scratch_upgrade head: 47 DirectoryOperatingControls1794971660195
No changes in database schema were found - cannot generate a migration.
```

The upgrade source was the pre-S8 live backup, restored into scratch. After both runs, `migration:generate` found no drift from the entities.

## Live restart and outage drill, first run

Before the worker readiness fix:

```
## baseline
261 towns, 1688 identities, 4 export jobs, 0 open exports, 5 withdrawals, 1224 budget attempts, 1224 reserved cents, 6 control events, 47 migrations
directory ready=200 worker ready=200
redis: directory DIRECTORY_REDIS_URL set, worker set, worker mode register-pending-v1
## 1. restart directory API
restart returned after 0.3s
ready after 1.2s more
state unchanged
## 2. restart directory worker
restart returned after 0.3s
ready after 10.1s more
state unchanged
## 3. PostgreSQL outage (30 s)
during outage: directory live=200 ready=503; worker live=200 ready=200
database down for 32.6s
postgres accepting after 1.1s
directory ready after 0.1s (from db accepting)
worker ready after 0.1s (from directory ready)
container restarts during outage: directory 0, worker 0
state unchanged
```

**Finding.** During the database outage the worker still reported ready. Its readiness only checked for a complete sweep within the last 120 s, so an outage shorter than that window went unseen.

**Fix (e1f94afef).** `/health/ready` now also needs a `SELECT 1` that completes within 2 s. A unit test covers three cases: the probe fails, the probe hangs, and the probe is skipped when the sweep state is already unready.

## PostgreSQL outage drill, rerun after the fix

```
## baseline
261 towns, 1688 identities, 4 export jobs, 0 open exports, 5 withdrawals, 1224 budget attempts, 1224 reserved cents, 6 control events, 47 migrations
directory ready=200 worker ready=200
## 3. PostgreSQL outage (30 s)
during outage: directory live=200 ready=503; worker live=200 ready=503
database down for 34.6s
postgres accepting after 1.2s
directory ready after 1.2s (from db accepting)
worker ready after 0.1s (from directory ready)
container restarts during outage: directory 0, worker 0
state unchanged
```

"State unchanged" means every row count in the baseline matched afterwards. That includes export jobs, withdrawals, budget attempts and control events, so nothing was duplicated, lost or falsely completed.

## Redis

The live worker runs in `DIRECTORY_WORKER_MODE=register-pending-v1`. In `apps/directory-worker/src/main.ts`, that mode returns into `runRegisterWorker` before it reads `DIRECTORY_REDIS_URL`. The register runtime opens no Redis connection.

Both containers still have `DIRECTORY_REDIS_URL` set, for the legacy v1 queue path. That path is fenced by `restore-fence.ts`. Restarting Redis or losing it therefore has no effect on the live runtime, so no Redis drill was run.

Queue isolation for the legacy path is still covered by `DIRECTORY_QUEUE_PREFIX` and the ACL workload in `S1-acl-workload.md`. Its suites (`queue.test.js`, `redis-recovery.test.js`) need disposable Redis URLs (`DIRECTORY_TEST_REDIS_URL*`) and were not rerun here.
