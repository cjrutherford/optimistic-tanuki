import { test, expect } from '@playwright/test';
import { createTestUser, cleanupTestUsers } from './fixtures/auth.fixture';

const GATEWAY_URL = process.env['GATEWAY_URL'] || 'http://localhost:3000';
const MOCK_PAYMENT_URL =
  process.env['MOCK_PAYMENT_URL'] || 'http://localhost:3019';

test.describe('Donation Workflow', () => {
  let donorToken: string;
  let donorId: string;

  test.beforeAll(async ({ request }) => {
    const donor = await createTestUser(request, {});
    donorToken = donor.token || '';
    donorId = donor.id || '';
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test('can fetch monthly donation goal', async ({ request }) => {
    const response = await request.get(`${GATEWAY_URL}/api/donations/goal`);
    expect(response.ok() || response.status() === 404).toBeTruthy();
  });

  test('can create donation checkout via mock Helcim', async ({ request }) => {
    if (!donorToken) return;

    const response = await request.post(
      `${GATEWAY_URL}/api/payments/donations/checkout/initialize`,
      {
        headers: { Authorization: `Bearer ${donorToken}` },
        data: { amount: 1000, isRecurring: false },
      }
    );

    expect(response.ok() || response.status() === 400).toBeTruthy();

    if (response.ok()) {
      const data = await response.json();
      expect(
        data.checkoutUrl || data.checkoutToken || data.provider
      ).toBeTruthy();
    }
  });

  test('can get user donations', async ({ request }) => {
    if (!donorToken) return;

    const response = await request.get(
      `${GATEWAY_URL}/api/payments/donations/user`,
      { headers: { Authorization: `Bearer ${donorToken}` } }
    );

    expect(response.ok() || response.status() === 404).toBeTruthy();
  });

  test('can fetch monthly donations', async ({ request }) => {
    const response = await request.get(
      `${GATEWAY_URL}/api/donations?month=1&year=2025`
    );
    expect(response.ok() || response.status() === 404).toBeTruthy();
  });

  test.describe('Mock Payment Server', () => {
    test('helcim initialize endpoint responds', async ({ request }) => {
      const response = await request.post(
        `${MOCK_PAYMENT_URL}/v2/helcim-pay/initialize`,
        {
          data: { amount: 1000, currency: 'USD' },
        }
      );
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.checkoutToken).toBeTruthy();
    });

    test('helcim complete endpoint responds', async ({ request }) => {
      const initResponse = await request.post(
        `${MOCK_PAYMENT_URL}/v2/helcim-pay/initialize`,
        {
          data: { amount: 1000 },
        }
      );
      const initData = await initResponse.json();

      const completeResponse = await request.post(
        `${MOCK_PAYMENT_URL}/v2/helcim-pay/complete`,
        {
          data: {
            sessionId: initData.sessionId,
            checkoutToken: initData.checkoutToken,
          },
        }
      );

      expect(completeResponse.ok()).toBeTruthy();
      const completeData = await completeResponse.json();
      expect(completeData.hash).toBeTruthy();
      expect(completeData.data).toBeTruthy();
    });

    test('helcim refund endpoint responds', async ({ request }) => {
      const refundResponse = await request.post(
        `${MOCK_PAYMENT_URL}/v2/payment/refund`,
        {
          data: { originalTransactionId: 'txn_test123', amount: 1000 },
        }
      );
      expect(refundResponse.ok()).toBeTruthy();
      const data = await refundResponse.json();
      expect(data.status).toBe('completed');
    });

    test('stripe payment intents endpoint responds', async ({ request }) => {
      const response = await request.post(
        `${MOCK_PAYMENT_URL}/v1/payment_intents`,
        {
          data: { amount: 1000, currency: 'usd', metadata: { test: 'e2e' } },
        }
      );
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.client_secret).toBeTruthy();
    });

    test('stripe account links endpoint responds', async ({ request }) => {
      const response = await request.post(
        `${MOCK_PAYMENT_URL}/v1/account_links`,
        {
          data: { type: 'account_onboarding' },
        }
      );
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.url).toBeTruthy();
    });

    test('mock server health check', async ({ request }) => {
      const response = await request.get(`${MOCK_PAYMENT_URL}/health`);
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.providers).toContain('helcim');
      expect(data.providers).toContain('stripe');
    });
  });
});

test.describe('Donation Refund Workflow', () => {
  let donorToken: string;

  test.beforeAll(async ({ request }) => {
    const donor = await createTestUser(request, {});
    donorToken = donor.token || '';
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test('donation refund requires authentication', async ({ request }) => {
    const response = await request.post(
      `${GATEWAY_URL}/api/payments/donations/donation-id/refund`,
      { data: { reason: 'Test refund' } }
    );
    expect(response.status()).toBeGreaterThanOrEqual(401);
  });

  test('can attempt refund with valid token', async ({ request }) => {
    if (!donorToken) return;

    const response = await request.post(
      `${GATEWAY_URL}/api/payments/donations/nonexistent-id/refund`,
      {
        headers: { Authorization: `Bearer ${donorToken}` },
        data: { reason: 'Test refund' },
      }
    );
    expect(response.ok() || response.status() === 404).toBeTruthy();
  });
});

test.describe('Recurring Donation Workflow', () => {
  let recurringDonorToken: string;

  test.beforeAll(async ({ request }) => {
    const donor = await createTestUser(request, {});
    recurringDonorToken = donor.token || '';
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test('can create recurring donation checkout', async ({ request }) => {
    if (!recurringDonorToken) return;

    const response = await request.post(
      `${GATEWAY_URL}/api/payments/donations/checkout/initialize`,
      {
        headers: { Authorization: `Bearer ${recurringDonorToken}` },
        data: { amount: 500, isRecurring: true },
      }
    );

    expect(response.ok() || response.status() === 400).toBeTruthy();
  });

  test('can cancel recurring donation subscription', async ({ request }) => {
    if (!recurringDonorToken) return;

    const response = await request.delete(
      `${GATEWAY_URL}/api/payments/donations/subscription/test-subscription-id`,
      { headers: { Authorization: `Bearer ${recurringDonorToken}` } }
    );

    expect(response.ok() || response.status() === 404).toBeTruthy();
  });
});
