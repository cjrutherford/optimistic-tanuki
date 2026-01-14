import { test, expect } from '@playwright/test';

test.describe('User Journey', () => {
  const timestamp = Date.now();
  const testUser = {
    email: `fow_testuser_${timestamp}@example.com`,
    password: 'Password123!',
    firstName: 'Test',
    lastName: 'User',
    bio: 'Initial Bio',
    updatedBio: 'Updated Bio',
  };

  test('should register, login, and update profile', async ({ page }) => {
    console.log('Starting User Journey Test for Forge of Will');

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
      'otui-button[type="submit"], otui-button:has-text("adventure")',
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

    // 3. Land on Projects
    console.log('Waiting for redirect to / (Projects)');
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });

    // 4. Update Profile
    console.log('Navigating to /settings');
    await page.goto('/settings');

    console.log('Clicking banner to edit profile');
    await page.waitForSelector('.profile-section', { state: 'visible' });
    await page.click('.profile-section', { force: true });

    console.log('Waiting for edit profile modal content');
    const modalContent = page.locator('otui-modal .modal');
    await expect(modalContent).toBeVisible({ timeout: 10000 });

    console.log('Updating bio');
    await page
      .locator('lib-text-input[formControlName="bio"] input')
      .fill(testUser.updatedBio);

    console.log('Uploading profile picture');
    await page
      .locator('lib-image-upload input[type="file"]')
      .first()
      .setInputFiles('apps/forgeofwill-e2e/src/test-image.png');

    console.log('Submitting profile update');
    await page.click(
      'otui-modal otui-button[variant="success"], otui-modal otui-button:has-text("Submit")',
      { force: true }
    );

    // Verify modal closes
    console.log('Waiting for modal to close');
    await expect(modalContent).not.toBeVisible({ timeout: 10000 });

    // Verify update
    console.log('Verifying update');
    await page.click('.profile-section', { force: true });
    await page.waitForSelector('otui-modal .modal', { state: 'visible' });
    await expect(
      page.locator('lib-text-input[formControlName="bio"] input')
    ).toHaveValue(testUser.updatedBio);
    console.log('User Journey Test Completed Successfully for Forge of Will');
  });
});
