import { test as base, expect } from '@playwright/test';

/**
 * Hosts the E2E stack actually serves. Everything else is third party.
 *
 * The stack binds every app and service to a loopback port, so anything
 * addressed elsewhere is a request the suite has no control over.
 */
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function isLocal(url: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(url).hostname);
  } catch {
    // A URL we cannot parse is not one of ours.
    return false;
  }
}

/**
 * Playwright's `test`, extended so every page in the suite is sealed off from
 * the public internet.
 *
 * Several apps pull webfonts straight from fonts.googleapis.com, both from
 * index.html and at runtime through FontLoadingService. A stylesheet request
 * blocks the document's `load` event, so when that host is slow or
 * unreachable from the runner, `page.goto()` — which waits for `load` by
 * default — hangs until the test times out. Nothing under test depends on the
 * response, so the suite should never have been reaching for it.
 *
 * Third-party requests are fulfilled with an empty 200 rather than aborted:
 * an abort surfaces as a console error and, for a stylesheet, can cascade
 * into unrelated assertions about page errors.
 */
export const test = base.extend<{ sealedFromThirdParties: void }>({
  sealedFromThirdParties: [
    async ({ context }, use) => {
      await context.route(
        (url) => !isLocal(url.toString()),
        (route) =>
          route.fulfill({
            status: 200,
            contentType: 'text/plain',
            body: '',
          })
      );

      await use();
    },
    { auto: true },
  ],
});

export { expect };
