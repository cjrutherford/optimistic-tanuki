# Fin Commander re-audit scorecard — 2026-08-11

## Outcome

**Weighted score: 5.0 / 10 — a tenant-scoped financial workspace with verified membership isolation, but not yet an accounting command system.**

The prior score was 4.3/10. The increase reflects a verified owner/member/non-member membership lifecycle and live five-account isolation matrix. It does not solve the defining product problem: plans, goals, and scenarios record intent but do not produce ledger-backed accounting directives or execution work.

## Scope and evidence

- Live Fin Commander at `http://127.0.0.1:8089`, rebuilt after Slice 5.
- Clean authenticated browser sessions created a plan, goal, and scenario in Tenant A; separate new sessions showed the plan and scenario again.
- Browser reload on the Scenario route made three successful scoped requests (two plan lists, one scenario list), not the previous unbounded request loop.
- Mobile viewport: 375×667 Scenario route had no horizontal overflow.
- Accessibility audit on that route after Slice 6: **0 violations** (39 passes; one gradient-related contrast check remains incomplete rather than failed).
- Fresh authenticated login inspection showed no submitted email or password in the browser console.
- Source and unit-test review of Fin Commander, its data-access library, gateway, and Finance service.
- Live five-account matrix covering owner, Finance admin, Finance member, revoked member, and unrelated non-member; non-owner mutation was denied and revocation removed access.
- Finance tenant service: 17 tests passed; Finance, Gateway, and Fin Commander E2E lint passed; checked-in Nx entity-membership CI target passed.

## Scoring model

| Dimension                         | Weight | Score | Evidence                                                                                                                                                                                                   |
| --------------------------------- | -----: | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional correctness            |    25% |  6/10 | Plan/goal/scenario writes use the authenticated tenant API and server UUIDs; fresh-session persistence is proven. Update flows are not exposed in the client and broader E2E is still absent.              |
| Accounting usefulness             |    25% |  2/10 | Goals and scenarios are still manually entered, text-led intent records with no funding calculation, ledger linkage, forecast, or execution action.                                                        |
| Tenant isolation and clarity      |    20% |  8/10 | Canonical route selection converges URL, selector, and request scope; owner/member/non-member access and revocation now pass a five-account live matrix. The owner-console member UI is still incomplete.  |
| Cross-feature coherence           |    15% |  3/10 | The ledger and plan live in the same tenant, but the plan overview only displays independent workspace summaries. No directive changes a budget, recurring item, transfer, or reconciliation decision.     |
| UX, accessibility, responsiveness |    10% |  5/10 | The audited Scenario route has no axe violations and no mobile overflow at 375px. Entity terminology still says “Account” and “New account”, and the route-level audit must be expanded beyond this route. |
| Verification confidence           |     5% |  8/10 | Focused unit suites, changed-project lint, rebuilt live flows, and the checked-in entity-membership CI target are verified. Full Fin Commander E2E and execution accounting remain unverified.             |

## Re-audit findings

### P0 — Planning is persisted but still cannot direct accounting work

`FinCommanderPlan` stores a label, description, and default workspace. A goal stores target/current cents, due date, and strategy text. A scenario stores free-text assumptions and string deltas. None links to ledger accounts, categories, budgets, recurring items, transactions, cadence, owner, approval, or computed projection.

Evidence: `libs/fin-commander-data-access/src/lib/models/fin-commander.models.ts`; Finance Fin Commander entities; live plan/goal/scenario forms.

Impact: users cannot answer affordability, monthly required contribution, source of funds, forecasted balance, or “what should happen next?” A plan remains a notebook beside accounting rather than a command surface.

Recommendation: introduce a typed **directive** domain: funding target, source account/category, cadence, due date, priority, guardrail, owner, and execution state. Compute forecasts from balances, transactions, budgets, and recurring items; allow accepted directives to create/revise budget or recurring work.

### P1 — Multi-user tenancy API is verified but owner-console workflow is incomplete

Finance and Gateway now expose typed add, role-update, and remove operations. Finance remains the authorization source of truth: owners mutate membership, active members can read the tenant, and unrelated/revoked profiles are denied. The owner-console product UI still needs to expose the lifecycle, profile selection, and role controls.

Evidence: `apps/finance/src/app/services/finance-tenant.service.ts`; `apps/gateway/src/controllers/finance/finance.controller.ts:1352`; tenant-service tests.

Recommendation: wire the existing API into the owner-console Entity members route with bounded Finance-profile selection, role changes, removal, and visible error states.

### P1 — Entity terminology and legacy navigation keep the model ambiguous

The tenant selector calls a tenant **Account** and its action **New account**, while financial accounts are a separate ledger resource. The legacy Commander shell also still renders `/commander/...` links even though application routes redirect to canonical `/tenants/:tenantId/plans/...` URLs.

Evidence: live command bar; `apps/fin-commander/src/app/pages/commander-shell/commander-shell.component.ts`; `apps/fin-commander/src/app/app.routes.ts:174-189`.

Recommendation: rename tenant UI to Entity/Household/Organization and remove the legacy shell or route all generated links through `tenant-routes.ts`.

## Resolved since the prior audit

- Plans, goals, and scenarios now use tenant-scoped API reads/writes; browser local storage is no longer the plan system of record.
- A parent plan must be visible in the caller’s resolved scope before a goal or scenario can be created.
- Canonical owned-tenant URLs set the active tenant used by finance requests.
- Fresh sessions proved plan and scenario persistence.
- Overview, Goals, and Scenarios no longer create self-triggered hydration request loops.
- Login submission no longer writes the submitted form or form-change payload to the browser console; a regression test covers both paths.
- Scenario errors retain list semantics and live updates; the page has an H1 and the editor advances to H2.
- Shared navigation now has labelled navigation landmarks and accessible active-link contrast; command-bar and selector wrappers have valid labelled semantics.
- A fresh live axe 4.12.1 scan of the authenticated Scenario route reports 0 violations (39 passes; 1 gradient-related contrast check incomplete).

## Priority sequence

1. Replace intent-only planning with typed, ledger-backed directives and projections.
2. Connect directives to budget, recurring, transfer, or reconciliation execution work.
3. Wire the verified membership API into the owner-console Entity members UI.
4. Remove legacy Commander links and rename tenant UI consistently to Entity.
5. Add route-level axe checks across Goals, Overview, and the authenticated shell; resolve the gradient contrast indeterminacy where the computed colors are not provably compliant.

## Next slice tracker — planned

**Slice:** entity membership lifecycle and five-account isolation E2E. **State:** API and verification complete; owner-console UI remains.

The slice added owner-only add/role-change/remove operations for existing Finance-scoped profiles and live owner/admin/member/revoked/unrelated proof including revocation. The owner-console UI remains the follow-up. It deliberately excludes email invitation delivery and unregistered-user onboarding; that requires a separate invitation-token and notification domain. The detailed plan is [2026-08-11-fin-commander-membership-lifecycle.md](../plans/2026-08-11-fin-commander-membership-lifecycle.md).

## Acceptance gates for the next slice

- Owner invites a member; member sees shared records; non-member is denied; all sessions remain in their own entity context.
- A directive calculates a monthly contribution and changes status when a linked ledger balance changes.

## Residual risks

- No cross-user browser proof yet.
- Full Fin Commander E2E suite remains unaccepted.
- Accounting policy choices (cash/accrual, entity separation, approval/close) still need product decisions before directive execution can be safely automated.
