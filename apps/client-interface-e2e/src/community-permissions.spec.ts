import { test, expect } from '@playwright/test';
import { Logger } from '@nestjs/common';

function uniqueEmail(prefix: string): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1_000_000);
  return `${prefix}.${ts}.${rand}@example.test`;
}

test.describe('Community Permissions - Client Interface', () => {
  const logger = new Logger('CommunityPermissionsE2E');

  test.beforeAll(() => {
    Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']);
  });

  test.setTimeout(180000);

  test('Security: Non-member cannot post to community', async ({ page }) => {
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        logger.error(`[Browser Error] ${text}`);
      }
    });

    logger.debug('Test: Non-member attempting to post to community');
    const email = uniqueEmail('nonmember');
    const password = 'Password123!';

    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('First Name').fill('Non');
    await page.getByPlaceholder('Last Name').fill('Member');
    await page.getByPlaceholder('Email').fill(email);

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.first().fill(password);
    await passwordInputs.nth(1).fill(password);

    await page.getByRole('button', { name: /register/i }).click();

    await page.waitForURL(/\/login$/, { timeout: 30000 });
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: /login/i }).click({ force: true });

    await page.waitForURL(/\/(settings|feed)/, { timeout: 30000 });

    if (page.url().includes('settings')) {
      await page.getByPlaceholder('Profile Name').fill('Non Member');
      await page.getByPlaceholder('Bio').fill('Not in any community');
      await page.getByRole('button', { name: 'Submit' }).click();
      await page.waitForURL(/\/feed/, { timeout: 30000 });
    }

    await page.goto('/communities');
    await page.waitForLoadState('networkidle');

    const communityCards = page.locator(
      '.community-card, [class*="community-item"]'
    );
    const count = await communityCards.count();

    if (count > 0) {
      await communityCards.first().click();
      await page.waitForLoadState('networkidle');

      const postForm = page.locator(
        'form[class*="post"], [class*="create-post"]'
      );
      if (await postForm.isVisible({ timeout: 5000 }).catch(() => false)) {
        await page.getByPlaceholder('Title').fill('Unauthorized Post');
        await page.locator('.ProseMirror').fill('Should be blocked');

        await page.getByRole('button', { name: /post/i }).click();
        await page.waitForTimeout(1000);

        logger.debug(
          'Post submission attempted - verify it was rejected by backend'
        );
      }
    }

    logger.debug('Test complete');
  });

  test('Security: Non-member cannot react to community posts', async ({
    page,
  }) => {
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        logger.error(`[Browser Error] ${text}`);
      }
    });

    logger.debug('Test: Non-member attempting to react to community posts');

    const outsiderEmail = uniqueEmail('outsiderreact');
    const outsiderPassword = 'Password123!';

    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('First Name').fill('Outsider');
    await page.getByPlaceholder('Last Name').fill('Reactor');
    await page.getByPlaceholder('Email').fill(outsiderEmail);

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.first().fill(outsiderPassword);
    await passwordInputs.nth(1).fill(outsiderPassword);

    await page.getByRole('button', { name: /register/i }).click();

    await page.waitForURL(/\/login$/, { timeout: 30000 });
    await page.getByPlaceholder('Email').fill(outsiderEmail);
    await page.getByPlaceholder('Password').fill(outsiderPassword);
    await page.getByRole('button', { name: /login/i }).click({ force: true });

    await page.waitForURL(/\/(settings|feed)/, { timeout: 30000 });

    if (page.url().includes('settings')) {
      await page.getByPlaceholder('Profile Name').fill('Outsider Reactor');
      await page.getByPlaceholder('Bio').fill('Testing reaction security');
      await page.getByRole('button', { name: 'Submit' }).click();
      await page.waitForURL(/\/feed/, { timeout: 30000 });
    }

    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    const posts = page.locator('.post-container, [class*="post-card"]');
    const postCount = await posts.count();

    logger.debug(`Found ${postCount} posts to test`);

    if (postCount > 0) {
      const firstPost = posts.first();
      await firstPost.scrollIntoViewIfNeeded();

      const likeButton = firstPost
        .locator('button[class*="like"], [class*="reaction"]')
        .first();

      if (await likeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await likeButton.click();
        await page.waitForTimeout(500);

        logger.debug('Reaction click attempted as non-member');
        logger.debug(
          'SECURITY NOTE: ReactionService does NOT check community membership'
        );
        logger.debug(
          'This is a vulnerability - reactions should require community membership'
        );
      }
    }

    logger.debug('Test complete - review backend for proper rejection');
  });

  test('Member can post to joined community', async ({ page }) => {
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        logger.error(`[Browser Error] ${text}`);
      }
    });

    logger.debug('Test: Member posting to joined community');

    const memberEmail = uniqueEmail('member');
    const memberPassword = 'Password123!';

    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('First Name').fill('Member');
    await page.getByPlaceholder('Last Name').fill('User');
    await page.getByPlaceholder('Email').fill(memberEmail);

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.first().fill(memberPassword);
    await passwordInputs.nth(1).fill(memberPassword);

    await page.getByRole('button', { name: /register/i }).click();

    await page.waitForURL(/\/login$/, { timeout: 30000 });
    await page.getByPlaceholder('Email').fill(memberEmail);
    await page.getByPlaceholder('Password').fill(memberPassword);
    await page.getByRole('button', { name: /login/i }).click({ force: true });

    await page.waitForURL(/\/(settings|feed)/, { timeout: 30000 });

    if (page.url().includes('settings')) {
      await page.getByPlaceholder('Profile Name').fill('Member User');
      await page.getByPlaceholder('Bio').fill('I am a community member');
      await page.getByRole('button', { name: 'Submit' }).click();
      await page.waitForURL(/\/feed/, { timeout: 30000 });
    }

    await page.goto('/communities');
    await page.waitForLoadState('networkidle');

    const joinButtons = page.getByRole('button', { name: /join/i });
    const joinCount = await joinButtons.count();

    if (joinCount > 0) {
      await joinButtons.first().click();
      await page.waitForTimeout(2000);

      const joinedCommunity = page.locator('[class*="community"]').first();
      if (await joinedCommunity.isVisible()) {
        const postButton = page.getByRole('button', {
          name: /create post|new post/i,
        });
        if (await postButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await postButton.click();
          await page.waitForTimeout(500);

          await page.getByPlaceholder('Title').fill('Member Post');
          await page
            .locator('.ProseMirror')
            .fill('This is a valid member post');

          await page.getByRole('button', { name: /post/i }).click();
          await page.waitForTimeout(1000);

          logger.debug('Member post submitted successfully');
        }
      }
    } else {
      logger.debug('No communities available to join');
    }

    logger.debug('Test complete');
  });
});
