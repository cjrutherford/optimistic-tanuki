import { expect, test } from '@playwright/test';
import {
  ALWAYS_ALLOWED,
  CONSOLE_CLEAN_PAGES,
  MOCKED_503_ALLOWED,
  NAV_TARGETS,
  openLeaf,
  expectPageHeader,
  selectTown,
  signInAsOwner,
  watchProblems,
} from '../support/nav';
import { installApiMocks, MOCK_TOWN } from './fixtures';

test.describe('Owner console navigation smoke (mocked API)', () => {
  test('the app bar carries the town switcher and Sign out', async ({
    page,
  }) => {
    await installApiMocks(page);
    await signInAsOwner(page, 'owner@example.test', 'irrelevant');

    const town = page.locator('select[aria-label="Town"]');
    await expect(town).toBeVisible();
    await selectTown(page, MOCK_TOWN.id);
    await expect(town).toHaveValue(MOCK_TOWN.id);
    await expect(page.getByText('Sign out')).toBeVisible();
  });

  test('every OWNER_NAV page renders a header without page errors', async ({
    page,
  }) => {
    test.setTimeout(5 * 60_000);
    await installApiMocks(page);
    await signInAsOwner(page, 'owner@example.test', 'irrelevant');
    await selectTown(page, MOCK_TOWN.id);
    const problems = watchProblems(page, [
      ...ALWAYS_ALLOWED,
      ...MOCKED_503_ALLOWED,
    ]);
    const townId = MOCK_TOWN.id;

    for (const target of NAV_TARGETS) {
      await test.step(target.leaf.label, async () => {
        const before = problems.consoleErrors.length;
        const path = await openLeaf(page, target, townId);
        await expectPageHeader(page, path);
        // Let the page's own loads settle so a crash on a failed one lands here.
        await page.waitForTimeout(500);
        if (CONSOLE_CLEAN_PAGES.some((clean) => clean.test(path))) {
          expect
            .soft(
              problems.consoleErrors.slice(before),
              `${path} logged console errors`
            )
            .toEqual([]);
        }
      });
    }

    expect(problems.pageErrors, 'uncaught page errors').toEqual([]);
  });
});
