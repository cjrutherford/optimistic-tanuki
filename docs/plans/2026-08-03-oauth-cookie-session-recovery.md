# OAuth Cookie Session Recovery Implementation Plan

> **For Codex:** Apply this plan test-first in the current checkout; repository guidance prohibits worktrees.

**Goal:** Keep OAuth callback listeners alive through false cross-origin popup-closure reports and restore a valid cookie session when the login page loads.

**Architecture:** The shared OAuth service will treat `window.closed` only as a cancellation signal for token flows. Cookie-session OAuth will wait for the configured callback message, which is the authoritative completion signal. The Client Interface login component will explicitly restore an existing cookie session and reuse its normal post-login profile/navigation behavior.

**Tech Stack:** Angular, RxJS, Jest, Nx.

---

### Task 1: Protect cookie OAuth from false popup closure

**Files:**

- Modify: `libs/auth-ui/src/lib/services/oauth.service.ts`
- Test: `libs/auth-ui/src/lib/services/oauth.service.spec.ts`

1. Add a regression test that reports the popup closed, advances beyond the former grace period, and verifies a cookie-session login remains pending until an `oauth-callback` message arrives.
2. Run the focused test and observe the existing fallback resolve too early.
3. Remove the cookie-session closure-success fallback while retaining cancellation behavior for token flows.
4. Run the focused OAuth service spec.

### Task 2: Restore a valid cookie session on the login route

**Files:**

- Modify: `apps/client-interface/src/app/components/login.component.ts`
- Test: `apps/client-interface/src/app/components/login.component.spec.ts`

1. Add a regression test that starts the login component with a restorable cookie session and expects normal profile selection and feed navigation.
2. Run the focused test and observe no navigation.
3. Extract the existing successful-login continuation and invoke it after startup restoration and OAuth completion.
4. Run the focused login component spec.

### Task 3: Build verification

**Files:** no source changes.

1. Run the two focused Nx tests.
2. Run `client-interface` and affected shared-library builds with Nx.
3. Hand the stack rebuild to the user, then repeat the live Google flow.
