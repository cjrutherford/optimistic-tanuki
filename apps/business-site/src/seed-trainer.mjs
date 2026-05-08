/**
 * Business User Seed Script
 * Plain ES module - runs in any Node.js environment without compilation.
 */

import pg from 'pg';

const logger = {
  log: (msg) => console.log(`[BusinessSeed] ${msg}`),
  warn: (msg) => console.warn(`[BusinessSeed] ${msg}`),
  error: (msg) => console.error(`[BusinessSeed] ${msg}`),
};

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://gateway:3000/api';
const APP_SCOPE = process.env.APP_SCOPE || 'business-site';
const { Client: PgClient } = pg;

const SEED_USERS = [
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
  {
    email: 'pending-client@localbusiness.test',
    firstName: 'Taylor',
    lastName: 'Quinn',
    password: 'PendingClientPass123!',
    bio: 'Prospective client waiting for business approval before booking.',
    profileName: 'Taylor Quinn',
  },
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-ot-appscope': APP_SCOPE,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

async function bootstrap() {
  logger.log(`=== Starting Business User Seed ===`);
  logger.log(`Gateway URL: ${GATEWAY_URL}`);
  logger.log(`App Scope: ${APP_SCOPE}`);

  const permissionsDb = new PgClient({
    host: process.env.POSTGRES_HOST || 'db',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.PERMISSIONS_DB || 'ot_permissions',
  });

  await permissionsDb.connect();

  // Test connectivity
  try {
    await fetchJson(`${GATEWAY_URL.replace(/\/api$/, '')}/api-docs`);
    logger.log('Gateway connectivity: OK');
  } catch (e) {
    logger.warn(`Gateway connectivity check failed: ${e.message}. Continuing anyway...`);
  }

  const authenticatedUsers = [];

  async function configureBusinessSite(owner) {
    logger.log('Configuring business-site lead context and public identity...');
    await fetchJson(`${GATEWAY_URL}/business/site-config`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({
        config: {
          brand: {
            businessName: 'North Star Advisory',
            ownerName: 'Jordan Vale',
            trainerName: 'Jordan Vale',
            monogram: 'NS',
            tagline: 'Operational guidance for growing service businesses.',
            intro: 'Clear scheduling, better client handoff, and a simpler approval flow.',
            longBio:
              'North Star Advisory helps service businesses turn interest into approved client relationships and well-structured engagements.',
            credentials: ['Operations strategy', 'Client systems'],
            specializations: ['Scheduling', 'Client onboarding'],
          },
        },
      }),
    });
  }

  async function createLeadForUser(owner, client, approved = false) {
    logger.log(
      `${approved ? 'Seeding accepted client lead' : 'Seeding queued client lead'} for ${client.email}`
    );

    const leadResponse = await fetchJson(`${GATEWAY_URL}/business/leads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${client.token}` },
      body: JSON.stringify({
        name: client.email === 'client@localbusiness.test' ? 'Maya Rivers' : 'Taylor Quinn',
        email: client.email,
        phone: '(555) 100-2000',
        goal: approved
          ? 'Schedule a strategy consultation'
          : 'Join the approval queue before scheduling',
        context: approved
          ? 'Accepted client used for real-booking validation.'
          : 'Pending client used for approval-queue validation.',
        preferredStart: '2026-05-10T10:00',
        preferredEnd: '2026-05-10T11:00',
      }),
    });

    if (approved && leadResponse?.data?.id) {
      await fetchJson(`${GATEWAY_URL}/business/owner/leads/${leadResponse.data.id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${owner.token}` },
      });
    }
  }

  async function seedAvailability(owner) {
    logger.log('Seeding recurring availability and a date-specific override...');

    await fetchJson(`${GATEWAY_URL}/business/owner/availabilities`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({
        dayOfWeek: 0,
        startTime: '09:00:00',
        endTime: '17:00:00',
        hourlyRate: 150,
        serviceType: 'Strategy consultation',
      }),
    });

    await fetchJson(`${GATEWAY_URL}/business/owner/availability-overrides`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({
        mode: 'blocked',
        startTime: '2026-05-10T12:00:00.000Z',
        endTime: '2026-05-10T13:00:00.000Z',
        hourlyRate: 150,
        serviceType: 'Strategy consultation',
      }),
    });
  }

  async function assignRole(profileId, roleName) {
    const result = await permissionsDb.query(
      `
        INSERT INTO "role_assignment" ("profileId", "roleId", "appScopeId", "created_at")
        SELECT $1, r.id, s.id, NOW()
        FROM "role" r
        JOIN "app_scope" s ON s.id = r."appScopeId"
        WHERE r.name = $2 AND s.name = $3
        ON CONFLICT ("roleId", "profileId", "appScopeId") DO NOTHING
        RETURNING id
      `,
      [profileId, roleName, APP_SCOPE]
    );

    if (!result.rowCount) {
      const roleCheck = await permissionsDb.query(
        `
          SELECT r.id
          FROM "role" r
          JOIN "app_scope" s ON s.id = r."appScopeId"
          WHERE r.name = $1 AND s.name = $2
          LIMIT 1
        `,
        [roleName, APP_SCOPE]
      );

      if (!roleCheck.rowCount) {
        throw new Error(`Role ${roleName} not found for ${APP_SCOPE}`);
      }
    }
  }

  function extractProfileId(response) {
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

  for (const userData of SEED_USERS) {
    let userId;
    let token;
    let profileId;

    // Try register
    try {
      logger.log(`Registering user: ${userData.email}`);
      const { status, data } = await fetchJson(`${GATEWAY_URL}/authentication/register`, {
        method: 'POST',
        body: JSON.stringify({
          email: userData.email,
          fn: userData.firstName,
          ln: userData.lastName,
          password: userData.password,
          confirm: userData.password,
          bio: userData.bio,
        }),
      });

      if (data?.data?.user?.id) {
        userId = data.data.user.id;
        logger.log(`Registered user: ${userData.email} (${userId})`);
      } else if (status === 409 || JSON.stringify(data).includes('already exists')) {
        logger.log(`User ${userData.email} already exists, will login...`);
      }
    } catch (err) {
      logger.warn(`Registration error for ${userData.email}: ${err.message}`);
    }

    await sleep(200);

    // Try login
    try {
      logger.log(`Logging in user: ${userData.email}`);
      const { data } = await fetchJson(`${GATEWAY_URL}/authentication/login`, {
        method: 'POST',
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
        }),
      });

      token = data?.data?.token || data?.data?.newToken || data?.token;

      if (!userId || !profileId) {
        try {
          const { data: meData } = await fetchJson(`${GATEWAY_URL}/authentication/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          userId = meData?.data?.userId || meData?.data?.id || userId;
        } catch (e) {
          logger.warn(`Could not fetch /authentication/me: ${e.message}`);
        }
      }

      if (!userId && token) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            userId = payload?.sub || payload?.userId || payload?.user_id;
            logger.log(`Extracted userId from token: ${userId}`);
          }
        } catch (e) {
          logger.warn(`Could not decode token: ${e.message}`);
        }
      }

      if (!token) {
        logger.warn(`No token received for ${userData.email}, skipping...`);
        continue;
      }

      // Fetch or create profile
      if (userId && token) {
        try {
          let profileRes;
          try {
            profileRes = await fetchJson(`${GATEWAY_URL}/profile/user/${userId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch (e) {
            profileRes = await fetchJson(`${GATEWAY_URL}/profile`, {
              headers: { Authorization: `Bearer ${token}` },
            });
          }

          const profiles = profileRes.data?.data || profileRes.data || [];
          const matchingProfile = Array.isArray(profiles)
            ? profiles.find((p) => p.userId === userId)
            : profiles;

          profileId = matchingProfile?.id || profileId;
          logger.log(`Found profileId: ${profileId}`);
        } catch (e) {
          logger.warn(`Could not fetch profile for ${userData.email}: ${e.message}`);
        }
      }

      if (userId && !profileId && token) {
        try {
          const { data: createdProfile } = await fetchJson(`${GATEWAY_URL}/profile`, {
            method: 'POST',
            body: JSON.stringify({
              userId,
              name: `${userData.firstName} ${userData.lastName}`,
              coverPic: '',
              profilePic: '',
              bio: userData.bio,
              location: '',
              description: '',
              occupation: '',
              interests: '',
              skills: '',
              appScope: APP_SCOPE,
            }),
            headers: { Authorization: `Bearer ${token}` },
          });
          profileId = extractProfileId(createdProfile) || profileId;
          logger.log(`Created profile: ${profileId}`);
        } catch (e) {
          logger.warn(`Could not create profile for ${userData.email}: ${e.message}`);
        }
      }

      if (userId && profileId && token) {
        const roleName =
          userData.email === 'owner@localbusiness.test'
            ? 'business_site_owner'
            : 'business_site_client';

        try {
          await assignRole(profileId, roleName);
          logger.log(`Assigned role ${roleName} to ${userData.email}`);
        } catch (error) {
          logger.error(`Could not assign ${roleName} to ${userData.email}: ${error.message}`);
          throw error;
        }

        authenticatedUsers.push({ userId, profileId, token, email: userData.email });
        logger.log(`Authenticated: ${userData.email} (userId: ${userId}, profileId: ${profileId})`);
      }
    } catch (err) {
      logger.warn(`Login failed for ${userData.email}: ${err.message}`);
    }

    await sleep(100);
  }

  logger.log(`=== Business User Seed Complete ===`);
  logger.log(`Successfully authenticated ${authenticatedUsers.length} users`);

  const owner = authenticatedUsers.find((user) => user.email === 'owner@localbusiness.test');
  const acceptedClient = authenticatedUsers.find(
    (user) => user.email === 'client@localbusiness.test'
  );
  const pendingClient = authenticatedUsers.find(
    (user) => user.email === 'pending-client@localbusiness.test'
  );

  if (owner && acceptedClient && pendingClient) {
    await configureBusinessSite(owner);
    await seedAvailability(owner);
    await createLeadForUser(owner, acceptedClient, true);
    await createLeadForUser(owner, pendingClient, false);
  } else {
    logger.warn('Skipping client-acceptance seed setup because one or more users are missing.');
  }

  for (const user of authenticatedUsers) {
    const seedUser = SEED_USERS.find((u) => u.email === user.email);
    logger.log(`Email: ${user.email}, Password: ${seedUser?.password}`);
  }

  await permissionsDb.end();
}

bootstrap().catch((err) => {
  console.error('Business seed failed:', err);
  process.exit(1);
});
