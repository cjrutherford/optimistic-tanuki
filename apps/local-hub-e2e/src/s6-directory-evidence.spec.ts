import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * S6 acceptance evidence against the live local stack (E2E_DOCKER=true, BASE_URL=http://127.0.0.1:8087).
 * Live towns: populated (valdosta-ga), blocked/town-ineligible (dev-review-0d056f5e) and a town Directory has never
 * scanned (alexandria-va, coverage unknown — what a newly created town shows). States the stack cannot produce on
 * demand (acquiring, empty, partial, unconfigured, policy-withdrawn, failed infrastructure) are rendered by
 * intercepting only the public listings response; everything else on the page is live.
 */
const evidenceRun = process.env['S6_EVIDENCE'] === 'true';
const outDir = join(
  __dirname,
  '../../../docs/plans/town-square-directory/s6-evidence'
);
const POPULATED = 'valdosta-ga';
const BLOCKED = 'dev-review-0d056f5e';
const NEVER_SCANNED = 'alexandria-va';

const viewports = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

test.skip(!evidenceRun, 'set S6_EVIDENCE=true to capture S6 evidence');

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
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .include('main')
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

interface StubCoverage {
  state: string;
  reason?: string;
  withheldReviewedDetails: number;
}

async function stubListings(
  page: Page,
  body: { status: number; coverage?: StubCoverage; keepListings?: boolean }
): Promise<void> {
  await page.route(
    '**/api/directory/towns/*/local-evaluation-listings?**',
    async (route) => {
      if (body.status !== 200) {
        await route.fulfill({
          status: body.status,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Local directory unavailable' }),
        });
        return;
      }
      const live = await route.fetch();
      const json = await live.json();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...json,
          listings: body.keepListings ? json.listings : [],
          hasMore: body.keepListings ? json.hasMore : false,
          nextCursor: body.keepListings ? json.nextCursor : null,
          coverage: body.coverage,
        }),
      });
    }
  );
}

const directory = (slug: string, query = '') =>
  `/city/${slug}/businesses${query}`;

for (const [vp, size] of Object.entries(viewports)) {
  test.describe(`S6 directory states (${vp})`, () => {
    test.use({ viewport: size });

    test('populated town: list, filters in URL, Back, detail', async ({
      page,
    }) => {
      await page.goto(directory(POPULATED));
      const cards = page.locator('article.card');
      await expect(cards.first()).toBeVisible();
      await expect(
        page.getByText('Directory listing (not claimed)').first()
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /nearby towns/i })
      ).toBeVisible();
      await axe(page);
      await shot(page, `${vp}-01-populated`);

      // Keyboard: the search box is reachable and submitting writes the URL.
      await page.getByLabel('Search businesses').fill('pizza');
      await page.getByLabel('Search businesses').press('Enter');
      await expect(page).toHaveURL(/[?&]q=pizza/);
      await expect(cards.first()).toBeVisible();
      await page.reload();
      await expect(page.getByLabel('Search businesses')).toHaveValue('pizza');
      await page.goBack();
      await expect(page).not.toHaveURL(/q=pizza/);
      await expect(page.getByLabel('Search businesses')).toHaveValue('');

      await cards.first().locator('a.card__detail').click();
      await expect(page).toHaveURL(/\/businesses\/[^/?]+/);
      await expect(
        page.getByRole('link', { name: /report or correct/i })
      ).toBeVisible();
      await axe(page);
      await shot(page, `${vp}-02-detail`);
    });

    test('zero-results search keeps the directory entry', async ({ page }) => {
      await page.goto(directory(POPULATED, '?q=zzqqxxnomatch'));
      await expect(page.getByText('No results', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Search businesses')).toBeVisible();
      await axe(page);
      await shot(page, `${vp}-03-zero-results`);
    });

    test('town Directory has never scanned (new town)', async ({ page }) => {
      await page.goto(directory(NEVER_SCANNED));
      await expect(page.getByText('Coverage unknown')).toBeVisible();
      await axe(page);
      await shot(page, `${vp}-04-new-town-unknown`);
    });

    test('blocked town (live)', async ({ page }) => {
      await page.goto(directory(BLOCKED));
      await expect(
        page.getByText('Directory not available', { exact: true })
      ).toBeVisible();
      await axe(page);
      await shot(page, `${vp}-05-blocked-town-ineligible`);
    });

    const stubbed: Array<[string, StubCoverage, string, boolean]> = [
      [
        'acquiring',
        { state: 'acquiring', withheldReviewedDetails: 0 },
        'Gathering listings',
        false,
      ],
      [
        'empty',
        { state: 'empty', withheldReviewedDetails: 0 },
        'No businesses listed',
        false,
      ],
      [
        'partial',
        { state: 'partial', withheldReviewedDetails: 0 },
        'Listings still arriving',
        true,
      ],
      [
        'unconfigured',
        { state: 'unconfigured', withheldReviewedDetails: 0 },
        'Directory not available yet',
        false,
      ],
      [
        'policy-withdrawn',
        {
          state: 'blocked',
          reason: 'policy-withdrawn',
          withheldReviewedDetails: 0,
        },
        'Listings withdrawn',
        false,
      ],
    ];
    for (const [name, coverage, title, keep] of stubbed) {
      test(`${name} state (stubbed coverage)`, async ({ page }) => {
        await stubListings(page, { status: 200, coverage, keepListings: keep });
        await page.goto(directory(POPULATED));
        await expect(page.getByText(title, { exact: true })).toBeVisible();
        await axe(page);
        await shot(page, `${vp}-06-${name}`);
      });
    }

    test('failed infrastructure (stubbed 503)', async ({ page }) => {
      await stubListings(page, { status: 503 });
      await page.goto(directory(POPULATED));
      const alert = page.getByRole('alert');
      await expect(alert).toContainText('temporarily unavailable');
      await expect(alert).not.toContainText(
        /503|gateway|directory-db|stack|ECONN/i
      );
      await expect(
        page.getByRole('button', { name: /try again/i })
      ).toBeVisible();
      await axe(page);
      await shot(page, `${vp}-07-failed-infra`);
    });
  });
}

test.describe('S6 report and receipt (desktop, live)', () => {
  test.use({ viewport: viewports.desktop });

  test('report a listing, get a receipt, check status', async ({ page }) => {
    await page.goto(directory(POPULATED));
    await page.locator('article.card a.card__detail').first().click();
    await page.getByRole('link', { name: /report or correct/i }).click();
    await expect(
      page.getByRole('heading', { name: 'Report or correct this listing' })
    ).toBeVisible();

    // Submitting with no reason shows a focused error summary.
    await page.getByRole('button', { name: /send report|submit/i }).click();
    await expect(page.locator('.report-page__summary')).toBeFocused();
    await shot(page, 'desktop-08-report-validation');

    await page.getByLabel(/details are wrong/i).check();
    await page
      .getByLabel('Details (optional)')
      .fill('S6 evidence run: phone number is out of date.');
    await axe(page);
    await page.getByRole('button', { name: /send report|submit/i }).click();
    const ack = page.locator('#ack-title');
    await expect(ack).toBeFocused();
    const receipt =
      (
        await page.locator('.report-page__receipt code').textContent()
      )?.trim() ?? '';
    expect(receipt).toMatch(/^[A-Za-z0-9_-]{16,}$/);
    await shot(page, 'desktop-09-report-ack');

    await page
      .getByRole('link', { name: /status/i })
      .first()
      .click();
    await expect(page).toHaveURL(/directory\/reports\/status$/);
    const input = page.getByLabel(/receipt code/i);
    if (!(await input.inputValue())) await input.fill(receipt);
    await page.getByRole('button', { name: /check/i }).click();
    await expect(page.getByRole('status')).toContainText('Received');
    await axe(page);
    await shot(page, 'desktop-10-receipt-status');
  });
});
