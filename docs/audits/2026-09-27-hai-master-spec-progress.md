# Master specification progress audit — 2026-09-27

> This is the initial baseline. For current status and verification evidence, see the [Slice 07–08 closeout](2026-09-27-slices-07-08-closeout.md), [Slice 09 closeout](2026-09-27-slice-09-closeout.md), and [Slice 10 closeout](2026-09-27-slice-10-closeout.md).

## Scope and evidence

Reviewed the 14-page _Master Engineering Specification: Hopeful Aspirations Industries & Optimistic Tanuki Monorepo_ (the last page is blank), repository HEAD `1874383d` on `develop/site-copy-review`, the current working tree, and the HAI contact path through Gateway, Lead Tracker, Owner Console, and email. This is a source and unit-test audit, not a production acceptance test. The PDF's roadmap status on page 13 predates the current commits.

The status rubric is: **committed implementation** means code is in HEAD but every PDF acceptance criterion has not been independently verified; **worktree only** means uncommitted code exists and is subject to change; **partial** means some specified behavior exists but material criteria are absent or unverified. No slice is marked fully accepted without an end-to-end check.

## Roadmap status

| Slice                              | Current evidence                                                                                                                                           | Assessment                                                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 HAI brand/hero                  | Commit `cda3e1ea`; `apps/hai/src/app/components/landing/landing.component.html`, `components/title-bar/`                                                   | Committed implementation; live rendering unverified.                                                                                                                       |
| 02 hardware catalog                | Commit `e6bf2acd`; `apps/hai/src/app/components/hardware-catalog/`, Gateway hardware controller, configurator preset routes                                | Committed implementation; deep-link runtime unverified.                                                                                                                    |
| 03 industry solutions              | Commit `c38ca4e2` plus copy fixes `6bc9e05c`, `c5ff4ece`; `apps/hai/src/app/components/solutions-matrix/`                                                  | Committed implementation; runtime navigation unverified.                                                                                                                   |
| 04 Field Flow                      | Commits `d30468bb`, `d60e724b`, `75872667`; `apps/whitebox-field-flow/`, Gateway flow controller, Lead Tracker flow service, Payments flow deposit service | Committed implementation; PDF's live integrations and tenant behavior not rechecked here.                                                                                  |
| 05 Practice Vault                  | Commit `75872667`; `apps/whitebox-practice-vault/`, Gateway vault controller, compliance audit, storage, finance, and AI services                          | Committed implementation; live ClamAV, Object Lock, SMS, and Ollama not rechecked.                                                                                         |
| 06 Project Nexus                   | HEAD `1874383d`; `apps/whitebox-project-nexus/`, `apps/project-planning/src/app/nexus/`, Gateway nexus controller, shared canvas/storage                   | Committed implementation; field sync and live acceptance unverified.                                                                                                       |
| 07 Civic Core                      | Untracked `apps/whitebox-civic-core/`, `apps/civic/`, Gateway civic controller, contracts/theme/E2E files                                                  | Worktree only; do not treat as delivered.                                                                                                                                  |
| 08 HAI ROI and contact SLA         | Untracked ROI calculator/component/specs and modified HAI landing/contact files                                                                            | Worktree only. Calculator currently fails TypeScript tests. Contact SLA and owner email are incomplete.                                                                    |
| 09 portfolio grid/identity         | Existing `apps/christopherrutherford-net/src/landing/hero/` and responsive project grid (`repeat(auto-fit, minmax(280px, 1fr))`)                           | Partial evidence for grid and identity; no slice acceptance check.                                                                                                         |
| 10 portfolio architecture showcase | Registry-driven cards in `apps/christopherrutherford-net/src/landing/project-grid/`; curated data has eight IDs                                            | Partial; exact six-app/Systems Lab requirement not evidenced.                                                                                                              |
| 11 BTO appliance portal            | Existing `apps/system-configurator/` and `apps/system-configurator-api/` with preset handling                                                              | Partial; specified distributor feeds, 10% contingency/30-day validity, lease/margin formulas, proposal/env/compose compiler, and deployment not established by this audit. |

## HAI one-hour contact SLA: current behavior

1. `apps/hai/src/app/components/landing/landing.component.ts:163` posts `appScope: 'hai'` to `/api/contact`. Gateway `apps/gateway/src/controllers/blogging/contact.controller.ts:76` validates/routes and sends `LeadCommands.CREATE`. `apps/lead-tracker/src/app/leads.service.ts:124` saves the lead. Manual operator response emails the requester and records `lastRespondedAt` (`leads.service.ts:161`). This confirms an intake and manual response path.
2. No owner email is sent on HAI lead creation. No scheduled deadline, reminder, or breach notification was found. Gateway `apps/gateway/src/assets/config.yaml:197` sets only HAI's source label. The routing fallback selects one global profile (`contact.controller.ts:369`); Owner Console lists leads by the signed-in profile, so other owners may not see the lead.
3. Owner Console authorization recognizes Owner Console-scoped `owner_console_owner`, `owner`, `global_admin`, and `system_admin` roles (`apps/owner-console/src/admin-api-authorization.ts:6`). Recipient resolution must use that policy and exclude ordinary profiles. The existing performance alert email flow is a reusable delivery precedent, but its broad profile list is not a safe recipient rule (`apps/gateway/src/performance/performance-telemetry.controller.ts:84`).
4. Owner Console's displayed SLA is a UI heuristic: a NEW lead is overdue after two days (`apps/owner-console/src/app/components/contact-leads-management.component.ts:1041`), using a hard-coded July 4, 2026 clock (`:1055`). It cannot measure a one-hour promise.
5. HAI currently tells visitors that a local engineer answers within one business hour and can be on site across South Georgia the same day (`apps/hai/src/app/components/landing/contact-section.component.html:11`), and repeats the response promise after intake success (`landing.component.ts:179`). Persistence alone does not establish either commitment.

The PDF only says “1-hour physical SLA” on page 13. It does not define clock start, business hours, timezone, geographical coverage, or what “physical” means. The current page copy has filled these gaps without backend enforcement or documented acceptance criteria.

## Verification on this checkout

- `blogging:test`: 14 suites, 154 tests passed.
- `lead-tracker:test`: 33 suites, 203 tests passed.
- `hai:test`: 14 suites passed and 2 failed. The new ROI component declares both an `emailComparison` output and an `emailComparison()` method (`roi-calculator-section.component.ts:332,397`), causing TypeScript duplicate identifier errors. Its spec also calls the output as a method. This blocks a clean HAI suite/build claim.
- The expected live ports 8080, 8081, 8094 and Owner Console port 8084 were closed. No Docker/browser/email delivery test was performed.
- The worktree was already dirty before this audit, including Civic, ROI, HAI copy/form, Gateway wiring, and shared library changes. This audit did not alter those files.

## Next execution batch

1. Resolve the SLA contract first: define the exact clock start and business calendar/timezone, what qualifies as a response, and whether “physical” promises onsite arrival. Until enforcement exists, remove or soften the one-hour and same-day copy.
2. Fix the ROI `emailComparison` name collision and rerun the HAI suite/build. Keep this isolated from the contact behavior.
3. Implement server-owned HAI first-response deadline and durable, idempotent notification state in Lead Tracker, using its owning service's generated TypeORM migration target for any schema changes. Calculate overdue from that deadline and `lastRespondedAt`, then show it in Owner Console; remove the frozen UI clock.
4. Resolve every eligible Owner Console owner from scoped role assignments and current email addresses. Send an intake email to **all** eligible owners after successful HAI lead creation, and escalate an unanswered deadline via a restart-safe worker/outbox. Keep owner access to the lead aligned with notification recipients.
5. Add focused tests for recipient inclusion/exclusion, duplicate/retry safety, deadline boundaries, on-time response suppression, and owner visibility. Verify migration generation/fresh-DB run and `pnpm run validate:typeorm-migrations`; then run affected Nx tests/builds and a live HAI submit-to-owner-email-to-response/breach scenario. After this, resume Slice 07 acceptance and the remaining roadmap gaps.

The tests above prove existing paths still pass; none proves delivery of an owner email or the one-hour SLA.
