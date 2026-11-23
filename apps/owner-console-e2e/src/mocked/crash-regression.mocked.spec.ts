import { expect, Page, test } from '@playwright/test';
import {
  ALWAYS_ALLOWED,
  MOCKED_503_ALLOWED,
  NAV_TARGETS,
  openLeaf,
  selectTown,
  signInAsOwner,
  watchProblems,
} from '../support/nav';
import { ApiMockOptions, installApiMocks, MOCK_TOWN } from './fixtures';

/**
 * Regressions for crashes the first mocked run found: an Angular
 * `ERROR TypeError: Cannot read properties of ... (reading 'length')` thrown
 * while rendering. Angular logs it through console.error, so it is read from
 * the console, with only the stub's own 503 lines allowed.
 */
const target = (path: string) => {
  const found = NAV_TARGETS.find((t) => t.leaf.path === path);
  if (!found) throw new Error(`${path} is not in OWNER_NAV`);
  return found;
};

async function visit(
  page: Page,
  path: string,
  options: ApiMockOptions
): Promise<string[]> {
  await installApiMocks(page, options);
  await signInAsOwner(page, 'owner@example.test', 'irrelevant');
  // With no towns loaded there is nothing to pick.
  if (options.communities !== null) await selectTown(page, MOCK_TOWN.id);
  const problems = watchProblems(page, [
    ...ALWAYS_ALLOWED,
    ...MOCKED_503_ALLOWED,
  ]);
  await openLeaf(page, target(path), MOCK_TOWN.id);
  await page.waitForTimeout(800);
  return [...problems.pageErrors, ...problems.consoleErrors];
}

test.describe('crash regressions (mocked API)', () => {
  for (const path of ['/dashboard/communities', '/dashboard/cities']) {
    test(`${path}: a record with no description renders`, async ({ page }) => {
      const errors = await visit(page, path, {
        communities: [{ ...MOCK_TOWN, description: null }],
      });
      expect(errors).toEqual([]);
      await expect(
        page.getByRole('heading', { level: 1 }).last()
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 2, name: MOCK_TOWN.name })
      ).toBeVisible();
    });

    test(`${path}: a failed load shows Unavailable with Retry`, async ({
      page,
    }) => {
      const errors = await visit(page, path, { communities: null });
      expect(errors).toEqual([]);
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
      const errors = await visit(page, path, { operations: emptyBodies });
      expect(errors).toEqual([]);
    });

    test(`${path}: a failed load throws nothing`, async ({ page }) => {
      const errors = await visit(page, path, {});
      expect(errors).toEqual([]);
    });
  }
});
