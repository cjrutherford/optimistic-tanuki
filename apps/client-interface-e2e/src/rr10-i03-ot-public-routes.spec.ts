import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const origin = new URL(process.env['OT_BASE_URL'] ?? 'http://127.0.0.1:8080')
  .origin;
const workspaceRoot = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const evidenceDirectory = resolve(workspaceRoot, '.runtime-artifacts/rr10');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidencePath = resolve(
  evidenceDirectory,
  `i03-ot-public-routes-${runId}.json`
);

async function pageState(page: Page) {
  return {
    url: page.url(),
    title: await page.title(),
    headings: await page.getByRole('heading').allTextContents(),
    bodyText: (await page.locator('body').innerText()).slice(0, 2_000),
  };
}

test('RR10 I03 anonymous OT home and forum routes survive direct navigation and refresh', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR10_I03_LIVE_STACK'] !== 'true',
    'Requires the current local OT stack'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Public route provenance is recorded once in system Chrome'
  );
  test.setTimeout(60_000);
  expect(new URL(origin).port).toBe('8080');
  const buildRunId = process.env['RR10_I03_BUILD_RUN'];
  expect(buildRunId, 'record the current-source Nx build run').toBeTruthy();
  expect(process.env['RR10_I03_CONTAINER_ID']).toBeTruthy();
  expect(process.env['RR10_I03_IMAGE_ID']).toBeTruthy();
  expect(process.env['RR10_I03_CONTAINER_STARTED']).toBeTruthy();
  expect(process.env['RR10_I03_RUNTIME_MOUNT']).toContain('dist/apps');
  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  chmodSync(evidenceDirectory, 0o700);

  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  }).trim();
  const sourceFiles = [
    'apps/client-interface/src/app/app.routes.ts',
    'libs/forum-ui/src/lib/forum-ui/forum.routes.ts',
    'libs/forum-ui/src/lib/forum-ui/shell/forum-shell.component.ts',
    'libs/forum-ui/src/lib/forum-ui/shell/forum-shell.component.html',
  ];
  const sourceSha256 = Object.fromEntries(
    sourceFiles.map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(resolve(workspaceRoot, path)))
        .digest('hex'),
    ])
  );
  const servedMain = await page.request.get(`${origin}/main.js`);
  const servedMainHash = createHash('sha256')
    .update(await servedMain.body())
    .digest('hex');
  const builtMainHash = createHash('sha256')
    .update(
      readFileSync(
        resolve(workspaceRoot, 'dist/apps/client-interface/browser/main.js')
      )
    )
    .digest('hex');
  expect(servedMain.status()).toBe(200);
  expect(servedMainHash).toBe(builtMainHash);

  const results: Record<string, unknown>[] = [];
  const pageErrors: string[] = [];
  const apiStatuses: Record<string, number>[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 300)));
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === '/api/forum/topics') {
      apiStatuses.push({ status: response.status() });
    }
  });

  for (const path of ['/', '/forum']) {
    const forumResponse =
      path === '/forum'
        ? page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/forum/topics' &&
              response.status() === 200
          )
        : undefined;
    const directResponse = await page.goto(`${origin}${path}`, {
      waitUntil: 'domcontentloaded',
    });
    if (path === '/forum') {
      await forumResponse;
      await expect(
        page.getByText('Forum Topics', { exact: true })
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'New Post' })).toHaveCount(
        0
      );
    } else {
      await expect(page.locator('body')).not.toBeEmpty();
    }
    const directState = await pageState(page);
    const refreshedForumResponse =
      path === '/forum'
        ? page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/forum/topics' &&
              response.status() === 200
          )
        : undefined;
    const refreshResponse = await page.reload({
      waitUntil: 'domcontentloaded',
    });
    if (path === '/forum') {
      await refreshedForumResponse;
      await expect(
        page.getByText('Forum Topics', { exact: true })
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'New Post' })).toHaveCount(
        0
      );
    }
    const refreshedState = await pageState(page);
    expect(directResponse?.status()).toBe(200);
    expect(refreshResponse?.status()).toBe(200);
    expect(directState.url).toBe(`${origin}${path}`);
    expect(refreshedState.url).toBe(`${origin}${path}`);
    results.push({
      path,
      directStatus: directResponse?.status(),
      directState,
      refreshStatus: refreshResponse?.status(),
      refreshedState,
    });
    const screenshotPath = resolve(
      evidenceDirectory,
      `i03-ot-${path === '/' ? 'home' : 'forum'}-${runId}.png`
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
        runtimeContainerId: process.env['RR10_I03_CONTAINER_ID'] ?? null,
        runtimeImageId: process.env['RR10_I03_IMAGE_ID'] ?? null,
        runtimeStartedAt: process.env['RR10_I03_CONTAINER_STARTED'] ?? null,
        runtimeMount: process.env['RR10_I03_RUNTIME_MOUNT'] ?? null,
        servedMainSha256: servedMainHash,
        localBuiltMainSha256: builtMainHash,
        relevantSourceSha256: sourceSha256,
        anonymousContext: true,
        results,
        apiStatuses,
        pageErrors,
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
  chmodSync(evidencePath, 0o600);
  expect(pageErrors).toEqual([]);
  expect(apiStatuses.length).toBeGreaterThanOrEqual(2);
  expect(apiStatuses.every(({ status }) => status === 200)).toBe(true);
});
