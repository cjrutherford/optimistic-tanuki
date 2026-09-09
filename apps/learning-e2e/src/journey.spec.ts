import { expect, test } from '@playwright/test';

/**
 * The learning app, driven in a real browser.
 *
 * These are the checks a person would make: does the catalog have courses in
 * it, does a lesson render as prose rather than as markdown source, is the app
 * installable, and is anything cached that must always reach the server.
 *
 * This previously ran through a local `agent-browser` binary rather than
 * Playwright, on the grounds that Playwright would not install browsers on the
 * author's host. That binary is not part of this repository and is not on the
 * CI runner, so every browser-driven check here failed with
 * `spawnSync agent-browser ENOENT` and the suite could never pass in CI. Its
 * workarounds — closing the browser between checks, opening each page twice,
 * and sleeping for a fixed settle time — were compensating for that tool
 * wedging its CDP session, and none of them are needed here.
 *
 * Expects a stack already running; BASE_URL points at the app.
 */

/** The gateway, which is a different origin from the app under test. */
const API_URL = process.env['API_URL'] || 'http://127.0.0.1:3000';

test.describe('Learning journey', () => {
  // The front door makes an argument. Checked signed out, because a visitor
  // deciding whether to bother is by definition not signed in.
  test('the landing page argues for itself', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1').first()).not.toBeEmpty();

    const body = page.locator('body');
    await expect(body).toContainText(/readable without an account/i);

    await expect(
      page.getByRole('button', { name: /browse courses/i })
    ).toBeVisible();
    // Writing a course is the half of the product nothing used to mention.
    await expect(
      page.getByRole('button', { name: /write a course/i })
    ).toBeVisible();

    // The curriculum preview reads the live catalog, so an empty one means the
    // page is promising courses it is not showing. The data service returns
    // EMPTY during server rendering, so this only fills in after hydration; if
    // that ever stops working the section renders its empty state and this
    // catches it.
    await expect(
      page.locator('otlearn-curriculum-preview li').first()
    ).toBeVisible();
  });

  test('the catalog offers courses, and a way in', async ({ page }) => {
    await page.goto('/courses');

    await expect(page.locator('h1').first()).not.toBeEmpty();

    const firstCourse = page.locator('a.course').first();
    await expect(firstCourse).toBeVisible();
    await expect(firstCourse).toHaveAttribute('href', /^\/course\//);

    await expect(page.locator('.session a')).toHaveAttribute(
      'href',
      '/sign-in'
    );
  });

  test('a course page says what the course is before asking', async ({
    page,
  }) => {
    await page.goto('/courses');
    const firstCourse = page.locator('a.course').first();
    await expect(firstCourse).toHaveAttribute('href', /^\/course\//);

    await page.goto((await firstCourse.getAttribute('href')) as string);

    await expect(page.locator('h1').first()).not.toBeEmpty();
    // At least two facts about the course before it asks for a commitment.
    expect(await page.locator('dl dd').count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole('button', { name: /enrol/i })).toBeVisible();
  });

  test('a lesson renders as prose with its code coloured', async ({ page }) => {
    await page.goto(
      '/module/go-foundations/go-foundations-basics/go-foundations-basics-hello-world'
    );

    const prose = page.locator('otlearn-lesson-prose');
    await expect(prose, 'the lesson body never rendered').toBeVisible();

    const token = prose.locator('.token.keyword').first();
    await expect(token, 'a highlighted token never rendered').toBeVisible();
    const pre = prose.locator('pre').first();
    await expect(pre, 'a code block never rendered').toBeVisible();

    const text = (await prose.textContent()) ?? '';
    expect(
      text.length,
      `only ${text.length} characters of lesson`
    ).toBeGreaterThan(200);
    expect(
      await prose.locator('h2,h3,h4').count(),
      'markdown headings did not become headings'
    ).toBeGreaterThan(0);
    expect(
      /(^|\n)#{1,4}\s/.test(text),
      'markdown source is showing through'
    ).toBe(false);

    const colours = await page.evaluate(() => {
      const el = document.querySelector('otlearn-lesson-prose');
      const keyword = el?.querySelector('.token.keyword');
      const block = el?.querySelector('pre');
      return {
        keyword: keyword ? getComputedStyle(keyword).color : '',
        background: block ? getComputedStyle(block).backgroundColor : '',
        body: getComputedStyle(document.body).color,
      };
    });
    expect(
      colours.keyword,
      'keywords are body-coloured, so the highlighting styles never landed'
    ).not.toBe(colours.body);
    expect(
      colours.background,
      'the code block has no background of its own'
    ).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('the app is installable', async ({ request }) => {
    const manifest = await request.get('/manifest.webmanifest');
    expect(
      manifest.ok(),
      `the manifest answered ${manifest.status()}`
    ).toBeTruthy();

    const parsed = await manifest.json();
    expect(parsed.name, 'the manifest has no name').toBeTruthy();
    expect(parsed.start_url, 'the manifest has no start_url').toBeTruthy();
    expect(
      (parsed.icons || []).some(
        (icon: { purpose?: string }) => icon.purpose === 'maskable'
      ),
      'the manifest has no maskable icon'
    ).toBe(true);

    const worker = await request.get('/ngsw-worker.js');
    expect(
      worker.ok(),
      `the service worker answered ${worker.status()}`
    ).toBeTruthy();
    expect(
      worker.headers()['content-type'] ?? '',
      'the service worker is served as something other than script'
    ).toContain('javascript');
  });

  test('the service worker can actually cache the shell', async ({
    request,
  }) => {
    const config = await (await request.get('/ngsw.json')).json();

    // Without the index in the hash table there is nothing to fall back to,
    // and navigations hang waiting for a page that was never cached.
    expect(
      Object.keys(config.hashTable || {}).some((file) =>
        file.includes('index')
      ),
      'the shell is not in the hash table, so nothing is cached'
    ).toBe(true);
    expect(
      config.navigationRequestStrategy,
      'navigations are answered from cache, which throws away server rendering'
    ).toBe('freshness');
  });

  test('the service worker never caches work that must reach the server', async ({
    request,
  }) => {
    const config = await (await request.get('/ngsw.json')).json();
    const cachedUrls = (config.dataGroups || []).flatMap(
      (group: { urls?: string[]; patterns?: string[] }) =>
        group.urls || group.patterns || []
    );

    for (const forbidden of [
      '/runs',
      '/submit',
      '/answer',
      '/enrolments',
      '/me/progress',
    ]) {
      expect(
        cachedUrls.some((url: string) => String(url).includes(forbidden)),
        `${forbidden} is cached, and it must always reach the server`
      ).toBe(false);
    }
  });

  test('an unknown lesson is a 404, not a server error', async ({
    request,
  }) => {
    const response = await request.get(
      `${API_URL}/api/learning/programs/no-such-track/lessons/no-such-lesson`
    );
    expect(
      response.status(),
      `an unknown lesson answered ${response.status()}`
    ).toBe(404);
  });
});
