import { test, expect } from '@playwright/test';

test.describe('Blog Component Injection', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the blog page
    await page.goto('/blog');
    
    // Check if we need to login (if "New Post" button is not visible)
    const newPostBtn = page.getByRole('button', { name: 'New Post' });
    if (!(await newPostBtn.isVisible())) {
        await page.goto('/login');
        await page.getByLabel('Email').fill('test@example.com');
        await page.getByLabel('Password').fill('password123');
        await page.getByRole('button', { name: 'Sign In' }).click();
        await expect(page.url()).toContain('/blog');
    }
  });

  test('should inject and edit a callout box component', async ({ page }) => {
    // Start creating a new post
    await page.getByRole('button', { name: 'New Post' }).click();
    
    // Fill in title
    await page.getByLabel('Title').fill('Component Test Post');
    
    // Open component selector
    await page.locator('.toolbar-btn.component-btn').click();
    
    // Select Callout Box
    await page.locator('.component-item').filter({ hasText: 'Callout Box' }).click();
    
    // Verify component was inserted
    const componentWrapper = page.locator('lib-component-editor-wrapper');
    await expect(componentWrapper).toBeVisible();
    await expect(page.locator('lib-callout-box')).toBeVisible();
    
    // Test Quick Edit
    // 1. Hover over component to show controls
    await componentWrapper.hover();
    
    // 2. Click Edit button
    await componentWrapper.locator('.edit-btn').click();
    
    // 3. Change title in Quick Edit
    const quickEditOverlay = page.locator('.quick-edit-overlay');
    await expect(quickEditOverlay).toBeVisible();
    
    const titleInput = quickEditOverlay.locator('input[type="text"]').first();
    await titleInput.fill('Updated Callout Title');
    
    // 4. Save changes
    await quickEditOverlay.locator('.save-btn').click();
    
    // 5. Verify changes reflected in component
    await expect(page.locator('.callout-title')).toHaveText('Updated Callout Title');
    
    // Test Property Editor (Full Edit)
    // 1. Click Config button
    await componentWrapper.hover();
    await componentWrapper.locator('.config-btn').click();
    
    // 2. Verify property editor opens
    const propertyEditor = page.locator('lib-property-editor');
    await expect(propertyEditor).toBeVisible();
    
    // 3. Change content
    await propertyEditor.locator('lib-text-input').filter({ hasText: 'Content' }).locator('input').fill('Updated content via property editor');
    
    // 4. Save changes
    await propertyEditor.getByRole('button', { name: 'Save Changes' }).click();
    
    // 5. Verify changes
    await expect(page.locator('.callout-text')).toHaveText('Updated content via property editor');
    
    // Clean up - delete component
    await componentWrapper.hover();
    await componentWrapper.locator('.delete-btn').click();
    await expect(componentWrapper).not.toBeVisible();
  });
});
