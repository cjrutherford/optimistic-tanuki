import { test as base, Page, APIRequestContext } from '@playwright/test';
import { Pool } from 'pg';

export interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string;
  token?: string;
}

export interface TestContext {
  testUser: TestUser;
  dbPool: Pool | null;
  apiContext: APIRequestContext;
}

const testUsers: TestUser[] = [];

export async function createTestUser(
  request: APIRequestContext,
  overrides?: Partial<TestUser>
): Promise<TestUser> {
  const timestamp = Date.now();
  const user: TestUser = {
    id: '',
    email: overrides?.email || `testuser${timestamp}@example.com`,
    username: overrides?.username || `testuser${timestamp}`,
    password: overrides?.password || 'TestPassword123!',
  };

  const response = await request.post('/api/authentication/register', {
    data: {
      email: user.email,
      username: user.username,
      password: user.password,
      confirmPassword: user.password,
    },
    failOnStatusCode: false,
  });

  if (response.ok()) {
    const data = await response.json();
    user.id = data.id || data.user?.id || '';
    user.token = data.token || data.newToken;
  } else {
    const errorText = await response.text();
    console.warn(`User creation warning: ${errorText}`);
  }

  testUsers.push(user);
  return user;
}

export async function loginTestUser(
  request: APIRequestContext,
  user: TestUser
): Promise<string> {
  const response = await request.post('/api/authentication/login', {
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
  return user.token;
}

export async function cleanupTestUsers(): Promise<void> {
  testUsers.length = 0;
}

export async function createDbPool(): Promise<Pool> {
  return new Pool({
    host: process.env['POSTGRES_HOST'] || 'localhost',
    port: parseInt(process.env['POSTGRES_PORT'] || '5432'),
    user: process.env['POSTGRES_USER'] || 'postgres',
    password: process.env['POSTGRES_PASSWORD'] || 'postgres',
    database: process.env['POSTGRES_DB'] || 'ot_local_hub',
  });
}

export async function queryDb(
  pool: Pool,
  text: string,
  values?: unknown[]
): Promise<unknown[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, values);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function verifyUserInDb(
  pool: Pool,
  email: string
): Promise<boolean> {
  const rows = await queryDb(
    pool,
    'SELECT id, email FROM users WHERE email = $1',
    [email]
  );
  return rows.length > 0;
}

export async function verifyCommunityMembership(
  pool: Pool,
  userId: string,
  communityId: string
): Promise<boolean> {
  const rows = await queryDb(
    pool,
    'SELECT 1 FROM community_members WHERE user_id = $1 AND community_id = $2',
    [userId, communityId]
  );
  return rows.length > 0;
}

export const test = base.extend<TestContext>({
  testUser: async ({ request }, use) => {
    const user = await createTestUser(request);
    await use(user);
  },
  dbPool: async ({}, use) => {
    let pool: Pool | null = null;
    try {
      pool = await createDbPool();
      await use(pool);
    } finally {
      if (pool) {
        await pool.end();
      }
    }
  },
});
