import type { Locator, Page } from '@playwright/test';

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

/**
 * Clicks a control that opens a popup, retrying if no popup appears.
 *
 * digital-homestead re-themes itself repeatedly on load — its console shows a
 * run of "Setting personality" and "Personality theme saved" entries that the
 * other apps do not produce — and each pass re-renders the OAuth buttons. A
 * click dispatched between Playwright's actionability check and that re-render
 * lands on a node that is no longer in the tree: the trace records the click
 * completing, and then nothing at all happens. No popup, no navigation, no
 * console error, no error banner.
 *
 * Retrying is a mitigation, not a diagnosis. It is also the cheapest way to
 * confirm the diagnosis: if a second click succeeds where the first was
 * swallowed, the first was landing on a detached element. A click that opens a
 * popup is safe to repeat, because the wait stops at the first popup and the
 * attempt only repeats when none arrived.
 */
export async function clickForPopup(
  page: Page,
  locator: Locator,
  { attempts = 3, timeout = 5_000 } = {}
): Promise<Page> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const popupPromise = page.waitForEvent('popup', { timeout });
    await locator.click();
    try {
      return await popupPromise;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `No popup opened after ${attempts} clicks. Last error: ${String(lastError)}`
  );
}
