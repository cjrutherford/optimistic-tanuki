import {
  NAV_TARGETS,
  openLeaf,
  expectPageHeader,
  selectTown,
  signInAsOwner,
} from '../support/nav';
import { expect, installApiMocks, MOCK_TOWN, test } from './fixtures';

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

  // The console guard fails this test on any console error or unstubbed API
  // call from any page in the tree, so a page cannot log one unnoticed.
  test('every OWNER_NAV page renders a header and logs no console error', async ({
    page,
  }) => {
    test.setTimeout(5 * 60_000);
    await installApiMocks(page);
    await signInAsOwner(page, 'owner@example.test', 'irrelevant');
    await selectTown(page, MOCK_TOWN.id);

    for (const target of NAV_TARGETS) {
      await test.step(target.leaf.label, async () => {
        const path = await openLeaf(page, target, MOCK_TOWN.id);
        await expectPageHeader(page, path);
        // Let the page's own loads settle so an error from one lands in this
        // run rather than the next page's.
        await page.waitForTimeout(500);
      });
    }
  });
});
