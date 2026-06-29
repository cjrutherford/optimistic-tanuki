import axios from 'axios';
import { Logger } from '@nestjs/common';
import { pathToFileURL } from 'node:url';

export const OWNER_CONSOLE_SEED_USERS = [
  {
    email: 'test-owner@owner-console.local',
    firstName: 'Test',
    lastName: 'Owner',
    password: 'Password123!',
    bio: 'Development owner-console operator seeded for local platform bootstrap.',
  },
];

function extractToken(response) {
  return (
    response?.data?.token ||
    response?.data?.newToken ||
    response?.token ||
    response?.newToken ||
    ''
  );
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function seedOwnerConsoleUsers({
  httpClient,
  logger,
  users = OWNER_CONSOLE_SEED_USERS,
  appScope = 'owner-console',
}) {
  const authenticatedUsers = [];

  logger.log('=== Register and Login Owner Console Users ===');

  for (const userData of users) {
    try {
      logger.log(`Registering user: ${userData.email}`);
      await httpClient.post(
        '/authentication/register',
        {
          email: userData.email,
          fn: userData.firstName,
          ln: userData.lastName,
          password: userData.password,
          confirm: userData.password,
          bio: userData.bio,
        },
        {
          headers: {
            'x-ot-appscope': appScope,
          },
        }
      );
    } catch (registerError) {
      const errorMsg =
        registerError?.response?.data?.message || registerError?.message || '';
      const status = registerError?.response?.status;

      if (status === 409 || errorMsg.includes('already exists')) {
        logger.log(`User ${userData.email} already exists, logging in...`);
      } else {
        logger.warn(
          `Registration failed for ${userData.email} (status ${
            status ?? 'unknown'
          }): ${errorMsg}`
        );
      }
    }

    await sleep(100);

    try {
      logger.log(`Logging in user: ${userData.email}`);
      const loginResponse = await httpClient.post('/authentication/login', {
        email: userData.email,
        password: userData.password,
      });
      const data = loginResponse.data?.data || loginResponse.data;
      const token = extractToken(data);

      if (!token) {
        logger.warn(`No token received for ${userData.email}, skipping...`);
        continue;
      }

      authenticatedUsers.push({
        email: userData.email,
        token,
      });
    } catch (loginError) {
      logger.warn(
        `Login failed for ${userData.email}: ${
          loginError?.response?.data?.message ||
          loginError?.message ||
          'unknown error'
        }`
      );
    }
  }

  logger.log('=== Owner Console User Seed Complete ===');
  logger.log(`Successfully authenticated ${authenticatedUsers.length} users`);

  for (const user of authenticatedUsers) {
    const seedUser = users.find((candidate) => candidate.email === user.email);
    logger.log(`Email: ${user.email}, Password: ${seedUser?.password}`);
  }

  return authenticatedUsers;
}

export async function bootstrapOwnerConsoleSeed({
  gatewayUrl = process.env['GATEWAY_URL'] || 'http://ot_gateway:3000/api',
  appScope = process.env['APP_SCOPE'] || 'owner-console',
  logger = new Logger('OwnerConsoleSeedScript-HTTP'),
} = {}) {
  logger.log('=== Starting Owner Console User Seed ===');
  logger.log(`Gateway URL: ${gatewayUrl}`);
  logger.log(`App Scope: ${appScope}`);

  const httpClient = axios.create({
    baseURL: gatewayUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'x-ot-appscope': appScope,
    },
  });

  try {
    await httpClient.get('/health');
    logger.log('Gateway connectivity: OK');
  } catch (error) {
    logger.warn(
      `Gateway connectivity check failed: ${
        error?.message || error
      }. Continuing anyway...`
    );
  }

  return seedOwnerConsoleUsers({
    httpClient,
    logger,
    appScope,
  });
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  bootstrapOwnerConsoleSeed().catch((error) => {
    console.error('Owner console seed failed:', error);
    process.exit(1);
  });
}
