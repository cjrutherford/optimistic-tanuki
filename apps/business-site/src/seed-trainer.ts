import axios, { AxiosInstance } from 'axios';
import { Logger } from '@nestjs/common';

interface SeedUser {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  bio: string;
  profileName: string;
}

interface AuthenticatedUser {
  userId: string;
  profileId: string;
  token: string;
  email: string;
}

function extractProfileId(response: any): string {
  return (
    response?.data?.profileId ||
    response?.data?.profile?.id ||
    response?.data?.id ||
    response?.profileId ||
    response?.profile?.id ||
    response?.id ||
    ''
  );
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'owner@localbusiness.test',
    firstName: 'Jordan',
    lastName: 'Vale',
    password: 'BusinessOwnerPass123!',
    bio: 'Owner-operator focused on a polished online presence and a simple client portal for repeat customers.',
    profileName: 'Jordan Vale',
  },
  {
    email: 'client@localbusiness.test',
    firstName: 'Maya',
    lastName: 'Rivers',
    password: 'ClientPass123!',
    bio: 'Returning client using the portal to review services, updates, and business information.',
    profileName: 'Maya Rivers',
  },
];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bootstrap() {
  const logger = new Logger('BusinessSeedScript-HTTP');

  const gatewayUrl = process.env['GATEWAY_URL'] || 'http://ot_gateway:3000/api';
  const appScope = process.env['APP_SCOPE'] || 'business-site';

  logger.log(`=== Starting Business User Seed ===`);
  logger.log(`Gateway URL: ${gatewayUrl}`);
  logger.log(`App Scope: ${appScope}`);

  const httpClient: AxiosInstance = axios.create({
    baseURL: gatewayUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'x-ot-appscope': appScope,
    },
  });

  // Test connectivity
  try {
    await httpClient.get('/health');
    logger.log('Gateway connectivity: OK');
  } catch (e: any) {
    logger.warn(
      `Gateway connectivity check failed: ${e?.message}. Continuing anyway...`
    );
  }

  const authenticatedUsers: AuthenticatedUser[] = [];

  logger.log('=== Register and Login Business Users ===');

  for (const userData of SEED_USERS) {
    let userId: string | undefined;
    let token: string | undefined;
    let profileId: string | undefined;

    // Try to register
    try {
      logger.log(`Registering user: ${userData.email}`);
      const registerResponse = await httpClient.post(
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

      if (registerResponse.data?.data?.user?.id) {
        userId = registerResponse.data.data.user.id;
        logger.log(`Registered user: ${userData.email} (${userId})`);
      }
    } catch (registerError: any) {
      const errorMsg =
        registerError.response?.data?.message || registerError.message;
      const status = registerError.response?.status;

      if (status === 409 || errorMsg?.includes('already exists')) {
        logger.log(`User ${userData.email} already exists, logging in...`);
      } else {
        logger.warn(
          `Registration failed for ${userData.email} (status ${status}): ${errorMsg}`
        );
      }
    }

    await sleep(200);

    // Try to login
    try {
      logger.log(`Logging in user: ${userData.email}`);
      const loginResponse = await httpClient.post('/authentication/login', {
        email: userData.email,
        password: userData.password,
      });

      const data = loginResponse.data?.data || loginResponse.data;
      token = data?.token || data?.newToken;

      // There is no /authentication/me route on the gateway; decode the
      // userId directly from the JWT token payload instead.
      if ((!userId || !profileId) && token) {
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            userId =
              payload?.sub || payload?.userId || payload?.user_id || userId;
            logger.log(`Extracted userId from token: ${userId}`);
          }
        } catch (e) {
          logger.warn(`Could not decode token: ${e}`);
        }
      }

      if (!token) {
        logger.warn(`No token received for ${userData.email}, skipping...`);
        continue;
      }

      // Fetch or create profile
      if (userId && token) {
        try {
          let profileResponse;
          try {
            profileResponse = await httpClient.get(`/profile/user/${userId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch (e) {
            profileResponse = await httpClient.get(`/profile`, {
              headers: { Authorization: `Bearer ${token}` },
            });
          }

          const profiles =
            profileResponse.data?.data || profileResponse.data || [];
          const matchingProfile = Array.isArray(profiles)
            ? profiles.find((p: any) => p.userId === userId)
            : profiles;

          profileId = matchingProfile?.id || profileId;
          logger.log(`Found profileId: ${profileId}`);
        } catch (e: any) {
          logger.warn(
            `Could not fetch profile for ${userData.email}: ${
              e?.response?.data?.message || e.message
            }`
          );
        }
      }

      if (userId && !profileId && token) {
        try {
          const createProfileResponse = await httpClient.post(
            '/profile',
            {
              userId: userId,
              name: `${userData.firstName} ${userData.lastName}`,
              coverPic: '',
              profilePic: '',
              bio: userData.bio,
              location: '',
              description: '',
              occupation: '',
              interests: '',
              skills: '',
              appScope: appScope,
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          profileId = extractProfileId(createProfileResponse.data);
          logger.log(`Created profile: ${profileId}`);
        } catch (e: any) {
          logger.warn(
            `Could not create profile for ${userData.email}: ${
              e?.response?.data?.message || e.message
            }`
          );
        }
      }

      if (userId && profileId && token) {
        authenticatedUsers.push({
          userId,
          profileId,
          token,
          email: userData.email,
        });
        logger.log(
          `Logged in: ${userData.email} (userId: ${userId}, profileId: ${profileId})`
        );
      }
    } catch (loginError: any) {
      logger.warn(
        `Login failed for ${userData.email}: ${
          loginError.response?.data?.message || loginError.message
        }`
      );
    }

    await sleep(100);
  }

  logger.log(`=== Business User Seed Complete ===`);
  logger.log(`Successfully authenticated ${authenticatedUsers.length} users`);

  for (const user of authenticatedUsers) {
    logger.log(
      `Email: ${user.email}, Password: ${
        SEED_USERS.find((u) => u.email === user.email)?.password
      }`
    );
  }
}

bootstrap().catch((error) => {
  console.error('Business seed failed:', error);
  process.exit(1);
});
