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
 * S7 taxonomy dismiss evidence against the live local stack.
 *
 *   cd apps/local-hub-e2e && S7D_EVIDENCE=true E2E_DOCKER=true pnpm exec playwright test -c playwright.config.ts src/s7-taxonomy-dismiss-evidence.spec.ts --workers=1
 *
 * Takes one case in `open` (or `deferred`, the other state the Dismiss button allows) status, dismisses it through the
 * Owner Console with a reason, checks it shows Dismissed, then REOPENS it through the same UI so the case ends in the
 * status it started in (open). The two decisions stay in the case's audit history; that is the only residue.
 * A stale version token must get 409 over the API and changes nothing. With no open case the UI part is skipped and
 * the outcome file says so.
 * Credentials come from S7_OWNER_CREDENTIALS_FILE and are never logged or shot.
 */
const evidenceRun = process.env['S7D_EVIDENCE'] === 'true';
const outDir = join(
  __dirname,
  '../../../docs/plans/town-square-directory/s7-evidence'
);
const stateFile = join(__dirname, '../../../dist/s7d-owner-storage-state.json');
const OWNER_URL = (
  process.env['OWNER_URL'] || 'https://nirvana.tail5a4a0.ts.net:8446'
).replace(/\/$/, '');
const CREDENTIALS_FILE =
  process.env['S7_OWNER_CREDENTIALS_FILE'] ||
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i09-default-owner-credentials.json';
const desktop = { width: 1280, height: 900 } as const;
const mobile = { width: 390, height: 844 } as const;
const REASON = 'S7 dismiss evidence: reversible check';

test.skip(!evidenceRun, 'set S7D_EVIDENCE=true to capture S7 dismiss evidence');
test.describe.configure({ mode: 'serial' });
test.use({ launchOptions: { args: [] } });

let owner: BrowserContext;
let anon: APIRequestContext;
const outcome: Record<string, unknown> = {};

interface ApiResult {
  status: number;
  body: any;
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
  return { status: res.status(), body };
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
  expect(
    results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(' ')}`)),
    'serious/critical axe violations'
  ).toEqual([]);
}
/** Reopens a case an earlier, interrupted run of this spec left dismissed, so live state is restored first. */
async function recoverInterrupted(): Promise<void> {
  const res = await ownerApi(
    'GET',
    '/directory/taxonomy/cases?status=dismissed&limit=100'
  );
  expect(res.status).toBe(200);
  for (const c of res.body?.cases ?? []) {
    const detail = await caseById(c.id);
    const last = (detail.history ?? []).at(-1);
    if (last?.reason !== REASON) continue;
    const r = await ownerApi(
      'POST',
      `/directory/taxonomy/cases/${c.id}/decisions`,
      {
        decisionId: randomUUID(),
        action: 'reopen',
        reason: 'S7 dismiss evidence: restoring after an interrupted run',
        expectedVersionToken: detail.versionToken,
      }
    );
    expect(r.status).toBeLessThan(300);
    outcome['recoveredInterruptedRun'] = { caseId: c.id };
  }
}
async function findCase(): Promise<any | null> {
  await recoverInterrupted();
  for (const status of ['open', 'deferred']) {
    const res = await ownerApi(
      'GET',
      `/directory/taxonomy/cases?status=${status}&limit=100`
    );
    expect(res.status).toBe(200);
    const hit = (res.body?.cases ?? [])[0];
    if (hit) return hit;
  }
  return null;
}
async function caseById(id: string): Promise<any> {
  return (await ownerApi('GET', `/directory/taxonomy/cases/${id}`)).body;
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
    join(outDir, 's7-dismiss-live-outcome.json'),
    JSON.stringify(outcome, null, 2) + '\n'
  );
  await owner?.close();
  await anon?.dispose();
});

test.describe('S7 taxonomy dismiss (live)', () => {
  test('1. anonymous refused, owner lists cases, stale token gets 409', async () => {
    const a = await call(anon, 'GET', '/directory/taxonomy/cases');
    expect(a.status).toBe(401);
    const aPost = await call(
      anon,
      'POST',
      `/directory/taxonomy/cases/${randomUUID()}/dismiss`,
      {}
    );
    expect(aPost.status).toBe(401);
    const list = await ownerApi('GET', '/directory/taxonomy/cases?limit=100');
    expect(list.status).toBe(200);
    const target = await findCase();
    outcome['listing'] = {
      anonymousList: a.status,
      anonymousDismiss: aPost.status,
      ownerListStatus: list.status,
      casesReturned: (list.body?.cases ?? []).length,
      dismissibleCaseFound: !!target,
    };
    if (!target) {
      outcome['note'] =
        'no open or deferred taxonomy case exists on the live stack; UI dismiss not exercised';
      return;
    }
    const stale = await ownerApi(
      'POST',
      `/directory/taxonomy/cases/${target.id}/dismiss`,
      {
        decisionId: randomUUID(),
        reason: REASON,
        expectedVersionToken: '0'.repeat(64),
      }
    );
    expect(stale.status).toBe(409);
    const after = await caseById(target.id);
    expect(after.status).toBe(target.status);
    expect(after.versionToken).toBe(target.versionToken);
    outcome['staleToken'] = {
      caseId: target.id,
      status: stale.status,
      code: stale.body?.code ?? null,
      caseUnchanged: true,
    };
  });

  test('2. dismiss through the UI, shows Dismissed, then reopen restores it', async () => {
    const target = await findCase();
    test.skip(!target, 'no open or deferred taxonomy case on the live stack');
    const startStatus: string = target.status;
    const page = await owner.newPage({ viewport: desktop });
    await page.goto(`${OWNER_URL}/dashboard/directory-taxonomy`);
    await expect(page.locator('#taxonomy-cases-title')).toHaveText(
      'Taxonomy cases'
    );
    const statusLabel = startStatus === 'deferred' ? 'Deferred' : 'Open';
    await page
      .getByRole('group', { name: 'Case status' })
      .getByRole('button', { name: statusLabel })
      .click();
    const card = page
      .locator('otui-card.case-card', {
        hasText: target.name,
      })
      .first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.getByRole('button', { name: 'Open', exact: true }).click();
    await card.getByLabel('Reason (required)').fill(REASON);
    await axe(page);
    await shot(page, 's7d-01-before-dismiss-desktop');
    const dismissed = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/taxonomy/cases/${target.id}/dismiss`) &&
        r.request().method() === 'POST'
    );
    await card
      .getByRole('button', { name: `Dismiss case for ${target.name}` })
      .click();
    expect((await dismissed).status()).toBeLessThan(300);
    await expect(page.getByRole('status')).toContainText('Case dismissed');
    expect((await caseById(target.id)).status).toBe('dismissed');

    await page
      .getByRole('group', { name: 'Case status' })
      .getByRole('button', { name: 'Dismissed' })
      .click();
    const dismissedCard = page
      .locator('otui-card.case-card', {
        hasText: target.name,
      })
      .first();
    await expect(dismissedCard).toBeVisible({ timeout: 20_000 });
    await expect(
      dismissedCard.locator('otui-badge', { hasText: 'Dismissed' }).first()
    ).toBeVisible();
    await shot(page, 's7d-02-dismissed-desktop');
    await page.setViewportSize(mobile);
    await shot(page, 's7d-03-dismissed-mobile');
    await page.setViewportSize(desktop);

    // Reverse: reopen through the UI.
    const reasonField = dismissedCard.getByLabel('Reason (required)');
    // The details panel can survive the status switch; open it only if it is closed.
    const toggle = dismissedCard.getByRole('button', {
      name: /^(Open|Close)$/,
    });
    await expect(toggle).toBeVisible();
    if ((await toggle.textContent())?.trim() === 'Open') await toggle.click();
    await expect(reasonField).toBeVisible();
    await reasonField.fill('S7 dismiss evidence: restoring');
    const reopened = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/taxonomy/cases/${target.id}/decisions`) &&
        r.request().method() === 'POST'
    );
    await dismissedCard.getByRole('button', { name: 'Reopen' }).click();
    expect((await reopened).status()).toBeLessThan(300);
    const restored = await caseById(target.id);
    expect(restored.status, 'case back to an actionable state').toBe('open');
    await page.setViewportSize(mobile);
    await shot(page, 's7d-04-after-reopen-mobile');
    outcome['dismissRoundTrip'] = {
      caseId: target.id,
      startStatus,
      afterDismiss: 'dismissed',
      afterReopen: restored.status,
      note:
        startStatus === 'deferred'
          ? 'case started deferred; reopen returns it to open (a deferred case cannot be restored by decision)'
          : 'restored to the starting status',
      historyEntries: (restored.history ?? []).length,
    };
    await page.close();
  });
});
