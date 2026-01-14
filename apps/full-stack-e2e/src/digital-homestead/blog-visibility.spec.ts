import { test, expect } from '@playwright/test';

function uniqueEmail(prefix: string): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1_000_000);
  return `${prefix}.${ts}.${rand}@example.test`;
}

test.describe('Digital Homestead Blog Visibility', () => {
  test('Public users see only published posts; Owners see all', async ({
    page,
    request,
  }) => {
    // 1. Setup: Register an Owner user who can create posts
    const ownerEmail = uniqueEmail('dh-owner');
    const password = 'Password123!';

    // Register via Gateway for owner-console scope to get owner permissions
    const registerResp = await request.post('/api/authentication/register', {
      headers: {
        'x-ot-appscope': 'owner-console',
        'Content-Type': 'application/json',
      },
      data: {
        email: ownerEmail,
        password,
        confirm: password,
        fn: 'Blog',
        ln: 'Owner',
        bio: 'I own this blog',
      },
    });
    expect(registerResp.ok()).toBeTruthy();

    // Login via API to get token for setup
    const loginResp = await request.post('/api/authentication/login', {
      headers: {
        'Content-Type': 'application/json',
        'x-ot-appscope': 'digital-homestead',
      },
      data: { email: ownerEmail, password },
    });
    expect(loginResp.ok()).toBeTruthy();
    const loginBody: any = await loginResp.json();
    const token = loginBody.data?.newToken || loginBody.newToken;

    // Create Profile (required for authorId)
    // Decode token to get userId
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf8')
    );
    const userId = payload.userId;

    const profileResp = await request.post('/api/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-ot-appscope': 'digital-homestead',
        'Content-Type': 'application/json',
      },
      data: {
        userId,
        name: 'Blog Owner',
        bio: 'Owner Bio',
        appScope: 'digital-homestead',
      },
    });
    expect(profileResp.ok()).toBeTruthy();
    const profileBody = await profileResp.json();
    const profile = profileBody.profile || profileBody;
    const authorId = profile.id;

    // Re-login to get token with profileId/permissions
    const loginResp2 = await request.post('/api/authentication/login', {
      headers: {
        'Content-Type': 'application/json',
        'x-ot-appscope': 'digital-homestead',
      },
      data: { email: ownerEmail, password },
    });
    const loginBody2 = await loginResp2.json();
    const effectiveToken = loginBody2.data?.newToken || loginBody2.newToken;

    // Verify Roles (Best effort but we need it to be there)
    const rolesResp = await request.get(
      `/api/permissions/user-roles/${authorId}`,
      {
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    expect(rolesResp.ok()).toBeTruthy();
    const roles: any[] = await rolesResp.json();
    const hasOwnerRole = roles.some(
      (r) => r.role?.name === 'owner' || r.role?.name === 'digital_homesteader'
    );
    if (!hasOwnerRole) {
      console.warn(
        'WARNING: User does not have owner or digital_homesteader role yet. Permissions might be propagating.'
      );
      // Wait a bit and retry roles check once
      await page.waitForTimeout(2000);
      const rolesResp2 = await request.get(
        `/api/permissions/user-roles/${authorId}`,
        {
          headers: {
            Authorization: `Bearer ${effectiveToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const roles2 = await rolesResp2.json();
      expect(
        roles2.some(
          (r) =>
            r.role?.name === 'owner' || r.role?.name === 'digital_homesteader'
        )
      ).toBeTruthy();
    }

    // 2. Create Content: One Published Post, One Draft Post
    const publishedTitle = `Published Post ${Date.now()}`;
    const draftTitle = `Draft Post ${Date.now()}`;

    // Create Published Post
    // Note: API might default to draft, so we might need to publish it or set isDraft=false
    const pubPostResp = await request.post('/api/post', {
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
        'x-ot-appscope': 'digital-homestead',
        'Content-Type': 'application/json',
      },
      data: {
        title: publishedTitle,
        content: '<p>This is public content.</p>',
        authorId,
        isDraft: false,
      },
    });
    expect(pubPostResp.ok()).toBeTruthy();

    // Create Draft Post
    const draftPostResp = await request.post('/api/post', {
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
        'x-ot-appscope': 'digital-homestead',
        'Content-Type': 'application/json',
      },
      data: {
        title: draftTitle,
        content: '<p>This is private draft content.</p>',
        authorId,
        isDraft: true,
      },
    });
    expect(draftPostResp.ok()).toBeTruthy();

    // 3. Verify Public Visibility (Unauthenticated)
    await page.goto('/blog');

    // Published post should be visible
    await expect(
      page.locator('button.post-item', { hasText: publishedTitle })
    ).toBeVisible();

    // Draft post should NOT be visible
    await expect(
      page.locator('button.post-item', { hasText: draftTitle })
    ).not.toBeVisible();

    // 4. Verify Owner Visibility (Authenticated)
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill(ownerEmail);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: /login/i }).click({ force: true });

    await page.waitForURL(/\/blog/);

    // Published post should be visible
    await expect(
      page.locator('button.post-item', { hasText: publishedTitle })
    ).toBeVisible();

    // Draft post SHOULD be visible now
    const draftItem = page.locator('button.post-item', { hasText: draftTitle });
    await expect(draftItem).toBeVisible();

    // Verify Draft Badge
    await expect(draftItem.locator('.draft-badge')).toBeVisible();

    // 5. Verify View State
    // Click the draft post
    await draftItem.click();

    // Give it a moment to load
    await page.waitForTimeout(2000);

    // Verify main content area updates
    // Check for draft banner
    await expect(page.locator('.draft-banner')).toContainText(
      'This post is a draft'
    );

    // Check title in viewer
    await expect(page.locator('dh-blog-viewer h1')).toContainText(draftTitle);

    // Check content in viewer (using the specific locator structure we saw in component)
    await expect(page.locator('dh-blog-viewer')).toContainText(
      'This is private draft content.'
    );

    // 6. Publish Draft
    // Click 'Publish Now' in the banner
    await page.getByRole('button', { name: 'Publish Now' }).click();

    // Verify banner disappears
    await expect(page.locator('.draft-banner')).not.toBeVisible();

    // Verify Draft Badge disappears from sidebar
    await expect(draftItem.locator('.draft-badge')).not.toBeVisible();

    // 7. Verify Public Visibility (Unauthenticated)
    // Logout (or just clear storage/cookies, but UI logout is safer if available, or just navigate to login and clear)
    // Since there's no clear logout button visible in the snippets, we'll clear storage
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.goto('/blog');

    // Both posts should now be visible to public
    await expect(
      page.locator('button.post-item', { hasText: publishedTitle })
    ).toBeVisible();
    await expect(
      page.locator('button.post-item', { hasText: draftTitle })
    ).toBeVisible();
  });
});
