# Fin Commander Funded Goal Directive Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make a Fin Commander goal reference a real tenant funding account and expose a deterministic monthly contribution calculation without creating or moving money.

**Architecture:** Extend the existing goal aggregate with an optional funding account reference. Finance is the source of truth: it confirms the account belongs to the active tenant and calculates the remaining amount and required monthly contribution from a UTC calendar-month interval. Gateway continues to forward the typed DTO, while the Angular client selects from tenant accounts and presents the calculation with its inputs.

**Tech Stack:** Angular signals/forms, NestJS microservice messages, TypeORM/PostgreSQL, class-validator DTOs, Jest, Playwright.

---

### Task 1: Define the funded-goal contract and calculation

**Files:**

- Modify: `libs/constants/src/lib/libs/fin-commander.ts`
- Modify: `libs/fin-commander-data-access/src/lib/models/fin-commander.models.ts`
- Test: `apps/finance/src/app/services/fin-commander-goal.service.spec.ts`

**Step 1:** Add a failing service test for a goal with a funding account and a future due date. Expect source balance in cents, remaining cents, calendar months remaining, and a ceiling-rounded required monthly contribution.

**Step 2:** Run the focused Finance test and verify the test fails because the calculation/contract does not exist.

**Step 3:** Add optional `fundingAccountId` and projection fields. Preserve legacy goals with no funding source.

**Step 4:** Run the focused test and verify it passes.

### Task 2: Enforce tenant ownership and persist the funding source

**Files:**

- Modify: `apps/finance/src/entities/fin-commander-goal.entity.ts`
- Create: `apps/finance/src/migrations/1772100000000-fin-commander-funded-goal.ts`
- Modify: `apps/finance/src/app/services/fin-commander-goal.service.ts`
- Modify: `apps/finance/src/app/app.module.ts`
- Test: `apps/finance/src/app/services/fin-commander-goal.service.spec.ts`

**Step 1:** Add failing tests proving a funding account from another tenant is rejected and a valid active tenant account is accepted.

**Step 2:** Run tests; observe the expected failures.

**Step 3:** Add nullable persistence, an account relation/reference, and account lookup scoped by tenant/app scope. Reject invalid or cross-tenant IDs with a non-enumerating not-found error.

**Step 4:** Run focused tests; verify green.

### Task 3: Return the projection through the existing command path

**Files:**

- Modify: `apps/finance/src/app/services/fin-commander-goal.service.ts`
- Modify: `apps/finance/src/app/app.controller.ts`
- Modify: `apps/gateway/src/controllers/finance/finance.controller.ts`
- Test: `apps/finance/src/app/app.controller.spec.ts`

**Step 1:** Add a failing controller test proving read/create goal responses include a computed directive projection and no funding account causes an explicit unavailable state.

**Step 2:** Run that focused test and verify red.

**Step 3:** Implement projection mapping at the Finance owner boundary; preserve gateway error translation and scoped plan authorization.

**Step 4:** Run focused Finance controller/service tests; verify green.

### Task 4: Make the calculation visible in Fin Commander

**Files:**

- Modify: `libs/fin-commander-data-access/src/lib/services/fin-commander-plan-api.service.ts`
- Modify: `apps/fin-commander/src/app/pages/goals/goals-page.component.ts`
- Test: `apps/fin-commander/src/app/pages/goals/goals-page.component.spec.ts`

**Step 1:** Add a failing component test for a visible funding-source selector and a directive card that explains remaining amount, due date, source balance, and required monthly contribution.

**Step 2:** Run the focused client test and verify red.

**Step 3:** Load scoped accounts, submit `fundingAccountId`, and render only server-calculated projections. Make unavailable state clear rather than inventing a forecast.

**Step 4:** Run focused client tests; verify green.

### Task 5: Verify the vertical slice

**Files:**

- Modify: `apps/fin-commander-e2e/src/user-journey.spec.ts` or create a dedicated focused directive spec

**Step 1:** Add an E2E scenario that creates a tenant account and funded goal, then asserts the displayed monthly contribution is derived from the persisted source/goal inputs.

**Step 2:** Run it against the live Docker stack with `SKIP_SETUP=true` and system Chrome; verify red first, then green.

**Step 3:** Run Finance, Gateway, Fin Commander lint; focused service/client tests; scoped builds; and the checked-in E2E target.
