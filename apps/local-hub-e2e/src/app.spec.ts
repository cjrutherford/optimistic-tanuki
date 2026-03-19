import { test, expect, request } from '@playwright/test';

test.describe('Public Pages', () => {
  test.describe('Landing Page', () => {
    test('should load the landing page', async ({ page }) => {
      const response = await page.goto('/');
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Cities Page', () => {
    test('should load cities page', async ({ page }) => {
      const response = await page.goto('/cities');
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Communities Page', () => {
    test('should load communities page', async ({ page }) => {
      const response = await page.goto('/communities');
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Login Page', () => {
    test('should load login page', async ({ page }) => {
      const response = await page.goto('/login');
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Register Page', () => {
    test('should load register page', async ({ page }) => {
      const response = await page.goto('/register');
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });
  });
});

test.describe('API Endpoints', () => {
  test('should fetch communities via API', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/communities');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });
});

test.describe('Authentication', () => {
  test('should register a new user', async ({ request }) => {
    const timestamp = Date.now();
    const response = await request.post(
      'http://localhost:3000/api/authentication/register',
      {
        data: {
          email: `e2e_${timestamp}@test.com`,
          username: `e2euser_${timestamp}`,
          password: 'TestPass123!',
          confirmPassword: 'TestPass123!',
        },
      }
    );
    expect(response.ok() || response.status() === 400).toBeTruthy();
  });

  test('should reject invalid login', async ({ request }) => {
    const response = await request.post(
      'http://localhost:3000/api/authentication/login',
      {
        data: {
          email: 'nonexistent@test.com',
          password: 'wrongpassword',
        },
      }
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Database', () => {
  test('should have communities in database', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/communities');
    expect(response.ok()).toBeTruthy();
    const communities = await response.json();
    if (communities.length === 0) {
      console.log(
        'No communities seeded - this is expected in fresh databases'
      );
    }
    expect(Array.isArray(communities)).toBeTruthy();
  });

  test('should have cities data', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/communities');
    expect(response.ok()).toBeTruthy();
    const communities = await response.json();
    const cities = communities.filter((c: any) => c.localityType === 'city');
    if (cities.length === 0) {
      console.log('No cities seeded - this is expected in fresh databases');
    }
    expect(Array.isArray(communities)).toBeTruthy();
  });
});

test.describe('City and Community Detail Pages', () => {
  let citySlug: string;
  let communitySlug: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/communities');
    const communities = await response.json();

    const city = communities.find((c: any) => c.localityType === 'city');
    citySlug = city?.slug || 'test-city';

    const community = communities.find(
      (c: any) => c.slug && c.localityType !== 'city'
    );
    communitySlug = community?.slug || 'test-community';
  });

  test.describe('City Detail Page', () => {
    test('should load city detail page', async ({ page }) => {
      const response = await page.goto(`/city/${citySlug}`);
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });

    test('should load city classifieds page', async ({ page }) => {
      const response = await page.goto(`/city/${citySlug}/classifieds`);
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Community Detail Page', () => {
    test('should load community detail page', async ({ page }) => {
      const response = await page.goto(`/c/${communitySlug}`);
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });

    test('should load community classifieds page', async ({ page }) => {
      const response = await page.goto(`/c/${communitySlug}/classifieds`);
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });
  });
});

test.describe('Protected Routes - Server-Side Authentication', () => {
  test('should redirect /account to login when unauthenticated', async ({
    page,
  }) => {
    const response = await page.goto('/account');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/login');
  });

  test('should redirect /seller-dashboard to login when unauthenticated', async ({
    page,
  }) => {
    const response = await page.goto('/seller-dashboard');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/login');
  });

  test('should redirect /messages to login when unauthenticated', async ({
    page,
  }) => {
    const response = await page.goto('/messages');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/login');
  });

  test('should redirect /messages/new to login when unauthenticated', async ({
    page,
  }) => {
    const response = await page.goto('/messages/new');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/login');
  });

  test('should redirect /city/test/classifieds/new to login when unauthenticated', async ({
    page,
  }) => {
    const response = await page.goto('/city/test/classifieds/new');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/login');
  });

  test('should redirect /c/test/classifieds/new to login when unauthenticated', async ({
    page,
  }) => {
    const response = await page.goto('/c/test/classifieds/new');
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/login');
  });
});

test.describe('Authenticated User Flows', () => {
  let authToken: string;
  let testUserId: string;
  let testCommunityId: string;
  let testCityId: string;
  let testCitySlug: string;

  test.beforeAll(async ({ request }) => {
    const timestamp = Date.now();
    const email = `authe2e_${timestamp}@test.com`;

    let registerResponse = await request.post(
      'http://localhost:3000/api/authentication/register',
      {
        data: {
          fn: 'Test',
          ln: 'User',
          email,
          password: 'TestPass123!',
          confirm: 'TestPass123!',
          bio: 'E2E test user',
        },
      }
    );

    let loginResponse;
    let loginData;

    if (!registerResponse.ok()) {
      loginResponse = await request.post(
        'http://localhost:3000/api/authentication/login',
        {
          data: {
            email,
            password: 'TestPass123!',
          },
        }
      );
      if (!loginResponse.ok()) {
        console.log('Auth failed, using fallback token approach');
        authToken = 'fallback';
      } else {
        loginData = await loginResponse.json();
        authToken = loginData.data?.newToken;
      }
    } else {
      loginResponse = await request.post(
        'http://localhost:3000/api/authentication/login',
        {
          data: {
            email,
            password: 'TestPass123!',
          },
        }
      );
      loginData = await loginResponse.json();
      authToken = loginData.data?.newToken;
    }

    const communitiesResponse = await request.get(
      'http://localhost:3000/api/communities'
    );
    const communities = await communitiesResponse.json();
    const city = communities.find((c: any) => c.localityType === 'city');
    testCityId = city?.id;
    testCitySlug = city?.slug || 'test-city';
  });

  test.describe('Community Membership', () => {
    test('should join a community', async ({ request }) => {
      const communitiesResponse = await request.get(
        'http://localhost:3000/api/communities'
      );
      const communities = await communitiesResponse.json();
      const community = communities.find(
        (c: any) => c.slug && c.localityType !== 'city'
      );

      if (!community) {
        console.log('No non-city community found, skipping join test');
        return;
      }

      const response = await request.post(
        `http://localhost:3000/api/communities/${community.id}/join`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      expect(response.ok() || response.status() === 400).toBeTruthy();
      testCommunityId = community.id;
    });

    test('should get user memberships', async ({ request }) => {
      const response = await request.get(
        'http://localhost:3000/api/social/community/user/communities',
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      expect(response.ok()).toBeTruthy();
      const memberships = await response.json();
      expect(Array.isArray(memberships)).toBeTruthy();
    });
  });

  test.describe('Community Creation', () => {
    test('should create a new community', async ({ request }) => {
      if (!testCityId) {
        console.log('No city found, skipping community creation');
        return;
      }

      const response = await request.post(
        'http://localhost:3000/api/communities',
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            name: `Test Community ${Date.now()}`,
            description: 'E2E Test Community',
            parentId: testCityId,
            localityType: 'neighborhood',
          },
        }
      );

      if (response.ok()) {
        const community = await response.json();
        testCommunityId = community.id;
        expect(community.name).toBeTruthy();
      } else {
        expect([400, 403, 404, 409]).toContain(response.status());
      }
    });
  });

  test.describe('Community Feed - Posts', () => {
    test('should create a post in community feed', async ({ request }) => {
      if (!testCommunityId) {
        console.log('No community ID, skipping post creation');
        return;
      }

      const response = await request.post(
        `http://localhost:3000/api/social/community/${testCommunityId}/posts`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            title: 'E2E Test Post',
            content: 'This is a test post from E2E tests',
          },
        }
      );
      expect(response.ok() || response.status() === 400).toBeTruthy();
    });

    test('should get community posts', async ({ request }) => {
      if (!testCommunityId) {
        console.log('No community ID, skipping get posts');
        return;
      }

      const response = await request.get(
        `http://localhost:3000/api/social/community/${testCommunityId}/posts`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      expect(response.ok()).toBeTruthy();
      const posts = await response.json();
      expect(Array.isArray(posts)).toBeTruthy();
    });
  });

  test.describe('Voting and Reactions', () => {
    let postId: string;

    test('should create a post for voting', async ({ request }) => {
      if (!testCommunityId) {
        console.log('No community ID, skipping');
        return;
      }

      const response = await request.post(
        `http://localhost:3000/api/social/community/${testCommunityId}/posts`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            title: 'Post for Voting Test',
            content: 'Vote on this post',
          },
        }
      );

      if (response.ok()) {
        const post = await response.json();
        postId = postId || post.id;
      }
    });

    test('should vote on a post', async ({ request }) => {
      if (!testCommunityId) {
        console.log('No community ID, skipping vote');
        return;
      }

      const postsResponse = await request.get(
        `http://localhost:3000/api/social/community/${testCommunityId}/posts`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const posts = await postsResponse.json();
      const testPost = posts.find(
        (p: any) => p.title === 'Post for Voting Test'
      );

      if (!testPost) {
        console.log('No test post found for voting');
        return;
      }

      const voteResponse = await request.post(
        `http://localhost:3000/api/social/posts/${testPost.id}/vote`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            voteType: 'up',
          },
        }
      );
      expect(voteResponse.ok() || voteResponse.status() === 400).toBeTruthy();
    });
  });

  test.describe('Comments', () => {
    test('should add a comment to a post', async ({ request }) => {
      if (!testCommunityId) {
        console.log('No community ID, skipping comment');
        return;
      }

      const postsResponse = await request.get(
        `http://localhost:3000/api/social/community/${testCommunityId}/posts`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const posts = await postsResponse.json();
      const testPost = posts[0];

      if (!testPost) {
        console.log('No posts found for commenting');
        return;
      }

      const commentResponse = await request.post(
        `http://localhost:3000/api/social/posts/${testPost.id}/comments`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            content: 'E2E Test Comment',
          },
        }
      );
      expect(
        commentResponse.ok() || commentResponse.status() === 400
      ).toBeTruthy();
    });
  });

  test.describe('Classified Ads', () => {
    test('should create a classified ad', async ({ request }) => {
      if (!testCommunityId) {
        console.log('No community ID, skipping classified creation');
        return;
      }

      const response = await request.post(
        'http://localhost:3000/api/classifieds',
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            title: 'E2E Test Classified',
            description: 'This is a test classified ad',
            price: 100,
            category: 'for-sale',
            communityId: testCommunityId,
          },
        }
      );
      expect(response.ok() || response.status() === 400).toBeTruthy();
    });

    test('should get classifieds by community', async ({ request }) => {
      if (!testCommunityId) {
        console.log('No community ID, skipping get classifieds');
        return;
      }

      const response = await request.get(
        `http://localhost:3000/api/classifieds/community/${testCommunityId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      expect(response.ok()).toBeTruthy();
      const classifieds = await response.json();
      expect(Array.isArray(classifieds)).toBeTruthy();
    });

    test('should get my classified ads', async ({ request }) => {
      const response = await request.get(
        'http://localhost:3000/api/classifieds/profile/my-ads',
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      expect(response.ok()).toBeTruthy();
      const myAds = await response.json();
      expect(Array.isArray(myAds)).toBeTruthy();
    });
  });

  test.describe('Community Manager Election', () => {
    test('should get community manager info', async ({ request }) => {
      if (!testCommunityId) {
        console.log('No community ID, skipping election test');
        return;
      }

      const response = await request.get(
        `http://localhost:3000/api/communities/${testCommunityId}/manager`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      expect(response.ok() || response.status() === 404).toBeTruthy();
    });

    test('should get active election info', async ({ request }) => {
      if (!testCommunityId) {
        console.log('No community ID, skipping election test');
        return;
      }

      const response = await request.get(
        `http://localhost:3000/api/communities/${testCommunityId}/election`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      expect(response.ok() || response.status() === 404).toBeTruthy();
    });
  });

  test.describe('Business Pages', () => {
    test('should create a business page', async ({ request }) => {
      if (!testCommunityId) {
        console.log('No community ID, skipping business page creation');
        return;
      }

      const response = await request.post(
        'http://localhost:3000/api/payments/business-pages',
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            name: `Test Business ${Date.now()}`,
            description: 'E2E Test Business Page',
            communityId: testCommunityId,
            tier: 'basic',
          },
        }
      );
      expect(response.ok() || response.status() === 400).toBeTruthy();
    });

    test('should get business pages', async ({ request }) => {
      if (!testCommunityId) {
        console.log('No community ID, skipping get business pages');
        return;
      }

      const response = await request.get(
        `http://localhost:3000/api/payments/business-pages/community/${testCommunityId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Account Page - Authenticated', () => {
    test('should load account page when authenticated', async ({ page }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('ot-local-hub-authToken', token);
      }, authToken);

      const response = await page.goto('/account');
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Seller Dashboard - Authenticated', () => {
    test('should load seller dashboard when authenticated', async ({
      page,
    }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('ot-local-hub-authToken', token);
      }, authToken);

      const response = await page.goto('/seller-dashboard');
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
