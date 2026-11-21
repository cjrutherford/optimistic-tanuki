import AxeBuilder from '@axe-core/playwright';
import {
  APIRequestContext,
  BrowserContext,
  expect,
  Page,
  request as pwRequest,
  test,
} from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * S8 export evidence against the live local stack.
 *
 *   cd apps/local-hub-e2e && S8_EVIDENCE=true E2E_DOCKER=true pnpm exec playwright test -c playwright.config.ts src/s8-exports-evidence.spec.ts --workers=1
 *
 * The rights policy (apps/directory/rights-policies/policies.json) grants `export` for release 2026-10-21.0, so the
 * honest live outcome is a request that COMPLETES with an artifact. Evidence: UI request, download, SHA-256 recomputed
 * from the bytes equals the job checksum, JSONL schema line, no key outside the allowlist, no Geoapify source, and
 * the row/excluded counts. Rights-driven revocation (status `revoked`, download 410) needs a rights field exclusion,
 * which would change live rights state, so it is NOT exercised live; it is proven in
 * apps/directory/test/export-rights-public.postgres.test.js.
 *
 * Writes: export jobs and their artifact files. Jobs expire after 24h (the sweep deletes the file and marks the job
 * `expired`); nothing else is changed, so the writes are inert and self-cleaning. Set S8_RELEASE to target another
 * release.
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
const ALLOWED_ROW_KEYS = new Set([
  'type',
  'key',
  'name',
  'category',
  'location',
  'address',
  'phone',
  'website',
  'provenance',
]);
async function downloadArtifact(
  id: string
): Promise<{ status: number; body: Buffer; headers: Record<string, string> }> {
  const res = await owner.request.fetch(
    `${OWNER_URL}/api/directory/exports/${id}/artifact`,
    { method: 'GET', headers: scopeHeaders, failOnStatusCode: false }
  );
  return {
    status: res.status(),
    body: await res.body(),
    headers: res.headers(),
  };
}
/** Verifies a completed job's artifact and returns the facts worth recording. */
async function verifyArtifact(job: any): Promise<Record<string, unknown>> {
  expect(job.status).toBe('complete');
  expect(job.errorCode ?? null).toBeNull();
  expect(job.sha256).toMatch(/^[0-9a-f]{64}$/);
  const dl = await downloadArtifact(job.id);
  expect(dl.status).toBe(200);
  const sha = createHash('sha256').update(dl.body).digest('hex');
  expect(sha, 'recomputed SHA-256 equals the job checksum').toBe(job.sha256);
  if (dl.headers['x-content-sha256'])
    expect(dl.headers['x-content-sha256']).toBe(job.sha256);
  expect(dl.body.length).toBe(Number(job.byteCount));
  const text = dl.body.toString('utf8');
  expect(text, 'no Geoapify-sourced value').not.toMatch(/geoapify/i);
  const lines = text
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  expect(lines[0].type).toBe('header');
  expect(lines[0].schema).toBe('town-square-directory-export/v1');
  const trailer = lines[lines.length - 1];
  expect(trailer.type).toBe('trailer');
  const rows = lines.filter((l) => l.type === 'row');
  expect(rows.length).toBe(Number(job.rowCount));
  expect(trailer.rowCount).toBe(Number(job.rowCount));
  expect(trailer.excludedRows).toBe(Number(job.excludedRows));
  expect(rows.length).toBeGreaterThan(0);
  const stray = new Set<string>();
  for (const r of rows)
    for (const k of Object.keys(r)) if (!ALLOWED_ROW_KEYS.has(k)) stray.add(k);
  expect([...stray], 'row keys outside the allowlist').toEqual([]);
  return {
    jobId: job.id,
    releaseId: job.releaseId,
    status: job.status,
    sha256: job.sha256,
    recomputedSha256: sha,
    byteCount: Number(job.byteCount),
    rowCount: Number(job.rowCount),
    excludedRows: Number(job.excludedRows),
    headerFields: lines[0].fields,
    attributions: lines[0].attributions,
    expiresAt: job.expiresAt ?? null,
  };
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
  test('0. rights sync resolves the cases the release policy covers', async () => {
    const count = (cases: { status: string; releaseId?: string }[]) =>
      cases.reduce<Record<string, number>>((acc, c) => {
        acc[c.status] = (acc[c.status] ?? 0) + 1;
        return acc;
      }, {});
    const before = await ownerApi('GET', '/directory/rights-cases?limit=100');
    expect(before.status).toBe(200);
    // Live scans carry no source evidence, so the owner declares the release on the history import (audited,
    // fills only runs with no release). Rights sync and public export then discover it from the ledger.
    const history = await ownerApi('POST', '/directory/runs/history/import', {
      decisionId: randomUUID(),
      reason: 'S8 evidence: record the staged Overture release',
      release: RELEASE,
    });
    expect([200, 201]).toContain(history.status);
    const sync = await ownerApi('POST', '/directory/rights-cases/sync', {
      syncId: randomUUID(),
    });
    expect(sync.status).toBe(201);
    const after = await ownerApi('GET', '/directory/rights-cases?limit=100');
    expect(after.status).toBe(200);
    const open = after.body.cases.filter(
      (c: { status: string }) => c.status === 'review'
    );
    expect(open).toHaveLength(0);
    // A second sync is a no-op: nothing left to resolve or create.
    const again = await ownerApi('POST', '/directory/rights-cases/sync', {
      syncId: randomUUID(),
    });
    expect(again.status).toBe(201);
    expect(again.body.resolved).toBe(0);
    expect(again.body.created).toBe(0);
    outcome['rightsSync'] = {
      historyImport: history.body,
      before: count(before.body.cases),
      first: sync.body,
      after: count(after.body.cases),
      second: again.body,
    };
  });

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

  test('2. UI request with an export grant completes and the artifact verifies', async () => {
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
    // Explicit expected outcome: the grant exists, so the job completes. `failed` here means the grant is missing.
    expect(
      done.status,
      `expected complete, got ${done.status}/${done.errorCode}`
    ).toBe('complete');
    const facts = await verifyArtifact(done);
    const card = page.locator('otui-card', { hasText: job.id });
    const downloadButton = card.getByRole('button', {
      name: `Download export ${job.id}`,
    });
    await expect(downloadButton).toBeVisible({ timeout: 15_000 });
    await shot(page, 's8-01-granted-desktop');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadButton.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.jsonl$/);
    await expect(
      page.getByRole('status').filter({ hasText: 'SHA-256' })
    ).toContainText(done.sha256);
    await page.setViewportSize(mobile);
    await shot(page, 's8-02-granted-mobile');
    await axe(page);
    outcome['granted'] = {
      ...facts,
      uiDownloadFilename: download.suggestedFilename(),
    };
    await page.close();
  });

  test('3. idempotent replay returns the same job, mismatch refused', async () => {
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
    const done = await waitTerminal(id);
    expect(done.status, `expected complete, got ${done.errorCode}`).toBe(
      'complete'
    );
    const facts = await verifyArtifact(done);
    const replayAfter = await ownerApi('POST', '/directory/exports', {
      id,
      releaseId: RELEASE,
    });
    expect(replayAfter.body?.id).toBe(id);
    expect(replayAfter.body?.sha256).toBe(done.sha256);
    const retryUnknown = await ownerApi(
      'POST',
      `/directory/exports/${randomUUID()}/retry`,
      {}
    );
    expect(retryUnknown.status).toBe(404);
    outcome['idempotency'] = {
      ...facts,
      firstStatus: first.status,
      replaySameId: replay.body?.id === id,
      replayAfterCompleteSameChecksum: replayAfter.body?.sha256 === done.sha256,
      mismatchStatus: mismatch.status,
      mismatchCode: mismatch.body?.code ?? mismatch.body?.message ?? null,
      retryUnknownId: retryUnknown.status,
    };
    outcome['revocationLive'] =
      'not exercised: needs a rights field exclusion that would change live rights state; covered by export-rights-public.postgres.test.js';
  });
});
