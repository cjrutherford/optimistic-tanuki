import {
  APIRequestContext,
  APIResponse,
  expect,
  Page,
} from '@playwright/test';
import { getGatewayUrl } from '../fixtures/helpers';

const TEST_PASSWORD = 'TestPass123!';

export type LocalHubCommunity = {
  id?: string;
  slug?: string;
  localityType?: string;
  name?: string;
};

export type AuthSession = {
  token: string;
  email: string;
};

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getGatewayUrl()}${normalizedPath}`;
}

export async function expectPageLoads(
  page: Page,
  path: string,
): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status()).toBeLessThan(400);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('body')).toBeVisible();
}

export async function expectRedirectsToLogin(
  page: Page,
  path: string,
): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status()).toBeLessThan(400);
  await page.waitForLoadState('domcontentloaded');
  expect(page.url()).toContain('/login');
}

export async function getCommunities(
  request: APIRequestContext,
): Promise<LocalHubCommunity[]> {
  const response = await request.get(apiUrl('/api/communities'));
  expect(response.ok()).toBeTruthy();
  const communities = await response.json();
  expect(Array.isArray(communities)).toBeTruthy();
  return communities;
}

export function findCity(
  communities: LocalHubCommunity[],
): LocalHubCommunity | undefined {
  return communities.find((community) => community.localityType === 'city');
}

export function findCommunity(
  communities: LocalHubCommunity[],
): LocalHubCommunity | undefined {
  return communities.find(
    (community) => community.slug && community.localityType !== 'city',
  );
}

export function expectOkOrStatus(
  response: APIResponse,
  allowedStatuses: number[],
): void {
  expect(
    response.ok() || allowedStatuses.includes(response.status()),
  ).toBeTruthy();
}

export async function createAuthenticatedSession(
  request: APIRequestContext,
): Promise<AuthSession> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `authe2e_${suffix}@test.com`;

  await request.post(apiUrl('/api/authentication/register'), {
    data: {
      fn: 'Test',
      ln: 'User',
      email,
      password: TEST_PASSWORD,
      confirm: TEST_PASSWORD,
      bio: 'E2E test user',
    },
  });

  const loginResponse = await request.post(apiUrl('/api/authentication/login'), {
    data: {
      email,
      password: TEST_PASSWORD,
    },
  });

  expect(loginResponse.ok()).toBeTruthy();
  const loginData = await loginResponse.json();
  const token = loginData.data?.newToken;
  expect(token).toBeTruthy();

  return { email, token };
}

export async function addAuthToken(
  page: Page,
  token: string,
): Promise<void> {
  await page.addInitScript((authToken) => {
    localStorage.setItem('ot-local-hub-authToken', authToken);
  }, token);
}

export async function createCommunity(
  request: APIRequestContext,
  token: string,
  cityId: string,
): Promise<LocalHubCommunity | undefined> {
  const response = await request.post(apiUrl('/api/communities'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      name: `Test Community ${Date.now()}`,
      description: 'E2E Test Community',
      parentId: cityId,
      localityType: 'neighborhood',
    },
  });

  if (!response.ok()) {
    expect([400, 403, 404, 409]).toContain(response.status());
    return undefined;
  }

  return response.json();
}

export async function createPost(
  request: APIRequestContext,
  token: string,
  communityId: string,
  title: string,
): Promise<{ id?: string; title?: string } | undefined> {
  const response = await request.post(apiUrl('/api/social/post'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      title,
      content: 'This is a test post from E2E tests',
      communityId,
    },
  });

  if (!response.ok()) {
    expectOkOrStatus(response, [400, 403, 404]);
    return undefined;
  }

  return response.json();
}
