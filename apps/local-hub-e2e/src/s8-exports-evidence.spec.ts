import AxeBuilder from '@axe-core/playwright';
import {
  APIRequestContext,
  BrowserContext,
  expect,
  Page,
  request as pwRequest,
  test,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * S8 export evidence against the live local stack.
 *
 *   cd apps/local-hub-e2e && S8_EVIDENCE=true E2E_DOCKER=true pnpm exec playwright test -c playwright.config.ts src/s8-exports-evidence.spec.ts --workers=1
 *
 * The live stack has no export grant for any release (no DIRECTORY_RIGHTS_POLICY_FILE), so the honest live outcome
 * is a request that ends `failed` with `export_not_granted` and writes no artifact. The granted path (queue to
 * artifact, checksum, expiry, withdrawal) is proven against a scratch database in
 * apps/directory/test/exports.postgres.test.js.
 *
 * Writes: failed export-job records only (no artifact, nothing served). They are inert and kept as the audit trail.
 * Credentials come from S7_OWNER_CREDENTIALS_FILE (as S7) and are never logged or shot.
 */
const evidenceRun = process.env['S8_EVIDENCE'] === 'true';
const outDir = join(
  __dirname,
  '../../../docs/plans/town-square-directory/s8-evidence'
);
const stateFile = join(__dirname, '../../../dist/s8-owner-storage-state.json');
const OWNER_URL = (
  process.env['OWNER_URL'] || 'https://nirvana.tail5a4a0.ts.net:8446'
).replace(/\/$/, '');
const CREDENTIALS_FILE =
  process.env['S7_OWNER_CREDENTIALS_FILE'] ||
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i09-default-owner-credentials.json';
const RELEASE = process.env['S8_RELEASE'] || '2026-10-21.0';
const desktop = { width: 1280, height: 900 } as const;
const mobile = { width: 390, height: 844 } as const;

test.skip(!evidenceRun, 'set S8_EVIDENCE=true to capture S8 evidence');
test.describe.configure({ mode: 'serial' });
test.use({ launchOptions: { args: [] } });

let owner: BrowserContext;
let anon: APIRequestContext;
const outcome: Record<string, unknown> = {};

interface ApiResult {
  status: number;
  body: any;
  headers: Record<string, string>;
}
const scopeHeaders = {
  'X-ot-appscope': 'owner-console',
  'X-ot-session-mode': 'cookie',
  Origin: OWNER_URL,
};
async function call(
  ctx: APIRequestContext,
  method: 'GET' | 'POST',
  path: string,
  data?: unknown
): Promise<ApiResult> {
  const res = await ctx.fetch(`${OWNER_URL}/api${path}`, {
    method,
    headers: scopeHeaders,
    ...(data === undefined ? {} : { data }),
    failOnStatusCode: false,
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status(), body, headers: res.headers() };
}
const ownerApi = (m: 'GET' | 'POST', p: string, d?: unknown) =>
  call(owner.request, m, p, d);

async function shot(page: Page, name: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(0);
  mkdirSync(outDir, { recursive: true });
  await page.screenshot({
    path: join(outDir, `${name}.jpg`),
    fullPage: true,
    type: 'jpeg',
    quality: 60,
  });
}
async function axe(page: Page): Promise<void> {
  await page.locator('section[aria-labelledby]').first().waitFor();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .include('section[aria-labelledby]')
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  expect(
    serious.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(' ')}`)),
    'serious/critical axe violations'
  ).toEqual([]);
}
async function waitTerminal(id: string): Promise<any> {
  let job: any;
  await expect
    .poll(
      async () => {
        job = (await ownerApi('GET', `/directory/exports/${id}`)).body;
        return job?.status;
      },
      { timeout: 60_000, intervals: [500, 1000, 2000] }
    )
    .toMatch(/^(failed|complete)$/);
  return job;
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  if (!existsSync(CREDENTIALS_FILE))
    throw new Error('owner credentials file not found');
  const creds = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8')) as {
    email: string;
    password: string;
  };
  mkdirSync(dirname(stateFile), { recursive: true });
  const loginCtx = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: desktop,
  });
  const page = await loginCtx.newPage();
  await page.goto(`${OWNER_URL}/login`);
  await page.getByLabel('Email', { exact: true }).fill(creds.email);
  await page.getByLabel('Password', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await loginCtx.storageState({ path: stateFile });
  await loginCtx.close();
  owner = await browser.newContext({
    ignoreHTTPSErrors: true,
    storageState: stateFile,
    viewport: desktop,
  });
  anon = await pwRequest.newContext({ ignoreHTTPSErrors: true });
});
test.afterAll(async () => {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 's8-live-outcome.json'),
    JSON.stringify(outcome, null, 2) + '\n'
  );
  await owner?.close();
  await anon?.dispose();
});

test.describe('S8 exports (live)', () => {
  test('1. authorization: anonymous refused, owner allowed, no-store', async () => {
    const a = await call(anon, 'GET', '/directory/exports');
    expect(a.status).toBe(401);
    const aDl = await call(
      anon,
      'GET',
      `/directory/exports/${randomUUID()}/artifact`
    );
    expect(aDl.status).toBe(401);
    const o = await ownerApi('GET', '/directory/exports');
    expect(o.status).toBe(200);
    expect(o.headers['cache-control']).toContain('no-store');
    const missing = await ownerApi(
      'GET',
      `/directory/exports/${randomUUID()}/artifact`
    );
    expect(missing.status).toBe(404);
    outcome['authorization'] = {
      anonymousList: a.status,
      anonymousDownload: aDl.status,
      ownerList: o.status,
      ownerListCacheControl: o.headers['cache-control'],
      ownerDownloadUnknownId: missing.status,
    };
  });

  test('2. UI request without an export grant fails with no artifact', async () => {
    const page = await owner.newPage({ viewport: desktop });
    await page.goto(`${OWNER_URL}/dashboard/directory-exports`);
    await expect(page.locator('#exports-title')).toHaveText('Exports');
    await axe(page);
    await page.getByLabel('Release id').fill(RELEASE);
    const created = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/directory/exports') &&
        r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Request export' }).click();
    const job = await (await created).json();
    expect(job.status).toBe('queued');
    const done = await waitTerminal(job.id);
    expect(done.status).toBe('failed');
    expect(done.errorCode).toBe('export_not_granted');
    expect(done.sha256 ?? null).toBeNull();
    expect(Number(done.rowCount ?? 0)).toBe(0);
    const card = page.locator('otui-card', { hasText: job.id });
    await expect(card.getByRole('alert')).toContainText(
      'No export grant for this release'
    );
    await expect(
      card.getByRole('button', { name: `Download export ${job.id}` })
    ).toHaveCount(0);
    await shot(page, 's8-01-not-granted-desktop');
    await page.setViewportSize(mobile);
    await shot(page, 's8-02-not-granted-mobile');
    await axe(page);
    const dl = await ownerApi('GET', `/directory/exports/${job.id}/artifact`);
    expect([409, 410]).toContain(dl.status);
    outcome['notGranted'] = {
      jobId: job.id,
      releaseId: RELEASE,
      status: done.status,
      errorCode: done.errorCode,
      sha256: done.sha256 ?? null,
      rowCount: done.rowCount ?? null,
      downloadStatus: dl.status,
      downloadCode: dl.body?.code ?? null,
    };
    await page.close();
  });

  test('3. idempotent replay, mismatch refused, retry stays honest', async () => {
    const id = randomUUID();
    const first = await ownerApi('POST', '/directory/exports', {
      id,
      releaseId: RELEASE,
    });
    expect([200, 201]).toContain(first.status);
    const replay = await ownerApi('POST', '/directory/exports', {
      id,
      releaseId: RELEASE,
    });
    expect(replay.body?.id).toBe(id);
    const mismatch = await ownerApi('POST', '/directory/exports', {
      id,
      releaseId: `${RELEASE}-other`,
    });
    expect(mismatch.status).toBe(409);
    const failed = await waitTerminal(id);
    expect(failed.errorCode).toBe('export_not_granted');
    const retry = await ownerApi('POST', `/directory/exports/${id}/retry`, {});
    expect(retry.status).toBeLessThan(300);
    const again = await waitTerminal(id);
    expect(again.status).toBe('failed');
    expect(again.errorCode).toBe('export_not_granted');
    const retryComplete = await ownerApi(
      'POST',
      `/directory/exports/${randomUUID()}/retry`,
      {}
    );
    expect(retryComplete.status).toBe(404);
    outcome['idempotency'] = {
      jobId: id,
      firstStatus: first.status,
      replaySameId: replay.body?.id === id,
      mismatchStatus: mismatch.status,
      mismatchCode: mismatch.body?.code ?? mismatch.body?.message ?? null,
      retryStatus: retry.status,
      afterRetry: { status: again.status, errorCode: again.errorCode },
      retryUnknownId: retryComplete.status,
    };
  });
});
