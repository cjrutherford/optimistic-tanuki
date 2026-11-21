# S5 item 3: source freshness provenance (design)

Status: design only, 2026-11-16. Builds on item 4 (source binding, live) and item 2 (reviewed spatial projection, live). Nothing here is implemented.

## 0. What the code does today

- `directory_overture_private_completion` is one column, `scanId` (`apps/directory/src/entity.ts:192-195`). `complete()` inserts that row and nothing else (`apps/directory/src/overture-private-sink.ts:121-130`). The cutover copies the same bare row into the live DB (`scripts/local-directory-overture-cutover.cjs:56`). No date of any kind exists for a scan.
- The release id the extractor knows is **not read from upstream**. It comes from the checked-in inventory JSON (`docs/plans/town-square-directory/S4a1-overture-2026-10-21-metadata.json`, loaded at `scripts/local-directory-overture-stage.cjs:~16`). The extractor only checks that the object key matches `/release/<id>/theme=places/type=place/*.parquet` and that the inventory carries an `etag` and a `lastModified` string (`scripts/overture-private-extractor.mjs:84`). Those `lastModified` values are a copy made earlier; this run never observed them.
- The only code that talks to upstream is the range proxy. Every request is `If-Match: "<etag>"`; it rejects any response whose status is not 200/206 or whose `ETag` differs (`scripts/overture-range-proxy.mjs:35-39`), and it forwards `last-modified` and `content-range` to DuckDB (line 50) but records nothing.
- The scan id hashes inventory, item, object URL, etag and policy hashes (`overture-private-extractor.mjs:87`; the cutover recomputes the same id at `overture-cutover.cjs:~29`), so the live scan id equals the stage scan id for the October cohort.
- Reviewed bindings carry `scanId` plus `stageScanId` / `stageInstallationId` (`entity.ts:327-335`). The stage-scan "newer scan" lookup joins completion and policy but has no timestamp (`apps/directory/src/reviewed-binding-revalidate.ts:123-132`).
- Readiness exposes `reviewedBindings` and `reviewedSpatial` only (`apps/directory/src/register-pending-runtime.ts:67-78, 524-536`); the local listings response is `{listings, hasMore, nextCursor}` (`register-pending-runtime.ts:278-279`). `S5-public-contract.md:23,25` lists "explicit source freshness" and "stale" states as open.

Consequence: a date can only be trusted if it is captured at the proxy, from a response that already passed the `If-Match`/ETag check, and stored beside the scan.

## 1. Evidence model

One new immutable table, `directory_overture_source_evidence` (entity `DirectoryOvertureSourceEvidence`, `entity.ts`), one row per scan, in **both** the stage DB and the live DB (same migration, same schema; verify in slice 1 that the stage DB is migrated from the Directory migrations, since `OverturePrivateSink` runs against it).

| column                 | type             | meaning                                                                                                                         |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `scanId`               | varchar(64) PK   | same id in stage and live (cutover keeps the id). No FK: stage completion may be rolled back, evidence follows it (see below).  |
| `evidenceVersion`      | int              | 1                                                                                                                               |
| `kind`                 | varchar(24)      | `captured` (recorded by the extractor) or `attached_verified` (section 4)                                                       |
| `releaseId`            | varchar(32)      | `YYYY-MM-DD.N`, parsed from the object key of the verified asset. Label only.                                                   |
| `artifactUrl`          | text             | exact object URL the proxy fetched                                                                                              |
| `artifactEtag`         | varchar(100)     | ETag from the response, equal to the pinned etag                                                                                |
| `artifactBytes`        | bigint null      | total from `Content-Range`                                                                                                      |
| `upstreamLastModified` | timestamptz null | `Last-Modified` header of the verified response. Null if absent or unparseable. **The only age clock.**                         |
| `observedAt`           | timestamptz null | extractor host clock at the first verified response; null for `attached_verified`                                               |
| `recordedAt`           | timestamptz      | DB `now()` in the recording transaction (the trusted clock)                                                                     |
| `recorder`             | varchar(160)     | e.g. `extractor:overture-private-extractor.mjs@<sha256-12>` or `attach:local-directory-source-freshness-attach.cjs@<sha256-12>` |
| `inventorySha256`      | varchar(64)      | pins which inventory listed this asset                                                                                          |
| `evidenceSha256`       | varchar(64)      | sha256 of the canonical JSON of every column above except itself and `recordedAt`                                               |

Constraints (entity `@Check`, so the generated migration carries them): `kind IN ('captured','attached_verified')`; `releaseId ~ '^\d{4}-\d{2}-\d{2}\.\d+$'`; `upstreamLastModified <= recordedAt`; `observedAt IS NULL OR observedAt <= recordedAt + interval '5 minutes'`; `kind='captured' OR observedAt IS NULL`.

Content hash. In remote mode the extractor never holds the bytes (the local-snapshot hash at `overture-private-extractor.mjs:99` is for `sourceMode==='local'` only), so there is no honest body hash. The binding to content is the ETag plus the self-hash `evidenceSha256`; docs must not call it a content hash. A body hash would require a second full download and is out of scope (decision 5).

Immutability. Entities cannot declare triggers and migrations are generated only (memory: TypeORM migrations must be generated), so immutability is by construction: the only writer is `OverturePrivateSink.recordEvidence`/`complete` using `INSERT ... ON CONFLICT ("scanId") DO NOTHING`, followed by a read-back that throws if the existing row's `evidenceSha256` differs (a re-run produces a conflict error, never an overwrite). No `UPDATE` exists in code (a source test greps for it). Readers recompute `evidenceSha256` and treat a mismatch as `unknown`. Rows are deleted only where completion is deleted (`overture-private-sink.ts:144,182`), in the same transaction, so a purged scan leaves no orphan evidence.

Stage and live. The extractor writes to the stage DB. The cutover (`overture-cutover.cjs:56`) reads the stage row, verifies `evidenceSha256`, and inserts it into the live DB inside the existing `lr` transaction beside the completion insert. A bad hash aborts nothing: the scan is copied without evidence and is `unknown` (decision 6 offers aborting instead). Reviewed bindings need no new column: freshness is resolved by `binding.scanId` against live evidence. For `provenance` other than legacy, `scanId = stageScanId`; the sweep/report additionally compares live evidence hash to the stage row and reports a mismatch (report-only, never a retire cause).

## 2. Capture path

1. `scripts/overture-range-proxy.mjs`: after the status/ETag acceptance at line 39, on the first accepted response call an optional `onVerified({asset, etag, lastModified: header, contentRangeTotal, at: Date.now()})` and expose `proxy.evidence()` returning the first captured object or `null`. Only accepted responses (200 HEAD or 206 GET with matching ETag, within the `If-Match` envelope) count; 412/502/short responses never do.
2. `scripts/overture-private-extractor.mjs`: just before `await sink.complete()` (line 156) read `proxy.evidence()`. Build the record with `releaseId` parsed from the same validated URL path used at line 84, `inventorySha256` from the inventory, `recorder` from the script hash. Pass it as `sink.complete(evidence)`.
3. `apps/directory/src/overture-private-sink.ts` `complete()` (line 121): in the same transaction as the completion insert (line 128) insert the evidence row. Both commit or neither, so a completion either has evidence or provably has none.
4. No evidence is ever synthesised. If the proxy captured nothing (resumed run whose remaining range needed no request is impossible, but a local-mode scan or a header-less response is possible), if `Last-Modified` is absent/unparseable, or if validation fails, the extractor passes `null` and the scan completes exactly as today with no evidence row, or with `upstreamLastModified = NULL` when only the date is missing. The log says `source evidence unavailable`.
5. Resumed scans: a resumed run opens a new proxy and captures anew; `observedAt` therefore reflects the run that completed the scan. `recordedAt` is the trusted completion time.
6. Cross-check (record, do not repair): if the date in `releaseId` and `upstreamLastModified` differ by more than 14 days, store `upstreamLastModified = NULL`. A contradictory header is treated as no evidence, not as a value to average.
7. Not used as evidence anywhere: file mtimes, the checked-in inventory's `lastModified`, dates parsed from the scan id, inventory JSON file timestamps, or `createdAt` of rows.

Stage scripts (`local-directory-overture-stage.cjs`, `...-census-stage.cjs`) call `extractPrivate` unchanged; they only need the new proxy/sink plumbing. The cutover change is section 1.

## 3. Freshness states

Inputs per scan: `upstreamLastModified` (U), `recordedAt` (R), now (N). Computed at read time, **never stored**, so no sweep or migration is needed as time passes.

| state     | rule                                                                           |
| --------- | ------------------------------------------------------------------------------ |
| `unknown` | no evidence row, hash mismatch, `U` null, or `U` in the future relative to `N` |
| `fresh`   | `N - U < 90 days`                                                              |
| `due`     | `90 days <= N - U <= 120 days`                                                 |
| `stale`   | `N - U > 120 days`                                                             |

Why `U` and not `R`: acquisition time says when we copied, not how old the data is. Pulling a year-old release today would read `fresh`. The upstream timestamp is the only date the upstream itself asserted over the verified channel. `R` and `releaseId` are shown (acquired-at, release label) but never decide the state. The 90/120 targets are constants in one module; boundaries are exact (day 90 is `due`, day 120 is `due`, day 120 + 1 ms is `stale`).

Aggregation. Scan state to cohort state is worst-wins in the order `unknown` > `stale` > `due` > `fresh`: unknown dominates because an unproven scan must not be reported as fresh. Town state aggregates the completed, non-revoked live scans that have at least one non-withdrawn row in that town (cached 60 s).

Exposure (all additive, label-only):

- Readiness `/health/ready` (`register-pending-runtime.ts:524-536`): `sourceFreshness {fresh, due, stale, unknown, oldestPublishedAt, evaluatedAt}` counted over completed live scans with active policy. Best-effort like `reviewedBindings`; never changes `ok` or the 200/503.
- Local-evaluation listing and bounds pages: top-level `sourceFreshness {state, releaseId, sourcePublishedAt, acquiredAt, thresholds}` for the town, beside `hasMore`/`nextCursor` (`register-pending-runtime.ts:278-279`). `releaseId`/dates are the worst scan's; null when `unknown`. Optional field in the shared `social-contracts` type, so older gateway/Local Hub builds ignore it. Local Hub shows a label ("Data from release 2026-10-21, due for refresh" / "freshness unknown"); no page is hidden or emptied.
- Operator report `scripts/local-directory-source-freshness-report.cjs` (read-only; same style as `local-directory-address-review-queue-report.cjs`): per scan release, `U`, `R`, age days, state, evidence hash match, stage/live hash match, bindings per state; `--fail-on due|stale|unknown` for a non-zero exit.

Label-only by default. Hiding reviewed fields at `stale` would blank towns for an upstream cadence outside our control and conflicts with item 4's lease being the sole gate. Argument for revisiting: only if the owner wants staleness to be a rights/accuracy claim (decision 3).

Interaction with item 4: the binding lease (`verifiedUntil`) and sweep are untouched; stale never suspends or retires a binding. The sweep report gains a freshness column by `scanId`. The "newer scan" selection in `reviewed-binding-revalidate.ts:123` stays presence-based; the report may show the newer scan's release but it is not a retire cause. Interaction with item 2: the projection tables and `validatorVersion` are unchanged, because freshness is neither a candidate predicate nor a spatial attribute; bounds pages carry the same page-level label as non-bounds pages, and the 503-on-drift behaviour is unaffected.

## 4. Historical scans

The 16 October scans, the revoked September cohort and every scan from before this change have no evidence row and stay `unknown`. No backfill job, no inference from scan id, inventory JSON or file times.

Later attachment is allowed only from a verifiable artifact, via a manual script `scripts/local-directory-source-freshness-attach.cjs` (`--check` default; `--apply --confirm-database <db>`):

1. Recompute the scan id from inventory + policy exactly as `overture-private-extractor.mjs:87` does; refuse unless it matches an existing completed scan.
2. Issue one anonymous `HEAD` with `If-Match` on the pinned ETag, through the same budget reservation the stage scripts use (`reserveAttempt`, `provider-budget`). The response must be 200 with the same ETag; take `Last-Modified` from that live response. A 412 means the object was replaced: attach nothing.
3. Insert `kind='attached_verified'`, `observedAt = NULL`, `recordedAt = now()`, recorder = the attach script. Acquisition time stays unknown, honestly.
4. Compare to the checked-in inventory `lastModified`; a mismatch is reported and nothing is written.
   This is a network action, run only by the owner at a time of their choosing (decision 4). Without it, history stays `unknown` forever, which is acceptable.

## 5. Slices (each independently testable, disposable DBs only)

1. **Entity and migration.** Add `DirectoryOvertureSourceEvidence` + checks and register it in `entity.ts` and `data-source.ts`. Generate with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run directory:typeorm:migration:generate` (`apps/directory/project.json:386`); review SQL; fresh-DB up/down/up; `pnpm run validate:typeorm-migrations`. Test `apps/directory/test/source-evidence-schema.postgres.test.js` (new target `test-source-evidence-schema`, `DIRECTORY_TEST_DATABASE_URL`): checks reject bad release id, future `upstreamLastModified`, bad kind; PK blocks a second row; stage-vs-live table identical.
2. **Pure freshness module** `apps/directory/src/source-freshness.ts` (+ spec): state function, worst-wins aggregation, hash verify. Unit test (no DB): day 89/90/120/120+1ms, null, future, mismatched hash, unknown dominates.
3. **Proxy capture.** `overture-range-proxy.mjs` `onVerified`/`evidence()`. Unit test with a stub `upstream`: 206 + ETag match captures; 412, 502, wrong ETag, missing `Last-Modified` capture nothing or a null date; second response does not overwrite.
4. **Extractor and sink.** `overture-private-extractor.mjs` passes evidence; `overture-private-sink.ts` writes it atomically in `complete()`. Extend `apps/directory/test/overture-private-sink.postgres.test.js` (`test-overture-private-sink`, `OVERTURE_TEST_DISPOSABLE=yes`, `OVERTURE_TEST_DATABASE_URL`): completion+evidence commit together; injected insert failure rolls both back; missing evidence completes with no row; re-run with different evidence throws and does not overwrite; scan purge deletes the row; source grep finds no `UPDATE ... source_evidence`.
5. **Cutover copy.** `overture-cutover.cjs` copies and verifies. Disposable stage+live pair: evidence copied equal; tampered hash copied as no-evidence; absent stays absent.
6. **Read surfaces.** Readiness counts, page-level `sourceFreshness` on local listings and bounds, shared contract type, report script. Runtime tests (extend `test-reviewed-binding-read` and `test-reviewed-spatial-bounds` DBs): page has the label, results unchanged between `fresh` and `stale` fixtures, readiness stays 200 with all states, no unreviewed town leaks a release.
7. **Attach script + live apply (owner-run).** Tests with an injected `upstream` stub: matching ETag attaches; 412/ETag change refuses; inventory mismatch refuses; `--check` writes nothing. Then local apply of the migration (backup first, as for item 2), report shows 16 `unknown`.
8. **Docs.** Replace `S5-public-contract.md:23,25` freshness lines with the shipped label contract; add a progress entry.

Verify before any push: affected Nx tests, Directory typecheck and build, migration validator (memory: push only after local e2e).

## 6. Owner decisions (conservative defaults)

1. **Age clock = `Last-Modified` from the wire-verified, ETag-matched upstream response.** Default: yes, tagged as "upstream object timestamp", not as a release publication date. If declined, every scan stays `unknown` and only release id and acquisition time are shown; the feature then carries no freshness claim.
2. **State driven by publication age, not acquisition age.** Default: publication age; acquisition time displayed only.
3. **Stale is label-only.** Default: no hiding, no binding retirement, no readiness failure. Any gating is a later, explicit decision.
4. **Historical attach.** Default: not run; history stays `unknown`. If run, owner-run with budget reservation per section 4.
5. **No body hash.** Default: ETag plus evidence self-hash only; a full re-download for a content hash is declined.
6. **Cutover with bad or missing evidence.** Default: proceed, scan is `unknown`. Alternative: abort the cutover.
7. **Town aggregation is worst-wins, unknown dominates.** Default yes.
8. **14-day release-id vs `Last-Modified` disagreement discards the date.** Default yes.
9. **Thresholds 90/120 days** are constants in `source-freshness.ts`, not environment-configurable. Default yes, to avoid drift between readiness and labels.
10. **Scheduling.** Default: the report is a manual operator command like the binding sweep (item 4 decision 10); no cron.
