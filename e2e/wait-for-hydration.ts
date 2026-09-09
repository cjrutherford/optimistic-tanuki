import type { Page } from '@playwright/test';

/**
 * Waits until a server-rendered Angular page is actually interactive.
 *
 * digital-homestead, forgeofwill and fin-commander all bootstrap with
 * `provideClientHydration(withEventReplay())`. Event replay records a click
 * that lands before hydration and replays it afterwards — which is fine for
 * ordinary handlers, but an OAuth button calls `window.open`, and a popup
 * opened from a replayed event is no longer tied to a user gesture. The click
 * is then swallowed: no popup, no console error, nothing to assert against.
 * The suites timed out waiting for a provider request that could never
 * happen.
 *
 * Hydration is late in these apps because their index.html pulls
 * render-blocking scripts from third-party CDNs (quill, highlight.js), so
 * bootstrap waits on a network that CI cannot hurry. client-interface, which
 * has neither the blocking scripts nor event replay, was the one OAuth suite
 * that always passed.
 *
 * Waiting for the network to settle is the honest way to express "the page has
 * finished loading the things that gate its bootstrap" without reaching into
 * Angular's internals. It is only needed before a click whose handler opens a
 * popup.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
}
