# Shared OAuth Client Callbacks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable every production Angular client to receive the shared gateway OAuth completion at its same-origin `/oauth/callback` route, while provider callbacks remain anchored at Optimistic Tanuki's `/api/oauth/callback/:provider` endpoint.

**Architecture:** Keep provider-to-gateway routing unchanged and use the shared `OAuthCallbackComponent` for the gateway-to-origin popup handoff. Export a reusable route constant from `auth-ui`; clients spread that constant into their route tables. Make the callback component’s API base optional with a `/api` fallback, because successful gateway completion only needs `postMessage` and several clients do not provide `API_BASE_URL`.

**Tech Stack:** Angular standalone routing, `@optimistic-tanuki/auth-ui`, Jest, Nx.

---

### Task 1: Cover the shared callback route contract

**Files:**

- Modify: `libs/auth-ui/src/lib/oauth-callback/oauth-callback.component.spec.ts`
- Modify: `libs/auth-ui/src/lib/auth-ui/index.ts`
- Modify: `libs/auth-ui/src/lib/oauth-callback/oauth-callback.component.ts`

**Step 1: Write failing tests**

Add tests proving the reusable route exports `path: 'oauth/callback'` and `OAuthCallbackComponent`, and that the component can be constructed without an `API_BASE_URL` provider for the token handoff path.

**Step 2: Run the focused auth-ui test through Nx**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test auth-ui --runInBand`

Expected: FAIL because the shared route export and optional provider behavior do not yet exist.

**Step 3: Implement the minimal shared contract**

Export a readonly callback route array from `auth-ui`; use an optional API base injection with `/api` as the direct-provider-callback fallback.

**Step 4: Re-run the focused test**

Run the same Nx test and confirm it passes.

### Task 2: Register the shared callback route in every remaining Angular client

**Files:**

- Modify: `apps/business-configurator/src/app/app.routes.ts`
- Modify: `apps/business-site/src/app/app.routes.ts`
- Modify: `apps/christopherrutherford-net/src/app/app.routes.ts`
- Modify: `apps/configurable-client/src/app/app.routes.ts`
- Modify: `apps/developer-portal/src/app/app.routes.ts`
- Modify: `apps/hai/src/app/app.routes.ts`
- Modify: `apps/marketing-generator/src/app/app.routes.ts`
- Modify: `apps/setup-console/src/app/app.routes.ts`
- Modify: `apps/store-client/src/app/app.routes.ts`
- Modify: `apps/ui-playground/src/app/app.routes.ts`
- Test: app route specs where present; otherwise add a minimal route-contract spec.

**Step 1: Write failing route-contract tests**

For each remaining routed client, assert its route table contains `/oauth/callback` backed by the shared callback component.

**Step 2: Run each focused app test through Nx**

Run the applicable `pnpm nx test <app> --runInBand` commands with the required Nx environment variables; confirm the new assertions fail.

**Step 3: Implement the route registrations**

Import and spread the shared `oauthCallbackRoutes` constant before root routes with custom matchers or wildcard/fallback routes. Do not add any app-owned callback components or provider credentials.

**Step 4: Re-run focused app tests**

Confirm the route-contract tests pass.

### Task 3: Verify the production client callback surface

**Files:**

- Verify: `tools/registry/apps.production.sample.yaml`
- Verify: `apps/gateway/src/controllers/oauth/oauth.controller.ts`

**Step 1: Run affected library and application tests through Nx**

Run `auth-ui` plus all ten affected client projects with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`.

**Step 2: Build the affected clients through Nx**

Build each affected routed client with the same Nx environment flags.

**Step 3: Inspect the final diff**

Confirm the provider callback endpoint is not moved away from `optimistic-tanuki.com/api/oauth/callback/:provider`, and that every `uiBaseUrl` in the production registry resolves to a frontend callback route.
