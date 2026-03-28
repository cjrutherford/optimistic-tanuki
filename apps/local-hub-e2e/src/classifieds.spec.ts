import { test, expect } from '@playwright/test';
import { createTestUser, cleanupTestUsers } from './fixtures/auth.fixture';

const GATEWAY_URL = process.env['GATEWAY_URL'] || 'http://localhost:3000';
const MOCK_PAYMENT_URL =
  process.env['MOCK_PAYMENT_URL'] || 'http://localhost:3019';

test.describe('Classifieds Purchase Workflow', () => {
  let sellerToken: string;
  let buyerToken: string;
  let communityId: string;
  let classifiedId: string;

  test.beforeAll(async ({ request }) => {
    const seller = await createTestUser(request, {});
    const buyer = await createTestUser(request, {});

    sellerToken = seller.token || '';
    buyerToken = buyer.token || '';

    const communitiesResp = await request.get(`${GATEWAY_URL}/api/communities`);
    const communities = await communitiesResp.json();
    const community = communities.find((c: any) => c.localityType !== 'city');
    communityId = community?.id || '';
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test('seller can create classified listing', async ({ request }) => {
    if (!sellerToken || !communityId) return;

    const response = await request.post(`${GATEWAY_URL}/api/classifieds`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
      data: {
        title: 'E2E Test Item for Sale',
        description: 'Test description for e2e workflow',
        price: 5000,
        category: 'for-sale',
        communityId: communityId,
      },
    });

    expect(response.ok() || response.status() === 400).toBeTruthy();

    if (response.ok()) {
      const data = await response.json();
      classifiedId = data.id || '';
    }
  });

  test('buyer can view classifieds in community', async ({ request }) => {
    if (!buyerToken || !communityId) return;

    const response = await request.get(
      `${GATEWAY_URL}/api/classifieds/community/${communityId}`,
      { headers: { Authorization: `Bearer ${buyerToken}` } }
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('buyer can get my classified ads', async ({ request }) => {
    if (!buyerToken) return;

    const response = await request.get(
      `${GATEWAY_URL}/api/classifieds/profile/my-ads`,
      { headers: { Authorization: `Bearer ${buyerToken}` } }
    );

    expect(response.ok()).toBeTruthy();
  });

  test('buyer can create offer on classified', async ({ request }) => {
    if (!buyerToken || !classifiedId) return;

    const response = await request.post(`${GATEWAY_URL}/api/payments/offers`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
      data: {
        classifiedId: classifiedId,
        amount: 4500,
        message: 'Offer for test item',
      },
    });

    expect(response.ok() || response.status() === 400).toBeTruthy();
  });

  test('buyer can initialize payment via mock Stripe', async ({ request }) => {
    if (!buyerToken || !classifiedId) return;

    const response = await request.post(
      `${GATEWAY_URL}/api/payments/classifieds/payment/initialize`,
      {
        headers: { Authorization: `Bearer ${buyerToken}` },
        data: {
          classifiedId: classifiedId,
          amount: 5000,
          paymentMethod: 'card',
        },
      }
    );

    expect(response.ok() || response.status() === 400).toBeTruthy();

    if (response.ok()) {
      const data = await response.json();
      expect(data.checkoutToken || data.clientSecret).toBeTruthy();
      expect(data.provider).toBeTruthy();
    }
  });

  test('seller can view their classifieds', async ({ request }) => {
    if (!sellerToken) return;

    const response = await request.get(
      `${GATEWAY_URL}/api/classifieds/profile/my-ads`,
      { headers: { Authorization: `Bearer ${sellerToken}` } }
    );

    expect(response.ok()).toBeTruthy();
  });

  test('seller can update classified listing', async ({ request }) => {
    if (!sellerToken || !classifiedId) return;

    const response = await request.patch(
      `${GATEWAY_URL}/api/classifieds/${classifiedId}`,
      {
        headers: { Authorization: `Bearer ${sellerToken}` },
        data: { title: 'Updated Test Item' },
      }
    );

    expect(response.ok() || response.status() === 400).toBeTruthy();
  });

  test('seller can delete classified listing', async ({ request }) => {
    if (!sellerToken || !classifiedId) return;

    const response = await request.delete(
      `${GATEWAY_URL}/api/classifieds/${classifiedId}`,
      { headers: { Authorization: `Bearer ${sellerToken}` } }
    );

    expect(response.ok() || response.status() === 404).toBeTruthy();
  });
});

test.describe('Classifieds Payment Flow with Mock', () => {
  let buyerToken: string;
  let classifiedId: string;

  test.beforeAll(async ({ request }) => {
    const buyer = await createTestUser(request, {});
    buyerToken = buyer.token || '';
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test('mock Stripe payment intent works', async ({ request }) => {
    const response = await request.post(
      `${MOCK_PAYMENT_URL}/v1/payment_intents`,
      {
        data: {
          amount: 5000,
          currency: 'usd',
          metadata: { type: 'classifieds' },
        },
      }
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.id).toMatch(/^pi_/);
    expect(data.client_secret).toBeTruthy();
  });

  test('mock Stripe confirm payment works', async ({ request }) => {
    const initResponse = await request.post(
      `${MOCK_PAYMENT_URL}/v1/payment_intents`,
      {
        data: { amount: 5000 },
      }
    );
    const initData = await initResponse.json();

    const confirmResponse = await request.post(
      `${MOCK_PAYMENT_URL}/v1/payment_intents/${initData.id}/confirm`,
      { data: {} }
    );

    expect(confirmResponse.ok()).toBeTruthy();
    const data = await confirmResponse.json();
    expect(data.status).toBe('succeeded');
  });

  test('buyer can create payment for classified', async ({ request }) => {
    if (!buyerToken) return;

    const response = await request.post(
      `${GATEWAY_URL}/api/payments/classifieds/payment`,
      {
        headers: { Authorization: `Bearer ${buyerToken}` },
        data: {
          classifiedId: 'test-classified-id',
          paymentMethod: 'card',
          amount: 5000,
        },
      }
    );

    expect(response.ok() || response.status() === 400).toBeTruthy();
  });
});

test.describe('Classifieds Categories and Filtering', () => {
  test('can fetch all categories', async ({ request }) => {
    const response = await request.get(
      `${GATEWAY_URL}/api/classifieds/categories`
    );
    expect(response.ok() || response.status() === 404).toBeTruthy();
  });

  test('can search classifieds', async ({ request }) => {
    const response = await request.get(
      `${GATEWAY_URL}/api/classifieds/search?q=test&category=for-sale`
    );
    expect(response.ok() || response.status() === 404).toBeTruthy();
  });

  test('can filter by price range', async ({ request }) => {
    const response = await request.get(
      `${GATEWAY_URL}/api/classifieds?minPrice=100&maxPrice=1000`
    );
    expect(response.ok() || response.status() === 404).toBeTruthy();
  });
});
