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
 * S9 operating-control evidence against the live local stack.
 *
 *   cd apps/local-hub-e2e && S9_EVIDENCE=true E2E_DOCKER=true pnpm exec playwright test -c playwright.config.ts src/s9-operations-evidence.spec.ts --workers=1
 *
 * Writes, all reversed or inert: the export worker is paused through the console, two export jobs queue behind it
 * (a backlog), the worker is resumed and they end `failed`/`export_not_granted` (no artifact, as in S8); provider
 * acquisition is paused and resumed without starting any run. Every control is resumed in afterAll whatever happens.
 * Only aggregate counts are recorded. Credentials come from S7_OWNER_CREDENTIALS_FILE and are never logged or shot.
 */
const evidenceRun = process.env['S9_EVIDENCE'] === 'true';
const outDir = join(
  __dirname,
  '../../../docs/plans/town-square-directory/s9-evidence'
);
const stateFile = join(__dirname, '../../../dist/s9-owner-storage-state.json');
const OWNER_URL = (
  process.env['OWNER_URL'] || 'https://nirvana.tail5a4a0.ts.net:8446'
).replace(/\/$/, '');
const CREDENTIALS_FILE =
  process.env['S7_OWNER_CREDENTIALS_FILE'] ||
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i09-default-owner-credentials.json';
const RELEASE = process.env['S9_RELEASE'] || '2026-10-21.0';
const desktop = { width: 1280, height: 900 } as const;
const mobile = { width: 390, height: 844 } as const;

test.skip(!evidenceRun, 'set S9_EVIDENCE=true to capture S9 evidence');
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
interface Control {
  key: string;
  paused: boolean;
  version: number;
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
const controls = async (): Promise<Control[]> =>
  (await ownerApi('GET', '/directory/operations/controls')).body.controls;
const control = async (key: string): Promise<Control> =>
  (await controls()).find((c) => c.key === key) as Control;
const metrics = async (): Promise<any> =>
  (await ownerApi('GET', '/directory/operations/metrics')).body;

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
    .include('section[aria-labelledby="operations-title"]')
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  expect(
    serious.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(' ')}`)),
    'serious/critical axe violations'
  ).toEqual([]);
}
async function waitStatus(id: string, re: RegExp): Promise<any> {
  let job: any;
  await expect
    .poll(
      async () => {
        job = (await ownerApi('GET', `/directory/exports/${id}`)).body;
        return job?.status;
      },
      { timeout: 60_000, intervals: [500, 1000, 2000] }
    )
    .toMatch(re);
  return job;
}
async function setPaused(
  page: Page,
  label: string,
  key: string,
  reason: string
) {
  const card = page.locator('otui-card', { hasText: label });
  await page.getByLabel(`Reason for pausing ${label}`).fill(reason);
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/directory/operations/controls/${key}`) &&
      r.request().method() === 'POST'
  );
  await card.getByRole('button', { name: `Pause ${label}` }).click();
  expect((await saved).status()).toBeLessThan(300);
  await expect(card.getByText('Paused', { exact: true })).toBeVisible();
}
async function resumeAll(): Promise<void> {
  for (const c of await controls()) {
    if (!c.paused) continue;
    await ownerApi('POST', `/directory/operations/controls/${c.key}`, {
      paused: false,
      reason: null,
      expectedVersion: c.version,
    });
  }
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
  if (owner) {
    await resumeAll();
    outcome['controlsAfter'] = (await controls()).map((c) => ({
      key: c.key,
      paused: c.paused,
    }));
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 's9-live-outcome.json'),
    JSON.stringify(outcome, null, 2) + '\n'
  );
  await owner?.close();
  await anon?.dispose();
});

test.describe('S9 operations (live)', () => {
  test('1. metrics and controls are restricted and never cached', async () => {
    const paths = [
      '/directory/operations/metrics',
      '/directory/operations/metrics/prometheus',
      '/directory/operations/controls',
    ];
    const anonymous: Record<string, number> = {};
    for (const p of paths) anonymous[p] = (await call(anon, 'GET', p)).status;
    expect(Object.values(anonymous).every((s) => s === 401)).toBe(true);
    const anonWrite = await call(
      anon,
      'POST',
      '/directory/operations/controls/export_worker',
      { paused: true, reason: 'x', expectedVersion: 0 }
    );
    expect(anonWrite.status).toBe(401);
    const m = await ownerApi('GET', paths[0]);
    expect(m.status).toBe(200);
    expect(m.headers['cache-control']).toContain('no-store');
    expect(m.body.errors).toEqual([]);
    const prom = await owner.request.fetch(`${OWNER_URL}/api${paths[1]}`, {
      headers: scopeHeaders,
    });
    expect(prom.status()).toBe(200);
    const text = await prom.text();
    expect(text).toContain('directory_');
    const forged = await ownerApi(
      'POST',
      '/directory/operations/controls/export_worker',
      {
        paused: true,
        reason: 'forged actor',
        expectedVersion: 0,
        actorId: randomUUID(),
      }
    );
    expect(forged.status).toBe(400);
    const unknown = await ownerApi(
      'POST',
      '/directory/operations/controls/withdrawal_worker',
      { paused: true, reason: 'not pausable', expectedVersion: 0 }
    );
    expect([400, 404]).toContain(unknown.status);
    outcome['authorization'] = {
      anonymous,
      anonymousWrite: anonWrite.status,
      ownerMetrics: m.status,
      ownerMetricsCacheControl: m.headers['cache-control'],
      prometheusGauges: text.split('\n').filter((l) => l && !l.startsWith('#'))
        .length,
      bodyActorIdRefused: forged.status,
      withdrawalPauseRefused: unknown.status,
    };
    const b = m.body;
    outcome['metricsBefore'] = {
      infrastructure: b.infrastructure,
      towns: b.towns,
      coverage: b.coverage,
      freshness: b.freshness,
      policy: b.policy,
      spend: b.spend,
      queues: b.queues,
    };
  });

  test('2. export pause holds a backlog; resume drains it honestly', async () => {
    test.setTimeout(180_000);
    const page = await owner.newPage({ viewport: desktop });
    await page.goto(`${OWNER_URL}/dashboard/directory-operations`);
    await expect(page.locator('#operations-title')).toHaveText('Operations');
    await axe(page);
    await setPaused(
      page,
      'Export worker',
      'export_worker',
      'S9 evidence: queue backlog drill'
    );
    const pausedAt = Date.now();
    const ids = [randomUUID(), randomUUID()];
    for (const id of ids) {
      const r = await ownerApi('POST', '/directory/exports', {
        id,
        releaseId: RELEASE,
      });
      expect([200, 201]).toContain(r.status);
    }
    await page.waitForTimeout(12_000);
    for (const id of ids)
      expect(
        (await ownerApi('GET', `/directory/exports/${id}`)).body.status
      ).toBe('queued');
    const backlog = (await metrics()).queues.export;
    expect(backlog.queued).toBeGreaterThanOrEqual(2);
    expect(backlog.oldestQueuedSeconds).toBeGreaterThanOrEqual(10);
    await page.getByRole('button', { name: 'Refresh operations' }).click();
    await shot(page, 's9-01-export-paused-desktop');
    await page.setViewportSize(mobile);
    await shot(page, 's9-02-export-paused-mobile');
    await axe(page);
    await page.setViewportSize(desktop);
    const card = page.locator('otui-card', { hasText: 'Export worker' });
    const resumed = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/directory/operations/controls/export_worker') &&
        r.request().method() === 'POST'
    );
    await card.getByRole('button', { name: 'Resume Export worker' }).click();
    expect((await resumed).status()).toBeLessThan(300);
    const resumedAt = Date.now();
    const done = [];
    for (const id of ids)
      done.push(await waitStatus(id, /^(failed|complete)$/));
    const drainedMs = Date.now() - resumedAt;
    for (const d of done) {
      expect(d.status).toBe('failed');
      expect(d.errorCode).toBe('export_not_granted');
    }
    const after = (await metrics()).queues.export;
    expect(after.queued).toBe(0);
    outcome['backlogDrill'] = {
      jobsQueuedWhilePaused: ids.length,
      heldForSeconds: Math.round((resumedAt - pausedAt) / 1000),
      metricsWhilePaused: backlog,
      drainedAfterResumeMs: drainedMs,
      terminal: done.map((d) => ({ status: d.status, errorCode: d.errorCode })),
      metricsAfter: after,
    };
    await page.close();
  });

  test('3. provider kill switch and stale-version refusal', async () => {
    const before = await control('provider_acquisition');
    expect(before.paused).toBe(false);
    const paused = await ownerApi(
      'POST',
      '/directory/operations/controls/provider_acquisition',
      {
        paused: true,
        reason: 'S9 evidence: kill switch drill',
        expectedVersion: before.version,
      }
    );
    expect(paused.status).toBeLessThan(300);
    expect(paused.body.paused).toBe(true);
    const stale = await ownerApi(
      'POST',
      '/directory/operations/controls/provider_acquisition',
      { paused: false, reason: null, expectedVersion: before.version }
    );
    expect(stale.status).toBe(409);
    expect(stale.body?.code).toBe('stale_version');
    const shown = (await metrics()).controls.find(
      (c: Control) => c.key === 'provider_acquisition'
    );
    expect(shown.paused).toBe(true);
    const resumed = await ownerApi(
      'POST',
      '/directory/operations/controls/provider_acquisition',
      { paused: false, reason: null, expectedVersion: paused.body.version }
    );
    expect(resumed.status).toBeLessThan(300);
    expect(resumed.body.paused).toBe(false);
    outcome['killSwitch'] = {
      pauseStatus: paused.status,
      staleVersionStatus: stale.status,
      staleVersionCode: stale.body?.code ?? null,
      metricsShowedPaused: shown.paused,
      resumeStatus: resumed.status,
      versions: [before.version, paused.body.version, resumed.body.version],
    };
  });
});
