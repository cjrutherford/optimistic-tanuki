import axios, { AxiosInstance } from 'axios';

/**
 * Billing gateway E2E (O5).
 *
 * Live-stack scope is deliberately narrow: these specs need no billing
 * microservice running. Auth-guard (401) and DTO-validation (400) behavior
 * execute before any TCP hop, so they prove the route is mounted and guarded
 * in the composed gateway. The happy path (201 via TCP) is covered by
 * `billing.controller.spec.ts` with a mocked client, and the
 * disabled-composition fallback (route absent / disabled proxy) by
 * `gateway-service-providers.spec.ts` — the e2e stack always boots the full
 * composition, so "disabled" cannot be observed live.
 *
 * Requires the live stack (`BASE_URL`, default http://localhost:3000).
 * Not runnable without it: global setup waits for the gateway port.
 */
describe('Billing gateway (O5 mount)', () => {
  jest.setTimeout(60000);
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const api: AxiosInstance = axios.create({
    baseURL: `${baseURL}/api`,
    headers: {
      'x-ot-appscope': 'client-interface',
      'x-ot-app-id': 'client-interface',
    },
    validateStatus: () => true,
  });

  const testUser = {
    email: `test-billing-${Date.now()}@example.com`,
    fn: 'Billing',
    ln: 'Test',
    password: 'Test@Password123',
    confirm: 'Test@Password123',
    bio: 'Billing mount probe',
  };

  let authToken: string;

  beforeAll(async () => {
    const registerRes = await api.post('/authentication/register', testUser);
    expect(registerRes.status).toBe(201);
    const loginRes = await api.post('/authentication/login', {
      email: testUser.email,
      password: testUser.password,
    });
    expect(loginRes.status).toBe(201);
    authToken = loginRes.data?.data?.newToken;
    expect(authToken).toBeDefined();
  });

  function authenticated(): AxiosInstance {
    return axios.create({
      baseURL: `${baseURL}/api`,
      headers: {
        'x-ot-appscope': 'client-interface',
        'x-ot-app-id': 'client-interface',
        Authorization: `Bearer ${authToken}`,
      },
      validateStatus: () => true,
    });
  }

  it('denies unauthenticated usage recording with 401 (route mounted, guarded)', async () => {
    const res = await api.post('/billing/usage/record', {
      tenantId: 'tenant-1',
      appScope: 'finance',
      meterId: 'meter-1',
      eventKey: 'api.call',
      quantity: 1,
    });

    // 401 proves the billing controller is mounted in the composed gateway:
    // an unmounted route would answer 404.
    expect(res.status).toBe(401);
  });

  it('rejects invalid usage payloads with 400 (DTO validation live)', async () => {
    const res = await authenticated().post('/billing/usage/record', {
      tenantId: 'tenant-1',
    });

    expect(res.status).toBe(400);
  });

  it('rejects invalid preview payloads with 400', async () => {
    const res = await authenticated().post('/billing/invoices/preview', {
      currency: 'USD',
    });

    expect(res.status).toBe(400);
  });
});
