# Handoff: truthful acquisition and coverage states (2026-11-17)

## What changed

Item 2 is committed as `62a7141cb` on `t3/integrate-business-directory`, and deployed on the local stack. Nothing is pushed.

- Listing responses carry `coverage: {state, reason?, withheldReviewedDetails}`. The states are available, empty, acquiring, partial, blocked and unknown (see `libs/social/contracts/src/lib/directory.ts`).
- Scans now record their target towns in `directory_town_scan_target`. Migration `1794930758234` adds the table.
- An ineligible town gets 200 with `blocked` / `town-ineligible`. Global authority failures still return 503.
- Local Hub describes each state. The city page shows a retryable error instead of hiding failures.

## Deployment

1. Dumped both databases to `.agent/backups/{ot_directory,ot_directory_census_stage}-pre-coverage-20261117.dump`.
2. Applied migration `1794930758234` to `ot_directory` and `ot_directory_census_stage`. Both now have 39 migrations.
3. Ran `scripts/local-directory-scan-target-backfill.cjs --apply --confirm-database ot_directory`. It inserted 148 targets (provenance `backfill-rows`) across 137 towns from 11 completed scans. A re-check shows 0 missing.
4. Tagged `:pre-coverage` on `optimistic-tanuki-directory`, `optimistic-tanuki-directory-worker`, `cjrutherford/optimistic_tanuki_gateway` and `cjrutherford/optimistic_tanuki_local-hub`.
5. Rebuilt those four images with the `ot-hostnet` builder and restarted the stack with `scripts/start-local-directory.sh`.

## Smoke checks (gateway at 127.0.0.1:3000)

- Town `615482e8-…` returns 200 with `no-store`: 25 listings, `coverage: {state: "available", withheldReviewedDetails: 1}`.
- Town `ec0cc2ad-…` returns 200 with listings.
- The nil-UUID town returns 200 with `{listings: [], coverage: {state: "blocked", reason: "town-ineligible"}}`.
- A malformed id returns 400 with `no-store`.
- Local Hub `/` and `/city/615482e8-…` return 200.
- Not exercised live: `empty`, `acquiring`, `partial` and `unknown`. No eligible town without a target was at hand, and no scans were started because there are no network calls. Unit tests and the Postgres tests cover these states.

## Rollback

Retag the `:pre-coverage` images as `:latest` and restart. To restore the data, run `pg_restore --clean` from the dumps. The new table is additive, so older images ignore it.

## Open owner decisions (defaults taken, revisable)

- An ineligible town answers 200 `blocked` rather than an error.
- There is no response cache.
- Withheld details are shown as a count only, with neutral wording.
- A "publication paused" state is not modelled.
- The POC and adult import scripts do not record scan targets yet, so their towns stay `unknown` until a backfill runs.
