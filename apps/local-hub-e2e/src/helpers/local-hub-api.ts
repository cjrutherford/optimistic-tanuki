import { APIRequestContext, APIResponse, expect, Page } from '@playwright/test';
import { getBaseUrl, getGatewayUrl } from '../fixtures/helpers';

const TEST_PASSWORD = 'TestPass123!';
export const LOCAL_HUB_HEADERS = {
  'X-ot-appscope': 'local-hub',
  'X-ot-app-id': 'local-hub',
};

export function localHubAuthHeaders(token: string): Record<string, string> {
  return { ...LOCAL_HUB_HEADERS, Authorization: `Bearer ${token}` };
}

export type LocalHubCommunity = {
  id?: string;
  slug?: string;
  localityType?: string;
  name?: string;
};

export type AuthSession = {
  token: string;
  email: string;
  userId: string;
  profileId: string;
};

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getGatewayUrl()}${normalizedPath}`;
}

export async function expectPageLoads(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);
  const body = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  expect(
    response?.status(),
    `GET ${path} returned an unexpected response. Body:\n${body}`
  ).toBeLessThan(400);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('body')).toBeVisible();
  const expectedPathname = new URL(path, page.url()).pathname;
  expect(
    new URL(page.url()).pathname,
    `GET ${path} redirected to ${page.url()}`
  ).toBe(expectedPathname);
  await expect(
    page.locator('.error-state, [data-error-state="true"]')
  ).toHaveCount(0);
}

export async function expectRedirectsToLogin(
  page: Page,
  path: string
): Promise<void> {
  const response = await page.goto(path);
  const body = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  expect(
    response?.status(),
    `GET ${path} returned an unexpected response. Body:\n${body}`
  ).toBeLessThan(400);
  await page.waitForLoadState('domcontentloaded');
  expect(page.url()).toContain('/login');
}

export async function getCommunities(
  request: APIRequestContext
): Promise<LocalHubCommunity[]> {
  const response = await request.get(apiUrl('/api/communities'), {
    headers: LOCAL_HUB_HEADERS,
  });
  expect(response.ok()).toBeTruthy();
  const communities = await response.json();
  expect(Array.isArray(communities)).toBeTruthy();
  return communities;
}

export function findCity(
  communities: LocalHubCommunity[]
): LocalHubCommunity | undefined {
  return communities.find((community) => community.localityType === 'city');
}

export function findCommunity(
  communities: LocalHubCommunity[]
): LocalHubCommunity | undefined {
  return communities.find(
    (community) => community.slug && community.localityType !== 'city'
  );
}

export function expectOkOrStatus(
  response: APIResponse,
  allowedStatuses: number[]
): void {
  expect(
    response.ok() || allowedStatuses.includes(response.status())
  ).toBeTruthy();
}

async function responseBody(response: APIResponse): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function assertResponseStatus(
  response: APIResponse,
  expectedStatus: number,
  operation: string,
  body: unknown
): void {
  expect(
    response.status(),
    `${operation} returned ${response.status()} instead of ${expectedStatus}. Body: ${JSON.stringify(
      body
    )}`
  ).toBe(expectedStatus);
}

export async function createAuthenticatedSession(
  request: APIRequestContext,
  options: { withBrowserCookie?: boolean } = {}
): Promise<AuthSession> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `authe2e_${suffix}@test.com`;

  const registerResponse = await request.post(
    apiUrl('/api/authentication/register'),
    {
      headers: LOCAL_HUB_HEADERS,
      data: {
        fn: 'Test',
        ln: 'User',
        email,
        password: TEST_PASSWORD,
        confirm: TEST_PASSWORD,
        bio: 'E2E test user',
      },
    }
  );
  const registerBody = await responseBody(registerResponse);
  assertResponseStatus(registerResponse, 201, 'Registration', registerBody);
  expect(registerBody, 'Registration response must include data').toMatchObject(
    { data: expect.anything() }
  );

  const loginResponse = await request.post(
    apiUrl('/api/authentication/login'),
    {
      headers: LOCAL_HUB_HEADERS,
      data: {
        email,
        password: TEST_PASSWORD,
      },
    }
  );

  const loginBody = (await responseBody(loginResponse)) as any;
  assertResponseStatus(loginResponse, 201, 'Token login', loginBody);
  const token =
    loginBody.data?.newToken || loginBody.newToken || loginBody.token;
  expect(
    token,
    `Token login response did not include a token. Body: ${JSON.stringify(
      loginBody
    )}`
  ).toEqual(expect.any(String));

  const sessionResponse = await request.get(
    apiUrl('/api/authentication/session'),
    {
      headers: localHubAuthHeaders(token),
    }
  );
  const sessionBody = (await responseBody(sessionResponse)) as any;
  assertResponseStatus(sessionResponse, 200, 'Session lookup', sessionBody);
  const userId = sessionBody.data?.userId;
  expect(
    userId,
    `Session lookup did not include userId. Body: ${JSON.stringify(
      sessionBody
    )}`
  ).toEqual(expect.any(String));
  const profileId = sessionBody.data?.profileId;
  expect(
    profileId,
    `Session lookup did not include profileId. Body: ${JSON.stringify(
      sessionBody
    )}`
  ).toMatch(/^[0-9a-f-]{36}$/i);

  if (options.withBrowserCookie) {
    // Use the same-origin Local Hub proxy for the browser session. This is the
    // cookie SSR contract; a gateway token or localStorage value is insufficient.
    const cookieLoginResponse = await request.post(
      `${getBaseUrl()}/api/authentication/login`,
      {
        headers: {
          ...LOCAL_HUB_HEADERS,
          'X-ot-session-mode': 'cookie',
        },
        data: { email, password: TEST_PASSWORD },
      }
    );
    const cookieLoginBody = await responseBody(cookieLoginResponse);
    assertResponseStatus(
      cookieLoginResponse,
      201,
      'Cookie login through Local Hub proxy',
      cookieLoginBody
    );
    expect(cookieLoginBody).not.toHaveProperty('data.newToken');
    const storedCookies = (await request.storageState()).cookies;
    const sessionCookie = storedCookies.find(
      (cookie) =>
        cookie.name === 'ot_session' &&
        cookie.domain === new URL(getBaseUrl()).hostname
    );
    expect(
      sessionCookie,
      `Cookie login did not establish ot_session. Body: ${JSON.stringify(
        cookieLoginBody
      )}`
    ).toMatchObject({
      name: 'ot_session',
      httpOnly: true,
      path: '/',
    });
  }

  return { email, token, userId, profileId };
}

export async function createCommunity(
  request: APIRequestContext,
  token: string,
  cityId: string
): Promise<LocalHubCommunity | undefined> {
  const response = await request.post(apiUrl('/api/communities'), {
    headers: localHubAuthHeaders(token),
    data: {
      name: `Test Community ${Date.now()}`,
      description: 'E2E Test Community',
      parentId: cityId,
      localityType: 'neighborhood',
    },
  });

  if (!response.ok()) {
    const body = await responseBody(response);
    throw new Error(
      `Create community returned ${response.status()} instead of 201. Body: ${JSON.stringify(
        body
      )}`
    );
  }

  expect(response.status()).toBe(201);

  return response.json();
}

export async function createPost(
  request: APIRequestContext,
  token: string,
  profileId: string,
  communityId: string,
  title: string
): Promise<{ id?: string; title?: string } | undefined> {
  const response = await request.post(apiUrl('/api/social/post'), {
    headers: localHubAuthHeaders(token),
    data: {
      title,
      content: 'This is a test post from E2E tests',
      profileId,
      communityId,
    },
  });

  const body = await responseBody(response);
  assertResponseStatus(response, 201, `Create post "${title}"`, body);
  return response.json();
}
