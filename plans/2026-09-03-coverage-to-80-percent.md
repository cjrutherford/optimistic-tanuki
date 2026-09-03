# Workspace coverage to 80% — baseline and plan

Goal: line coverage >= 80% across the workspace.

## Measured baseline (2026-09-03)

Method: `nx run-many -t test -c ci` (Jest `json-summary` reporter), aggregated
over every `coverage/**/coverage-summary.json` with a non-zero line total.

| Metric                                    | Value                        |
| ----------------------------------------- | ---------------------------- |
| Aggregate line coverage                   | **72.05%** (36,439 / 50,578) |
| Projects measured                         | 96                           |
| Projects below 80%                        | 39                           |
| Covered lines needed to reach 80% overall | **4,024**                    |

Caveat: the baseline is a snapshot taken while this branch's first tranche of
tests was landing, so a handful of projects already reflect new tests. It is
accurate to well within the margin that matters for prioritisation.

## The important finding

The aggregate gap is _not_ spread across all 112 projects. **13 projects carry
it.** Bringing just these to 80% moves the workspace past 80% overall:

| #   | Project                | Now    | Lines needed | Running aggregate |
| --- | ---------------------- | ------ | ------------ | ----------------- |
| 1   | apps/client-interface  | 46.14% | 760          | 73.55%            |
| 2   | apps/owner-console     | 63.47% | 619          | 74.77%            |
| 3   | apps/social            | 59.59% | 447          | 75.66%            |
| 4   | apps/local-hub         | 63.88% | 395          | 76.44%            |
| 5   | apps/gateway           | 72.88% | 373          | 77.17%            |
| 6   | apps/finance           | 63.00% | 283          | 77.73%            |
| 7   | apps/leads-app         | 62.44% | 247          | 78.22%            |
| 8   | libs/blogging-ui       | 58.98% | 220          | 78.66%            |
| 9   | libs/finance-ui        | 48.14% | 181          | 79.01%            |
| 10  | libs/compose-lib       | 32.16% | 151          | 79.31%            |
| 11  | apps/fin-commander     | 70.21% | 148          | 79.61%            |
| 12  | apps/digital-homestead | 63.29% | 132          | 79.87%            |
| 13  | apps/payments          | 62.92% | 131          | **80.13%**        |

The remaining 23 sub-80 projects account for only 766 lines between them and
are cleanup, not the critical path. Chasing them first is the main way this
effort can burn effort without moving the number.

## Order of work

1. **Tier 1 — aggregate movers (items 1-7 above).** Large apps. Prioritise the
   biggest untested services/components per app rather than uniform 80% per
   file; partial progress here still moves the workspace number.
2. **Tier 2 — items 8-13.** Mostly libs and mid-size apps, cheaper per line.
3. **Tier 3 — the 23 stragglers.** Batch these; many are a single spec file.

## Known blockers and defects found

- `libs/classified-ui/src/test-setup.ts` was an **empty stub**, so TestBed was
  never initialised and the project could not run Angular tests at all. Fixed
  on this branch: 0 runnable suites -> 4 suites / 41 tests / 100% lines.
  **Audited 2026-09-03: classified-ui was the only occurrence.** All 84
  `test-setup.ts` files were checked, and every project using
  `jest-preset-angular` initialises a test environment. The non-initialising
  setups that remain are all backend (Nest) or e2e projects, where that is
  correct.
- `apps/christopherrutherford-net` has **5 pre-existing failing suites**
  (`app.component`, `landing`, `hero`, `contact`, `services-grid`) that are
  unrelated to this branch. They must be fixed before that app's coverage can
  be trusted or raised.
- `apps/local-hub` donation-progress spec was dropped: with `jest.useFakeTimers()`
  the component's `setInterval` refresh makes `fixture.whenStable()` hang.
  Needs a rewrite that flushes microtasks instead. Follow-up.
- `ClassifiedCardComponent.sellerInitials` falls back to the literal `'CM'` but
  derives initials per whitespace-separated word, so it renders `'C'`. Specs pin
  current behaviour; the intent mismatch is a product decision, not a test bug.

## Constraints from open auto-opened dependency PRs

| PR               | Contents                                                            | Effect on this work                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #236             | dev-dependencies, 51 updates (jest / ts-jest / nx toolchain)        | CI green. No conflict — this branch changes no `package.json` or lockfile. Re-validate specs against it once merged.                                                                                 |
| #240             | production-dependencies, 66 updates                                 | No conflict.                                                                                                                                                                                         |
| #212, #213, #216 | `upload-artifact` 6->7, `pnpm/action-setup` 4->5, `setup-node` 6->7 | All three edit `.github/workflows/coverage.yml`. **Do not edit that file on this branch** — a coverage gate belongs in per-project jest `coverageThreshold` instead, or must wait until these merge. |
| #214, #215       | `setup-go`, `setup-python`                                          | Unrelated.                                                                                                                                                                                           |

## Working rules

- Tests only: no source logic changes except genuine bug fixes, called out
  explicitly.
- No root/shared config edits (`jest.preset.js`, `nx.json`, `tsconfig.base.json`),
  and no `coverage.yml` while the CI-bump PRs are open.
- Every project must be run green (`nx test <project> -c ci`) before its tests
  are committed. No committing unverified specs.
- No coverage padding: no vacuous assertions, no `istanbul ignore`, no
  skipping or weakening source to make numbers move.
