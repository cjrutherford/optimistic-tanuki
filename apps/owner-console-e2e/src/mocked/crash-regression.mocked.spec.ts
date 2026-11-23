import { Page } from '@playwright/test';
import {
  NAV_TARGETS,
  openLeaf,
  selectTown,
  signInAsOwner,
} from '../support/nav';
import {
  ApiMockOptions,
  expect,
  installApiMocks,
  MOCK_TOWN,
  test,
} from './fixtures';

/**
 * Regressions for crashes the first mocked run found: an Angular
 * `ERROR TypeError: Cannot read properties of ... (reading 'length')` thrown
 * while rendering. Angular logs it through console.error, which the console
 * guard fails the test on; a test that fails a load on purpose allows only
 * the browser's own 503 line for it.
 */
const STUB_503 = /Failed to load resource.*status of 503/;
const target = (path: string) => {
  const found = NAV_TARGETS.find((t) => t.leaf.path === path);
  if (!found) throw new Error(`${path} is not in OWNER_NAV`);
  return found;
};

async function visit(
  page: Page,
  path: string,
  options: ApiMockOptions
): Promise<void> {
  await installApiMocks(page, options);
  await signInAsOwner(page, 'owner@example.test', 'irrelevant');
  // With no towns loaded there is nothing to pick.
  if (options.communities !== null) await selectTown(page, MOCK_TOWN.id);
  await openLeaf(page, target(path), MOCK_TOWN.id);
  await page.waitForTimeout(800);
}

test.describe('crash regressions (mocked API)', () => {
  for (const path of ['/dashboard/communities', '/dashboard/cities']) {
    test(`${path}: a record with no description renders`, async ({ page }) => {
      await visit(page, path, {
        communities: [{ ...MOCK_TOWN, description: null }],
      });
      await expect(
        page.getByRole('heading', { level: 1 }).last()
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 2, name: MOCK_TOWN.name })
      ).toBeVisible();
    });

    test(`${path}: a failed load shows Unavailable with Retry`, async ({
      page,
      consoleGuard,
    }) => {
      consoleGuard.allow(STUB_503);
      await visit(page, path, { communities: null });
      const alert = page.getByRole('alert').filter({ hasText: /Unavailable/ });
      await expect(alert).toBeVisible();
      await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
    });
  }

  const emptyBodies = {
    'pipeline-health': {},
    'official-candidates': {},
    density: {},
    'takedown-notices': {},
    backfill: {},
  };
  for (const path of [
    '/dashboard/daylight',
    `/dashboard/towns/:townId/daylight`,
  ]) {
    test(`${path}: unusable replies do not throw`, async ({ page }) => {
      await visit(page, path, { operations: emptyBodies });
    });

    test(`${path}: a failed load throws nothing`, async ({
      page,
      consoleGuard,
    }) => {
      consoleGuard.allow(STUB_503);
      await visit(page, path, { operations: null });
    });
  }
});
