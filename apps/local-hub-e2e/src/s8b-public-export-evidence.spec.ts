import AxeBuilder from '@axe-core/playwright';
import {
  APIRequestContext,
  expect,
  Page,
  request as pwRequest,
  test,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * S8b public export evidence against the live local stack.
 *
 *   cd apps/local-hub-e2e && S8B_EVIDENCE=true E2E_DOCKER=true BASE_URL=http://127.0.0.1:8087 pnpm exec playwright test -c playwright.config.ts src/s8b-public-export-evidence.spec.ts --workers=1
 *
 * Town: S8B_TOWN_ID (a community id) wins; else S8B_TOWN_SLUG (default san-antonio-tx, a Census-staged town whose
 * rows carry source provenance) is resolved through the public community slug route, then the other candidates.
 * The S6 pilot towns (valdosta-ga, alexandria-va) have no provenance, so they answer 404 by design.
 * The policy grants publicExport for the live release; if no candidate town answers 200 the test fails and says so.
 *
 * Budget: production allows 6 requests a minute per caller and validation errors count, so the spec spends about
 * 4 before the UI download (resolve 1, CSV+JSONL 2, unknown town 1). Bad-format and bad-id 400s are covered by the
 * gateway controller spec, not spent here. Rerun after a minute if a 429 appears early.
 *
 * Writes: none that persist. Everything is anonymous GET. The throttle probe is run last and aimed at an unknown
 * town, because it can exhaust the caller's per-minute budget (6 per minute in production). It stops at the first 429
 * and sends at most S8B_THROTTLE_PROBE requests (default 10); if the budget is larger it records that and stops.
 */
const evidenceRun = process.env['S8B_EVIDENCE'] === 'true';
const outDir = join(
  __dirname,
  '../../../docs/plans/town-square-directory/s8-evidence'
);
const BASE = (process.env['BASE_URL'] || 'http://localhost:8087').replace(
  /\/$/,
  ''
);
const PROBE_MAX = Number(process.env['S8B_THROTTLE_PROBE'] || 10);
const SLUGS = [
  process.env['S8B_TOWN_SLUG'] || 'san-antonio-tx',
  'san-antonio-tx',
  'valdosta-ga',
  'alexandria-va',
];
const ROW_CAP = Number(process.env['DIRECTORY_PUBLIC_EXPORT_MAX_ROWS'] || 5000);
const viewports = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

test.skip(!evidenceRun, 'set S8B_EVIDENCE=true to capture S8b evidence');
test.describe.configure({ mode: 'serial' });

let api: APIRequestContext;
let townId = '';
let townSlug = '';
const outcome: Record<string, unknown> = {};
const exportUrl = (id: string, format: string) =>
  `${BASE}/api/directory/towns/${id}/public-export?format=${format}`;

async function shot(page: Page, name: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(0);
  mkdirSync(outDir, { recursive: true });
  const section = page.locator('section[aria-labelledby="download-heading"]');
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({
    path: join(outDir, `${name}.jpg`),
    type: 'jpeg',
    quality: 60,
  });
}

async function resolveTown(): Promise<void> {
  const fixed = process.env['S8B_TOWN_ID'];
  if (fixed) {
    townId = fixed;
    townSlug = process.env['S8B_TOWN_SLUG'] || '';
    return;
  }
  const tried: string[] = [];
  for (const slug of [...new Set(SLUGS)]) {
    const res = await api.get(`${BASE}/api/social/community/slug/${slug}`, {
      failOnStatusCode: false,
    });
    if (res.status() !== 200) {
      tried.push(`${slug}:community ${res.status()}`);
      continue;
    }
    const id = (await res.json())?.id;
    if (typeof id !== 'string') continue;
    const probe = await api.get(exportUrl(id, 'jsonl'), {
      failOnStatusCode: false,
    });
    if (probe.status() === 200) {
      townId = id;
      townSlug = slug;
      return;
    }
    tried.push(`${slug}:export ${probe.status()}`);
  }
  throw new Error(`no town with a public export found (${tried.join(', ')})`);
}

test.beforeAll(async () => {
  api = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  await resolveTown();
  outcome['town'] = { id: townId, slug: townSlug };
});
test.afterAll(async () => {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 's8b-live-outcome.json'),
    JSON.stringify(outcome, null, 2) + '\n'
  );
  await api?.dispose();
});

test.describe('S8b public export (live)', () => {
  test('1. anonymous CSV and JSONL: headers, attribution, no identifiers', async () => {
    const csv = await api.get(exportUrl(townId, 'csv'));
    expect(csv.status()).toBe(200);
    expect(csv.headers()['cache-control']).toContain('no-store');
    expect(csv.headers()['content-disposition']).toMatch(
      /^attachment; filename="?town-square-listings-\d{4}-\d{2}-\d{2}\.csv"?/
    );
    expect(csv.headers()['content-type']).toContain('text/csv');
    const csvText = await csv.text();
    const csvLines = csvText.split(/\r?\n/).filter(Boolean);
    const comments = csvLines.filter((l) => l.startsWith('# '));
    expect(csvText).toContain('town-square-public-export/v1');
    expect(comments.join('\n')).toContain('CC0-1.0');
    expect(comments.join('\n')).toContain('CDLA-Permissive-2.0');
    expect(comments.some((l) => l.startsWith('# Attribution:'))).toBe(true);
    expect(csvText).not.toContain('@');
    expect(csvText).not.toMatch(/geoapify/i);
    const header = csvLines[comments.length];
    expect(header).not.toMatch(/\b(id|scanId|email|reference)\b/i);
    const csvRows = csvLines.length - comments.length - 1;
    expect(csvRows).toBeGreaterThan(0);
    expect(csvRows).toBeLessThanOrEqual(ROW_CAP);

    const jsonl = await api.get(exportUrl(townId, 'jsonl'));
    expect(jsonl.status()).toBe(200);
    expect(jsonl.headers()['cache-control']).toContain('no-store');
    expect(jsonl.headers()['content-disposition']).toMatch(/^attachment/);
    expect(jsonl.headers()['x-content-type-options']).toBe('nosniff');
    const text = await jsonl.text();
    const lines = text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines[0].type).toBe('header');
    expect(lines[0].schema).toBe('town-square-public-export/v1');
    const licences = (lines[0].sources as Array<{ license: string }>).map(
      (s) => s.license
    );
    expect(licences).toEqual(
      expect.arrayContaining(['CC0-1.0', 'CDLA-Permissive-2.0'])
    );
    expect(lines[0].attributions.length).toBeGreaterThan(0);
    const rows = lines.filter((l) => l.type === 'row');
    const trailer = lines[lines.length - 1];
    expect(trailer.type).toBe('trailer');
    expect(trailer.rowCount).toBe(rows.length);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(ROW_CAP);
    expect(Number(jsonl.headers()['x-row-count'])).toBe(rows.length);
    const allowed = new Set([
      'type',
      'name',
      'category',
      'location',
      'address',
      'phone',
      'website',
    ]);
    const stray = new Set<string>();
    for (const r of rows)
      for (const k of Object.keys(r)) if (!allowed.has(k)) stray.add(k);
    expect([...stray], 'row keys outside the public allowlist').toEqual([]);
    expect(text).not.toContain('@');
    expect(text).not.toMatch(/geoapify/i);
    outcome['anonymousDownloads'] = {
      csv: { status: 200, rows: csvRows, commentLines: comments.length },
      jsonl: {
        status: 200,
        rows: rows.length,
        truncated: trailer.truncated,
        fields: lines[0].fields,
        licences,
      },
      rowCapChecked: ROW_CAP,
    };
  });

  test('2. unknown town is refused', async () => {
    const unknown = await api.get(exportUrl(randomUUID(), 'csv'), {
      failOnStatusCode: false,
    });
    expect(unknown.status()).toBe(404);
    outcome['refusals'] = { unknownTown: unknown.status() };
  });

  for (const [label, size] of Object.entries(viewports)) {
    test(`3. Local Hub page, ${label}: section, axe, CSV download`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: size,
        acceptDownloads: true,
      });
      const page = await context.newPage();
      const slug = townSlug || 'valdosta-ga';
      await page.goto(`${BASE}/city/${slug}/businesses`);
      const section = page.locator(
        'section[aria-labelledby="download-heading"]'
      );
      await expect(
        section.getByRole('heading', { name: 'Download listings' })
      ).toBeVisible({ timeout: 30_000 });
      const csvButton = section.getByRole('button', {
        name: 'Download listings as CSV',
      });
      const jsonButton = section.getByRole('button', {
        name: 'Download listings as JSON Lines',
      });
      await expect(csvButton).toBeVisible();
      await expect(jsonButton).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .include('section[aria-labelledby="download-heading"]')
        .analyze();
      expect(
        results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(' ')}`)),
        'serious/critical axe violations'
      ).toEqual([]);
      await shot(page, `s8b-01-download-section-${label}`);
      if (label === 'desktop') {
        const [download] = await Promise.all([
          page.waitForEvent('download'),
          csvButton.click(),
        ]);
        const name = download.suggestedFilename();
        expect(name).toMatch(/^town-square-listings-\d{4}-\d{2}-\d{2}\.csv$/);
        const path = await download.path();
        const { statSync } = await import('node:fs');
        const size = statSync(path).size;
        expect(size).toBeGreaterThan(200);
        outcome['uiDownload'] = { filename: name, bytes: size };
      }
      await context.close();
    });
  }

  test('4. throttle: record the budget, stop at the first 429', async () => {
    // Last on purpose: a 429 here blocks this caller's downloads for the rest of the minute.
    // Aimed at an unknown town so each probe costs the Directory one cheap lookup.
    const statuses: number[] = [];
    let retryAfter: string | null = null;
    for (let i = 0; i < PROBE_MAX; i++) {
      const res = await api.get(exportUrl(randomUUID(), 'csv'), {
        failOnStatusCode: false,
      });
      statuses.push(res.status());
      if (res.status() === 429) {
        retryAfter = res.headers()['retry-after'] ?? null;
        break;
      }
      expect(res.status()).toBe(404);
    }
    const first429 = statuses.indexOf(429);
    outcome['throttle'] = {
      probes: statuses.length,
      statuses,
      first429At: first429 === -1 ? null : first429 + 1,
      retryAfter,
      note:
        first429 === -1
          ? `no 429 within ${PROBE_MAX} requests: the configured limit (THROTTLE_DIRECTORY_PUBLIC_EXPORT_LIMIT) is larger; not hammered`
          : 'limit reached; budget resets after the 60s window',
    };
    // Either outcome is recorded honestly; a non-404/429 status is a real failure.
    expect(statuses.every((s) => s === 404 || s === 429)).toBe(true);
  });
});
