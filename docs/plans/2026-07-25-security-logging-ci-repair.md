# Security Logging CI Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Repair the CI failures introduced by the security-logging branch without absorbing unrelated workspace baseline failures.

**Architecture:** Keep the production behavior unchanged except for lint-compliant regular expressions. Make the admin bootstrap test self-contained by supplying the deployment configuration that its real code now reads.

**Tech Stack:** Nx, Jest, ESLint, TypeScript, NestJS.

---

### Task 1: Make the bootstrap regression test self-contained

**Files:**

- Modify: `apps/admin-api/src/app/bootstrap/bootstrap.service.spec.ts`

**Step 1:** Add a test fixture for `ops/deployments/production.yaml` and configure `admin-api.deploymentPath` to it.

**Step 2:** Run `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run admin-api:test:ci` and confirm the previous `ENOENT` failure is gone.

### Task 2: Repair Gateway lint errors

**Files:**

- Modify: `apps/gateway/src/controllers/oauth/oauth.controller.ts`
- Modify: `apps/gateway/src/docker-compose-oauth-env.spec.ts`
- Modify: `apps/gateway/src/app/mcp/mcp-auth.guard.spec.ts`
- Modify: `apps/gateway/src/app/mcp/project-mcp.service.spec.ts`
- Modify: `apps/gateway/src/app/mcp/task-mcp.service.spec.ts`
- Modify: `apps/gateway/src/auth/auth.guard.spec.ts`

**Step 1:** Replace lint-invalid regex syntax with equivalent lint-compliant expressions and remove obsolete ESLint disable directives.

**Step 2:** Run `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run gateway:lint`.

### Task 3: Verify affected branch targets

**Files:**

- Verify only

**Step 1:** Run the focused admin-api test and Gateway lint targets.

**Step 2:** Review the diff to confirm it contains only branch-owned CI repairs.
