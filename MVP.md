# MVP Plan (formatted)

Each app remains responsible for its own runtime config (API base URL, auth provider). Extract only trivially repeating helpers. No large shared CRUD refactor for now — prefer small, low-risk shared helpers and per-app wiring.

Add a permissions audit and a clear enforcement pattern (gateway + microservice checks).

---

## Top-level plan (priority, tasks, verification, estimate)

### 1. Permissions audit — DEFINE policy then IMPLEMENT — 2–3 days (adjusted) COMPLETE
Goal:
- Produce a permissions matrix, enforce at gateway and validate at microservice boundaries.
- Reuse existing gateway and permissions-service primitives where possible.

Audit tasks (deliverables: `docs/permissions-audit.md` and test matrix)
- Inventory enforcement points across gateway and services (start from gateway controllers and guards).
  - Gateway controllers to inspect: `apps/gateway/src/controllers/*` (e.g. project-planning, social, blogging, asset, permissions).
- Confirm and extend existing enforcement primitives:
  - Gateway-side proxy: `PermissionsProxyService` already exists and has a spec to extend.
  - Gateway guards: `AuthGuard` and `PermissionsGuard` exist; extend tests and map to endpoints.
  - Decorators: `permissions.decorator.ts` exists for marking controller permissions.
- Create minimal Roles & Permissions model (seed exists in `apps/permissions/assets/default-permissions.json`).
- Map endpoints → permissions and verify JWT/user decorator claims.
- Implement gateway guard + PermissionsProxyService pattern and tests; ensure microservices validate incoming calls.

Verification:
- Unit tests for `PermissionsProxyService` and `AuthGuard` (extend existing specs).
- Integration tests simulating role tokens with explicit cases across gateway ↔ permissions service and a target microservice.

Checklist (deliverables):
- docs/permissions-audit.md (matrix + endpoint mapping)
- Unit tests: extend `auth.guard.spec.ts`, `permissions-proxy.service.spec.ts` (already present) and add `permissions.guard.spec.ts`
- Integration tests: gateway ↔ project-planning role scenarios
- Logged examples of permission denials (structured logs)

#### Files not currently covered by permissions guards
- `blogging/contact.controller.ts`
- `blogging/event.controller.ts`

Files to inspect / extend:
- [apps/gateway/src/auth/permissions-proxy.service.ts](apps/gateway/src/auth/permissions-proxy.service.ts) — [`PermissionsProxyService`](apps/gateway/src/auth/permissions-proxy.service.ts)
- [apps/gateway/src/auth/auth.guard.ts](apps/gateway/src/auth/auth.guard.ts) — [`AuthGuard`](apps/gateway/src/auth/auth.guard.ts)
- [apps/gateway/src/guards/permissions.guard.ts](apps/gateway/src/guards/permissions.guard.ts) — [`PermissionsGuard`](apps/gateway/src/guards/permissions.guard.ts)
- [apps/gateway/src/decorators/permissions.decorator.ts](apps/gateway/src/decorators/permissions.decorator.ts) — permissions decorator
- [apps/permissions/src/app/permissions.service.ts](apps/permissions/src/app/permissions.service.ts) — permissions backend
- [apps/permissions/src/app/roles.service.ts](apps/permissions/src/app/roles.service.ts) — roles backend
- [apps/permissions/src/app/app-scopes.service.ts](apps/permissions/src/app/app-scopes.service.ts) — app-scopes support

Notes on reuse:
- Many gateway tests already exist: extend them rather than rewrite. See `apps/gateway/src/auth/permissions-proxy.service.spec.ts` and `apps/gateway/src/auth/auth.guard.spec.ts`.
- The permissions app already contains migrations, seed and controllers for permissions/roles; plan integration tests to call it as the authority.


### 2. Discovery & per-app wiring — 0.5 day COMPLETE
Tasks:
- Confirm bootstrap points and AppModule locations so each app can register runtime config (API base URL / auth).
- Inspect modules: `project.service.ts`, `post.service.ts`, `blog.service.ts`, `contact.service.ts`.

Verification:
- Open each AppModule and confirm provider hook exists.

Checklist (deliverables):
- Per-app list of AppModule provider insertion points
- Short README snippet for each app showing how to register the base-url token
- Smoke compile in CI for provider wiring

Files to inspect:
- `project.service.ts`, `http.interceptor.ts`, `blog.service.ts`, `contact.service.ts`

### 3. Minimal shared base-url token & tiny helper — 0.5 day COMPLETE 
Tasks:
- Add a single InjectionToken library so apps can import a consistent token name while providing their own value.
- Do NOT provide defaults; each app must register a provider.

Verification:
- Apps compile with token imported and provider defined in AppModule.

Checklist (deliverables):
- `libs/api-client` InjectionToken implementation
- Example AppModule provider snippet in one app
- CI compile verification

Reference:
- Add `libs/api-client` token; apps wire provider in `AppModule`.

### 4. Social app hardening (client-interface) — 2–3 days
Tasks:
- Real-time client with exponential reconnect/backoff. ✅
- Pagination & query limits in `PostService`.✅
- Input sanitization at UI + server side.
- Media uploads integrated with assets service.

Verification:
- Unit tests for pagination; E2E create post → comment → vote; role-based permission tests.

Checklist (deliverables):
- Pagination tests for PostService✅
- SSE/WebSocket client helper with backoff✅
- Sanitization checklist + example middleware
- E2E scenario for post → comment → vote ❌ (delayed.)

Files:
- `post.service.ts`, `comment.service.ts`, `http.interceptor.ts`, `server.ts`

### 5. Project Management + AI (forgeofwill) — 3–5 days
Tasks:
- AI Orchestrator endpoint holding keys and enforcing quotas.
- Conversation/context store with privacy settings.
- Autosave & optimistic update UX patterns.
- Enforce permissions for project/task operations.

Verification:
- Unit tests for prompt generation; integration tests mocking AI responses.

Checklist (deliverables):
- Orchestrator endpoint scaffold + rate-limit enforcement
- Prompt-generation unit tests (libs/prompt-generation)
- Privacy settings design doc
- Integration test mocking AI responses

Files:
- `project.service.ts`, `index.ts`, prompt libs under `libs/prompt-generation`

### 6. Blog & Portfolio — 1–2 days each
Tasks:
- Blog: editor, drafts, RSS, search, authoring permissions.
- Portfolio: spam-protected contact form, SEO metadata, sitemap.

Verification:
- Lighthouse checks, RSS validator, contact form integration tests.

Checklist (deliverables):
- Editor & draft flow demo
- RSS feed generation + validation
- Contact form spam protection test
- Authoring role permission mapping

Files:
- `blog.service.ts`, `contact.service.ts`

### 7. Assets & uploads — 1–2 days
Tasks:
- Central assets service for signed URL uploads, size/type checks, virus-scan stub.
- Wire social and project apps to assets endpoints; permission checks on delete.

Verification:
- Upload/download/delete tests.

Checklist (deliverables):
- Assets service signed URL API
- Upload validation tests (size/type)
- Permission-protected delete tests

Files:
- `app.service.ts`, migrations under `apps/assets/migrations/*.ts`

### 8. Security & operational hardening — initial pass 1–2 days
Tasks:
- Input validation on DTOs, sanitize outputs.
- Rate limiting at gateway: update `main.ts`.
- Ensure AI keys never go to front-end.
- Limit request size in express servers.

Verification:
- Security tests and manual scan.

Checklist (deliverables):
- DTO validation coverage report
- Gateway rate-limiting config + test
- Request-size limits applied in server configs
- Secrets audit note (AI keys)

Files:
- `main.ts`, `server.ts`, DTOs in `libs/models/*`

### 9. Tests / CI / FIRST enforcement — 1–2 days
Tasks:
- Unit tests for permission checks, services.
- Integration tests for critical RBAC flows.
- Ensure Nx CI uses `nx affected` and targeted tests.

Verification:
- CI passes for affected changes.

Checklist (deliverables):
- Unit + integration test suite additions
- CI job updates to run affected tests
- Example nx command usage in CONTRIBUTING

Files:
- Jest configs: `jest.config.ts`, project-level jest configs, e2e setup.

### 10. Observability, rollout & docs — 1 day
Tasks:
- Structured logs, metrics for permission-denied events.
- Document the permissions matrix and per-app provider requirements.
- Roll forward one app at a time with feature toggles.

Verification:
- Metrics surfaced and basic alerting for anomalies.

Checklist (deliverables):
- Logging & metrics snippets for permission-denied events
- Per-app README updates with provider requirements
- Rollout plan with feature-flag steps

Files to update:
- per-app README files and a central `docs/permissions-audit.md`.

---

## Roles & Permissions model (minimal)
- Roles: Owner, Admin, Member, Guest
- Permissions granularity:
  - Resource: project, task, risk, journal, post, comment, asset
  - Action: create, read, update, delete, query
  - Scope: own vs any

Example mapping (start small):
- Owner: full (any) on owned projects
- Admin: create/read/update/delete on project resources (any) with restrictions
- Member: create/read/update on project resources (own or project-scoped)
- Guest: read-only where permitted

---

## Quick verification targets (smoke tests)
- AuthN: login → obtain token → call `project-planning.controller.ts` endpoints.
- RBAC: test owner vs member vs guest for create/update/delete.
- Assets: upload via assets service, verify metadata and permission-protected delete.
- AI: call orchestrator endpoint with server-side key in tests.

---

## Commands / common references
- Start standard stack:
  ```
  docker-compose up -d
  ```
- Start Forge of Will stack:
  ```
  docker-compose -f fow.docker-compose.yaml up -d
  ```
- Nx test example:
  ```
  nx test common-ui
  ```
