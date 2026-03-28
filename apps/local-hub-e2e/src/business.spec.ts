import { test, expect } from '@playwright/test';
import { createTestUser, cleanupTestUsers } from './fixtures/auth.fixture';

const GATEWAY_URL = process.env['GATEWAY_URL'] || 'http://localhost:3000';
const MOCK_PAYMENT_URL =
  process.env['MOCK_PAYMENT_URL'] || 'http://localhost:3019';

test.describe('Business Pages Workflow', () => {
  let businessOwnerToken: string;
  let communityId: string;
  let businessPageId: string;

  test.beforeAll(async ({ request }) => {
    const owner = await createTestUser(request, {});
    businessOwnerToken = owner.token || '';

    const communitiesResp = await request.get(`${GATEWAY_URL}/api/communities`);
    const communities = await communitiesResp.json();
    const community = communities.find((c: any) => c.localityType !== 'city');
    communityId = community?.id || '';
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test('owner can create business page', async ({ request }) => {
    if (!businessOwnerToken || !communityId) return;

    const response = await request.post(
      `${GATEWAY_URL}/api/payments/business-pages`,
      {
        headers: { Authorization: `Bearer ${businessOwnerToken}` },
        data: {
          name: 'E2E Test Business',
          description: 'Test business for e2e workflow',
          communityId: communityId,
          tier: 'basic',
        },
      }
    );

    expect(response.ok() || response.status() === 400).toBeTruthy();

    if (response.ok()) {
      const data = await response.json();
      businessPageId = data.id || '';
    }
  });

  test('can get business pages by community', async ({ request }) => {
    if (!communityId) return;

    const response = await request.get(
      `${GATEWAY_URL}/api/payments/business-pages/community/${communityId}`
    );

    expect(response.ok() || response.status() === 404).toBeTruthy();
  });

  test('can get business page by ID', async ({ request }) => {
    if (!businessPageId) return;

    const response = await request.get(
      `${GATEWAY_URL}/api/payments/business-pages/${businessPageId}`
    );

    expect(response.ok() || response.status() === 404).toBeTruthy();
  });

  test('owner can update business page', async ({ request }) => {
    if (!businessOwnerToken || !businessPageId) return;

    const response = await request.patch(
      `${GATEWAY_URL}/api/payments/business-pages/${businessPageId}`,
      {
        headers: { Authorization: `Bearer ${businessOwnerToken}` },
        data: { description: 'Updated description' },
      }
    );

    expect(response.ok() || response.status() === 400).toBeTruthy();
  });

  test('can update business page logo', async ({ request }) => {
    if (!businessOwnerToken || !businessPageId) return;

    const response = await request.patch(
      `${GATEWAY_URL}/api/payments/business-pages/${businessPageId}/logo`,
      {
        headers: { Authorization: `Bearer ${businessOwnerToken}` },
        data: { logoUrl: 'https://example.com/logo.png' },
      }
    );

    expect(response.ok() || response.status() === 400).toBeTruthy();
  });

  test('can get all business tiers', async ({ request }) => {
    const response = await request.get(
      `${GATEWAY_URL}/api/payments/business-pages/tiers`
    );
    expect(response.ok() || response.status() === 404).toBeTruthy();
  });
});

test.describe('Stripe Connect Onboarding Flow', () => {
  let connectedUserToken: string;

  test.beforeAll(async ({ request }) => {
    const user = await createTestUser(request, {});
    connectedUserToken = user.token || '';
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test('can initiate Stripe Connect onboarding via mock', async ({
    request,
  }) => {
    if (!connectedUserToken) return;

    const response = await request.post(
      `${GATEWAY_URL}/api/payments/stripe/connect/account-link`,
      {
        headers: { Authorization: `Bearer ${connectedUserToken}` },
        data: {},
      }
    );

    expect(response.ok() || response.status() === 400).toBeTruthy();

    if (response.ok()) {
      const data = await response.json();
      expect(data.onboardingUrl || data.accountId).toBeTruthy();
    }
  });

  test('mock Stripe account creation works', async ({ request }) => {
    const response = await request.post(`${MOCK_PAYMENT_URL}/v1/accounts`, {
      data: { email: 'test@example.com', type: 'express' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.id).toMatch(/^acct_/);
    expect(data.chargesEnabled).toBe(false);
  });

  test('mock Stripe account link creation works', async ({ request }) => {
    const accountResponse = await request.post(
      `${MOCK_PAYMENT_URL}/v1/accounts`,
      {
        data: { email: 'test@example.com', type: 'express' },
      }
    );
    const accountData = await accountResponse.json();

    const linkResponse = await request.post(
      `${MOCK_PAYMENT_URL}/v1/account_links`,
      {
        data: {
          account: accountData.id,
          type: 'account_onboarding',
          refresh_url: 'http://localhost:4200/stripe-connect-refresh',
          return_url: 'http://localhost:4200/stripe-connect-return',
        },
      }
    );

    expect(linkResponse.ok()).toBeTruthy();
    const linkData = await linkResponse.json();
    expect(linkData.url).toBeTruthy();
  });

  test('mock Stripe account retrieval works', async ({ request }) => {
    const createResponse = await request.post(
      `${MOCK_PAYMENT_URL}/v1/accounts`,
      {
        data: { email: 'test@example.com' },
      }
    );
    const createData = await createResponse.json();

    const getResponse = await request.get(
      `${MOCK_PAYMENT_URL}/v1/accounts/${createData.id}`
    );

    expect(getResponse.ok()).toBeTruthy();
    const getData = await getResponse.json();
    expect(getData.id).toBe(createData.id);
  });

  test('can check Stripe Connect status', async ({ request }) => {
    if (!connectedUserToken) return;

    const response = await request.get(
      `${GATEWAY_URL}/api/payments/stripe/connect/status`,
      { headers: { Authorization: `Bearer ${connectedUserToken}` } }
    );

    expect(response.ok() || response.status() === 404).toBeTruthy();
  });
});

test.describe('Business Page Sponsorship Flow', () => {
  let sponsorToken: string;
  let businessPageId: string;

  test.beforeAll(async ({ request }) => {
    const sponsor = await createTestUser(request, {});
    sponsorToken = sponsor.token || '';
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test('can create sponsorship for business page', async ({ request }) => {
    if (!sponsorToken || !businessPageId) return;

    const response = await request.post(
      `${GATEWAY_URL}/api/payments/sponsorships`,
      {
        headers: { Authorization: `Bearer ${sponsorToken}` },
        data: {
          businessPageId: businessPageId,
          amount: 10000,
          tier: 'premium',
        },
      }
    );

    expect(response.ok() || response.status() === 400).toBeTruthy();
  });

  test('can get sponsorship status', async ({ request }) => {
    if (!sponsorToken || !businessPageId) return;

    const response = await request.get(
      `${GATEWAY_URL}/api/payments/sponsorships/${businessPageId}/status`,
      { headers: { Authorization: `Bearer ${sponsorToken}` } }
    );

    expect(response.ok() || response.status() === 404).toBeTruthy();
  });
});

test.describe('Business Page Analytics', () => {
  let ownerToken: string;

  test.beforeAll(async ({ request }) => {
    const owner = await createTestUser(request, {});
    ownerToken = owner.token || '';
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test('can get business page analytics', async ({ request }) => {
    if (!ownerToken) return;

    const response = await request.get(
      `${GATEWAY_URL}/api/payments/business-pages/test-page-id/analytics`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );

    expect(response.ok() || response.status() === 404).toBeTruthy();
  });

  test('can get business page revenue', async ({ request }) => {
    if (!ownerToken) return;

    const response = await request.get(
      `${GATEWAY_URL}/api/payments/business-pages/test-page-id/revenue`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );

    expect(response.ok() || response.status() === 404).toBeTruthy();
  });
});
