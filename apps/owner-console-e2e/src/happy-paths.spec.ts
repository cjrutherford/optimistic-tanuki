import { expect, Page, test } from '@playwright/test';
import {
  NAV_TARGETS,
  NavTarget,
  openLeaf,
  firstTownId,
  selectTown,
  signInAsOwner,
} from './support/nav';

/**
 * One happy path per section, each through the confirmation step the page
 * asks for. They need the stack's owner (OWNER_EMAIL / OWNER_PASSWORD) and
 * data the seed may not hold; where the data is missing the test skips and
 * says which row it needed.
 */
const email = process.env['OWNER_EMAIL'];
const password = process.env['OWNER_PASSWORD'];

const targetFor = (path: string): NavTarget => {
  const found = NAV_TARGETS.find((t) => t.leaf.path === path);
  if (!found) throw new Error(`${path} is not in OWNER_NAV`);
  return found;
};

async function start(page: Page, path: string): Promise<void> {
  const townId = await firstTownId(page, email as string, password as string);
  await signInAsOwner(page, email as string, password as string);
  if (townId) await selectTown(page, townId);
  const target = targetFor(path);
  if (target.leaf.needsTown && !townId) {
    test.skip(true, 'the seed has no towns');
  }
  await openLeaf(page, target, townId);
}

test.describe('Owner console happy paths (full stack)', () => {
  test.skip(
    !email || !password,
    'OWNER_EMAIL and OWNER_PASSWORD are not set: the stack has no provisioned owner account'
  );

  test('People & access: assign a role (reason dialog)', async ({ page }) => {
    await start(page, '/dashboard/users');
    const manage = page.getByRole('button', { name: /roles|manage/i }).first();
    test.skip(
      !(await manage.isVisible({ timeout: 10_000 }).catch(() => false)),
      'the seed has no profile to assign a role to'
    );
    await manage.click();
    const assign = page.getByRole('button', { name: 'Assign', exact: true });
    test.skip(
      !(await assign
        .first()
        .isVisible()
        .catch(() => false)),
      'the seed has no assignable role'
    );
    await assign.first().click();
    const dialog = page
      .getByRole('dialog')
      .filter({ hasText: /Assign/ })
      .last();
    await dialog.getByRole('textbox').fill('Playwright happy path');
    await dialog.getByRole('button', { name: 'Assign role' }).click();
    await expect(page.getByText(/Assigned .* to /)).toBeVisible();
  });

  test('Towns: resolve an address review (attested approve)', async ({
    page,
  }) => {
    await start(page, '/dashboard/towns/:townId/directory-address-review');
    const approve = page.getByRole('button', { name: 'Approve' }).first();
    test.skip(
      !(await approve.isVisible({ timeout: 10_000 }).catch(() => false)),
      'the seed has no pending address-review candidate'
    );
    const card = page.locator('.candidate-review').first();
    await card.getByLabel('Evidence URL').fill('https://example.test/evidence');
    await card.getByLabel(/I compared the source record/).check();
    await card.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('Directory: cancel a run (reason and typed CANCEL)', async ({
    page,
  }) => {
    await start(page, '/dashboard/directory-runs');
    const open = page.getByRole('button', { name: 'Open' }).first();
    test.skip(
      !(await open.isVisible({ timeout: 10_000 }).catch(() => false)),
      'the seed has no acquisition run'
    );
    await open.click();
    const cancel = page.getByRole('button', { name: 'Cancel run' });
    test.skip(
      (await cancel.count()) === 0,
      'the seed has no queued or running acquisition run to cancel'
    );
    await page.getByLabel(/Reason \(required\)/).fill('Playwright happy path');
    await page.getByLabel(/Type CANCEL, RESUME or RETRY/).fill('CANCEL');
    await cancel.click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('Moderation queue: decline a report (reason dialog)', async ({
    page,
  }) => {
    await start(page, '/dashboard/moderation');
    const decline = page.getByRole('button', { name: 'Decline' }).first();
    test.skip(
      !(await decline.isVisible({ timeout: 10_000 }).catch(() => false)),
      'the seed has no open report to moderate'
    );
    await decline.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill('Playwright happy path');
    await dialog.getByRole('button', { name: 'Decline', exact: true }).click();
    await expect(page.getByText('Done.')).toBeVisible();
  });
});
