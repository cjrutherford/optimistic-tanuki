import { expect, test } from '@playwright/test';
import { appendFileSync, chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const tsOrigin = new URL(process.env['TS_BASE_URL'] ?? 'http://127.0.0.1:8092')
  .origin;
const enabled = process.env['RR09_V01_CURRENT_REVIEW'] === 'true';
const workspaceRoot = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const evidenceDirectory = join(
  workspaceRoot,
  '.runtime-artifacts/rr09/v01/current-review'
);
const metadataPath = join(evidenceDirectory, 'screenshots.jsonl');

const routes = [
  { label: 'ts-cities', path: '/cities', heading: 'Explore Local Hubs' },
  {
    label: 'ts-communities',
    path: '/communities',
    heading: 'Local Communities',
  },
  {
    label: 'ts-city-classifieds',
    path: '/city/savannah-ga/classifieds',
    heading: 'Back to Community',
  },
];

function record(value: Record<string, unknown>): void {
  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  appendFileSync(metadataPath, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  chmodSync(metadataPath, 0o600);
}

test('RR09 V01 current review screenshots for read-only Local Hub routes', async ({
  page,
}, testInfo) => {
  test.skip(
    !enabled,
    'Explicitly opt-in current-source, read-only evidence capture'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'One system-Chrome desktop capture'
  );
  test.setTimeout(60_000);
  expect(new URL(tsOrigin).port, 'uses source-built Local Hub origin').toBe(
    '8092'
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const route of routes) {
    const apiStatuses: Record<string, number[]> = {};
    const onResponse = (response: import('@playwright/test').Response) => {
      const url = new URL(response.url());
      if (!url.pathname.includes('/api/')) return;
      const category = url.pathname.includes('classified')
        ? 'classifieds'
        : url.pathname.includes('community')
        ? 'communities'
        : 'other';
      (apiStatuses[category] ??= []).push(response.status());
    };
    page.on('response', onResponse);
    const response = await page.goto(`${tsOrigin}${route.path}`, {
      waitUntil: 'domcontentloaded',
    });
    expect(
      new URL(page.url()).origin,
      'browser stays on explicit TS origin'
    ).toBe(tsOrigin);
    await expect(page.getByText(route.heading, { exact: false })).toBeVisible({
      timeout: 15_000,
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    );

    const screenshotName = `${route.label}-1280x900.png`;
    const screenshotPath = join(evidenceDirectory, screenshotName);
    const screenshot = await page.screenshot({ fullPage: false });
    mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
    chmodSync(evidenceDirectory, 0o700);
    writeFileSync(screenshotPath, screenshot, { mode: 0o600 });
    chmodSync(screenshotPath, 0o600);
    const pageState = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      visibleHeadingCount: Array.from(document.querySelectorAll('h1')).filter(
        (node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return (
            rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
          );
        }
      ).length,
    }));
    record({
      capturedAt: new Date().toISOString(),
      app: 'local-hub',
      origin: tsOrigin,
      route: route.path,
      auth: 'anonymous public route; no identity data stored',
      navigationStatus: response?.status() ?? null,
      viewport: { width: 1280, height: 900 },
      themeAttribute: pageState.theme,
      prefersReducedMotion: pageState.reducedMotion,
      reducedMotionMode: 'Playwright emulation',
      visibleHeadingCount: pageState.visibleHeadingCount,
      apiStatusCounts: Object.fromEntries(
        Object.entries(apiStatuses).map(([category, statuses]) => [
          category,
          statuses.reduce<Record<string, number>>((counts, status) => {
            counts[String(status)] = (counts[String(status)] ?? 0) + 1;
            return counts;
          }, {}),
        ])
      ),
      screenshot: screenshotName,
      screenshotSha256: createHash('sha256').update(screenshot).digest('hex'),
    });
    page.off('response', onResponse);
  }
});
