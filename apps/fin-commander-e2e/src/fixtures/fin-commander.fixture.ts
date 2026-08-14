import {
  test as base,
  request as playwrightRequest,
  type APIRequestContext,
} from '@playwright/test';
import { Pool } from 'pg';
import { createDbPool } from '../support/db';
import { waitForFinCommander, waitForGateway, getGatewayUrl } from './helpers';

export interface FinCommanderTestUser {
  id: string;
  email: string;
  username: string;
  password: string;
  token?: string;
}

export interface FinCommanderFixtureContext {
  testUser: FinCommanderTestUser;
  apiContext: APIRequestContext;
  dbPool: Pool | null;
}

export async function createTestUser(
  apiContext: APIRequestContext,
  overrides?: Partial<FinCommanderTestUser>
): Promise<FinCommanderTestUser> {
  const timestamp = Date.now();
  const user: FinCommanderTestUser = {
    id: '',
    email: overrides?.email || `fc-e2e-${timestamp}@example.com`,
    username: overrides?.username || `fc-e2e-${timestamp}`,
    password: overrides?.password || 'TestPassword123!',
  };

  const response = await apiContext.post('/api/authentication/register', {
    data: {
      email: user.email,
      fn: 'Fin',
      ln: user.username,
      password: user.password,
      confirm: user.password,
      bio: '',
    },
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    throw new Error(
      `Registration failed: ${response.status()} ${await response.text()}`
    );
  }

  const data = await response.json();
  user.id = data.data?.user?.id || data.id || data.user?.id || '';
  user.token = data.data?.newToken || data.token || data.newToken;

  return user;
}

export async function loginTestUser(
  apiContext: APIRequestContext,
  user: FinCommanderTestUser
): Promise<string> {
  const response = await apiContext.post('/api/authentication/login', {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()}`);
  }

  const data = await response.json();
  user.token = data.data?.newToken || data.newToken || data.token;
  return user.token as string;
}

export async function createFinanceDbPool(): Promise<Pool> {
  return createDbPool({ database: 'ot_finance' });
}

export const test = base.extend<FinCommanderFixtureContext>({
  apiContext: async ({ baseURL }, use) => {
    void baseURL;
    await waitForGateway();
    const apiContext = await playwrightRequest.newContext({
      baseURL: getGatewayUrl(),
      extraHTTPHeaders: {
        'content-type': 'application/json',
        'x-ot-appscope': 'finance',
      },
    });

    try {
      await use(apiContext);
    } finally {
      await apiContext.dispose();
    }
  },
  testUser: async ({ apiContext }, use) => {
    await waitForFinCommander();
    const user = await createTestUser(apiContext);
    await use(user);
  },
  dbPool: async ({ baseURL }, use) => {
    void baseURL;
    let dbPool: Pool | null = null;

    try {
      dbPool = await createFinanceDbPool();
      await use(dbPool);
    } finally {
      if (dbPool) {
        await dbPool.end();
      }
    }
  },
});

export { expect } from '@playwright/test';
