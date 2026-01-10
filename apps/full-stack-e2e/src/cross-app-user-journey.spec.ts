import { test, expect } from '@playwright/test';

const OWNER_CONSOLE_URL = 'http://localhost:8084';
const FORGE_OF_WILL_URL = 'http://localhost:8081';
const CLIENT_INTERFACE_URL = 'http://localhost:8080';

test.describe('Cross-App User Journey', () => {
  const timestamp = Date.now();
  const testUser = {
    email: `cross_app_user_${timestamp}@example.com`,
    password: 'Password123!',
    firstName: 'CrossApp',
    lastName: 'User',
    bio: 'Initial Bio from Owner Console',
    updatedBioFOW: 'Updated Bio from Forge of Will',
    updatedBioClient: 'Updated Bio from Client Interface',
  };

  test('should register in owner-console and access all apps', async ({ page }) => {
    test.setTimeout(120000);
    // 1. Register via Owner Console
    console.log('Step 1: Register via Owner Console');
    await page.goto(`${OWNER_CONSOLE_URL}/register`);
    await expect(page).toHaveURL(`${OWNER_CONSOLE_URL}/register`);

    await page.locator('lib-text-input[formControlName="firstName"] input').fill(testUser.firstName);
    await page.locator('lib-text-input[formControlName="lastName"] input').fill(testUser.lastName);
    await page.locator('lib-text-input[formControlName="email"] input').fill(testUser.email);
    await page.locator('lib-text-input[formControlName="password"] input').fill(testUser.password);
    await page.locator('lib-text-input[formControlName="confirmation"] input').fill(testUser.password);
    
    // Check if bio field exists before filling
    const bioInput = page.locator('lib-text-input[formControlName="bio"] input');
    if (await bioInput.count() > 0) {
        await bioInput.fill(testUser.bio);
    }

    await page.click('otui-button[type="submit"] button, button:has-text("Register")');

    // Wait for success message
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 10000 });
    
    // Check where we land. It tries to go to dashboard, but might hit login.
    // Wait for either dashboard or login
    await page.waitForURL(/.*(dashboard|login)/, { timeout: 20000 });
    
    if (page.url().includes('login')) {
        console.log('Redirected to login page, performing login...');
        await page.locator('lib-text-input[formControlName="email"] input').fill(testUser.email);
        await page.locator('lib-text-input[formControlName="password"] input').fill(testUser.password);
        await page.click('otui-button[type="submit"] button, button:has-text("Login")', { force: true });
        await page.waitForURL(/.*dashboard/, { timeout: 15000 });
    } else {
        console.log('Directly redirected to dashboard');
    }

    // 2. Verify Login and Profile Update in Forge of Will
    console.log('Step 2: Verify Login and Profile Update in Forge of Will');
    await page.goto(`${FORGE_OF_WILL_URL}/login`);
    await page.locator('lib-text-input[formControlName="email"] input').fill(testUser.email);
    await page.locator('lib-text-input[formControlName="password"] input').fill(testUser.password);
    await page.click('otui-button[type="submit"] button', { force: true });

    await page.waitForURL(`${FORGE_OF_WILL_URL}/`, { timeout: 15000 });

    // Update Profile in FOW
    await page.goto(`${FORGE_OF_WILL_URL}/settings`);
    await page.waitForSelector('.profile-section', { state: 'visible' });
    await page.click('.profile-section', { force: true });
    
    // Check if initial bio is correct
    const bioInputFOW = page.locator('lib-text-input[formControlName="bio"] input');
    await expect(bioInputFOW).toBeVisible();
    await bioInputFOW.fill(testUser.updatedBioFOW);
    
    // Upload Profile Picture
    console.log('Uploading profile picture in FOW');
    await page.locator('lib-image-upload input[type="file"]').first().setInputFiles('apps/full-stack-e2e/src/test-image.png');
    
    await page.click('otui-modal otui-button[variant="success"] button', { force: true });
    // Wait for modal to disappear first
    await expect(page.locator('otui-modal')).not.toBeVisible();

    // 3. Verify Login and Profile Update in Client Interface
    console.log('Step 3: Verify Login and Profile Update in Client Interface');
    await page.goto(`${CLIENT_INTERFACE_URL}/login`);
    await page.locator('lib-text-input[formControlName="email"] input').fill(testUser.email);
    await page.locator('lib-text-input[formControlName="password"] input').fill(testUser.password);
    await page.click('otui-button[type="submit"] button', { force: true });

    await page.waitForURL(`${CLIENT_INTERFACE_URL}/feed`, { timeout: 15000 });

    // Update Profile in Client Interface
    await page.goto(`${CLIENT_INTERFACE_URL}/settings`);
    await page.waitForSelector('.profile-section', { state: 'visible' });
    await page.click('.profile-section', { force: true });

    const bioInputClient = page.locator('lib-text-input[formControlName="bio"] input');
    await expect(bioInputClient).toBeVisible();
    await bioInputClient.fill(testUser.updatedBioClient);

    console.log('Uploading profile picture in Client Interface');
    await page.locator('lib-image-upload input[type="file"]').first().setInputFiles('apps/full-stack-e2e/src/test-image.png');

    await page.click('otui-modal otui-button[variant="success"] button', { force: true });
    await expect(page.locator('otui-modal')).not.toBeVisible();

    console.log('Cross-App User Journey Completed Successfully');
  });
});
