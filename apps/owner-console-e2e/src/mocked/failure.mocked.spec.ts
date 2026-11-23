import { expect, test } from '@playwright/test';
import { signInAsOwner } from '../support/nav';
import { installApiMocks } from './fixtures';

test('a failed attention source shows Unavailable with Retry, not zero', async ({
  page,
}) => {
  await installApiMocks(page, { attention: null });
  await signInAsOwner(page, 'owner@example.test', 'irrelevant');
  await expect(page).toHaveURL(/\/dashboard\/home/);

  const alert = page
    .getByRole('alert')
    .filter({ hasText: /Unavailable.*attention list could not be loaded/ });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Needs your attention' })
  ).toBeVisible();
  await expect(page.getByText(/^\s*0 waiting\s*$/)).toHaveCount(0);
});
