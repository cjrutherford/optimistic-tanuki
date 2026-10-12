import { expect, test, type Page } from '@playwright/test';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const origin = new URL(process.env['BASE_URL'] ?? 'http://127.0.0.1:8080')
  .origin;
const credentialsPath =
  process.env['RR10_I03_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i03-credentials.json';
const evidenceDirectory = resolve(
  process.cwd().endsWith('apps/client-interface-e2e') ? '../..' : process.cwd(),
  '.runtime-artifacts/rr10'
);
const workspaceRoot = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidencePath = resolve(
  evidenceDirectory,
  `i03-permission-recovery-${runId}.json`
);

async function snapshot(page: Page) {
  return {
    url: page.url(),
    title: await page.title(),
    bodyText: (await page.locator('body').innerText()).slice(0, 4_000),
    visibleHeadings: await page.getByRole('heading').allTextContents(),
  };
}

test('RR10 I03 forum permission resolver recovers after a controlled 503', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR10_I03_LIVE_STACK'] !== 'true',
    'Requires the existing local OT stack and saved RR09 author account'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'The recovery state is recorded once in system Chrome'
  );
  test.setTimeout(90_000);
  expect(new URL(origin).port).toBe('8080');
  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8')) as {
    email: string;
    password: string;
  };
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
  const servedMainResponse = await page.request.get(`${origin}/main.js`);
  const servedMainHash = createHash('sha256')
    .update(await servedMainResponse.body())
    .digest('hex');
  const builtMainHash = createHash('sha256')
    .update(
      readFileSync(
        resolve(workspaceRoot, 'dist/apps/client-interface/browser/main.js')
      )
    )
    .digest('hex');
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
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  }).trim();
  const buildRunId = process.env['RR10_I03_BUILD_RUN'];
  expect(buildRunId, 'record the current-source Nx build run').toBeTruthy();
  expect(servedMainResponse.status()).toBe(200);
  expect(servedMainHash).toBe(builtMainHash);

  const events: Record<string, unknown>[] = [];
  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  chmodSync(evidenceDirectory, 0o700);
  page.on('pageerror', (error) =>
    events.push({ type: 'pageerror', message: error.message.slice(0, 500) })
  );
  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/permissions/permission-search')) {
      events.push({
        type: 'requestfailed',
        url: request.url(),
        failure: request.failure()?.errorText,
      });
    }
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/permissions/permission-search')) {
      events.push({
        type: 'permission-response',
        status: response.status(),
        url: response.url(),
      });
    } else if (response.url().includes('/api/forum')) {
      events.push({
        type: 'forum-response',
        status: response.status(),
        url: new URL(response.url()).pathname,
      });
    }
  });

  let resolverCalls = 0;
  let firstResolverStatus: number | undefined;
  await page.route('**/api/permissions/permission-search?**', async (route) => {
    resolverCalls += 1;
    if (resolverCalls === 1) {
      firstResolverStatus = 503;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 503, message: 'Controlled outage' }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto(`${origin}/forum`, { waitUntil: 'domcontentloaded' });
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Forum permissions are temporarily unavailable' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'New Post', exact: true })
  ).toBeHidden();
  const after503 = await snapshot(page);
  await page.screenshot({
    path: resolve(evidenceDirectory, `i03-forum-after-503-${runId}.png`),
  });
  chmodSync(
    resolve(evidenceDirectory, `i03-forum-after-503-${runId}.png`),
    0o600
  );

  const retryResponse = page.waitForResponse(
    (response) => response.url().includes('/api/permissions/permission-search'),
    { timeout: 20_000 }
  );
  await page
    .getByRole('button', { name: 'Retry forum access', exact: true })
    .click();
  const recoveredPermissions = await retryResponse;
  events.push({
    type: 'resolver-retry',
    status: recoveredPermissions.status(),
  });
  await expect(
    page.getByRole('button', { name: 'New Post', exact: true })
  ).toBeVisible();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Forum permissions are temporarily unavailable' })
  ).toHaveCount(0);
  const afterRetry = await snapshot(page);
  await page.screenshot({
    path: resolve(evidenceDirectory, `i03-forum-after-retry-${runId}.png`),
  });
  chmodSync(
    resolve(evidenceDirectory, `i03-forum-after-retry-${runId}.png`),
    0o600
  );

  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        stackOrigin: origin,
        sourceCommit,
        buildRunId,
        runtimeContainerId: process.env['RR10_I03_CONTAINER_ID'] ?? null,
        runtimeImageId: process.env['RR10_I03_IMAGE_ID'] ?? null,
        runtimeStartedAt: process.env['RR10_I03_CONTAINER_STARTED'] ?? null,
        runtimeMount: process.env['RR10_I03_RUNTIME_MOUNT'] ?? null,
        servedMainStatus: servedMainResponse.status(),
        servedMainSha256: servedMainHash,
        localBuiltMainSha256: builtMainHash,
        relevantSourceSha256: sourceSha256,
        principal: 'retained RR09-I03 author account; identity omitted',
        controlledFailure: {
          method: 'GET',
          endpoint: '/api/permissions/permission-search?startsWith=forum.',
          status: firstResolverStatus,
          count: resolverCalls,
        },
        after503,
        afterRetry,
        events,
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
  chmodSync(evidencePath, 0o600);

  expect(firstResolverStatus).toBe(503);
  expect(recoveredPermissions.status()).toBe(200);
  expect(resolverCalls).toBeGreaterThanOrEqual(2);
  expect(after503.url).toContain('/forum');
  expect(afterRetry.url).toContain('/forum');
  expect(afterRetry.bodyText.length).toBeGreaterThan(0);
  expect(after503.bodyText).not.toContain('New Post');
  expect(afterRetry.bodyText).toContain('New Post');
});
