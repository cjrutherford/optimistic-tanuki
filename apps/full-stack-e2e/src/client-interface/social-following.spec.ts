import { test, expect } from '@playwright/test';
import { Logger } from '@nestjs/common';

function uniqueEmail(prefix: string): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1_000_000);
  return `${prefix}.${ts}.${rand}@example.test`;
}

function decodeJwt(token: string): any {
  const [, payload] = token.split('.');
  const json = Buffer.from(payload, 'base64').toString('utf8');
  return JSON.parse(json);
}

test.describe('Client Interface Social Following', () => {
  const logger = new Logger('SocialFollowingE2E');

  test.beforeAll(() => {
    Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']);
  });

  test.setTimeout(120000);

  test('User can Follow other users', async ({ page, request }) => {
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        logger.error(`[Browser Error] ${text}`);
      } else {
        logger.debug(`[Browser Log] ${text}`);
      }
    });

    logger.debug('Test Started: User can Follow other users');
    // Register User B (Target) via API
    const emailB = uniqueEmail('userB');
    const password = 'Password123!';
    logger.debug(`Registering User B (Target): ${emailB}`);

    const regB = await request.post('/api/authentication/register', {
      headers: {
        'x-ot-appscope': 'client-interface',
        'Content-Type': 'application/json',
      },
      data: {
        email: emailB,
        password,
        confirm: password,
        fn: 'User',
        ln: 'B',
        bio: 'Target for following',
      },
    });
    expect(regB.ok()).toBeTruthy();

    // Login B to get token
    logger.debug('Logging in User B via API...');
    const loginB = await request.post('/api/authentication/login', {
      headers: {
        'x-ot-appscope': 'client-interface',
        'Content-Type': 'application/json',
      },
      data: { email: emailB, password },
    });
    expect(loginB.ok()).toBeTruthy();
    const loginBBody = await loginB.json();
    const tokenB = loginBBody.data?.newToken || loginBBody.newToken;

    const decodedB = decodeJwt(tokenB);
    const userIdB = decodedB.userId;

    logger.debug('Creating Profile for User B...');
    const profileBResp = await request.post('/api/profile', {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'x-ot-appscope': 'client-interface',
      },
      data: {
        userId: userIdB,
        name: 'User B',
        description: 'Target for following',
        bio: 'I am the target',
        appScope: 'client-interface',
      },
    });
    expect(profileBResp.ok()).toBeTruthy();
    const createdBodyB = await profileBResp.json();
    const profileB = createdBodyB.profile ?? createdBodyB;

    // Re-login B so the JWT includes the new profileId
    logger.debug('Re-logging User B to get token with profileId...');
    const loginBAgain = await request.post('/api/authentication/login', {
      headers: {
        'x-ot-appscope': 'client-interface',
        'Content-Type': 'application/json',
      },
      data: { email: emailB, password },
    });
    expect(loginBAgain.ok()).toBeTruthy();
    const loginBAgainBody = await loginBAgain.json();
    const tokenBWithProfile =
      loginBAgainBody.data?.newToken || loginBAgainBody.newToken;

    // Create Post for B so A can see it
    logger.debug('Creating Post for User B...');
    const postTitleB = `User B Post ${Date.now()}`;
    const postBResp = await request.post('/api/social/post', {
      headers: {
        Authorization: `Bearer ${tokenBWithProfile}`,
        // Social endpoints require the 'social' app scope
        // so that permissions like `social.post.create`
        // are evaluated against the correct scope.
        'x-ot-appscope': 'social',
      },
      data: {
        title: postTitleB,
        content: 'Follow me!',
        profileId: profileB.id,
      },
    });
    expect(postBResp.ok()).toBeTruthy();

    // Register User A (Follower) via API
    const emailA = uniqueEmail('userA');
    logger.debug(`Registering User A (Follower): ${emailA}`);
    const regA = await request.post('/api/authentication/register', {
      headers: {
        'x-ot-appscope': 'client-interface',
        'Content-Type': 'application/json',
      },
      data: {
        email: emailA,
        password,
        confirm: password,
        fn: 'User',
        ln: 'A',
        bio: 'I follow people',
      },
    });
    expect(regA.ok()).toBeTruthy();

    // UI Flow for A
    logger.debug('Step: Login User A via UI');
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill(emailA);
    await page.getByPlaceholder('Password').fill(password);

    logger.debug('Submitting login for User A...');
    await page.getByRole('button', { name: /login/i }).click({ force: true });

    logger.debug('Waiting for redirect...');
    await page.waitForURL(/\/(settings|feed)/, { timeout: 20000 });
    logger.debug(`Redirected to: ${page.url()}`);

    if (page.url().includes('settings')) {
      logger.debug('In Settings. Creating profile for User A...');
      const nameInput = page
        .locator('lib-text-input[label="Display Name"] input')
        .or(page.locator('lib-text-input[label="Profile Name"] input'));
      await nameInput.fill('User A');
      await page
        .locator('lib-text-area[label="Bio"] textarea')
        .fill('I follow people');
      await page
        .getByRole('button', { name: 'Create Profile' })
        .or(page.getByRole('button', { name: 'Submit' }))
        .click();
      await page.waitForURL(/\/feed/, { timeout: 20000 });
      logger.debug('Profile created. Redirected to feed.');
    }

    // Find User B's post
    logger.debug("Searching for User B's post...");
    const postB = page
      .locator('.post-container')
      .filter({ hasText: postTitleB })
      .first();
    await expect(postB).toBeVisible({ timeout: 15000 });

    // Wait for User B profile name to appear in header, which ensures the Follow button should be ready
    logger.debug('Waiting for User B profile name in post header...');
    await expect(postB.locator('.post-profile')).toContainText('User B', {
      timeout: 10000,
    });

    // Verify Follow Button
    logger.debug('Checking for Follow button...');
    const followBtn = postB.getByRole('button', { name: 'Follow' });
    await expect(followBtn).toBeVisible({ timeout: 10000 });

    // Click Follow
    logger.debug('Clicking Follow...');
    await followBtn.click({ force: true });

    // Verify change to Unfollow
    await expect(postB.getByRole('button', { name: 'Unfollow' })).toBeVisible({
      timeout: 10000,
    });
    logger.debug('Follow successful (button changed to Unfollow).');

    // Reload to verify persistence
    logger.debug('Reloading page to verify persistence...');
    await page.reload();
    const postBAfterReload = page
      .locator('.post-container')
      .filter({ hasText: postTitleB })
      .first();
    await expect(
      postBAfterReload.getByRole('button', { name: 'Unfollow' })
    ).toBeVisible({ timeout: 15000 });
    logger.debug('Persistence verified.');

    // Unfollow
    logger.debug('Clicking Unfollow...');
    await postBAfterReload
      .getByRole('button', { name: 'Unfollow' })
      .click({ force: true });
    await expect(
      postBAfterReload.getByRole('button', { name: 'Follow' })
    ).toBeVisible({ timeout: 10000 });
    logger.debug('Unfollow successful. Test Complete.');
  });
});
