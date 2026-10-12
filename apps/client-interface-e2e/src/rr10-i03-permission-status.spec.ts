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

for (const status of [403, 401]) {
  test(`RR10 I03 forum permission resolver handles ${status} distinctly`, async ({
    page,
  }, testInfo) => {
    test.skip(
      process.env['RR10_I03_LIVE_STACK'] !== 'true',
      'Requires the existing local OT stack and saved RR09 author account'
    );
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'Resolver state is recorded once in system Chrome'
    );
    test.setTimeout(60_000);
    expect(new URL(origin).port).toBe('8080');
    const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8')) as {
      email: string;
      password: string;
    };
    await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email', { exact: true }).fill(credentials.email);
    await page
      .getByLabel('Password', { exact: true })
      .fill(credentials.password);
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

    let injected = false;
    const responses: number[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/permissions/permission-search')) {
        responses.push(response.status());
      }
    });
    await page.route(
      '**/api/permissions/permission-search?**',
      async (route) => {
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
      }
    );
    const injectedResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/permissions/permission-search') &&
        response.status() === status,
      { timeout: 15_000 }
    );
    await page.goto(`${origin}/forum`, { waitUntil: 'domcontentloaded' });
    await injectedResponse;

    const runId = new Date().toISOString().replace(/[:.]/g, '-');
    mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
    chmodSync(evidenceDirectory, 0o700);
    const screenshotPath = resolve(
      evidenceDirectory,
      `i03-permission-${status}-${runId}.png`
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    chmodSync(screenshotPath, 0o600);

    let outcome: Record<string, unknown>;
    if (status === 401) {
      await expect(page).toHaveURL(/\/login(?:$|\?)/, { timeout: 15_000 });
      await expect(
        page.getByText('Forum permissions are temporarily unavailable', {
          exact: false,
        })
      ).toHaveCount(0);
      outcome = { status, url: page.url(), expectedLoginRedirect: true };
    } else {
      await expect(
        page.getByRole('status').filter({
          hasText: 'Forum permissions were denied',
        })
      ).toBeVisible();
      await expect(
        page.getByText('Forum permissions are temporarily unavailable', {
          exact: false,
        })
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Retry forum access' })
      ).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'New Post' })).toHaveCount(
        0
      );

      const recoveredPermission = page.waitForResponse(
        (response) =>
          response.url().includes('/api/permissions/permission-search') &&
          response.status() === 200,
        { timeout: 15_000 }
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      const live = await recoveredPermission;
      expect(live.status()).toBe(200);
      await expect(
        page.getByRole('button', { name: 'New Post' })
      ).toBeVisible();
      await expect(
        page.getByRole('status').filter({
          hasText: 'Forum permissions were denied',
        })
      ).toHaveCount(0);
      outcome = { status, recoveredStatus: live.status(), url: page.url() };
    }

    const evidencePath = resolve(
      evidenceDirectory,
      `i03-permission-status-${status}-${runId}.json`
    );
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
          injectedEndpoint:
            '/api/permissions/permission-search?startsWith=forum.',
          injectedStatus: status,
          responses,
          outcome,
          screenshot: screenshotPath,
        },
        null,
        2
      )}\n`,
      { mode: 0o600 }
    );
    chmodSync(evidencePath, 0o600);
  });
}
