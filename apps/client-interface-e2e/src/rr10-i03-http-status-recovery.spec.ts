import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const origin = new URL(process.env['BASE_URL'] ?? 'http://127.0.0.1:8080')
  .origin;
const credentialsPath =
  process.env['RR10_I03_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i03-credentials.json';
const workspaceRoot = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const evidenceDirectory = resolve(workspaceRoot, '.runtime-artifacts/rr10');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidencePath = resolve(
  evidenceDirectory,
  `i03-http-status-recovery-${runId}.json`
);

test('RR10 I03 forum handles denied, missing, and failing topic reads with a retry', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR10_I03_LIVE_STACK'] !== 'true',
    'Requires the existing local OT stack and saved RR09 author account'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Status recovery is recorded once in system Chrome'
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

  const buildRunId = process.env['RR10_I03_BUILD_RUN'];
  expect(buildRunId, 'record the current-source Nx build run').toBeTruthy();
  const servedMain = await page.request.get(`${origin}/main.js`);
  const servedMainHash = createHash('sha256')
    .update(await servedMain.body())
    .digest('hex');
  const distMainHash = createHash('sha256')
    .update(
      readFileSync(
        resolve(workspaceRoot, 'dist/apps/client-interface/browser/main.js')
      )
    )
    .digest('hex');
  expect(servedMain.status()).toBe(200);
  expect(servedMainHash).toBe(distMainHash);
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  }).trim();

  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  chmodSync(evidenceDirectory, 0o700);
  const results: Record<string, unknown>[] = [];
  for (const status of [403, 404, 500, 401]) {
    let injected = false;
    const statuses: number[] = [];
    const onResponse = (response: import('@playwright/test').Response) => {
      if (new URL(response.url()).pathname === '/api/forum/topics') {
        statuses.push(response.status());
      }
    };
    page.on('response', onResponse);
    const routeHandler = async (route: import('@playwright/test').Route) => {
      if (!injected) {
        injected = true;
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: status,
            message: `Controlled ${status}`,
          }),
        });
      } else {
        await route.continue();
      }
    };
    await page.route('**/api/forum/topics', routeHandler);
    const firstResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/forum/topics' &&
        response.status() === status,
      { timeout: 15_000 }
    );
    await page.goto(`${origin}/forum`, { waitUntil: 'domcontentloaded' });
    await firstResponse;

    if (status === 401) {
      await expect(page).toHaveURL(/\/login(?:$|\?)/, { timeout: 15_000 });
      results.push({
        status,
        destination: new URL(page.url()).pathname,
        statuses,
      });
    } else {
      const expectedReason =
        status === 403
          ? 'You do not have permission to load forum topics.'
          : status === 404
          ? 'Forum topics were not found.'
          : 'Forum topics are temporarily unavailable.';
      const topicError = page
        .getByRole('alert')
        .filter({ hasText: expectedReason });
      await expect(topicError).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Retry loading topics' })
      ).toBeVisible();
      await expect(
        page.getByText('No topics found.', { exact: false })
      ).toHaveCount(0);
      const screenshotPath = resolve(
        evidenceDirectory,
        `i03-http-${status}-${runId}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      chmodSync(screenshotPath, 0o600);
      const retryResponse = page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/api/forum/topics',
        { timeout: 15_000 }
      );
      await page.getByRole('button', { name: 'Retry loading topics' }).click();
      const recovered = await retryResponse;
      expect(recovered.status()).toBe(200);
      await expect(topicError).toHaveCount(0);
      results.push({ status, recoveredStatus: recovered.status(), statuses });
    }

    await page.unroute('**/api/forum/topics', routeHandler);
    page.off('response', onResponse);
  }

  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        origin,
        sourceCommit,
        buildRunId,
        runtimeContainerId: process.env['RR10_I03_CONTAINER_ID'],
        runtimeImageId: process.env['RR10_I03_IMAGE_ID'],
        runtimeStartedAt: process.env['RR10_I03_CONTAINER_STARTED'],
        runtimeMount: process.env['RR10_I03_RUNTIME_MOUNT'],
        servedMainSha256: servedMainHash,
        distMainSha256: distMainHash,
        principal: 'retained RR09-I03 author account; identity omitted',
        testedStatuses: [403, 404, 500, 401],
        results,
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
  chmodSync(evidencePath, 0o600);
  expect(results).toHaveLength(4);
});
