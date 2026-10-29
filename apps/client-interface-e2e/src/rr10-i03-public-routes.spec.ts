import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const origin = new URL(process.env['TS_BASE_URL'] ?? 'http://127.0.0.1:8087')
  .origin;
const workspaceRoot = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const evidenceDirectory = resolve(workspaceRoot, '.runtime-artifacts/rr10');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidencePath = resolve(
  evidenceDirectory,
  `i03-ts-public-routes-${runId}.json`
);
const routes = [
  { path: '/cities', heading: 'Explore Local Hubs' },
  { path: '/communities', heading: 'Local Communities' },
  { path: '/city/savannah-ga/classifieds', heading: 'Classifieds' },
];

async function pageState(page: Page) {
  return {
    url: page.url(),
    title: await page.title(),
    headings: await page.getByRole('heading').allTextContents(),
    bodyText: (await page.locator('body').innerText()).slice(0, 2_000),
  };
}

test('RR10 I03 Towne Square public routes survive direct navigation and refresh', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR10_I03_LIVE_STACK'] !== 'true',
    'Requires the current local Towne Square stack'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Public route provenance is recorded once in system Chrome'
  );
  test.setTimeout(60_000);
  expect(new URL(origin).port).toBe('8087');
  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  chmodSync(evidenceDirectory, 0o700);

  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  }).trim();
  const buildRunId = process.env['RR10_I03_TS_BUILD_RUN'];
  expect(buildRunId, 'record the current-source Nx build run').toBeTruthy();
  const servedMain = await page.request.get(`${origin}/main.js`);
  const servedMainHash = createHash('sha256')
    .update(await servedMain.body())
    .digest('hex');
  const builtMainHash = createHash('sha256')
    .update(
      readFileSync(
        resolve(workspaceRoot, 'dist/apps/local-hub/browser/main.js')
      )
    )
    .digest('hex');
  const sourceFiles = [
    'apps/local-hub/src/app/app.routes.ts',
    'apps/local-hub/src/app/app.component.ts',
  ];
  const relevantSourceSha256 = Object.fromEntries(
    sourceFiles.map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(resolve(workspaceRoot, path)))
        .digest('hex'),
    ])
  );
  expect(process.env['RR10_I03_TS_CONTAINER_ID']).toBeTruthy();
  expect(process.env['RR10_I03_TS_IMAGE_ID']).toBeTruthy();
  expect(process.env['RR10_I03_TS_CONTAINER_STARTED']).toBeTruthy();
  expect(servedMain.status()).toBe(200);
  expect(servedMainHash).toBe(builtMainHash);

  const results: Record<string, unknown>[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 300)));
  for (const route of routes) {
    const directResponse = await page.goto(`${origin}${route.path}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByRole('heading', { name: route.heading })
    ).toBeVisible();
    const directState = await pageState(page);
    const refreshResponse = await page.reload({
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByRole('heading', { name: route.heading })
    ).toBeVisible();
    const refreshedState = await pageState(page);
    expect(directResponse?.status()).toBe(200);
    expect(refreshResponse?.status()).toBe(200);
    expect(directState.url).toBe(`${origin}${route.path}`);
    expect(refreshedState.url).toBe(`${origin}${route.path}`);
    results.push({
      path: route.path,
      expectedHeading: route.heading,
      directStatus: directResponse?.status(),
      directState,
      refreshStatus: refreshResponse?.status(),
      refreshedState,
    });
    const screenshotPath = resolve(
      evidenceDirectory,
      `i03-ts-${route.path.replaceAll('/', '_')}-${runId}.png`
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    chmodSync(screenshotPath, 0o600);
  }

  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        origin,
        sourceCommit,
        buildRunId,
        runtimeContainerId: process.env['RR10_I03_TS_CONTAINER_ID'] ?? null,
        runtimeImageId: process.env['RR10_I03_TS_IMAGE_ID'] ?? null,
        runtimeStartedAt: process.env['RR10_I03_TS_CONTAINER_STARTED'] ?? null,
        runtimeMount: process.env['RR10_I03_TS_RUNTIME_MOUNT'] ?? null,
        servedMainStatus: servedMain.status(),
        servedMainSha256: servedMainHash,
        localBuiltMainSha256: builtMainHash,
        relevantSourceSha256,
        results,
        pageErrors,
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
  chmodSync(evidencePath, 0o600);
  expect(pageErrors).toEqual([]);
});
