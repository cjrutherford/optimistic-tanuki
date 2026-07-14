# Inter-Application OAuth Configuration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make platform OAuth configuration resolve predictably from built-in provider defaults, optional service YAML, and final environment overrides while deriving inter-application callback routing from the application registry.

**Architecture:** The gateway remains the single server-owned OAuth bridge and the application registry remains the canonical source for application URLs. Provider protocol metadata is supplied by built-in defaults, service `config.yaml` may override it, and non-empty environment variables override individual YAML credential/callback fields. The authentication service consumes the same precedence semantics without introducing another runtime secrets source; `.secrets` remains deployment-tool input only.

**Tech Stack:** Nx, NestJS, TypeScript, Jest, YAML, Docker Compose, Go registry CLI

---

### Task 1: Lock down gateway OAuth precedence

**Files:**

- Modify: `apps/gateway/src/config.spec.ts`
- Modify: `apps/gateway/src/config.ts`

**Steps:**

1. Add failing tests proving built-in provider endpoints/scopes are present when YAML omits OAuth, YAML credentials fill missing environment variables, and non-empty environment variables override YAML one field at a time.
2. Run `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test gateway --runInBand` and confirm the new expectations fail for missing defaults/YAML precedence.
3. Add provider defaults and a deterministic defaults -> YAML -> environment merge.
4. Rerun the gateway test target and confirm it passes.

### Task 2: Align authentication OAuth precedence

**Files:**

- Modify: `apps/authentication/src/config.spec.ts`
- Modify: `apps/authentication/src/config.ts`

**Steps:**

1. Add failing tests for YAML fallback, partial environment override, placeholder handling, and provider defaults.
2. Run `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test authentication --runInBand` and confirm the new expectations fail for the intended reason.
3. Implement the same field-level precedence and provider defaults in authentication.
4. Rerun the authentication test target and confirm it passes.

### Task 3: Make registry routing canonical and deployment wiring simple

**Files:**

- Modify: `apps/gateway/src/controllers/oauth/oauth.controller.spec.ts`
- Modify: `apps/gateway/src/controllers/oauth/oauth.controller.ts`
- Modify: `tools/registry/apps.production.sample.yaml`
- Modify: `docker-compose.yaml`
- Modify: `docker-compose.dev.yaml`
- Modify: `.env.sample`

**Steps:**

1. Add a failing controller test proving the configured provider redirect URI wins when supplied and the client-interface registry URL supplies the fallback.
2. Implement one callback resolver used for authorization and token exchange.
3. Make every production registry UI endpoint explicit so callback/return routing is reviewable without relying on normalization.
4. Remove legacy per-client OAuth credential duplication from Compose and document the concise provider variables and precedence in `.env.sample`.
5. Validate the production registry with its checked-in Go CLI.

### Task 4: Document and verify the operational contract

**Files:**

- Modify: `apps/authentication/OAUTH_SETUP.md`
- Modify: `tools/registry/README.md`

**Steps:**

1. Document the defaults -> YAML -> environment precedence and the distinct responsibilities of runtime env, service YAML, `.secrets`, and registry data.
2. Run the affected Nx unit tests and builds for `gateway` and `authentication`.
3. Run Compose config rendering with representative YAML-only and environment-override cases, checking that no secret values are written to generated artifacts.
4. Review `git diff --check` and the final diff for unrelated changes.
