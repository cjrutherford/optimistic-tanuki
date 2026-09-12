# digital-homestead: nothing on the client hydrates

Written from CI evidence gathered while repairing the e2e suites, so the revamp
starts from findings rather than rediscovery.

## The symptom

**Nobody can sign in to digital-homestead by any means.** Not OAuth, not email
and password.

This was found through the OAuth button, which made it look like an OAuth
problem for several rounds. It is not. OAuth was simply the first control
anyone clicked.

## The evidence

From Playwright traces and gateway container logs on runs 34412346552,
34415500279 and 34421448066.

**The click reaches the element and nothing follows.** Playwright records the
full sequence — `attempting click action`, `element is visible, enabled and
stable`, `click action done` — and then nothing at all. No popup, no
navigation, no request, no console error, no rendered error banner. Only the
`.error-banner` CSS is present in the stylesheet; no instance is ever rendered.

**Retrying does not help.** A helper was added that clicks up to three times,
waiting five seconds for a popup each time. All three clicks completed and no
popup ever opened. That rules out a transient re-render race, which had been the
competing explanation.

**Email and password behaves identically.** Submitting the login form produces
**no `/api/authentication/login` request**. The whole network trace for a full
run contains three requests: an API registration the test makes itself, the RUM
beacon, and `/login`.

**It is not limited to the login route.** With a valid session cookie already in
the context's jar, `/blog` never issued the `/api/authentication/session` call
that `AuthStateService`'s constructor makes. `isAuthenticated()` stayed at its
server-rendered `false`, so the page kept showing anonymous copy and the
editor's entry points never appeared.

**The shell does boot.** `ThemeService` logs `Theme initialization complete` and
applies a personality in the browser. So `bootstrapApplication` runs; it is the
routed components that never instantiate on the client.

**The gateway never sees any of it.** Zero `Getting OAuth configuration for
domain=` lines for digital-homestead across every run, while fin-commander's
gateway logged them repeatedly on the same stack. The failure is entirely in the
browser, ahead of the network.

## What has been ruled out

- **Routing.** The screencast shows this app's own login page, with its own
  `description` text.
- **Component wiring.** Traced statically end to end: `otui-button` →
  `(action)` → `onProviderClick` → `providerSelected` → `oauthProviderSelected`
  → `onOAuthProvider` → `initiateOAuthLogin` → `window.open`. Every link is
  correct, and nothing is awaited before `window.open`.
- **A blocked popup.** That path rejects with "Failed to open OAuth popup",
  which `onOAuthProvider` catches into `this.error` and the template renders. No
  banner ever appeared.
- **The gateway, its OAuth config, and the startup race.** All addressed
  separately and all now working for other apps on the same stack.

## Leads

**`app.routes.server.ts` prerenders everything.** It ends with
`{ path: '**', renderMode: RenderMode.Prerender }`. A prerendered document is
static HTML produced at build time. This is the most likely place to start:
confirm whether the served document carries the hydration annotations the client
needs, and whether the prerendered output matches what the client router expects
to take over.

**`startPerformanceMonitoring` runs before `bootstrapApplication`** in
`main.ts`. It is the source of the `/api/performance/rum` request seen in the
trace, so it does execute; worth confirming it cannot leave the app in a state
where hydration is skipped.

Confirming either means building and serving the app locally and watching
hydration, rather than reading CI traces. That is where this should pick up.

## The cookie-auth angle

The app is being moved from token auth to cookie auth, and that is expected to
be part of the revamp. Two things already in place are worth keeping in view:

- `AuthStateService.restoreSession()` reads `GET /api/authentication/session`
  with `withCredentials`, and `login()` sends `X-ot-session-mode: cookie`. The
  gateway sets `ot_session` **at path `/`** — both in `OAuthController`'s redeem
  handler and in `AuthenticationController.browserSessionCookieOptions()`. Two
  e2e suites previously asserted `/api` and were wrong.
- `apps/digital-homestead/src/server.ts` proxies `/api` with
  `changeOrigin: true` and no `xfwd`, so the gateway sees `Host: gateway:3000`.
  `client-interface` deliberately uses `changeOrigin: false, xfwd: true` to
  preserve the caller's host. The gateway resolves some OAuth configuration by
  domain, so this difference is worth settling during the revamp even though it
  is not the cause of the hydration failure.

## What the e2e suites do meanwhile

- `apps/digital-homestead-e2e/src/blog-editor.spec.ts` — the editor suite is
  `test.describe.skip`, with this finding summarised at the skip. The tests
  themselves are written against the real editor and were passing their own
  assertions before login broke; they are waiting on the app.
- The same file's "signed-in user without a role sees read-only" case is
  skipped for the same reason. The anonymous case beside it still runs, because
  it only asserts what the server rendered.
- `apps/digital-homestead/src/app/components/login-page/login-page.component.ts`
  has `[showOAuth]="false"`, so the dead provider buttons are not shown. Restore
  them when the page works again.
- `example.spec.ts` still runs 49 tests. Worth knowing: they assert
  server-rendered structure, so they pass regardless of hydration and should not
  be read as evidence that the app works.
