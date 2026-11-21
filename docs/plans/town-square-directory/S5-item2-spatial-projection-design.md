# S5 item 2 — reviewed-address spatial projection (design)

Status: design only, 2026-11-15. No code, schema or data was changed.
Builds on [item 4](S5-item4-source-binding-design.md) and the
[public contract](S5-public-contract.md). Goal and constraints are in
[HANDOFF-2026-11-15-ITEMS-2-3.md](HANDOFF-2026-11-15-ITEMS-2-3.md).

## 0. Findings that shape the design

- Bounds search today runs the ordinary listing SQL with the binding gate forced
  on, `LIMIT 5001`, throws above 5,000, then filters address validity and the box
  in JS before computing `hasMore`
  (`apps/directory/src/register-pending-runtime.ts:182-196`, `:216-217`).
- Three earlier attempts failed because they tried to make the index itself the
  authority (HANDOFF-2026-11-15-S5-PROGRESS.md:40). **This design does not.**
  The projection is a _candidate index only_. Every authorising check (binding
  state, lease, policy, scan and row withdrawal, completion, assignment token,
  adult choice, town) is still evaluated against the live tables in the same
  statement. Consequences:
  - a stale or extra projection row can never disclose anything (the joins
    reject it);
  - a missing projection row can only hide a listing; that is the single failure
    reconciliation and readiness have to detect.
- PostGIS is already in the Directory database
  (`apps/directory/src/entity.ts:27`, migration `1793815352610`), and TypeORM can
  generate a `geometry(Point,4326)` column and a spatial index, so the migration
  can be generated rather than hand-written.
- At most one non-retired binding exists per live row
  (`UQ_directory_reviewed_binding_live_row`, `entity.ts:309`), so a projection
  keyed by the live row is unambiguous.
- The address validity test is JS-only (`register-pending-runtime.ts:206-212`).
  To put validation before `LIMIT`, its verdict has to be stored, tied to the
  exact content it was computed on and to the validator's version.
- Directory returns `location` for every listing to the Gateway, which strips it
  unless an address is present (`apps/gateway/src/controllers/directory/directory.controller.ts:47`).
  That hop is unchanged and out of scope; noted for decision 9.

## 1. Projection shape

### 1.1 `directory_reviewed_spatial` (new entity `DirectoryReviewedSpatial`)

| Column                | Type                                 | Notes                                                                               |
| --------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| `scanId`              | varchar(64), PK                      | live row key                                                                        |
| `sourceFileRowNumber` | bigint, PK                           | live row key; keyset order                                                          |
| `bindingId`           | uuid, unique                         | the active binding this row was derived from                                        |
| `communityId`         | uuid                                 | copy of `binding.communityId`                                                       |
| `point`               | `geometry(Point,4326)`, **nullable** | the reviewed row's map point; `NULL` when the reviewed fields have no valid address |
| `listingDigest`       | varchar(32)                          | `md5(listing::text)` computed in SQL in the inserting statement                     |
| `validatorVersion`    | integer                              | `REVIEWED_SPATIAL_VALIDATOR_VERSION` at write time                                  |
| `createdAt`           | timestamptz                          | default `CURRENT_TIMESTAMP`                                                         |

Indexes:

- PK `(scanId, sourceFileRowNumber)` — keyset.
- `UQ_directory_reviewed_spatial_binding (bindingId)` — maintenance and drift probe.
- `IDX_directory_reviewed_spatial_town_keyset (communityId, scanId, sourceFileRowNumber)`
  — in-order town walk.
- `IDX_directory_reviewed_spatial_point` — `@Index({ spatial: true })` on
  `point`, generated as `USING GiST`.

No lease, state, policy or assignment column is copied: those change without a
content change and are read live.

### 1.2 `directory_reviewed_spatial_state` (singleton, `id='current'`)

`validatorVersion integer`, `rebuildStartedAt`, `rebuildCompletedAt` (nullable),
`reconciledAt`, `missing integer`, `stale integer`, `orphaned integer`.
Written only by the rebuild/reconcile command (section 2.3).

### 1.3 Which rows qualify

A projection row exists **iff** a binding is `active` and its live row exists in
the binding's town (`row.regionId = binding.communityId`). It is created only on
the confirm transition, by code that has just re-read the row. `pending`,
`suspended`, `retired`, `source_file` and `unknown_legacy` bindings never have a
row (the last two can never be `active`: `entity.ts:322`, revalidate `:330`).

`point` is non-null only when the shared validator accepts the row's `reviewed`
object _and_ its address (same rules as `register-pending-runtime.ts:206-212`).
An active binding with only a website or phone gets a row with `point IS NULL`.
This keeps "expected rows" computable in pure SQL (one per active binding) so
drift never depends on re-running JS.

A row is _served_ by bounds search only when all of these hold at query time:

1. `p.point` intersects the envelope, `p.validatorVersion` = current,
   `p.communityId` = town.
2. binding `b.id = p.bindingId`, same row key, `b.communityId` = town,
   `b.state='active' AND b."verifiedUntil" > now()` (item 4 predicate, runtime `:193`).
3. live row exists with `regionId` = town and `p.listingDigest = md5(r.listing::text)`.
4. membership → policy `revoked=false`, completion present, no scan revocation,
   no row revocation (runtime `:183-187`).
5. adult, category and search filters (runtime `:188`, `:190`, `:194`).
6. assignment: `r.listing->>'assignmentChangeToken'` **present and equal** to the
   town's current change token (stricter than `:189`; decision 2).

**Lease expiry is enforced at query time, not by projection removal.** It is
time-based; no writer runs at the instant of expiry, and the sweep extends
leases often, so copying `verifiedUntil` would add writes and a second source
of truth. Expired-lease rows stay in the table, unreachable, until the sweep
suspends or retires the binding (which deletes them).

## 2. Maintenance

New module `apps/directory/src/reviewed-spatial.ts`:

- `REVIEWED_SPATIAL_VALIDATOR_VERSION` and the pure function
  `mappableReviewed(listing)`, extracted from runtime `:197-212` and used by
  both `localListings` and the writers so they cannot diverge.
- `projectBinding(manager, binding)` — reads the live row, runs the validator,
  then one statement:
  `INSERT … SELECT …, md5(r.listing::text) FROM directory_overture_private_row r WHERE keys AND r."regionId"=$town AND r.listing=$seen::jsonb ON CONFLICT ("scanId","sourceFileRowNumber") DO UPDATE …`.
  The `listing=$seen::jsonb` guard (same idiom as
  `scripts/local-directory-withdraw-wrong-town.cjs:30`) means the stored verdict
  and digest always describe the same content. Zero rows inserted ⇒ throw, which
  aborts the transition.
- `unprojectBinding(manager, bindingId)` and `unprojectScan(manager, scanId)`.

### 2.1 Writers (all in the caller's existing transaction)

| #   | Writer                                                 | File:line                                               | Projection action                                                                                               |
| --- | ------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| W1  | confirm (pending→active, and every lease extension)    | `reviewed-binding-revalidate.ts:218-235`                | `projectBinding` after the binding CAS succeeds. Idempotent, so each sweep also repairs a missing or stale row. |
| W2  | suspend                                                | `reviewed-binding-revalidate.ts:236-250`                | `unprojectBinding`                                                                                              |
| W3  | retire (sweep, suspension timeout, stage invalidation) | `reviewed-binding-revalidate.ts:251-267`                | `unprojectBinding`, before the `reviewed` strip                                                                 |
| W4  | human revoke                                           | `address-review-store.ts:484-530`                       | `unprojectBinding` beside the retire at `:524`                                                                  |
| W5  | re-publication replaces a binding                      | `address-review-publish.ts:352-361`                     | `unprojectBinding(old.id)`; the new binding is `pending` and gets no row until W1                               |
| W6  | scan withdrawal                                        | `overture-private-sink.ts:140-141`                      | `unprojectScan` before the row delete                                                                           |
| W7  | policy withdrawal cleanup batch                        | `overture-private-sink.ts:~176`                         | delete projection rows for the batch keys in the same CTE transaction                                           |
| W8  | wrong-town withdrawal script                           | `scripts/local-directory-withdraw-wrong-town.cjs:25-30` | `unprojectBinding` for each withdrawn row                                                                       |
| W9  | legacy binding script                                  | `scripts/local-directory-reviewed-binding-legacy.cjs`   | none: `unknown_legacy` is never active; add an assertion that no projection row exists for them                 |

Not writers, by design (query-time only, section 1.3):

- **Policy revocation** (`overture-private-sink.ts:158`, `scripts/local-directory-overture-cutover.cjs:58`)
  — hidden immediately by the policy join; rows go when W7 or the sweep runs.
- **Row revocation** inserts — hidden by the `NOT EXISTS`; the sweep retires the
  binding (W3). Slice 3 must `rg` for every `INSERT INTO directory_overture_private_row_revocation`
  and confirm none needs more than this.
- **Town reassignment / Social change token** — hidden by rule 6. Nothing is
  rewritten; the projection never stores or re-keys an assignment token.
- **`attachReviewed`** (`overture-private-sink.ts:72`) — only runs inside a
  publication, which performs W5 first; the digest guard covers any other path.
- **Account-lifecycle erase** — the table holds source keys, a hash and a public
  business map point; no account, profile or reviewer identifier. It needs a
  `none(...)`/`source-data` disposition next to the binding's
  (`account-lifecycle-dispositions.ts:291-297`), or
  `account-lifecycle.test.js:24` fails. No erase writer is needed.

Lock order is unchanged: candidate → binding → policy → scan lock → row
(revalidate `:251`), with the projection row taken last.

### 2.2 Why missed deletes are safe and missed inserts are detectable

- Missed delete ⇒ extra row ⇒ rejected by rules 2–6 ⇒ no disclosure. Reported as
  `orphaned`.
- Missed insert ⇒ active binding without a row ⇒ listing absent from the map
  only. Counted as `missing` by a pure-SQL anti-join.
- Content changed under an active binding without W1 ⇒ digest mismatch ⇒ row
  hidden. Counted as `stale`.

### 2.3 Reconcile / rebuild command

`scripts/local-directory-reviewed-spatial-reconcile.cjs`, dry-run by default
(mirrors the sweep script's conventions):

- `--check` (default): read-only. Reports `missing`, `stale`, `orphaned`,
  `versionMismatch`, and `unreachableAssignment` (rows whose listing token is
  absent or not the town's current token — reported, never repaired).
- `--apply`: sets `rebuildCompletedAt=NULL`; then, in batches of 500 ordered by
  binding id, one transaction per batch: lock the binding
  `FOR UPDATE SKIP LOCKED`, re-check `state='active'`, call `projectBinding`;
  delete orphaned rows; finally write counts and `rebuildCompletedAt`,
  `validatorVersion`. Skipped (locked) bindings are retried; if any remain the
  run ends without setting `rebuildCompletedAt`.
- It never changes a binding, a listing, a lease or an assignment token, and
  never creates rows for non-active bindings. Historical publications
  (`unknown_legacy`, 48 rows) stay unprojected until re-reviewed.

### 2.4 Readiness (fail-closed)

`spatialHealth()` beside `bindingHealth()` (runtime `:67-70`), cached in process
for 30 s:

```
ready = state.validatorVersion == CURRENT
     && state.rebuildCompletedAt IS NOT NULL
     && missing == 0          -- active, current-lease bindings with no row of the current version
```

- Not ready, or the probe fails ⇒ every bounds request throws
  (`Spatial index unavailable` → 503 through the existing error path). An
  incomplete map is never returned as if complete.
- Non-bounds listing, detail and identity routes are unaffected.
- `/health/ready` adds `reviewedSpatial: { ready, missing, validatorVersion, rebuildCompletedAt }`
  next to `reviewedBindings` (runtime `:476-480`); overall `ready` is not failed
  by it (decision 4).
- `missing` cannot false-positive under concurrency: W1 commits the binding
  state and the row atomically.
- `stale` and `orphaned` need a full pass and are measured by `--check` and
  self-healed by each sweep's W1; they hide, never disclose.
- A validator version bump at deploy makes bounds return 503 until `--apply`
  completes. Acceptable while unreleased; documented in the operator page.

## 3. Query path

Only the bounds branch of `localListings` changes; `bounds` already requires
cursor mode and excludes detail (runtime `:174`).

```
SELECT r.listing, r."scanId", r."sourceFileRowNumber"
FROM directory_reviewed_spatial p
JOIN directory_reviewed_binding b ON b.id = p."bindingId" AND <rule 2>
JOIN directory_overture_private_row r ON <keys> AND r."regionId" = $town
JOIN membership / policy(revoked=false) / completion
WHERE p."communityId" = $town AND p."validatorVersion" = $v
  AND p.point && ST_MakeEnvelope($w,$s,$e,$n,4326)
  AND p."listingDigest" = md5(r.listing::text)
  AND <rules 4-6>
  AND ($cursor = '' OR (p."scanId", p."sourceFileRowNumber") > ($scan, $row::bigint))
ORDER BY p."scanId", p."sourceFileRowNumber"
LIMIT 26
```

- **Validation before `hasMore`.** Every filter, including address validity (via
  `point IS NOT NULL` implied by `&&`, the digest and the version), is in `WHERE`
  before `LIMIT 26`. `hasMore = rows.length > 25`.
- **JS becomes an assertion.** The 26 rows are run through `mappableReviewed` and
  the inclusive box test (`:216`). A failure is impossible unless code and
  version disagree, so it throws (503) and logs; it is never silently dropped,
  because dropping after `LIMIT` would make `hasMore` wrong.
- **Cap removed.** `LIMIT` is always 26 and the guard at `:196` becomes
  `rows.length > 26`. No candidate count is computed, returned or logged.
- **Cost bound.** The planner either uses GiST then sorts the in-box matches, or
  walks the town keyset index and filters by box. Both are bounded by the town's
  projected rows, not by all imported rows. The statement runs in a read-only
  transaction with `SET LOCAL statement_timeout='2s'`; a timeout is a 503, never
  a truncated page.
- **Cursor unchanged.** Format v1, position `{reviewed:false, scanId, row}`,
  query binding including canonical bounds and the change token
  (`local-listing-cursor.ts`, runtime `:180-181`, `:226`). No new cursor field.
- **Concurrency (non-snapshot, as S5-public-contract.md:11).**
  - Each page is one statement, so one MVCC snapshot: internally consistent.
  - Between pages: a binding suspended, retired, expired, or a row/scan/policy
    withdrawn disappears from later pages; a newly confirmed row ordered after
    the cursor appears; one ordered before it appears only on restart.
  - `hasMore=true` may be followed by an empty final page with
    `nextCursor=null` if the 26th row was withdrawn in between. That is
    permitted and tested.
  - The before/after change-token check and `authority()` calls
    (`:176-177`, `:223-225`) stay as they are.

## 4. Disclosure safety

- The only code path that writes a `point` is `projectBinding`, called from the
  confirm transition and the rebuild, both under a locked `active` binding, both
  after the validator accepted a reviewed address. No importer, cutover or
  candidate writer touches the table.
- Unreviewed rows therefore have no row and no indexed coordinate. Suspended,
  retired and replaced bindings have theirs deleted in the same transaction
  (W2–W5), so withdrawn coordinates do not linger in an index.
- The point is the same value the listing already serves once the address is
  reviewed; the projection adds no new datum.
- The bounds query never touches an unreviewed row: it starts from the
  projection and inner-joins the active binding. No count of candidates,
  examined rows or drift is in any public response; health counts are on the
  internal readiness endpoint only and count bindings, not locations.
- The removed 5,000 failure was itself a signal about candidate volume; it is
  gone. The timeout backstop depends only on reviewed rows.
- Extra rows cannot disclose (section 2.2). A schema test asserts
  `point IS NULL OR` the binding is active for every row after each lifecycle
  test.

## 5. Slices

Each slice ends green on its own tests. Nx commands use
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false`. Postgres tests use a dedicated
loopback PostGIS database `directory_spatial_test_*` via
`S5_SPATIAL_TEST_DATABASE_URL`, with the name guard copied from
`reviewed-binding-read.postgres.test.js:7-13`.

**Slice 1 — shared validator (no behaviour change).**
Files: new `apps/directory/src/reviewed-spatial.ts`; `register-pending-runtime.ts`
(`:197-212` call the extracted function); new `test/reviewed-spatial.test.js`.
Tests: table of accepted/rejected `reviewed` objects; existing
`test-reviewed-binding-read` and `test-local-listing-cursor-concurrency` still pass.

**Slice 2 — schema.**
Files: `apps/directory/src/entity.ts` (two entities, section 1), `data-source.ts`
(register), `account-lifecycle-dispositions.ts` (two `none(...)` entries),
generated `apps/directory/migrations/<timestamp>-DirectoryFoundation.ts` via
`nx run directory:typeorm:migration:generate` against a fresh disposable
database. Commit the generated timestamp as-is; review the SQL; strip unrelated
default churn only.
Entity sketch:

```ts
@Entity({ name: 'directory_reviewed_spatial' })
@Index('UQ_directory_reviewed_spatial_binding', ['bindingId'], { unique: true })
@Index('IDX_directory_reviewed_spatial_town_keyset', ['communityId', 'scanId', 'sourceFileRowNumber'])
export class DirectoryReviewedSpatial {
  @PrimaryColumn({ type: 'varchar', length: 64 }) scanId!: string;
  @PrimaryColumn('bigint') sourceFileRowNumber!: string;
  @Column('uuid') bindingId!: string;
  @Column('uuid') communityId!: string;
  @Index('IDX_directory_reviewed_spatial_point', { spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  point!: object | null;
  @Column({ type: 'varchar', length: 32 }) listingDigest!: string;
  @Column('integer') validatorVersion!: number;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
}
```

Tests: `test-reviewed-binding-schema` extended — migration applies from scratch,
`pg_indexes` shows a `gist` index on `point`, lifecycle inventory test passes.

**Slice 3 — writers W1–W9.**
Files: `reviewed-spatial.ts`, `reviewed-binding-revalidate.ts`,
`address-review-store.ts`, `address-review-publish.ts`, `overture-private-sink.ts`,
the two scripts. New `test/reviewed-spatial-lifecycle.postgres.test.js`:

1. confirm creates a row with a point; website-only binding gets `point NULL`.
2. lease extension is idempotent and repairs a deleted row.
3. suspend, retire (each cause), human revoke, re-publication: row gone in the
   same transaction (a forced failure after the delete rolls both back).
4. scan withdrawal and policy cleanup batches leave no rows for the scan.
5. `listing` changed between read and insert ⇒ transition aborts, no row.
6. pending, `source_file`, `unknown_legacy` never get a row.

**Slice 4 — reconcile and readiness.**
Files: new `scripts/local-directory-reviewed-spatial-reconcile.cjs`,
`register-pending-runtime.ts` (`spatialHealth`, health payload),
`docs/operators/directory-address-review.md`. New
`test/reviewed-spatial-reconcile.postgres.test.js`:

1. seeded drift (one missing, one stale, one orphaned) is counted by `--check`
   with no writes (table checksum unchanged).
2. `--apply` repairs all three and sets state; a second run is a no-op.
3. legacy/suspended bindings and superseded assignment tokens are reported and
   left untouched.
4. interrupted rebuild leaves `rebuildCompletedAt` null ⇒ not ready.
5. prove the check catches a known failure: delete one row ⇒ `ready=false`.

**Slice 5 — query switch and cap removal.**
Files: `register-pending-runtime.ts` (bounds branch, `:182-196`, `:216-217`),
`project.json` (`test-reviewed-spatial*` targets), `S5-public-contract.md`
(replace the 5,000 sentence at line 15). New
`test/reviewed-spatial-bounds.postgres.test.js`:

1. parity: for a 300-row mixed fixture, bounds pages equal the old JS-filtered
   result set, in order, each row exactly once.
2. `hasMore` after validation: 25 mappable + 40 active website-only + 500
   unreviewed in the box ⇒ one page, `hasMore=false`.
3. **cap regression:** 6,000 in-box reviewed rows paginate to exhaustion
   (240 pages), every row once, no error.
4. each exclusion: expired lease, suspended, pending, policy revoked, scan
   revoked, row revoked, wrong town, absent or old assignment token, adult,
   stale digest, old validator version.
5. not ready ⇒ bounds 503 while non-bounds listing still answers.
6. unreviewed rows inside the box never appear and changing their number does
   not change any response byte (compare serialized pages).

Concurrency, added to `local-listing-cursor.concurrent.postgres.test.js`:

7. between page 1 and 2: suspend one later row, retire one, revoke a row,
   expire a lease, confirm a new row after the cursor and one before it ⇒ later
   row present, earlier absent until restart, removed rows absent, no duplicate.
8. withdraw the 26th row after page 1 ⇒ page 2 empty, `nextCursor=null`.
9. interleaved: 20 concurrent readers paging while a writer loops
   confirm/suspend on 200 bindings for 5 s ⇒ no reader ever sees a listing whose
   binding was not active at some instant within that request, no duplicates
   within one traversal, no 500s (503 on timeout allowed, counted, expected 0).
10. reader blocked mid-transition: hold a confirm transaction open, read ⇒ row
    absent; commit, read ⇒ present.

Performance sanity (same file, `{ skip: !process.env.S5_SPATIAL_PERF }`):

11. 20 towns, 400,000 imported rows, 60,000 active reviewed (30,000 in one
    town), `ANALYZE`d. First page, a mid cursor and the last page of a 2°×2° box
    and of a 0.02° box: `EXPLAIN (ANALYZE, FORMAT JSON)` shows no `Seq Scan` on
    `directory_overture_private_row` or the projection; p95 of 50 runs each
    under 150 ms on the local database; full traversal of the dense town
    completes. Record the plans and timings in the progress handoff.

**Slice 6 — local stack.** Apply the migration, run `--check`, `--apply`,
`--check`; run the sweep dry-run; verify one live bounds request and readiness
payload; append evidence to HANDOFF-2026-11-15-S5-PROGRESS.md. No push or merge.

Order is mandatory: writers (3) and readiness (4) land before the query reads
the projection (5).

## 6. Owner decisions (conservative defaults)

1. **Projection is a candidate index; authority stays in live joins.**
   Default: yes. The alternative (self-authorising projection) is what could not
   be proven safe.
2. **Assignment token for bounds results.** Default: require the listing's
   token to be present and equal to the current town token; tokenless rows are
   not mappable and are never backfilled. This is stricter than the list route
   (`:189`), which is left unchanged.
3. **Lease expiry.** Default: query time only; no expiry job on the projection.
4. **Readiness.** Default: drift makes bounds fail closed (503) and is reported,
   but does not fail `/health/ready` for the whole service.
5. **Drift probe cache.** Default: 30 s in process. Shorter costs a binding scan
   per interval; longer delays fail-closed.
6. **Validator version bump.** Default: bounds unavailable until a completed
   `--apply`; no dual-version serving.
7. **`btree_gist` composite `(communityId, point)` index.** Default: no new
   extension; separate GiST and town keyset indexes. Revisit only if slice 5
   test 11 misses its budget.
8. **Statement timeout.** Default: 2 s, returns 503. Never a partial page.
9. **Directory→Gateway hop still carries `location` for unreviewed rows on the
   list route** (stripped at the Gateway). Default: out of scope here; raise as a
   separate hardening item rather than widen this change.
10. **Foreign key from the projection to the binding.** Default: none (the file
    uses no relations); the unique `bindingId`, the join and `orphaned` cover it.
11. **Scheduling.** The sweep is still run by hand, so W1 self-healing and
    lease extension depend on an operator. Default: unchanged here; scheduling
    stays a separate decision, and `--check` is added to the same runbook.
12. **Performance budget.** Default: p95 150 ms at 30,000 reviewed rows in one
    town on the local database, as a sanity check, not a production SLO.
