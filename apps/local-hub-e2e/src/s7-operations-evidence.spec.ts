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
 * S7 operator-workflow evidence against the live local stack. Run (the Owner Console and Local Hub images must be
 * the freshly built ones):
 *
 *   cd apps/local-hub-e2e && S7_EVIDENCE=true E2E_DOCKER=true BASE_URL=http://127.0.0.1:8087 pnpm exec playwright test -c playwright.config.ts src/s7-operations-evidence.spec.ts --workers=1
 *
 * Environment:
 *   OWNER_URL                    Owner Console origin (default https://nirvana.tail5a4a0.ts.net:8446). Login happens
 *                                on this origin so the Origin header matches the registered app.
 *   S7_OWNER_CREDENTIALS_FILE    JSON {email,password} (default ~/.cache/optimistic-tanuki/rr09-i09-default-owner-credentials.json).
 *                                The credentials are never logged, shot or written anywhere but the browser form.
 *   S7_RIGHTS_RELEASE            Optional release id for the rights sync; otherwise the newest release named by an
 *                                acquisition run is used.
 *
 * The owner session (httpOnly ot_session cookie) is saved to dist/s7-owner-storage-state.json (gitignored).
 * Every mutation here is reversed by the test that makes it, except the intended one-way ones, which are
 * deliberately inert: a withdrawal of a row key that matches nothing, and history import (idempotent, read-only
 * history records). Rights sync and mapping install are idempotent.
 */
const evidenceRun = process.env['S7_EVIDENCE'] === 'true';
const outDir = join(
  __dirname,
  '../../../docs/plans/town-square-directory/s7-evidence'
);
const stateFile = join(__dirname, '../../../dist/s7-owner-storage-state.json');
const OWNER_URL = (
  process.env['OWNER_URL'] || 'https://nirvana.tail5a4a0.ts.net:8446'
).replace(/\/$/, '');
const HUB_URL = (process.env['BASE_URL'] || 'http://127.0.0.1:8087').replace(
  /\/$/,
  ''
);
const GATEWAY_URL = (
  process.env['GATEWAY_URL'] || 'http://127.0.0.1:3000'
).replace(/\/$/, '');
const CREDENTIALS_FILE =
  process.env['S7_OWNER_CREDENTIALS_FILE'] ||
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i09-default-owner-credentials.json';
const TOWN_SLUG = 'valdosta-ga';
const TOWN_ID = '615482e8-d72b-4500-989f-5b79ceb32781';
const ASYNC_TIMEOUT = 120_000;

const desktop = { width: 1280, height: 900 } as const;
const mobile = { width: 390, height: 844 } as const;

test.skip(!evidenceRun, 'set S7_EVIDENCE=true to capture S7 evidence');
test.describe.configure({ mode: 'serial' });
// The shared config launches Chrome with --disable-web-security, which drops
// the Origin header from same-origin POSTs. The gateway binds operator login
// and writes to the registered browser origin, so run with normal security.
test.use({ launchOptions: { args: [] } });

let owner: BrowserContext;
let anon: APIRequestContext;
let hub: APIRequestContext;
const created: Array<() => Promise<void>> = [];

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
  // The Owner Console has no <main>; its pages are a labelled <section>.
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .include('main, section[aria-labelledby]')
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  expect(
    serious.flatMap((v) =>
      v.nodes.map(
        (n) =>
          `${v.id} ${n.target.join(' ')} ${n.failureSummary?.slice(0, 160)}`
      )
    ),
    'serious/critical axe violations'
  ).toEqual([]);
}

interface ApiResult {
  status: number;
  body: any;
}

async function send(
  ctx: APIRequestContext,
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string>,
  data?: unknown
): Promise<ApiResult> {
  const res = await ctx.fetch(url, {
    method,
    headers,
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

/** An operator API call through the Owner Console origin, as the signed-in owner, with the Owner Console scope. */
function ownerApi(
  method: 'GET' | 'POST',
  path: string,
  data?: unknown
): Promise<ApiResult> {
  return send(
    owner.request,
    method,
    `${OWNER_URL}/api${path}`,
    {
      'X-ot-appscope': 'owner-console',
      'X-ot-session-mode': 'cookie',
      Origin: OWNER_URL,
    },
    data
  );
}

function hubApi(path: string): Promise<ApiResult> {
  return send(hub, 'GET', `${HUB_URL}/api${path}`, {
    'x-ot-appscope': 'local-hub',
  });
}

function ownerPage(viewport: { width: number; height: number } = desktop) {
  return owner.newPage({ viewport });
}

const town = (path: string) => `/directory/towns/${TOWN_ID}${path}`;

async function publicListings(q = ''): Promise<any[]> {
  const res = await hubApi(
    town(
      `/local-evaluation-listings?pagination=cursor${
        q ? `&q=${encodeURIComponent(q)}` : ''
      }`
    )
  );
  expect(res.status).toBe(200);
  return res.body.listings as any[];
}

/** Operator view of the same listings, with identities (the suppression page's own search). */
async function operatorListings(q: string): Promise<any[]> {
  const res = await ownerApi(
    'GET',
    town(`/local-evaluation-listings?q=${encodeURIComponent(q)}&identities=1`)
  );
  expect(res.status).toBe(200);
  return res.body.listings as any[];
}

async function openOwner(page: Page, path: string): Promise<void> {
  await page.goto(`${OWNER_URL}${path}`);
  await expect(page).toHaveURL(new RegExp(`${path.split('/')[2]}`));
  await expect(page.locator('h1').first()).toBeVisible();
}

function status(page: Page) {
  return page.locator('[role="status"].page-message');
}

async function confirmUndo(
  page: Page,
  scope: ReturnType<Page['locator']>,
  reason: string
): Promise<void> {
  await scope
    .getByRole('button', { name: 'Undo', exact: true })
    .first()
    .click();
  const dialog = scope.getByRole('alertdialog', { name: 'Confirm undo' });
  await dialog.getByLabel('Reason (required)').fill(reason);
  await dialog.getByRole('button', { name: 'Confirm undo' }).click();
  await expect(status(page)).toContainText(/Undid/);
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  if (!existsSync(CREDENTIALS_FILE))
    throw new Error('S7 owner credentials file not found');
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
  // No screenshot of this form: it holds the credentials.
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
  hub = await pwRequest.newContext({ ignoreHTTPSErrors: true });
});

test.afterAll(async () => {
  for (const undo of created.reverse()) {
    try {
      await undo();
    } catch {
      // best effort: the test that made the change also reverses it
    }
  }
  await owner?.close();
  await anon?.dispose();
  await hub?.dispose();
});

test.describe('S7 operator workflows (live)', () => {
  test.use({ viewport: desktop });

  test('1. permission matrix over the API', async () => {
    const paths = [
      '/directory/runs',
      '/directory/rights-cases',
      '/directory/taxonomy/cases',
      '/directory/withdrawals',
      town('/business-identity-review'),
    ];
    interface Row {
      case: string;
      path: string;
      session: 'none' | 'owner';
      scopeHeader: string | null;
      expected: string;
      status: number;
    }
    const rows: Row[] = [];
    const run = async (
      label: string,
      ctx: APIRequestContext,
      session: 'none' | 'owner',
      scope: string | null,
      expected: number[],
      base = OWNER_URL,
      cookie?: string
    ) => {
      for (const p of paths) {
        const headers: Record<string, string> = { Origin: OWNER_URL };
        if (scope) headers['x-ot-appscope'] = scope;
        if (cookie) headers['Cookie'] = cookie;
        const res = await send(ctx, 'GET', `${base}/api${p}`, headers);
        rows.push({
          case: label,
          path: p,
          session,
          scopeHeader: scope,
          expected: expected.join('|'),
          status: res.status,
        });
        expect(expected, `${label} ${p} -> ${res.status}`).toContain(
          res.status
        );
      }
    };
    await run('anonymous, owner-console scope', anon, 'none', 'owner-console', [
      401,
    ]);
    await run(
      'anonymous, owner-console scope, direct gateway',
      anon,
      'none',
      'owner-console',
      [401],
      GATEWAY_URL
    );
    await run(
      'no session, local-hub scope',
      anon,
      'none',
      'local-hub',
      [401, 403]
    );
    // The Owner Console proxy always adds its own scope, so the wrong-scope
    // rows carry the owner's session cookie straight to the gateway.
    const sessionCookie = (await owner.cookies(OWNER_URL))
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    expect(sessionCookie).toContain('ot_session=');
    await run(
      'owner session, no scope header, direct gateway',
      anon,
      'owner',
      null,
      [401, 403],
      GATEWAY_URL,
      sessionCookie
    );
    await run(
      'owner session, local-hub scope header, direct gateway',
      anon,
      'owner',
      'local-hub',
      [401, 403],
      GATEWAY_URL,
      sessionCookie
    );
    // Positive control: the same session with the right scope is allowed, so the 403s above are about scope.
    await run(
      'owner session, owner-console scope (control)',
      owner.request,
      'owner',
      'owner-console',
      [200]
    );
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, 's7-permission-matrix.json'),
      JSON.stringify({ generatedFor: 'S7 operator routes', rows }, null, 2) +
        '\n'
    );
  });

  test('2. acquisition runs: history, progress, refused resume, budget', async () => {
    const page = await ownerPage();
    await openOwner(page, '/dashboard/directory-runs');
    await expect(
      page.getByRole('heading', { name: 'Acquisition runs', exact: true })
    ).toBeVisible();
    // Budget panel with the 2500-cent ceiling.
    await expect(page.getByText(/of 2500 cents/)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Provider budget/ })
    ).toBeVisible();

    const reason = 'S7 evidence: import history';
    await page.getByLabel('Reason (required)').first().fill(reason);
    await page.getByRole('button', { name: 'Import history' }).click();
    await expect(status(page)).toContainText(/History imported:/);
    // Idempotent: repeating adds nothing.
    await page.getByRole('button', { name: 'Import history' }).click();
    await expect(status(page)).toContainText(/0 added/);
    await axe(page);
    await shot(page, 'desktop-runs-01-list-and-budget');

    const historical = page
      .locator('otui-card.run-card')
      .filter({ hasText: /Historical/i })
      .first();
    const card = (await historical.count())
      ? historical
      : page.locator('otui-card.run-card').first();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Open' }).click();
    await expect(
      page.getByRole('table', { name: 'Progress by unit' })
    ).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();
    await axe(page);
    await shot(page, 'desktop-runs-02-run-progress');

    // Resume on a history record: the page offers no Resume and says why; the API refuses it with 409.
    const detail = page.locator('otui-card.run-card.detail');
    await expect(
      detail.getByRole('button', { name: 'Resume', exact: true })
    ).toHaveCount(0);
    await expect(
      detail.getByText(
        'This is an imported history record; there is nothing to resume.'
      )
    ).toBeVisible();
    const runId = (await detail.locator('h2').textContent())
      ?.replace('Run', '')
      .trim();
    expect(runId).toMatch(/^[0-9a-f-]{36}$/);
    const current = await ownerApi('GET', `/directory/runs/${runId}`);
    expect(current.status).toBe(200);
    const refused = await ownerApi('POST', `/directory/runs/${runId}/resume`, {
      decisionId: randomUUID(),
      reason: 'S7 evidence: resume a history record',
      expectedVersionToken: current.body.versionToken,
      confirm: 'RESUME',
    });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('invalid_state');
    await shot(page, 'desktop-runs-03-resume-refused');

    await page.setViewportSize(mobile);
    await shot(page, 'mobile-runs-01-detail');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await shot(page, 'mobile-runs-02-list');
    await page.close();
  });

  test('3. correction propagation: suppress, public absence, lift', async ({
    page,
  }) => {
    const [first] = await publicListings();
    expect(first, 'valdosta has a public listing').toBeTruthy();
    const name: string = first.name;
    const reference: string = first.reference;
    const operator = (await operatorListings(name)).find(
      (l) => l.name === name && typeof l.id === 'string'
    );
    expect(operator, 'operator search finds the listing id').toBeTruthy();
    const listingId: string = operator.id;
    const cardsNamed = (p: Page) =>
      p.locator('article.card').filter({
        has: p.locator('h3.card__name', { hasText: name }),
      });
    const before = (await publicListings(name)).filter(
      (l) => l.name === name
    ).length;
    expect(before).toBeGreaterThan(0);
    const detailBefore = await hubApi(
      town(`/local-evaluation-listings/${encodeURIComponent(reference)}`)
    );
    expect(detailBefore.status).toBe(200);

    // The list page is open and holds a snapshot (Back redraws from it for up to 60 seconds).
    await page.goto(
      `/city/${TOWN_SLUG}/businesses?q=${encodeURIComponent(name)}`
    );
    await expect(cardsNamed(page)).toHaveCount(before);
    await shot(page, 'desktop-correction-01-public-before');

    const op = await ownerPage();
    let suppressed = false;
    try {
      await openOwner(
        op,
        `/dashboard/directory-listing-suppressions/${TOWN_ID}`
      );
      await op.getByLabel('Search this town').fill(name);
      await op.getByRole('button', { name: 'Search', exact: true }).click();
      // Search hits carry a Suppress button; history rows for the same listing do not.
      const hit = op
        .locator('p.row-line')
        .filter({ hasText: listingId })
        .filter({
          has: op.getByRole('button', { name: 'Suppress', exact: true }),
        });
      await expect(hit).toBeVisible();
      await hit.getByRole('button', { name: 'Suppress', exact: true }).click();
      // "other" is not a rights reason and does not send the listing to address review, so the lift restores it fully.
      await op
        .getByRole('combobox', { name: /^Reason\b/ })
        .selectOption('other');
      await op.getByLabel('Note (optional, internal)').fill('S7 evidence run');
      await op.getByLabel(/I reviewed this listing/).check();
      await axe(op);
      await shot(op, 'desktop-correction-02-suppress-form');
      // Arm the cleanup before submitting: a write can land even when the reply fails.
      suppressed = true;
      await op.getByRole('button', { name: 'Suppress listing' }).click();
      await expect(status(op)).toContainText(/Listing suppressed/);
      const suppressedCard = op
        .locator('otui-card.suppression-card')
        .filter({ hasText: listingId })
        .filter({ hasText: 'Suppressed' })
        .first();
      await expect(suppressedCard).toContainText('Suppressed');
      await axe(op);
      await shot(op, 'desktop-correction-03-suppressed');
      await op.setViewportSize(mobile);
      await shot(op, 'mobile-suppression-01-list');
      await op.setViewportSize(desktop);

      // Public absence, API first.
      await expect
        .poll(
          async () =>
            (await publicListings(name)).filter((l) => l.name === name).length,
          { timeout: 30_000 }
        )
        .toBe(before - 1);
      expect(
        (
          await hubApi(town(`/local-evaluation-listings?pagination=cursor`))
        ).body.listings.some((l: any) => l.reference === reference),
        'the old reference is not in the public payload (the map reads this same payload, so no pin either)'
      ).toBe(false);
      const detailGone = await hubApi(
        town(`/local-evaluation-listings/${encodeURIComponent(reference)}`)
      );
      expect(detailGone.status).toBe(404);

      // Snapshot: the open page still shows the stale card. Opening it is a fetch, which 404s; the service then
      // forgets the listing from every remembered page (forgetListing), so Back must not resurrect it. Reload is
      // the other half: snapshots are in memory only, so a reload always refetches.
      const staleCard = cardsNamed(page).first();
      if (await staleCard.count()) {
        await staleCard.locator('a.card__detail').click();
        await expect(page.getByTestId('detail-expired')).toBeVisible();
        await shot(page, 'desktop-correction-04-detail-expired');
        await page.goBack();
      } else {
        await page.goto(
          `/city/${TOWN_SLUG}/businesses?q=${encodeURIComponent(name)}`
        );
      }
      await expect(cardsNamed(page)).toHaveCount(before - 1);
      await shot(page, 'desktop-correction-05-after-back');
      await page.reload();
      await expect(cardsNamed(page)).toHaveCount(before - 1);
      await page.goto(
        `/city/${TOWN_SLUG}/businesses/${encodeURIComponent(reference)}`
      );
      await expect(page.getByTestId('detail-expired')).toBeVisible();
      await axe(page);

      // Lift in the Owner Console.
      await openOwner(
        op,
        `/dashboard/directory-listing-suppressions/${TOWN_ID}`
      );
      const open = op
        .locator('otui-card.suppression-card')
        .filter({ hasText: listingId })
        .filter({ hasText: 'Suppressed' })
        .first();
      await open.getByRole('button', { name: 'Lift suppression' }).click();
      await open.getByLabel('Lift reason').selectOption('mistaken-suppression');
      await open.getByLabel(/I want this listing public again/).check();
      await open
        .getByRole('button', { name: 'Lift suppression' })
        .last()
        .click();
      await expect(status(op)).toContainText(/Suppression lifted/);
      suppressed = false;
      await shot(op, 'desktop-correction-06-lifted');
    } finally {
      if (suppressed) {
        // Reverse an interrupted run through the API so the live data is never left hidden.
        const list = await ownerApi('GET', town('/listing-suppressions'));
        const openOne = (list.body?.suppressions ?? []).find(
          (s: any) => s.listingId === listingId && !s.liftedAt
        );
        if (openOne)
          await ownerApi(
            'POST',
            town(`/listing-suppressions/${openOne.suppressionId}/lift`),
            { attested: true, reasonCode: 'mistaken-suppression' }
          );
      }
      await op.close();
    }
    await expect
      .poll(
        async () =>
          (await publicListings(name)).filter((l) => l.name === name).length,
        { timeout: 30_000 }
      )
      .toBe(before);
    await page.goto(
      `/city/${TOWN_SLUG}/businesses?q=${encodeURIComponent(name)}`
    );
    await expect(cardsNamed(page)).toHaveCount(before);
    await shot(page, 'desktop-correction-07-restored');
  });

  test('4. identity review: confirm, undo, history, stale token', async () => {
    const page = await ownerPage();
    await openOwner(page, `/dashboard/directory-identity-review/${TOWN_ID}`);
    await expect(
      page.getByRole('heading', {
        name: 'Business identity review',
        exact: true,
      })
    ).toBeVisible();
    await expect(
      page.getByText('Unresolved', { exact: true }).first()
    ).toBeVisible();
    const queue = await ownerApi('GET', town('/business-identity-review'));
    expect(queue.status).toBe(200);
    const item =
      queue.body.queue.unresolved[0] ?? queue.body.queue.carriedUnbound[0];
    const outcome: Record<string, unknown> = {
      health: queue.body.health,
      itemAvailable: !!item,
    };
    if (!item) {
      await expect(
        page.getByText('No row is waiting for a decision.')
      ).toBeVisible();
      await axe(page);
      await shot(page, 'desktop-identity-01-empty');
    } else {
      const businessId: string = item.businessId;
      const oldToken: string = item.versionToken;
      await axe(page);
      await shot(page, 'desktop-identity-01-queue');
      const card = page
        .locator('otui-card.business-card')
        .filter({ hasText: businessId })
        .first();
      await card.getByRole('button', { name: 'Confirm', exact: true }).click();
      await card
        .getByLabel('Reason (required)')
        .fill('S7 evidence: confirm then undo');
      await card.getByLabel(/I reviewed this business/).check();
      await shot(page, 'desktop-identity-02-confirm-form');
      await card.getByRole('button', { name: 'Record confirm' }).click();
      await expect(status(page)).toContainText(/Recorded confirm/);
      await card.getByRole('button', { name: 'History', exact: true }).click();
      await expect(
        card.locator('.decision-history__entry').first()
      ).toBeVisible();
      await shot(page, 'desktop-identity-03-history-after-confirm');
      await confirmUndo(page, card, 'S7 evidence: undo the confirm');
      await expect(card.locator('.decision-history__entry')).toHaveCount(2);
      await expect(card.getByText('Undone')).toBeVisible();
      await axe(page);
      await shot(page, 'desktop-identity-04-history-after-undo');

      const detail = await ownerApi(
        'GET',
        town(`/business-identity-review/${businessId}`)
      );
      expect(detail.status).toBe(200);
      expect(detail.body.history.length).toBeGreaterThanOrEqual(2);
      expect(detail.body.history.some((h: any) => h.undoOf)).toBe(true);
      expect(detail.body.history.some((h: any) => h.undoneBy)).toBe(true);

      // Stale token: the pre-decision token no longer matches, so the same decision is refused and writes nothing.
      const stale = await ownerApi(
        'POST',
        town('/business-identity-review/decisions'),
        {
          decisionId: randomUUID(),
          expectedVersionToken: oldToken,
          action: 'confirm',
          businessId,
          reason: 'S7 evidence: stale token must be refused',
          attested: true,
        }
      );
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('stale_decision');
      outcome['staleDecision'] = {
        status: stale.status,
        code: stale.body.code,
      };
      const after = await ownerApi(
        'GET',
        town(`/business-identity-review/${businessId}`)
      );
      expect(after.body.history.length).toBe(detail.body.history.length);
    }
    writeFileSync(
      join(outDir, 's7-identity-outcome.json'),
      JSON.stringify(outcome, null, 2) + '\n'
    );
    await page.close();
  });

  test('5. address review: needs info, undo, history, stale token', async () => {
    const page = await ownerPage();
    await openOwner(page, `/dashboard/directory-address-review/${TOWN_ID}`);
    await expect(
      page.getByRole('heading', { name: 'Address review queue', exact: true })
    ).toBeVisible();
    const list = await ownerApi(
      'GET',
      town('/address-review-candidates?status=needs_human&limit=25&offset=0')
    );
    expect(list.status).toBe(200);
    const candidate = (list.body.candidates ?? [])[0];
    const outcome: Record<string, unknown> = {
      candidateAvailable: !!candidate,
    };
    if (!candidate) {
      await expect(
        page.getByText('No candidates in this status')
      ).toBeVisible();
      await axe(page);
      await shot(page, 'desktop-address-01-empty');
    } else {
      const oldToken: string = candidate.versionToken;
      const card = page
        .locator('otui-card.candidate-card')
        .filter({ has: page.locator('h2', { hasText: candidate.name }) })
        .first();
      await expect(card).toBeVisible();
      await axe(page);
      await shot(page, 'desktop-address-01-queue');
      await card
        .getByLabel('Review note (optional)')
        .fill('S7 evidence: needs info then undo');
      // lib-checkbox hides its native input behind a styled mark; click the label.
      await card
        .getByText('I compared the source record, geocode and evidence.')
        .click();
      await expect(card.locator('lib-checkbox input')).toBeChecked();
      await card.getByRole('button', { name: 'Needs info' }).click();
      await expect(status(page)).toContainText(/Recorded needs info/);
      // needs_info keeps the candidate in needs_human; the list refreshes, so find the card again.
      const again = page
        .locator('otui-card.candidate-card')
        .filter({ has: page.locator('h2', { hasText: candidate.name }) })
        .first();
      await expect(again.locator('otui-badge').first()).toBeVisible();
      await again.getByRole('button', { name: 'History', exact: true }).click();
      // The candidate may carry earlier system decisions, so count relative to this run.
      await expect(
        again.getByText('S7 evidence: needs info then undo').first()
      ).toBeVisible();
      const entries = again.locator('.decision-history__entry');
      const afterDecision = await entries.count();
      outcome['historyBeforeRun'] = afterDecision - 1;
      await shot(page, 'desktop-address-02-history-after-decision');
      await confirmUndo(page, again, 'S7 evidence: undo needs info');
      await expect(entries).toHaveCount(afterDecision + 1);
      await expect(
        again.getByText('Needs Human', { exact: true }).first()
      ).toBeVisible();
      await shot(page, 'desktop-address-03-history-after-undo');

      const detail = await ownerApi(
        'GET',
        town(`/address-review-candidates/${candidate.id}`)
      );
      expect(detail.status).toBe(200);
      expect(detail.body.status).toBe('needs_human');
      outcome['finalStatus'] = detail.body.status;

      const stale = await ownerApi(
        'POST',
        town(`/address-review-candidates/${candidate.id}/decisions`),
        {
          decisionId: randomUUID(),
          expectedVersionToken: oldToken,
          decision: 'needs_info',
          reason: 'S7 evidence: stale token must be refused',
          attested: true,
        }
      );
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('stale_decision');
      outcome['staleDecision'] = {
        status: stale.status,
        code: stale.body.code,
      };
    }
    writeFileSync(
      join(outDir, 's7-address-outcome.json'),
      JSON.stringify(outcome, null, 2) + '\n'
    );
    await page.close();
  });

  test('6. rights: sync, defer, undo, invalid terms hash', async () => {
    const page = await ownerPage();
    await openOwner(page, '/dashboard/directory-rights');
    await expect(
      page.getByRole('heading', { name: 'Rights cases', exact: true })
    ).toBeVisible();

    let release = process.env['S7_RIGHTS_RELEASE'] ?? '';
    if (!release) {
      const runs = await ownerApi('GET', '/directory/runs?limit=50');
      release =
        (runs.body?.runs ?? []).find(
          (r: any) => typeof r.release === 'string' && r.release
        )?.release ?? '';
    }
    const outcome: Record<string, unknown> = { release: release || null };
    if (release) {
      await page.getByLabel('Release id').fill(release);
      await page
        .getByRole('button', { name: 'Sync cases from release' })
        .click();
      await expect(status(page)).toContainText(/Sync complete:/);
    }
    await page.reload();
    const cards = page.locator('otui-card.case-card');
    const count = await cards.count();
    outcome['reviewCases'] = count;
    if (count === 0) {
      await expect(page.getByText('No cases in this status')).toBeVisible();
      await axe(page);
      await shot(page, 'desktop-rights-01-empty');
    } else {
      await axe(page);
      await shot(page, 'desktop-rights-01-queue');
      // Invalid SHA: validated before any request is made.
      let confirmable = -1;
      for (let i = 0; i < Math.min(count, 10); i++) {
        await cards
          .nth(i)
          .getByRole('button', { name: 'Open', exact: true })
          .click();
        if (
          await cards
            .nth(i)
            .getByRole('button', { name: 'Confirm terms read' })
            .count()
        ) {
          confirmable = i;
          break;
        }
        await cards
          .nth(i)
          .getByRole('button', { name: 'Close', exact: true })
          .click();
      }
      outcome['confirmTermsCaseAvailable'] = confirmable >= 0;
      if (confirmable >= 0) {
        const c = cards.nth(confirmable);
        await c
          .getByLabel('Reason (required)')
          .fill('S7 evidence: invalid hash');
        await c
          .getByLabel('Terms URL (confirming terms)')
          .fill('https://example.com/terms');
        await c
          .getByLabel('SHA-256 of the terms text (confirming terms)')
          .fill('not-a-sha');
        await c.getByRole('button', { name: 'Confirm terms read' }).click();
        await expect(status(page)).toContainText(
          'Confirming terms needs an HTTPS terms URL and the SHA-256'
        );
        await shot(page, 'desktop-rights-02-invalid-sha');
        await c.getByRole('button', { name: 'Close', exact: true }).click();
      }
      // Defer, then undo.
      const target = cards.first();
      await target.getByRole('button', { name: 'Open', exact: true }).click();
      await target
        .getByLabel('Reason (required)')
        .fill('S7 evidence: defer then undo');
      await target.getByRole('button', { name: 'Defer', exact: true }).click();
      await expect(status(page)).toContainText('Recorded defer.');
      await expect(
        target.locator('.decision-history__entry').first()
      ).toBeVisible();
      await shot(page, 'desktop-rights-03-deferred-history');
      await confirmUndo(page, target, 'S7 evidence: undo defer');
      await expect(target.locator('.decision-history__entry')).toHaveCount(2);
      await axe(page);
      await shot(page, 'desktop-rights-04-history-after-undo');
    }
    writeFileSync(
      join(outDir, 's7-rights-outcome.json'),
      JSON.stringify(outcome, null, 2) + '\n'
    );
    await page.close();
  });

  test('7. withdrawals: a row of an unbound scan is refused permanently, nothing removed', async () => {
    const page = await ownerPage();
    await openOwner(page, '/dashboard/directory-withdrawals');
    await expect(
      page.getByRole('heading', { name: 'Withdrawals', exact: true })
    ).toBeVisible();
    await axe(page);
    await shot(page, 'desktop-withdrawals-01-form');
    // A well-formed row key (64 hex characters, row number) for a scan bound to no
    // policy. The worker refuses it as a permanent failure without retrying, so the
    // request exercises the full form, queue and worker path and removes nothing.
    // A target that completed would leave a revocation marker that cannot be undone.
    const target = `${'0'.repeat(63)}1:4000000000`;
    await page.getByRole('button', { name: 'One row' }).click();
    await page.getByLabel('Target', { exact: true }).fill(target);
    await page
      .getByLabel('Reason (required)')
      .fill('S7 evidence: no-op target');
    await page.getByLabel(/Type WITHDRAW to confirm/).fill('WITHDRAW');
    await page.getByRole('button', { name: 'Withdraw permanently' }).click();
    await expect(status(page)).not.toContainText(/refused|could not/i);
    const card = page
      .locator('otui-card.withdrawal-card')
      .filter({ hasText: target })
      .first();
    await expect(card).toBeVisible();
    await expect
      .poll(
        async () => {
          const res = await ownerApi('GET', '/directory/withdrawals?limit=25');
          return (res.body?.requests ?? []).find(
            (r: any) => r.target === target
          )?.status;
        },
        { timeout: ASYNC_TIMEOUT, intervals: [2000] }
      )
      .toBe('failed');
    const final = (
      await ownerApi('GET', '/directory/withdrawals?limit=25')
    ).body.requests.find((r: any) => r.target === target);
    expect(final.lastError).toBe('Scan not bound to policy');
    expect(final.attempts, 'a permanent failure is not retried').toBe(1);
    await page.reload();
    await expect(
      page
        .locator('otui-card.withdrawal-card')
        .filter({ hasText: target })
        .first()
        .getByRole('alert')
    ).toContainText('Scan not bound to policy', { timeout: 30_000 });
    await axe(page);
    await shot(page, 'desktop-withdrawals-02-refused');
    writeFileSync(
      join(outDir, 's7-withdrawal-outcome.json'),
      JSON.stringify(
        {
          target,
          status: final.status,
          attempts: final.attempts,
          lastError: final.lastError,
        },
        null,
        2
      ) + '\n'
    );
    await page.close();
  });

  test('8a. taxonomy runs: install, dry run, apply gated on the active mapping', async () => {
    test.setTimeout(6 * 60_000);
    const page = await ownerPage();
    await openOwner(page, '/dashboard/directory-taxonomy-runs');
    await expect(
      page.getByRole('heading', { name: 'Reclassification runs', exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Install', exact: true }).click();
    await expect(status(page)).toContainText(/installed/);
    await axe(page);
    await shot(page, 'desktop-taxonomy-01-mapping');

    const form = page
      .locator('otui-card.run-form')
      .filter({ hasText: 'New dry run' });
    await form.getByRole('button', { name: 'One town' }).click();
    await form.getByLabel('Town id').fill(TOWN_ID);
    await form
      .getByLabel('Reason (required)')
      .fill('S7 evidence: valdosta dry run');
    await form.getByRole('button', { name: 'Start dry run' }).click();
    await expect(status(page)).toContainText(/Dry run queued/);

    const newest = async (mode: string) => {
      const res = await ownerApi('GET', '/directory/taxonomy/runs?limit=25');
      return (res.body?.runs as any[])
        .filter((r) => r.mode === mode && r.townId === TOWN_ID)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    };
    let dry: any;
    await expect
      .poll(async () => ((dry = await newest('dry_run')), dry?.status), {
        timeout: ASYNC_TIMEOUT,
        intervals: [2000],
      })
      .toBe('complete');
    expect(dry.planHash).toMatch(/^[0-9a-f]{64}$/);
    await page.reload();
    const dryCard = page
      .locator('otui-card.run-card')
      .filter({ hasText: dry.planHash })
      .first();
    await expect(dryCard).toBeVisible();
    await axe(page);
    await shot(page, 'desktop-taxonomy-02-dry-run-diff');

    const transition = dry.summary.transitions[0];
    const outcome: Record<string, unknown> = {
      planHash: dry.planHash,
      transitions: dry.summary.transitions.length,
      changedRows: dry.changedRows,
    };
    const sample = transition?.samples?.[0]?.name as string | undefined;
    const categoryOf = async (name: string) =>
      (await publicListings(name)).find((l) => l.name === name)?.category;
    const categoryBefore = sample ? await categoryOf(sample) : undefined;

    // Apply needs the active mapping. Activation changes how every later case
    // decision re-derives a category and has no deactivate control, so the
    // evidence run never activates: it is the owner's deploy decision. With the
    // mapping inactive the run shows the server refusing apply; with it active
    // it applies and rolls back.
    const mappings = await ownerApi('GET', '/directory/taxonomy/mappings');
    expect(mappings.status).toBe(200);
    const mappingActive = (mappings.body.versions as any[]).some(
      (v) => v.id === dry.mappingVersion && v.active === true
    );
    outcome['mappingActive'] = mappingActive;
    if (!mappingActive) {
      const appliesBefore = (
        await ownerApi('GET', '/directory/taxonomy/runs?limit=100')
      ).body.runs.filter((r: any) => r.mode === 'apply').length;
      await dryCard
        .getByLabel('Reason (required)')
        .fill('S7 evidence: apply while the mapping is inactive');
      await dryCard.getByLabel('Type APPLY to apply this plan').fill('APPLY');
      await dryCard.getByRole('button', { name: 'Apply this plan' }).click();
      await expect(status(page)).toContainText(/apply was refused/i);
      await shot(page, 'desktop-taxonomy-03-apply-refused-inactive');
      const appliesAfter = (
        await ownerApi('GET', '/directory/taxonomy/runs?limit=100')
      ).body.runs.filter((r: any) => r.mode === 'apply').length;
      expect(appliesAfter, 'no apply run was created').toBe(appliesBefore);
      outcome['applyRefused'] = true;
      if (sample)
        expect(await categoryOf(sample), 'public category unchanged').toBe(
          categoryBefore
        );
    }

    let applied: any;
    if (mappingActive)
      try {
        const reason = dryCard.getByLabel('Reason (required)');
        await reason.fill('S7 evidence: apply then roll back');
        await dryCard.getByLabel('Type APPLY to apply this plan').fill('APPLY');
        await dryCard.getByRole('button', { name: 'Apply this plan' }).click();
        await expect(status(page)).toContainText(/Apply queued/);
        await expect
          .poll(
            async () => ((applied = await newest('apply')), applied?.status),
            {
              timeout: ASYNC_TIMEOUT,
              intervals: [2000],
            }
          )
          .toBe('complete');
        await page.reload();
        await shot(page, 'desktop-taxonomy-03-applied');
        const categoryApplied = sample ? await categoryOf(sample) : undefined;
        outcome['sample'] = {
          name: sample ?? null,
          transition: transition
            ? `${transition.from} -> ${transition.to}`
            : null,
          before: categoryBefore ?? null,
          afterApply: categoryApplied ?? null,
          publicCategoryChanged: categoryApplied !== categoryBefore,
        };

        const applyCard = page
          .locator('otui-card.run-card')
          .filter({ hasText: /Apply · one town/ })
          .first();
        await applyCard
          .getByLabel('Reason (required)')
          .fill('S7 evidence: rollback');
        await applyCard
          .getByLabel('Type ROLLBACK to roll this run back')
          .fill('ROLLBACK');
        await applyCard.getByRole('button', { name: 'Roll back' }).click();
        await expect(status(page)).toContainText(/Rollback started/);
        await expect
          .poll(async () => (await newest('apply'))?.status, {
            timeout: ASYNC_TIMEOUT,
            intervals: [2000],
          })
          .toBe('rolled_back');
        applied = undefined;
        await page.reload();
        await axe(page);
        await shot(page, 'desktop-taxonomy-04-rolled-back');
        if (sample)
          expect(await categoryOf(sample), 'public category restored').toBe(
            categoryBefore
          );
      } finally {
        if (applied && applied.status === 'complete') {
          await ownerApi(
            'POST',
            `/directory/taxonomy/runs/${applied.id}/rollback`,
            {
              reason: 'S7 evidence: cleanup rollback',
              confirm: 'ROLLBACK',
            }
          );
        }
      }
    writeFileSync(
      join(outDir, 's7-taxonomy-run-outcome.json'),
      JSON.stringify(outcome, null, 2) + '\n'
    );
    await page.setViewportSize(mobile);
    await shot(page, 'mobile-taxonomy-runs');
    await page.close();
  });

  test('8b. taxonomy case: assign, public detail changes, undo restores', async ({
    page: hubPage,
  }) => {
    const [first] = (await publicListings()).slice(0, 1);
    const name: string = first.name;
    const operator = (await operatorListings(name)).find(
      (l) => l.name === name && typeof l.id === 'string'
    );
    expect(operator).toBeTruthy();
    const original: string = (await publicListings(name)).find(
      (l) => l.name === name
    ).category;
    const candidates = ['stores', 'services', 'activities', 'education'];
    const chosen = candidates.find((c) => c !== original) as string;

    const page = await ownerPage();
    await openOwner(page, '/dashboard/directory-taxonomy');
    await expect(
      page.getByRole('heading', { name: 'Taxonomy cases', exact: true })
    ).toBeVisible();
    const raise = page.locator('otui-card.raise-form');
    await raise.getByLabel('Town id').fill(TOWN_ID);
    await raise.getByLabel('Listing id').fill(operator.id);
    await raise
      .getByLabel('Reason (required)')
      .fill('S7 evidence: category check');
    await raise.getByRole('button', { name: 'Raise case' }).click();
    await expect(status(page)).toContainText(
      /Case raised|already has an open case/
    );
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Taxonomy cases', exact: true })
    ).toBeVisible();
    await axe(page);
    await shot(page, 'desktop-taxonomy-case-01-queue');
    const card = page
      .locator('otui-card.case-card')
      .filter({ has: page.locator('h2', { hasText: name }) })
      .first();
    await expect(card).toBeVisible();
    let assigned = false;
    try {
      await card.getByRole('button', { name: 'Open', exact: true }).click();
      await card
        .getByLabel('Reason (required)')
        .fill('S7 evidence: assign then undo');
      await card
        .getByRole('combobox', { name: /^Category\b/ })
        .selectOption(chosen);
      await shot(page, 'desktop-taxonomy-case-02-assign-form');
      await card.getByRole('button', { name: 'Assign category' }).click();
      await expect(status(page)).toContainText('Recorded assign.');
      assigned = true;
      await expect
        .poll(
          async () =>
            (await publicListings(name)).find((l) => l.name === name)?.category,
          {
            timeout: 30_000,
          }
        )
        .toBe(chosen);
      await hubPage.goto(
        `/city/${TOWN_SLUG}/businesses?q=${encodeURIComponent(name)}`
      );
      await hubPage
        .locator('article.card')
        .filter({ hasText: name })
        .first()
        .locator('a.card__detail')
        .click();
      await expect(hubPage.locator('.detail__category')).toBeVisible();
      await shot(hubPage, 'desktop-taxonomy-case-03-public-detail-assigned');
      await shot(page, 'desktop-taxonomy-case-04-history');
      await confirmUndo(page, card, 'S7 evidence: undo assignment');
      assigned = false;
      await expect
        .poll(
          async () =>
            (await publicListings(name)).find((l) => l.name === name)?.category,
          {
            timeout: 30_000,
          }
        )
        .toBe(original);
      await hubPage.reload();
      await shot(hubPage, 'desktop-taxonomy-case-05-public-detail-restored');
      await shot(page, 'desktop-taxonomy-case-06-history-after-undo');
    } finally {
      if (assigned) {
        const open = await ownerApi(
          'GET',
          '/directory/taxonomy/cases?status=all&limit=50'
        );
        const mine = (open.body?.cases ?? []).find(
          (c: any) => c.name === name && c.status === 'assigned'
        );
        if (mine) {
          const d = await ownerApi(
            'GET',
            `/directory/taxonomy/cases/${mine.id}`
          );
          const latest = (d.body?.history ?? []).find(
            (h: any) => h.reversible && !h.undoneBy
          );
          if (latest)
            await ownerApi(
              'POST',
              `/directory/taxonomy/cases/${mine.id}/undo`,
              {
                decisionId: randomUUID(),
                undoOf: latest.decisionId ?? latest.id,
                expectedVersionToken: d.body.versionToken,
                reason: 'S7 evidence: cleanup undo',
              }
            );
        }
      }
      await page.close();
    }
  });
});
