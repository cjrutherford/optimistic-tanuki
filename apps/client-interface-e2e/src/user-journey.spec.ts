import { test, expect } from '@playwright/test';
import {
  openProfileEditorFromSettings,
  submitProfileEditor,
} from '../../e2e/support/workspace-ui';

test.describe('User Journey', () => {
  const timestamp = Date.now();
  const testUser = {
    email: `testuser_${timestamp}@example.com`,
    password: 'Password123!',
    firstName: 'Test',
    lastName: 'User',
    bio: 'Initial Bio',
    updatedBio: 'Updated Bio',
  };

  test('should register, login, and update profile', async ({ page }) => {
    console.log('Starting User Journey Test');

    page.on('console', (msg) => {
      console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
    });

    page.on('pageerror', (error) => {
      console.log(`BROWSER ERROR: ${error.message}`);
    });

    // 1. Register
    console.log('Navigating to /register');
    await page.goto('/register');
    await expect(page).toHaveURL(/\/register/);

    console.log('Filling registration form');
    await page
      .locator('lib-text-input[formControlName="firstName"] input')
      .fill(testUser.firstName);
    await page
      .locator('lib-text-input[formControlName="lastName"] input')
      .fill(testUser.lastName);
    await page
      .locator('lib-text-input[formControlName="email"] input')
      .fill(testUser.email);
    await page
      .locator('lib-text-input[formControlName="password"] input')
      .fill(testUser.password);
    await page
      .locator('lib-text-input[formControlName="confirmation"] input')
      .fill(testUser.password);

    console.log('Submitting registration');
    await page.click(
      'otui-button[type="submit"], otui-button:has-text("Register")',
      { force: true }
    );

    // Expect redirect to login
    console.log('Waiting for redirect to /login');
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

    // 2. Login
    console.log('Filling login form');
    await page
      .locator('lib-text-input[formControlName="email"] input')
      .fill(testUser.email);
    await page
      .locator('lib-text-input[formControlName="password"] input')
      .fill(testUser.password);

    console.log('Submitting login');
    await page.click(
      'otui-button[type="submit"], otui-button:has-text("Login")',
      { force: true }
    );

    // 3. Land on Feed
    console.log('Waiting for auth flow to leave /login');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), {
      timeout: 15000,
    });

    // 4. Update Profile
    console.log('Opening profile editor from /settings');
    const modalContent = await openProfileEditorFromSettings(page);

    console.log('Updating bio');
    await page
      .locator('lib-text-input[formControlName="profileName"] input')
      .fill(`Test User ${timestamp}`);
    await page
      .locator('lib-text-input[formControlName="bio"] input')
      .fill(testUser.updatedBio);

    console.log('Submitting profile update');
    await submitProfileEditor(page);

    // In SettingsComponent, it doesn't redirect to /feed, it just closes modal.
    console.log('Waiting for modal to close');
    await expect(modalContent).not.toBeVisible({ timeout: 10000 });

    // Verify update
    console.log('Verifying update in settings');
    const reopenedModal = await openProfileEditorFromSettings(page);
    await expect(
      page.locator('lib-text-input[formControlName="bio"] input')
    ).toHaveValue(testUser.updatedBio);
    await expect(reopenedModal).toBeVisible();
    console.log('User Journey Test Completed Successfully');
  });
});
