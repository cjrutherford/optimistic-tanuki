# Login-Only OAuth Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make OAuth login-only, bind authorization attempts to the initiating browser, prevent unverified provider linking, eliminate provider-token persistence, and enforce identity uniqueness.

**Architecture:** The gateway owns OAuth authorization, state, code exchange, identity lookup, and a one-time callback-code handoff. It stores only short-lived state and callback grants, bound to an HttpOnly initiation cookie. The authentication service persists stable provider identity metadata only; provider access and refresh tokens are discarded immediately after identity lookup.

**Tech Stack:** NestJS, TypeORM/PostgreSQL migrations, Angular, Jest, Nx.

---

### Task 1: Remove persisted OAuth provider credentials and enforce identity uniqueness

**Files:**

- Modify: `apps/authentication/src/oauth-providers/entities/oauth-provider.entity.ts`
- Modify: `apps/authentication/src/app/oauth.service.ts`
- Modify: `apps/authentication/src/app/app.controller.ts`
- Modify: `libs/models/src/lib/libs/authentication/LinkProviderRequest.ts`
- Create: `apps/authentication/migrations/1789200000000-harden-oauth-provider-identities.ts`
- Modify: `apps/authentication/src/app/oauth.service.spec.ts`

**Step 1: Write failing tests**

Add tests proving OAuth login never saves `accessToken` or `refreshToken`, and that a duplicate provider identity results in a domain error rather than an ambiguous account lookup.

**Step 2: Run tests to verify they fail**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test authentication --runInBand --testPathPatterns=oauth.service.spec.ts`

Expected: FAIL because credentials are still persisted and the schema lacks uniqueness.

**Step 3: Implement minimal persistence changes**

Remove token fields from the entity and login/link command data. Create a forward-only migration that drops both token columns, de-duplicates existing rows deterministically before adding unique indexes on `(provider, providerUserId)` and `(userId, provider)`.

**Step 4: Run tests to verify they pass**

Run the Task 1 command. Expected: PASS.

### Task 2: Require a dedicated OAuth state secret and bind a one-time state record to the browser

**Files:**

- Modify: `apps/gateway/src/controllers/oauth/oauth.controller.ts`
- Modify: `apps/gateway/src/controllers/oauth/oauth.controller.spec.ts`
- Modify: `apps/gateway/src/config.ts`
- Modify: `.env.sample`
- Modify: `docker-compose.yaml`
- Modify: `k8s/base/gateway.yaml`

**Step 1: Write failing tests**

Cover: missing `OAUTH_STATE_SECRET` rejects startup/configuration; start creates a random opaque state, a secure HttpOnly cookie, and a short-lived server record; callback requires the matching cookie and consumes state once.

**Step 2: Run focused gateway test to verify failure**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test gateway --runInBand --testPathPatterns=oauth.controller.spec.ts`

**Step 3: Implement state store**

Use an in-memory bounded TTL map behind a narrow interface initially, so Redis can replace it later. Use a dedicated `OAUTH_STATE_SECRET`; do not fall back to JWT signing material or a literal. Bind state to return origin, provider, app scope, issuance time, and a cookie nonce. Set `HttpOnly`, `Secure` in production, `SameSite=Lax`, and narrow path.

**Step 4: Re-run focused test**

Expected: PASS.

### Task 3: Replace direct linking with provider-verified OAuth link mode

**Files:**

- Modify: `apps/gateway/src/controllers/oauth/oauth.controller.ts`
- Modify: `apps/gateway/src/controllers/oauth/oauth.controller.spec.ts`
- Modify: `apps/authentication/src/app/oauth.service.ts`
- Modify: `apps/authentication/src/app/oauth.service.spec.ts`
- Modify: `libs/models/src/lib/libs/authentication/LinkProviderRequest.ts`

**Step 1: Write failing tests**

Prove `/oauth/link` cannot accept a caller-provided provider identity; an authenticated `start/:provider?mode=link` carries the verified current user into its state; callback verifies the provider identity then links it to that user.

**Step 2: Run focused tests and confirm failure.**

**Step 3: Implement minimum link-mode flow**

Remove the direct link endpoint/data transfer. Add a guard-protected link-start endpoint or guarded `start/:provider` link mode. Its state stores the authenticated user ID server-side only. The callback invokes `LinkProvider` using only provider-derived ID/email/display name.

**Step 4: Re-run focused tests.**

### Task 4: Hand off login through a one-time callback code, not a URL JWT

**Files:**

- Modify: `apps/gateway/src/controllers/oauth/oauth.controller.ts`
- Modify: `apps/gateway/src/controllers/oauth/oauth.controller.spec.ts`
- Modify: `libs/auth-ui/src/lib/oauth-callback/oauth-callback.component.ts`
- Modify: `libs/auth-ui/src/lib/oauth-callback/oauth-callback.component.spec.ts`
- Modify: `libs/auth-ui/src/lib/services/oauth.service.ts`
- Modify: `libs/auth-ui/src/lib/services/oauth.service.spec.ts`

**Step 1: Write failing tests**

Verify successful callback redirects with `callbackCode` rather than `token`, code redemption requires the matching browser nonce/origin and is single-use, and the UI sends the code to a new redeem endpoint before posting the received platform JWT to its opener.

**Step 2: Run focused tests and confirm failure.**

**Step 3: Implement callback grants**

Store platform JWT briefly in a one-time server callback grant bound to return origin and cookie nonce. Expose a public, throttled redeem endpoint which consumes the code only when binding checks pass. Update UI to redeem then relay the token via same-origin `postMessage`.

**Step 4: Re-run focused tests.**

### Task 5: Validate external identity responses and add integration coverage

**Files:**

- Modify: `apps/gateway/src/controllers/oauth/oauth.controller.ts`
- Modify: `apps/gateway/src/controllers/oauth/oauth.controller.spec.ts`
- Modify: `apps/authentication/src/app/oauth.service.spec.ts`

**Step 1: Write failing tests**

Cover rejected blank provider IDs, rejected invalid/expired/replayed state, configured fetch timeouts, verified-email auto-link success, and unverified-email auto-link rejection.

**Step 2: Run focused tests to verify failure.**

**Step 3: Implement input checks and fetch cancellation**

Validate provider ID and required email before account resolution. Use `AbortSignal.timeout` (or an equivalent compatible helper) for token, user-info, and GitHub-email requests. Ensure error redirects do not include provider secrets or application JWTs.

**Step 4: Run tests**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test authentication --runInBand`

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test gateway --runInBand`

### Task 6: Final cross-app verification

**Files:**

- Modify only if tests reveal a regression.

**Step 1: Run affected library and app tests**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test auth-ui --runInBand`

Run the smallest applicable client-interface and forgeofwill OAuth/login test slices through Nx.

**Step 2: Review changed configuration**

Confirm production configuration supplies `OAUTH_STATE_SECRET`, tokens are no longer in persistence schema/entity, and no response URL includes `token=`.
