import { test, expect } from '@playwright/test';
import {
  openProfileEditorFromSettings,
  registerAndCreateProfile,
  submitProfileEditor,
} from '../../e2e/support/workspace-ui';

test.describe('User Journey', () => {
  test('registers, creates a profile, and updates it through the profile editor', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const email = `testuser_${timestamp}@example.com`;

    await registerAndCreateProfile(page, {
      email,
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      profileName: `Test User ${timestamp}`,
      bio: 'Initial Bio',
    });

    const dialog = await openProfileEditorFromSettings(page);
    const bio = dialog.locator('lib-text-area[formControlName="bio"] textarea');
    await bio.fill('Updated Bio');
    const profileResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/profile/') &&
        response.request().method() === 'PUT'
    );
    await submitProfileEditor(page);
    const response = await profileResponse;
    expect(
      response.ok(),
      `profile update failed: ${response.status()} ${response.url()}`
    ).toBeTruthy();
    await expect(dialog).not.toBeVisible();

    const reopened = await openProfileEditorFromSettings(page);
    await expect(
      reopened.locator('lib-text-area[formControlName="bio"] textarea')
    ).toHaveValue('Updated Bio');
  });
});
