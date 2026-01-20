import { test, expect } from '@playwright/test';

const OWNER_CONSOLE_URL = 'http://localhost:8084';
const CONFIGURABLE_CLIENT_URL = 'http://localhost:8090';

test.describe('App Configuration Flow', () => {
  const timestamp = Date.now();
  const testUser = {
    email: `app_config_admin_${timestamp}@example.com`,
    password: 'Password123!',
    firstName: 'AppConfig',
    lastName: 'Admin',
  };
  
  const appConfig = {
    name: `E2E Test App ${timestamp}`,
    description: 'Created via E2E Test',
    domain: `e2e-test-app-${timestamp}`,
  };

  test('should create app config in owner-console and render in configurable-client', async ({ page }) => {
    test.setTimeout(120000);

    // 1. Register/Login to Owner Console
    console.log('Step 1: Register via Owner Console');
    await page.goto(`${OWNER_CONSOLE_URL}/register`);
    
    await page.locator('lib-text-input[formControlName="firstName"] input').fill(testUser.firstName);
    await page.locator('lib-text-input[formControlName="lastName"] input').fill(testUser.lastName);
    await page.locator('lib-text-input[formControlName="email"] input').fill(testUser.email);
    await page.locator('lib-text-input[formControlName="password"] input').fill(testUser.password);
    await page.locator('lib-text-input[formControlName="confirmation"] input').fill(testUser.password);
    
    await page.click('otui-button[type="submit"] button');
    
    // Wait for either dashboard or login
    await page.waitForURL(/.*(dashboard|login)/, { timeout: 30000 });
    
    if (page.url().includes('login')) {
      console.log('Redirected to login page, performing login...');
      await page
        .locator('lib-text-input[formControlName="email"] input')
        .fill(testUser.email);
      await page
        .locator('lib-text-input[formControlName="password"] input')
        .fill(testUser.password);
      await page.click(
        'otui-button[type="submit"] button, button:has-text("Login")',
        { force: true }
      );
      await page.waitForURL(/.*dashboard/, { timeout: 15000 });
    }

    // 2. Navigate to App Config Designer
    console.log('Step 2: Navigate to App Config Designer');
    // Using direct navigation to be more resilient to UI changes/sidebar issues
    await page.goto(`${OWNER_CONSOLE_URL}/dashboard/app-config`);
    await page.waitForURL(/.*app-config/);
    
    await page.click('otui-button:has-text("Create New Configuration")');
    await page.waitForURL(/.*designer/);
    
    // Fill General Info
    console.log('Filling General Info');
    
    // Wait for the form to appear
    await page.waitForSelector('lib-text-input input', { timeout: 60000 });
    
    // Use first input if ID selector fails, or ensure ID is correct
    // Trying generic first input in the form
    await page.locator('lib-text-input input').first().fill(appConfig.name);
    
    await page.locator('lib-text-area textarea').first().fill(appConfig.description);
    // Domain is likely the second text input
    await page.locator('lib-text-input input').nth(1).fill(appConfig.domain);
    
    // Add a Hero Section
    console.log('Adding Hero Section');
    await page.click('otui-button:has-text("Add Section")');
    await page.click('.section-type-item:has-text("Hero Section")');
    
    // Edit the Hero Section
    console.log('Editing Hero Section');
    await page.locator('.section-item:has-text("Hero Section") .icon-btn[title="Edit"]').click();
    
    const uniqueTitle = `E2E Hero ${timestamp}`;
    await page.locator('#heroTitle input').fill(uniqueTitle);
    await page.click('otui-button:has-text("Save Section")');
    
    // Enable a feature (Social)
    console.log('Enabling Social Feature');
    await page.click('.mat-mdc-tab:has-text("Features")');
    // Using nth(0) because Social is the first feature card
    await page.locator('.feature-card:has-text("Social") lib-checkbox input').check();
    
    // Save Configuration
    console.log('Saving Configuration');
    const saveResponsePromise = page.waitForResponse(response => 
      response.url().includes('/api/app-config') && 
      (response.status() === 201 || response.status() === 200) &&
      (response.request().method() === 'POST' || response.request().method() === 'PUT')
    );
    
    await page.click('otui-button:has-text("Save Configuration")');
    await saveResponsePromise;
    console.log('Configuration Saved');

    // 3. Verify in Configurable Client
    console.log('Step 3: Verify in Configurable Client');
    const encodedAppName = encodeURIComponent(appConfig.name);
    // Use the ?appName= query param we added support for
    const clientUrl = `${CONFIGURABLE_CLIENT_URL}/?appName=${encodedAppName}`;
    console.log(`Navigating to ${clientUrl}`);
    
    await page.goto(clientUrl);
    
    // Verify the unique title is rendered in the app
    // The Hero section renders the title in an h1
    await expect(page.locator('h1')).toContainText(uniqueTitle);
    
    console.log('E2E Test Completed Successfully');
  });
});
