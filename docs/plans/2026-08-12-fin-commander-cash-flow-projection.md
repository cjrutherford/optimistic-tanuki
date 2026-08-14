# Fin Commander Cash-flow Projection Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for each behavioral change.

**Goal:** Show a read-only, explainable 90-day balance projection for a plan’s default Finance workspace.

**Architecture:** Finance owns the calculation. It validates the plan scope, reads active workspace accounts and recurring items, reuses funded-goal directives, and returns dated events plus daily closing balances. Gateway exposes the typed response; Fin Commander renders the opening balance, forecast, and each input source without claiming affordability or moving money.

**Tech Stack:** NestJS/TypeORM, shared constants, Angular signals, Jest, Playwright.

---

### Task 1: Define projection contract and calculation

**Files:**

- Modify: `libs/constants/src/lib/libs/fin-commander.ts`
- Modify: `libs/constants/src/index.ts`
- Create: `apps/finance/src/app/services/fin-commander-projection.service.ts`
- Test: `apps/finance/src/app/services/fin-commander-projection.service.spec.ts`

1. Write a failing service test for a scoped plan with opening cash, one credit, one debit, and one funded goal.
2. Verify it fails because the projection service does not exist.
3. Add `FinCommanderProjectionCommands`, projection DTOs, and a service that returns a 90-day UTC daily series.
4. Schedule active recurring items from `nextDueDate` using weekly/monthly/quarterly/yearly cadence. Schedule funded-goal allocations on the first day of each month. Include source labels and signed integer-cents deltas.
5. Run the focused test and verify it passes.

### Task 2: Wire Finance and Gateway

**Files:**

- Modify: `apps/finance/src/app/app.module.ts`
- Modify: `apps/finance/src/app/app.controller.ts`
- Modify: `apps/gateway/src/controllers/finance/finance.controller.ts`
- Test: `apps/finance/src/app/app.controller.spec.ts`
- Test: `apps/gateway/src/controllers/finance/finance.controller.spec.ts`

1. Add failing handler/controller tests for scoped projection access and response forwarding.
2. Register the projection service and Finance message handler; require plan read permission on `GET /api/finance/fin-commander/plan/:planId/projection`.
3. Run focused tests.

### Task 3: Render the cash-flow page

**Files:**

- Modify: `libs/fin-commander-data-access/src/lib/models/fin-commander.models.ts`
- Modify: `libs/fin-commander-data-access/src/lib/services/fin-commander-plan-api.service.ts`
- Modify: `apps/fin-commander/src/app/pages/cash-flow/cash-flow-page.component.ts`
- Test: `apps/fin-commander/src/app/pages/cash-flow/cash-flow-page.component.spec.ts`

1. Add a failing component test for opening balance, forecast end balance, and an explainable recurring/goal event.
2. Load the projection using the active route plan id and render clear inputs plus calculation date.
3. Run component tests, lint, focused builds, and a live browser/API assertion.
