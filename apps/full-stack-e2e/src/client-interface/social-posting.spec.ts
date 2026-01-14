import { test, expect } from '@playwright/test';
import { Logger } from '@nestjs/common';

function uniqueEmail(prefix: string): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1_000_000);
  return `${prefix}.${ts}.${rand}@example.test`;
}

test.describe('Client Interface Social Posting', () => {
  const logger = new Logger('SocialPostingE2E');

  test.beforeAll(() => {
    Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']);
  });

  test.setTimeout(120000);

  test('First Party User can Post, Comment, Delete', async ({ page }) => {
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        logger.error(`[Browser Error] ${text}`);
      } else {
        logger.debug(`[Browser Log] ${text}`);
      }
    });

    logger.debug('Test Started: First Party User can Post, Comment, Delete');
    const email = uniqueEmail('social');
    const password = 'Password123!';
    logger.debug(`Generated test user: ${email}`);

    // 1. Register
    logger.debug('Step 1: Registration');
    await page.goto('/register');
    await page.getByPlaceholder('First Name').fill('Social');
    await page.getByPlaceholder('Last Name').fill('Tester');
    await page.getByPlaceholder('Email').fill(email);
    await page.locator('input[name="Password"]').fill(password);
    await page.locator('input[name="Confirm Password"]').fill(password);

    logger.debug('Submitting registration form...');
    await page.getByRole('button', { name: /register/i }).click();

    logger.debug('Waiting for redirection to login...');
    await page.waitForURL(/\/login$/);
    logger.debug('Redirected to login page. Step 1 Complete.');

    // 2. Login
    logger.debug('Step 2: Login');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);

    logger.debug('Submitting login form...');
    await page.getByRole('button', { name: /login/i }).click({ force: true });

    // 3. Create Profile if needed
    logger.debug('Waiting for redirection to settings or feed...');
    try {
      await page.waitForURL(/\/(settings|feed)/, { timeout: 20000 });
      logger.debug(`Redirected to: ${page.url()}`);
    } catch (e) {
      logger.error(
        'Timeout waiting for redirect. Checking for error messages...'
      );
      const errorText = await page
        .locator('.error, .alert, .validation-message')
        .allTextContents();
      logger.error(`Visible errors: ${JSON.stringify(errorText)}`);
      logger.error(`Current URL: ${page.url()}`);
      throw e;
    }

    if (page.url().includes('settings')) {
      logger.debug('In Settings page. Completing profile...');
      // Try both "Profile Name" and "Display Name" just in case
      const nameInput = page
        .locator('lib-text-input[label="Profile Name"] input')
        .or(page.locator('lib-text-input[label="Display Name"] input'));
      await nameInput.fill('Social Tester');
      await page
        .locator('lib-text-area[label="Bio"] textarea')
        .fill('I am a tester');
      await page
        .getByRole('button', { name: 'Submit' })
        .or(page.getByRole('button', { name: 'Create Profile' }))
        .click();
      await page.waitForURL(/\/feed/);
      logger.debug('Profile created. Redirected to feed. Step 3 Complete.');
    }

    // 4. Create Post
    logger.debug('Step 4: Create Post');
    const postTitle = `Test Post ${Date.now()}`;
    await page.locator('#title input').fill(postTitle);
    // Tiptap editor
    await page
      .locator('.tiptap-editor-styles .ProseMirror')
      .fill('This is a test post content.');
    await page.getByRole('button', { name: 'Post' }).click();
    logger.debug(`Post "${postTitle}" submitted. Step 4 Complete.`);

    // 5. Verify Post
    logger.debug('Step 5: Verify Post Visibility');
    const postLocator = page
      .locator('.post-container')
      .filter({ hasText: postTitle })
      .first();
    await expect(postLocator).toBeVisible({ timeout: 15000 });
    // Profile name might take a moment to load asynchronously
    await expect(postLocator).toContainText('Social Tester', {
      timeout: 10000,
    });
    logger.debug('Post verified. Step 5 Complete.');

    // 6. Comment
    logger.debug('Step 6: Comment on Post');
    // The "Leave a Comment" button opens a MatDialog
    await postLocator
      .getByRole('button', { name: 'Leave a Comment' })
      .click({ force: true });
    logger.debug('Clicked Leave a Comment. Waiting for dialog...');

    const commentEditor = page.locator(
      '.cdk-overlay-container quill-editor .ql-editor'
    );
    await expect(commentEditor).toBeVisible({ timeout: 10000 });
    await commentEditor.fill('Nice post!');

    await page
      .locator('.cdk-overlay-container')
      .getByRole('button', { name: 'Submit' })
      .click({ force: true });
    logger.debug('Comment submitted.');

    // Wait for the comment to appear in the DOM
    const commentLocator = postLocator
      .locator('.comment-content')
      .filter({ hasText: 'Nice post!' });
    await expect(commentLocator).toBeVisible({ timeout: 15000 });
    logger.debug('Comment verified. Step 6 Complete.');

    // 7. Delete
    logger.debug('Step 7: Delete Post');
    page.once('dialog', (dialog) => {
      logger.debug(`Dialog appearing: ${dialog.message()}`);
      dialog.accept();
    });
    await postLocator
      .getByRole('button', { name: 'Delete' })
      .click({ force: true });

    // Verify post gone
    await expect(
      page.locator('.post-container').filter({ hasText: postTitle })
    ).toHaveCount(0, { timeout: 15000 });
    logger.debug('Post deletion verified. Test Complete.');
  });
});
