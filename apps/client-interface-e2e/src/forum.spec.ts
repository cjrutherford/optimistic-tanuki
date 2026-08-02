import { expect, test } from '@playwright/test';
import { registerAndCreateProfile } from '../../e2e/support/workspace-ui';

test.describe('Forum access', () => {
  test('redirects an anonymous visitor to login', async ({ page }) => {
    await page.goto('/forum');
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });

  test('renders the forum shell for an authenticated profile', async ({
    page,
  }) => {
    const timestamp = Date.now();
    await registerAndCreateProfile(page, {
      firstName: 'Forum',
      lastName: 'Member',
      email: `forum-member-${timestamp}@example.test`,
      password: 'Password123!',
      profileName: `Forum Member ${timestamp}`,
      bio: 'Forum test profile',
    });

    const topicsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/forum/topics') &&
        response.request().method() === 'GET'
    );
    await page.goto('/forum');
    const topicsResponse = await topicsResponsePromise;
    const headers = topicsResponse.request().headers();
    expect(
      topicsResponse.ok(),
      `forum topics request failed: ${topicsResponse.status()} ${topicsResponse.url()}`
    ).toBeTruthy();
    expect(headers.authorization).toMatch(/^Bearer\s+\S+$/);
    expect(headers['x-ot-appscope']).toBe('forum');
    await expect(page).toHaveURL(/\/forum/);
    await expect(page.locator('.forum-shell')).toBeVisible();
    await expect(page.getByText('Forum Topics')).toBeVisible();
  });
});
