# S10 normalize stage and run quality scorecard (D27, D28)

## Normalize stage (D27)

`apps/directory/src/normalize.ts` is the one place provider records are cleaned. It runs inside `projectStagedRow`
(`overture-stage-core.ts`), after acquisition and before matching, duplicate detection and publication, for Overture and
AllThePlaces. Geoapify details are cleaned by the same functions and stored beside the raw `details`.

- It normalizes names (display form and a match key), addresses (USPS abbreviations, unit, ZIP5, state; the key is the
  street only), phones (E.164, US), websites (lowercase host, tracking parameters stripped, non-http rejected), categories
  (directory taxonomy) and opening hours.
- Raw values are never replaced. The result sits in `listing.normalized` (`v`, `nameDisplay`, `nameKey`, `category`, and
  `absent | valid | invalid` per contact field). Contact values are stored only when the sink retains contact fields.
- It is pure and deterministic. `NORMALIZER_VERSION` (`normalize-v1`) is recorded per scan in
  `directory_scan_normalization`. Bump it when a rule changes, then backfill.
- Provider-specific cleanup that used to live in `alltheplaces.ts` (name key, category tables, address text) now lives here.
  The duplicate index matches on `nameMatchKey`.

### Re-normalizing without re-acquiring

`scripts/directory-renormalize.cjs` rewrites only `listing.normalized` on staged rows. It is idempotent, skips rows pinned by
a reviewed spatial digest, and never touches the published name or the projection version.

```
DIRECTORY_DATABASE_URL=... TS_NODE_PROJECT=apps/directory/tsconfig.json \
  node -r ts-node/register/transpile-only -r tsconfig-paths/register \
  scripts/directory-renormalize.cjs --dry-run            # report only
  scripts/directory-renormalize.cjs [--scan <id>] [--limit <n>]
```

## Run quality scorecard (D28)

After a town's jobs finish, `finishRunWithQuality` (`run-quality.ts`) scores the run's own staged rows and stores the result
on `directory_acquisition_run.quality`. Measures: completeness of name, address, phone, website, category and hours; invalid
address and phone rates after normalization; out-of-boundary rate (against the installed geometry); in-run duplicate rate.

A run past a limit finishes `failed_permanent` with `lastError` starting `quality_limit` and `failureReason: quality_limit`
in the runs API. Its scans are retired (`directory_town_scan_retirement`, rows revoked), so the refresh swap never serves
them and the town keeps its previous live scan.

Defaults come from live distributions on 2026-11-18 (207 towns with a live scan): out-of-boundary p50 0, p90 0, p99 0.43
(old-boundary leftovers); duplicates p50 0.003, p90 0.008, p99 0.020, max 0.045. Limits: names and categories at least 0.99,
out-of-boundary at most 0.05, duplicates at most 0.08, invalid address and phone at most 0.35, nothing judged under 25 rows.
Contact completeness minima are 0 (reported only) because live rows keep no contact values yet. Override with
`DIRECTORY_QUALITY_LIMITS` (JSON object of limit names; invalid values are ignored).

Operators see the scorecard on the Owner Console runs page. Metrics: `directory_runs_failed_quality{window="total|last24h"}`.
