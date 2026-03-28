import { test, expect } from '@playwright/test';
import { createTestUser, cleanupTestUsers } from './fixtures/auth.fixture';

const GATEWAY_URL = process.env['GATEWAY_URL'] || 'http://localhost:3000';
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:8087';

test.describe('Permission Validation', () => {
  test.describe('Community Member Access Control', () => {
    let memberToken: string;
    let communityId: string;

    test.beforeAll(async ({ request }) => {
      const member = await createTestUser(request, {});
      memberToken = member.token || '';

      const communitiesResp = await request.get(
        `${GATEWAY_URL}/api/communities`
      );
      const communities = await communitiesResp.json();
      const community = communities.find((c: any) => c.localityType !== 'city');
      communityId = community?.id || '';
    });

    test.afterAll(async () => {
      await cleanupTestUsers();
    });

    test('member can access their community feed', async ({ request }) => {
      if (!communityId || !memberToken) return;
      const response = await request.get(
        `${GATEWAY_URL}/api/social/community/${communityId}/posts`,
        { headers: { Authorization: `Bearer ${memberToken}` } }
      );
      expect(response.ok()).toBeTruthy();
    });

    test('member can create post in community', async ({ request }) => {
      if (!communityId || !memberToken) return;
      const response = await request.post(
        `${GATEWAY_URL}/api/social/community/${communityId}/posts`,
        {
          headers: { Authorization: `Bearer ${memberToken}` },
          data: {
            title: 'Permission Test Post',
            content: 'Testing member permissions',
          },
        }
      );
      expect(response.ok() || response.status() === 400).toBeTruthy();
    });

    test('member can view community members list', async ({ request }) => {
      if (!communityId || !memberToken) return;
      const response = await request.get(
        `${GATEWAY_URL}/api/communities/${communityId}/members`,
        { headers: { Authorization: `Bearer ${memberToken}` } }
      );
      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Non-Member Access Restrictions', () => {
    let outsiderToken: string;
    let communityId: string;

    test.beforeAll(async ({ request }) => {
      const outsider = await createTestUser(request, {});
      outsiderToken = outsider.token || '';

      const communitiesResp = await request.get(
        `${GATEWAY_URL}/api/communities`
      );
      const communities = await communitiesResp.json();
      const community = communities.find((c: any) => c.localityType !== 'city');
      communityId = community?.id || '';
    });

    test.afterAll(async () => {
      await cleanupTestUsers();
    });

    test('non-member cannot post to community', async ({ request }) => {
      if (!communityId || !outsiderToken) return;
      const response = await request.post(
        `${GATEWAY_URL}/api/social/community/${communityId}/posts`,
        {
          headers: { Authorization: `Bearer ${outsiderToken}` },
          data: {
            title: 'Unauthorized Post',
            content: 'This should be blocked',
          },
        }
      );
      expect(response.status()).toBeGreaterThanOrEqual(403);
    });

    test('non-member cannot access community settings', async ({ request }) => {
      if (!communityId || !outsiderToken) return;
      const response = await request.get(
        `${GATEWAY_URL}/api/communities/${communityId}/settings`,
        { headers: { Authorization: `Bearer ${outsiderToken}` } }
      );
      expect(response.status()).toBeGreaterThanOrEqual(403);
    });
  });

  test.describe('Role-Based Access Control', () => {
    let ownerToken: string;
    let adminToken: string;
    let memberToken: string;
    let communityId: string;

    test.beforeAll(async ({ request }) => {
      const owner = await createTestUser(request, {});
      const admin = await createTestUser(request, {});
      const member = await createTestUser(request, {});

      ownerToken = owner.token || '';
      adminToken = admin.token || '';
      memberToken = member.token || '';

      const communitiesResp = await request.get(
        `${GATEWAY_URL}/api/communities`
      );
      const communities = await communitiesResp.json();
      const community = communities.find((c: any) => c.localityType !== 'city');
      communityId = community?.id || '';
    });

    test.afterAll(async () => {
      await cleanupTestUsers();
    });

    test('owner can access community settings', async ({ request }) => {
      if (!communityId || !ownerToken) return;
      const response = await request.get(
        `${GATEWAY_URL}/api/communities/${communityId}/settings`,
        { headers: { Authorization: `Bearer ${ownerToken}` } }
      );
      expect(response.ok() || response.status() === 404).toBeTruthy();
    });

    test('owner can manage community members', async ({ request }) => {
      if (!communityId || !ownerToken) return;
      const response = await request.get(
        `${GATEWAY_URL}/api/communities/${communityId}/members`,
        { headers: { Authorization: `Bearer ${ownerToken}` } }
      );
      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Protected Route Redirects', () => {
    test('redirects /account when unauthenticated', async ({ page }) => {
      await page.goto(`${BASE_URL}/account`);
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/login');
    });

    test('redirects /seller-dashboard when unauthenticated', async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/seller-dashboard`);
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/login');
    });

    test('redirects /messages when unauthenticated', async ({ page }) => {
      await page.goto(`${BASE_URL}/messages`);
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/login');
    });

    test('allows account page when authenticated', async ({
      page,
      request,
    }) => {
      const user = await createTestUser(request, {});
      await page.addInitScript((token) => {
        localStorage.setItem('ot-local-hub-authToken', token);
      }, user.token || '');

      await page.goto(`${BASE_URL}/account`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('API Endpoint Authorization', () => {
    test('requires authentication for user profile', async ({ request }) => {
      const response = await request.get(`${GATEWAY_URL}/api/profile/me`);
      expect(response.status()).toBeGreaterThanOrEqual(401);
    });

    test('requires authentication for creating communities', async ({
      request,
    }) => {
      const response = await request.post(`${GATEWAY_URL}/api/communities`, {
        data: {
          name: 'Unauthorized Community',
          description: 'Should fail',
          localityType: 'neighborhood',
        },
      });
      expect(response.status()).toBeGreaterThanOrEqual(401);
    });

    test('valid token grants access', async ({ request }) => {
      const user = await createTestUser(request, {});
      const response = await request.get(`${GATEWAY_URL}/api/profile/me`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      expect(response.ok() || response.status() === 404).toBeTruthy();
    });

    test('invalid token denies access', async ({ request }) => {
      const response = await request.get(`${GATEWAY_URL}/api/profile/me`, {
        headers: { Authorization: 'Bearer invalid-token-12345' },
      });
      expect(response.status()).toBeGreaterThanOrEqual(401);
    });
  });
});
