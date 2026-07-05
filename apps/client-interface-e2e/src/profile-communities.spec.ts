import { expect, test } from '@playwright/test';
import { registerAndCreateProfile } from '../../e2e/support/workspace-ui';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

test.describe('Profile and communities coverage', () => {
  test.setTimeout(180000);

  test('renders dedicated profile and communities sections across key viewports', async ({
    page,
  }) => {
    const timestamp = Date.now();

    await registerAndCreateProfile(page, {
      firstName: 'Profile',
      lastName: 'Coverage',
      email: `profile-coverage-${timestamp}@example.test`,
      password: 'Password123!',
      profileName: `Profile Coverage ${timestamp}`,
      bio: 'Responsive coverage profile',
    });

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await page.goto('/profile');
      await page.waitForLoadState('networkidle');
      await expect(
        page.locator('[data-testid="profile-identity-section"]')
      ).toBeVisible();
      await expect(page.getByText('Profile completion')).toBeVisible();
      await expect(
        page.locator('[data-testid="profile-recent-activity-section"]')
      ).toBeVisible();

      const profileOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth;
      });
      expect(profileOverflow).toBe(false);

      await page.goto('/communities');
      await page.waitForLoadState('networkidle');
      await expect(
        page.locator('[data-testid="communities-social-proof"]')
      ).toBeVisible();
      await expect(
        page.getByText(
          'Find the places already attracting people and activity.'
        )
      ).toBeVisible();

      const communitiesOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth;
      });
      expect(communitiesOverflow).toBe(false);
    }
  });
});
