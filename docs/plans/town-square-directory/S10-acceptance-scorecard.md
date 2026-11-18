# S10 — Integrated acceptance scorecard

Status: **ready for review, not accepted.** This scorecard records the S10 evidence gathered on 2026-11-18 against the live local stack (compose project `optimistic-tanuki`, branch `t3/integrate-business-directory`, base commit `76b5096fa`). Public deployment is deferred by the owner, so "live" here means the running local stack. Publication is paused and real provider acquisition is not authorized (`ACQUISITION_AUTHORIZED = false`).

The capability-by-capability disposition is in the [S10 capability ledger](S10-capability-ledger.md): 107 rows, of which 69 are integrated (local scope), 15 are deferred, 20 are open/blocking, 3 are unknown, and 0 are integrated for production. Under the plan's rule, any deferred or open capability means the full "each source service integrated" objective is **not met** unless the owner changes scope.

No claim is made of "all businesses" or "complete coverage".

## Verdict

| Gate                                                       | Status           | Why                                                                                                            |
| ---------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Local integrated acceptance (S0–S9 local scope)            | ready for review | Items 1, 3 (partly), 4 and 6 are live-proven; S7 and S8 are closed; S9 is locally complete.                    |
| First public release (S4a.3)                               | blocked          | Needs reviewer approval of cohorts, fields, notices, geography and ceiling; a canary; resumed publication.     |
| Complete integration (every source capability, production) | blocked          | 20 open/blocking and 15 deferred ledger rows; production deployment items from S9; acquisition not authorized. |

## Required live-stack evidence (plan S10 items 1–7)

| #   | Requirement                                                     | Status          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Reconcile every eligible DB town by exact UUID set              | **met (local)** | [s10-1](s10-evidence/s10-1-town-reconciliation.json): Social eligible 261, Directory eligible 261, set difference empty both ways. Every town answered 200 on the public API and on `/city/:slug/businesses`, each with an explicit state: 137 `available`, 124 `unknown`. The set is every eligible Social row, so non-seed and non-corridor towns are included.                                                                                                                                                                                                                                                              |
| 2   | New town through the owning service, missed event, restart      | **partly met**  | [s10-2](s10-evidence/s10-2-onboarding-live.json): created through Social's create command while the worker was stopped (a missed event), worker restarted, pending context and blocked work 13.6 s after creation (8.8 s after restart), API and page 200 with `unknown`. Deleting it withdrew the town in 51.7 s (`blocked/town-ineligible`). **Not met:** geometry stays `pending`, acquisition is blocked by authorization, so no populated UI.                                                                                                                                                                             |
| 3   | Populated search/detail/map and the failure/empty states        | **partly met**  | Populated search, detail, map, location and manual town selection: `s6-directory-evidence.spec.ts` 21/21 live today ([s10-7](s10-evidence/s10-7-regression-report.md)). Blocked: observed live (item 2 reversal). Infrastructure failure: [s10-3](s10-evidence/s10-3-infrastructure-failure.json), Directory stopped 13 s: API 503 "Local directory unavailable", page renders the try-again error with no host or service names, recovered on restart. **Not observed live:** a provider-completed zero-result town and partial coverage (no acquisition runs); both are tested and intercepted only ([S6](S6-public-ux.md)). |
| 4   | Operator workflows and their public effect                      | **met (local)** | Run ledger cancel/resume and budget, review/undo, suppression and withdrawal: [S7 §10](S7-operations.md) live 9/9. Rights cases resolved by policy and granted export (182,277 rows, checksum verified), public export: [S8 §7.6](S8-exports.md). Taxonomy dismiss and reopen: [s7-dismiss](s7-evidence/s7-dismiss-live-outcome.json). Operating controls and kill switch: [S9 runbook](S9-operations-runbook.md). Live artifact revocation and a completing rights withdrawal are scratch-DB only.                                                                                                                            |
| 5   | Provider-family wiring, rights, attribution, cost, retention    | **open**        | Overture: staged release loaded by operator-local scripts, rights policy and attribution live, no live provider request. AllThePlaces: only as an Overture contributor. Geoapify: denied for public and export; adapters deferred. Cost: budget ledger and cost alert locally, no invoice reconciliation. Retention-failure drill not run. See ledger §3.                                                                                                                                                                                                                                                                      |
| 6   | Privacy, app scope, associations, ownership/billing, no secrets | **met (local)** | [s10-6](s10-evidence/s10-6-public-payload-scan.json): all 261 towns, 3,398 public rows; listing keys are only `name`, `category`, `attribution`, `notices`, `termsUrls`; no id, provenance, owner, reviewer or rights field and no email-shaped value. App scope and private towns: eligibility rule `social-eligibility.ts`, item 1. Business-page link and billing separation: [S5](S5-public-contract.md).                                                                                                                                                                                                                  |
| 7   | Local Hub E2E, then shared-UI regressions                       | **partly met**  | [s10-7](s10-evidence/s10-7-regression-report.md). Local Hub: S6 evidence 21/21; public-pages, map, unauthenticated, api-smoke 24 passed, 1 failed, 2 skipped. Shared UI: forgeofwill 29 passed / 5 failed; client-interface 151 passed / 27 failed / 408 skipped (opt-in live specs); business-site setup stopped on 403. Triage below.                                                                                                                                                                                                                                                                                        |

### Item 7 triage

The failures were not traced to this branch, but no baseline run on `main` was made, so they are not proven pre-existing.

- **Forum (forgeofwill and client-interface).** `/api/forum/topics` answered 503: no forum service runs in this compose project. The forum proxy is unchanged on this branch.
- **business-site.** Owner login in global setup got 403 "App context is not authorized" from `resolveRegistrationAppId` in `authentication.controller.ts`, which resolves the app from the request origin. That controller is unchanged on this branch; the live gateway has no registration for the business-site origin.
- **OAuth popup, chat seeded participants, registration redirects.** These need services and seeded data this stack does not run.
- **Local Hub `map.spec.ts:135`.** One focus marker expected, none found. It is likely seed data (the first city has no coordinates); the map component is not changed for the directory.
- **Branch changes in scope.** Gateway `app.module.ts` changes add only directory controllers. `libs/common-ui` adds a decision-history component and its exports. Neither touches the failing paths.

Closing item 7 needs either a `main` baseline on the same stack or the missing services (forum, chat, OAuth) and app registrations running.

## Release-gate checklist

| Check                                                                             | Owner               | Evidence                                                    | Scope      | Status                |
| --------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------- | ---------- | --------------------- |
| Town reconciliation by UUID                                                       | agent               | [s10-1](s10-evidence/s10-1-town-reconciliation.json)        | local      | ready for review      |
| New-town onboarding, missed event and restart                                     | agent               | [s10-2](s10-evidence/s10-2-onboarding-live.json)            | local      | ready for review      |
| Automatic geometry for new towns                                                  | owner / S2          | ledger §5                                                   | production | blocked               |
| Acquisition authorization                                                         | owner               | `apps/directory/src/acquisition-run.ts`                     | production | blocked               |
| Public payload privacy                                                            | agent               | [s10-6](s10-evidence/s10-6-public-payload-scan.json)        | local      | ready for review      |
| Infrastructure-failure semantics                                                  | agent               | [s10-3](s10-evidence/s10-3-infrastructure-failure.json)     | local      | ready for review      |
| Rights cases and export grant for `2026-10-21.0`                                  | owner               | [S8 §7.6](S8-exports.md)                                    | local      | approved (2026-11-18) |
| Address auto-approval decisions                                                   | owner               | [S7 address review §12](S7-address-review-auto-approval.md) | local      | blocked               |
| Pilot-row provenance (4,850 rows)                                                 | owner / operator    | [S7 handoff](HANDOFF-2026-11-17-S7.md)                      | local      | blocked               |
| Shared-UI regression on a full stack                                              | agent               | [s10-7](s10-evidence/s10-7-regression-report.md)            | local      | blocked               |
| Production deployment (credentials, ACL, TLS, off-host backups, alerting, drills) | owner               | [S9 runbook gaps](S9-operations-runbook.md)                 | production | blocked               |
| First public release (S4a.3) approval and canary                                  | designated reviewer | plan §1 approval boundaries                                 | production | blocked               |

## Live mutations and their reversal

- A synthetic town `s10-acceptance-town-tx` was created through Social and deleted after the run. What remains is the designed tombstones: one `directory_town` row with `eligible = false`, and the Social change log entry.
- The Directory API was stopped for 13 s and restarted. It came back healthy.
- The directory worker was stopped for 5 s and restarted.
- Three regression app containers were started and left running: `ot_client_interface`, `fow_client_interface` and `ot_business_site`. No other service was stopped or recreated.

## Deferred work

Larger deferred capabilities are recorded as [DF-008 in DEFERRED-FEATURES.md](../../release-readiness/DEFERRED-FEATURES.md). The release-readiness [MASTER-AUDIT](../../release-readiness/MASTER-AUDIT.md) and [EXECUTION-PLAN](../../release-readiness/EXECUTION-PLAN.md) carry a dated pointer to this scorecard.

## Decisions for the owner

1. Accept the local integrated scope as evidenced, or name what is missing.
2. For each deferred ledger row (Geoapify, standalone AllThePlaces, `/regions`, fixture and sample modes, public-probe), confirm the deferral or change scope.
3. Settle the three unknown rows (normalize stage, dedupe uncertainty, OpenAPI regeneration).
4. Authorize acquisition, or keep the directory to the staged release.
5. Decide whether item 7 needs a `main` baseline run or a full-service stack.
