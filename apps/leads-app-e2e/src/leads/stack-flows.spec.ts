import { expect, Page, test } from '@playwright/test';

/**
 * End-to-end checks that need the real docker stack, not the bare dev server.
 *
 * Everything here touches the gateway: the anonymous redirect resolves auth
 * state through `/api`, and the onboarding, topics, and application flows all
 * require a signed-in profile.
 *
 * The signed-in tests register their own throwaway account rather than reusing
 * a developer's login. That keeps the suite runnable on any stack without
 * out-of-band setup, keeps real credentials out of the repo, and stops one
 * test's leftover data from steering another's assertions. Run with:
 *
 *   PW_CHANNEL=chrome BASE_URL=http://localhost:8095 \
 *     pnpm exec playwright test --config=apps/leads-app-e2e/playwright.config.ts \
 *     --project=chromium stack-flows
 */

/** Mirrors `http.interceptor.ts` — the gateway scopes sessions per app. */
const LEADS_HEADERS = {
  'X-ot-appscope': 'leads-app',
  'X-ot-session-mode': 'cookie',
};

const TEST_PASSWORD = 'E2ePassw0rd!test';

test.describe('leads-app against the docker stack', () => {
  test('anonymous visitors get the landing page with a route to sign in', async ({
    page,
  }) => {
    // `/` serves the marketing landing page, not a redirect — app.routes.ts
    // maps '' to LandingComponent. An older test asserted a /login redirect that
    // the app no longer performs.
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Opportunities worth pursuing.' })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
  });

  test('the gateway is reachable from the app origin', async ({ request }) => {
    // A same-origin /api call proves the app and gateway are wired together,
    // which is the thing a dev-server-only run cannot demonstrate.
    const response = await request.get('/api/oauth/config');
    expect([200, 401, 404]).toContain(response.status());
  });

  test('a failed sign-in reports the failure instead of doing nothing', async ({
    page,
  }) => {
    await page.goto('/login');
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill('nobody@example.invalid');
    await page.getByPlaceholder('Password').fill('definitely-wrong');
    await page.getByRole('button', { name: /login/i }).click();

    // Before workstream A this silently did nothing at all.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 });
  });

  test.describe('signed in', () => {
    test.beforeEach(async ({ page }) => {
      const email = `leadse2e_${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}@test.com`;

      // `page.request` shares the page's cookie jar, so the session cookie the
      // gateway sets on login is the one the app then sends. Going through the
      // API rather than the login form keeps these tests focused on the pages
      // under test; the form itself is covered by the failed-sign-in test above.
      const register = await page.request.post('/api/authentication/register', {
        headers: LEADS_HEADERS,
        data: {
          fn: 'Leads',
          ln: 'Tester',
          email,
          password: TEST_PASSWORD,
          confirm: TEST_PASSWORD,
          bio: 'E2E test user',
        },
      });
      expect(
        register.status(),
        `Registration failed: ${await register.text()}`
      ).toBe(201);

      const login = await page.request.post('/api/authentication/login', {
        headers: LEADS_HEADERS,
        data: { email, password: TEST_PASSWORD },
      });
      expect(login.status(), `Login failed: ${await login.text()}`).toBe(201);
    });

    /**
     * `/topics` is gated on having finished onboarding, and the gate is
     * satisfied by owning at least one topic. Creating one through the API is
     * enough — driving the whole interview would make these tests depend on a
     * running model for something they do not actually assert.
     */
    const seedTopic = async (page: Page) => {
      const response = await page.request.post('/api/leads/topics', {
        headers: LEADS_HEADERS,
        data: {
          name: 'E2E seed topic',
          keywords: ['angular'],
        },
      });
      expect(
        response.status(),
        `Topic seeding failed: ${await response.text()}`
      ).toBe(201);
    };

    test('the topics page offers only usable sources', async ({ page }) => {
      await seedTopic(page);
      await page.goto('/topics');
      await page.getByRole('button', { name: /add topic/i }).click();

      const sources = page.locator('.source-selector').first();
      await expect(sources).toBeVisible({ timeout: 15000 });

      // Retired sources must not be offerable for a new topic.
      for (const retired of ['Indeed', 'Clutch', 'JustRemote']) {
        await expect(sources.getByText(retired, { exact: true })).toHaveCount(
          0
        );
      }
      // Replacements from workstream D should be.
      for (const active of ['Arbeitnow', 'Remotive', 'The Muse']) {
        await expect(sources.getByText(active, { exact: true })).toHaveCount(1);
      }
    });

    test('dream companies are presented separately from broad sources', async ({
      page,
    }) => {
      await seedTopic(page);
      await page.goto('/topics');
      await page.getByRole('button', { name: /add topic/i }).click();

      const panel = page.locator('.aspirational-group');
      await expect(panel).toBeVisible({ timeout: 15000 });
      await expect(panel).toContainText('Long shots');
      await expect(panel.getByText(/Greenhouse/)).toBeVisible();
    });

    test('the intro step is a fill-in composer, not a bare textarea', async ({
      page,
    }) => {
      await page.goto('/onboarding');

      const composer = page.locator('app-mad-lib-composer');
      // The scaffold must stay visible rather than living in a placeholder.
      await expect(composer).toBeVisible({ timeout: 20000 });
      await expect(composer).toContainText('I am a');
      await expect(
        page.getByRole('button', { name: /write it as a paragraph/i })
      ).toBeVisible();
    });
  });
});
