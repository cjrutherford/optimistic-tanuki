# Forge of Will Forum Access Browser Acceptance Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish a browser-level contract for whether Forge of Will forum pages are public-read or authenticated-only, while ensuring forum writes remain permission-gated and session transitions are safe.

**Architecture:** Keep the policy decision at the Forge route boundary and preserve the reusable `forum-ui` shell for rendering and action-level permission checks. Use Playwright against the isolated Forge E2E stack with deterministic API-created fixtures, then assert visible UI, navigation, and relevant network outcomes together.

**Tech Stack:** Angular Router, `@optimistic-tanuki/forum-ui`, Forge of Will E2E, Playwright through Nx, gateway cookie sessions, and seeded forum/authentication services.

---

## Current evidence

- Forge navigation describes Forum as “Longer-form discussion and decisions” in [app.component.ts](../../apps/forgeofwill/src/app/app.component.ts:37).
- The top-level `/forum` route has no `AuthenticationGuard` or `ProfileGuard` in [app.routes.ts](../../apps/forgeofwill/src/app/app.routes.ts:50).
- The shared forum route factory resolves login state and permissions but does not enforce authentication in [forum.routes.ts](../../libs/forum-ui/src/lib/forum-ui/forum.routes.ts:4).
- The forum shell loads topics for browser users even when `isLoggedIn` is false, while hiding the new-post action and redirecting write attempts to `/login` in [forum-shell.component.ts](../../libs/forum-ui/src/lib/forum-ui/shell/forum-shell.component.ts:118) and [forum-shell.component.html](../../libs/forum-ui/src/lib/forum-ui/shell/forum-shell.component.html:31).
- Forge E2E currently has no forum-specific browser spec; its suite covers generic loading, OAuth, personality/navigation, and profile update.

The existing code therefore supports a plausible public-read/private-write policy, but the product intent is not encoded in a browser contract.

## Policy decision gate

Choose one policy before writing the assertions:

### Recommended: public forum read, authenticated permission-gated write

Guests may browse forum topics, topics, threads, and posts. Only authenticated users with the relevant permissions may create topics, threads, or posts. This matches the existing shell behavior and avoids making the landing/navigation promise depend on sign-in.

### Alternative: authenticated-only forum

Guests navigating to `/forum`, `/forum/topic/:topicId`, or `/forum/thread/:threadId` are redirected to `/login`; no forum read request is made from the guest page. Authenticated users then receive the same read/write and permission behavior.

Do not implement a hybrid policy where the root is public but deep links silently redirect; the browser contract must be consistent across all forum entry points.

## Browser acceptance matrix

### Shared fixture requirements

Create a focused fixture/helper, preferably under `e2e/support/forgeofwill-forum.ts`, that:

1. Creates two isolated users through the existing authentication API or checked-in E2E helper.
2. Establishes a session using the current cookie-session login path, not direct localStorage token injection.
3. Creates one topic, one thread, and one post through the forum API using the authorized user.
4. Creates permission variants: full forum writer, authenticated reader without create permissions, and anonymous context.
5. Returns stable titles containing a test-run identifier so parallel or retry runs do not collide.
6. Cleans up only resources created by the test if the backend supports deletion; otherwise uses a fresh E2E database/profile per run.

### Guest read behavior — recommended policy

Test: `guest can browse forum content but cannot write`.

- Navigate to `/forum`.
- Wait for the forum loading state to settle; do not use a fixed sleep.
- Assert the URL remains `/forum` and `.forum-shell` plus `Forum Topics` are visible.
- Assert the seeded topic title is visible.
- Assert no `Create New Topic`, `Create New Thread`, or `New Post` control is visible.
- Assert the topics request completed successfully and is made with the expected cookie/session mode.
- Open the seeded topic and thread deep links and assert content remains readable.
- Capture console errors and failed `/api/forum/*` requests; fail on unexpected 5xx or client exceptions.

### Guest behavior — authenticated-only policy

Test: `anonymous forum entry points redirect to login`.

- Visit `/forum`, `/forum/topic/:topicId`, and `/forum/thread/:threadId` in separate fresh contexts.
- Assert each route ends at `/login` with no forum shell visible.
- Assert no guest page sends a successful `/api/forum/topics`, `/topic/:id`, or `/thread/:id/posts` read request.
- Assert a controlled login route is used rather than a blank shell or uncaught error.

### Authenticated reader behavior

Test: `authenticated reader can browse but cannot see or invoke write controls`.

- Establish the reader’s cookie session and selected profile.
- Visit root, topic, and thread routes.
- Assert forum content renders and reload preserves access.
- Assert create controls are absent when the resolver does not grant `forum.topic.create` or `forum.thread.create`.
- Assert direct navigation to the same deep links remains stable after reload.

### Authenticated writer behavior

Test: `authorized writer can create a topic, thread, and post`.

- Establish the writer’s session.
- Assert the appropriate create controls are visible.
- Create a uniquely named topic and assert navigation to `/forum/topic/:id`.
- Create a thread and assert the thread appears in the topic view.
- Create a post and assert it appears in the thread view after the explicit refresh/read signal.
- Assert each successful write returns the expected status and no duplicate submission occurs.

### Session transition and write protection

Test: `logout removes forum write access without stale UI state`.

- Start as an authorized writer on a thread.
- Log out through the app UI.
- Revisit the root, topic, and thread URLs.
- Apply the selected policy’s guest assertions.
- Assert no stale composer remains visible and no authenticated write request is sent.
- If public-read is selected, assert reads remain available while writes are rejected with 401/403 through a browser-context request.

### Permission and backend enforcement

Test: `forum UI and backend agree on permission boundaries`.

- Use an authenticated reader without create permissions.
- Assert create controls are hidden.
- Attempt the corresponding API write from the same browser context and assert 401/403, never 2xx.
- Use an authorized writer and assert the same operation succeeds.
- Record the permission names and response statuses in the test failure message so a seed/configuration drift is diagnosable.

## Implementation tasks after policy approval

### Task 1: Add deterministic Forge forum fixtures

**Files:**

- Create/modify: `e2e/support/forgeofwill-forum.ts`
- Inspect/modify: `apps/forgeofwill-e2e/global-setup.ts`
- Inspect/modify: `e2e/docker-compose.forgeofwill-e2e.yaml`

Use API setup only for data creation; use browser navigation for the behavior under test. Confirm the fixture can distinguish app cookies from any legacy token state.

### Task 2: Add the policy-specific guest/read spec

**Files:**

- Create: `apps/forgeofwill-e2e/src/forum-access.spec.ts`
- Modify only if shared: `apps/forgeofwill-e2e/playwright.config.ts`

Implement the selected guest, deep-link, and network assertions. Capture console/page errors and unexpected forum request failures.

### Task 3: Add authenticated permission/write coverage

**Files:**

- Extend: `apps/forgeofwill-e2e/src/forum-access.spec.ts`
- Inspect: `libs/forum-ui/src/lib/forum-ui/shell/forum-shell.component.ts`
- Inspect: `apps/forgeofwill/src/app/app.routes.ts`
- Test if route behavior changes: `apps/forgeofwill/src/app/authentication.guard.spec.ts`

Keep route policy and action-level permissions separate: route access decides whether the page can be read; resolver permissions decide which controls and writes are available.

### Task 4: Run the focused Nx gate

With the isolated Forge stack running and `SKIP_SETUP=true` when reusing it:

```bash
SKIP_SETUP=true NX_DAEMON=false NX_ISOLATE_PLUGINS=false \
  pnpm nx run forgeofwill-e2e:e2e-ci--src/forum-access.spec.ts --skip-nx-cache
```

Then run the affected suite:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false \
  pnpm nx run forgeofwill-e2e:e2e-ci
```

Use the system Chrome channel, wait on visible/data-ready signals, and inspect trace/network artifacts on failure. Do not use `down -v` during a shared-stack validation.

## Definition of acceptance

The forum policy is complete only when:

1. Root and deep-link guest behavior match the chosen policy.
2. Authenticated content access survives reload and cookie-session restoration.
3. Permissionless users cannot see or perform write actions.
4. Authorized users can complete the intended topic/thread/post flow.
5. Logout/session expiry removes write capability and leaves no stale composer.
6. Browser assertions cover both visible outcomes and relevant network status.
7. The selected policy is documented in the scorecard and route comments/tests so a future route refactor cannot silently change it.
