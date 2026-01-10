import { test, expect } from '@playwright/test';
import { Logger } from '@nestjs/common';

function uniqueEmail(prefix: string): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1_000_000);
  return `${prefix}.${ts}.${rand}@example.test`;
}

test.describe('Client Interface Social Owner Actions', () => {
  const logger = new Logger('SocialOwnerE2E');

  test.beforeAll(() => {
    Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']);
  });

  test.setTimeout(120000);

  test('Owner User can perform social actions', async ({ page }) => {
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        logger.error(`[Browser Error] ${text}`);
      } else {
        logger.debug(`[Browser Log] ${text}`);
      }
    });

    logger.debug('Test Started: Owner User can perform social actions');
    const email = uniqueEmail('owner-social');
    const password = 'Password123!';
    logger.debug(`Generated Owner user: ${email}`);

    // 1. Register as Owner in Owner Console (or via API with owner-console scope)
    await page.request.post('/api/authentication/register', {
      headers: {
        'x-ot-appscope': 'owner-console',
        'Content-Type': 'application/json',
      },
      data: {
        email,
        password,
        confirm: password,
        fn: 'Owner',
        ln: 'Tester',
        bio: 'I own this',
      },
    });

    // 2. Login to Client Interface
    logger.debug('Step: Login to Client Interface as Owner');
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);

    logger.debug('Submitting login...');
    await page.getByRole('button', { name: /login/i }).click({ force: true });

    // 3. Setup Profile in Client Interface
    logger.debug('Waiting for redirect...');
    await page.waitForURL(/\/(settings|feed)/, { timeout: 20000 });
    logger.debug(`Redirected to: ${page.url()}`);

    if (page.url().includes('settings')) {
      logger.debug('In Settings. Creating profile for Owner...');
      const nameInput = page
        .locator('lib-text-input[label="Profile Name"] input')
        .or(page.locator('lib-text-input[label="Display Name"] input'));
      await nameInput.fill('Owner Tester');
      await page
        .locator('lib-text-area[label="Bio"] textarea')
        .fill('Global Owner');
      await page
        .getByRole('button', { name: 'Submit' })
        .or(page.getByRole('button', { name: 'Create Profile' }))
        .click();
      await page.waitForURL(/\/feed/);
      logger.debug('Profile created. Redirected to feed.');
    }

    // 4. Post as Owner
    logger.debug('Step: Post as Owner');
    const ownerPostTitle = `Owner Post ${Date.now()}`;
    await page.locator('#title input').fill(ownerPostTitle);
    await page
      .locator('.tiptap-editor-styles .ProseMirror')
      .fill('Owner content here.');
    await page.getByRole('button', { name: 'Post' }).click();
    logger.debug('Post submitted.');

    // 5. Verify and Delete
    logger.debug('Step: Verify and Delete');
    const postLocator = page
      .locator('.post-container')
      .filter({ hasText: ownerPostTitle })
      .first();
    await expect(postLocator).toBeVisible({ timeout: 15000 });

    page.once('dialog', (dialog) => {
      logger.debug(`Dialog appearing: ${dialog.message()}`);
      dialog.accept();
    });
    await postLocator
      .getByRole('button', { name: 'Delete' })
      .click({ force: true });
    await expect(
      page.locator('.post-container').filter({ hasText: ownerPostTitle })
    ).toHaveCount(0, { timeout: 15000 });
    logger.debug('Post deleted. Test Complete.');
  });
});
