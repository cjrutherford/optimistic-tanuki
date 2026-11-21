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

## S5 close-out (later on 2026-11-17)

All 12 S5 acceptance criteria now have code and test evidence. The status table is in [S5-public-contract.md](S5-public-contract.md), and example responses are in [S5-api-examples.md](S5-api-examples.md).

| Commit      | Content                                                                                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `7e5f86960` | Repairs stale recovery fixtures; the preflight now passes on the caller's budget reservation. The suite runs 0 failures.                                                                                              |
| `8491afacb` | Adds the `unconfigured` coverage state, the opaque `policyVersion`, the internal `exportEligible` and no-store everywhere. Adds evidence tests for cross-town replay, withheld rows, the scope matrix and link races. |
| `00476fd5e` | Adds reviewer listing suppression: table `directory_listing_suppression` (migration `1794937486351`), the gateway controller and an Owner Console page.                                                               |
| `48352138e` | Adds the examples doc and the golden contract spec, which was checked to fail on a renamed key. Gateway middleware now sets no-store before guards run, and the cursor-mode 400 message is fixed.                     |

**Deployment:**

- Backups: `.agent/backups/*-pre-s5close-20261117.dump`.
- Migration `1794937486351` is applied to both databases.
- Rollback images are tagged `:pre-s5close` for directory, directory-worker, gateway, local-hub and owner-console.
- Directory, gateway, local-hub and owner-console were rebuilt. The worker image did not change, because no file it is built from changed.
- The first parallel build failed on intermittent EAI_AGAIN errors during `pnpm install`. Building one image at a time worked.

**Live checks:**

- The listing returns `coverage` and `policyVersion`.
- The ineligible town returns `blocked`.
- The suppression routes return 401 with `no-store` when anonymous.
- The internal suppression list returns 200 empty.
- The Owner Console suppression page returns 200.
- An oversized cursor-mode bounds request returns 400 "Invalid bounds".

No suppressions were recorded.

**Still open, outside S5's code:**

- Publication is paused.
- The full account deletion with all 13 owners has not been exercised locally.
- The `empty`, `acquiring`, `partial`, `unknown` and `unconfigured` states have not been observed live.
- Public report intake belongs to S6.

Next stage: S6, the shared public UI in every town.
