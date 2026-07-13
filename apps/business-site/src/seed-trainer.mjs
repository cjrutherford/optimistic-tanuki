/**
 * Business User Seed Script
 * Plain ES module - runs in any Node.js environment without compilation.
 */

import pg from 'pg';
import {
  DEV_BUSINESS_TENANT_PRESETS,
  PRIMARY_WORKFLOW_TENANT_SLUG,
  WORKFLOW_CLIENT_USERS,
} from './sample-tenants.mjs';

const logger = {
  log: (msg) => console.log(`[BusinessSeed] ${msg}`),
  warn: (msg) => console.warn(`[BusinessSeed] ${msg}`),
  error: (msg) => console.error(`[BusinessSeed] ${msg}`),
};

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://gateway:3000/api';
const APP_SCOPE = process.env.APP_SCOPE || 'business-site';
const { Client: PgClient } = pg;
const OWNER_EMAILS = new Set(
  DEV_BUSINESS_TENANT_PRESETS.map((tenant) => tenant.owner.email)
);
const SEED_USERS = [
  ...DEV_BUSINESS_TENANT_PRESETS.map((tenant) => tenant.owner),
  ...WORKFLOW_CLIENT_USERS,
];
const DEV_BUSINESS_LOCALITY_SLUGS = [
  'savannah-ga',
  'savannah-starland-district',
  'augusta-ga',
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
  const storeDb = new PgClient({
    host: process.env.POSTGRES_HOST || 'db',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.STORE_DB || 'ot_store',
  });
  const paymentsDb = new PgClient({
    host: process.env.POSTGRES_HOST || 'db',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.PAYMENTS_DB || 'ot_payments',
  });

  await permissionsDb.connect();
  await storeDb.connect();
  await paymentsDb.connect();

  // Test connectivity
  try {
    await fetchJson(`${GATEWAY_URL.replace(/\/api$/, '')}/api-docs`);
    logger.log('Gateway connectivity: OK');
  } catch (e) {
    logger.warn(
      `Gateway connectivity check failed: ${e.message}. Continuing anyway...`
    );
  }

  const authenticatedUsers = [];

  function extractToken(response) {
    return (
      response?.data?.newToken ||
      response?.data?.token ||
      response?.newToken ||
      response?.token ||
      ''
    );
  }

  function decodeJwtPayload(token) {
    try {
      const [, payload] = token.split('.');
      return JSON.parse(Buffer.from(payload, 'base64').toString());
    } catch {
      return {};
    }
  }

  async function upsertBusinessSiteConfig(tenant, ownerProfileId, ownerUserId) {
    logger.log(`Upserting hosted site config for ${tenant.site.slug}...`);

    const site = {
      ...tenant.site,
      ownerProfileId,
      ownerUserId,
    };
    const leadContext = {
      profileId: ownerProfileId,
      appScope: APP_SCOPE,
    };

    await storeDb.query(
      `
        INSERT INTO "trainer_site_configs" (
          "configKey",
          "businessType",
          "site",
          "leadContext",
          "brand",
          "contact",
          "features",
          "serviceCatalog",
          "services",
          "landingPage",
          "clientPortal",
          "testimonials",
          "theme",
          "updatedAt"
        )
        VALUES (
          $1,
          $2,
          $3::jsonb,
          $4::jsonb,
          $5::jsonb,
          $6::jsonb,
          $7::jsonb,
          $8::jsonb,
          $9::jsonb,
          $10::jsonb,
          $11::jsonb,
          $12::jsonb,
          $13::jsonb,
          NOW()
        )
        ON CONFLICT ("configKey") DO UPDATE SET
          "businessType" = EXCLUDED."businessType",
          "site" = EXCLUDED."site",
          "leadContext" = EXCLUDED."leadContext",
          "brand" = EXCLUDED."brand",
          "contact" = EXCLUDED."contact",
          "features" = EXCLUDED."features",
          "serviceCatalog" = EXCLUDED."serviceCatalog",
          "services" = EXCLUDED."services",
          "landingPage" = EXCLUDED."landingPage",
          "clientPortal" = EXCLUDED."clientPortal",
          "testimonials" = EXCLUDED."testimonials",
          "theme" = EXCLUDED."theme",
          "updatedAt" = NOW()
      `,
      [
        tenant.configKey,
        tenant.businessType,
        JSON.stringify(site),
        JSON.stringify(leadContext),
        JSON.stringify(tenant.brand),
        JSON.stringify(tenant.contact),
        JSON.stringify(tenant.features),
        JSON.stringify(tenant.serviceCatalog),
        JSON.stringify(tenant.services),
        JSON.stringify(tenant.landingPage),
        JSON.stringify(tenant.clientPortal),
        JSON.stringify(tenant.testimonials),
        JSON.stringify(tenant.theme),
      ]
    );
  }

  async function createLeadForUser(owner, client, approved = false) {
    logger.log(
      `${
        approved ? 'Seeding accepted client lead' : 'Seeding queued client lead'
      } for ${client.email}`
    );

    const leadResponse = await fetchJson(`${GATEWAY_URL}/business/leads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${client.token}` },
      body: JSON.stringify({
        name:
          client.email === 'client@localbusiness.test'
            ? 'Maya Rivers'
            : 'Taylor Quinn',
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
      await fetchJson(
        `${GATEWAY_URL}/business/owner/leads/${leadResponse.data.id}/approve`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${owner.token}` },
        }
      );
    }
  }

  async function seedAvailability(owner) {
    logger.log(
      'Seeding recurring availability and a date-specific override...'
    );

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

  async function loadCommunityAnchor(slug) {
    const { status, data } = await fetchJson(
      `${GATEWAY_URL}/communities/slug/${slug}`
    );
    if (status >= 400 || !data?.id) {
      throw new Error(`Could not resolve community slug ${slug}`);
    }

    return {
      id: data.id,
      slug: data.slug || slug,
      lat: Number(data.lat),
      lng: Number(data.lng),
    };
  }

  function withOffset(anchor, index) {
    const offset = 0.0025 + index * 0.0015;
    return {
      lat: Number((anchor.lat + offset).toFixed(6)),
      lng: Number((anchor.lng - offset).toFixed(6)),
    };
  }

  async function upsertBusinessPageSeed(tenant, owner, locality, index) {
    const coordinates = withOffset(locality, index);
    const description =
      tenant.brand?.longBio ||
      tenant.brand?.intro ||
      tenant.owner?.bio ||
      tenant.businessType;

    const result = await paymentsDb.query(
      `
        INSERT INTO "business_pages" (
          "communityId",
          "ownerId",
          "name",
          "description",
          "website",
          "phone",
          "email",
          "address",
          "tier",
          "subscriptionStatus",
          "isFeatured",
          "anchorLat",
          "anchorLng",
          "updatedAt"
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          'active',
          true,
          $10,
          $11,
          NOW()
        )
        ON CONFLICT ("communityId") DO UPDATE SET
          "ownerId" = EXCLUDED."ownerId",
          "name" = EXCLUDED."name",
          "description" = EXCLUDED."description",
          "website" = EXCLUDED."website",
          "phone" = EXCLUDED."phone",
          "email" = EXCLUDED."email",
          "address" = EXCLUDED."address",
          "tier" = EXCLUDED."tier",
          "subscriptionStatus" = EXCLUDED."subscriptionStatus",
          "isFeatured" = EXCLUDED."isFeatured",
          "anchorLat" = EXCLUDED."anchorLat",
          "anchorLng" = EXCLUDED."anchorLng",
          "updatedAt" = NOW()
        RETURNING "id", "communityId"
      `,
      [
        locality.id,
        owner.userId,
        tenant.brand.businessName,
        description,
        `https://${tenant.site.slug}.local`,
        tenant.contact.phone,
        tenant.contact.email,
        `${locality.slug.replace(/-/g, ' ')}, local service area`,
        index === 0 ? 'enterprise' : 'pro',
        coordinates.lat,
        coordinates.lng,
      ]
    );

    return result.rows[0];
  }

  async function seedAdvertisingCampaign(
    tenant,
    owner,
    businessPage,
    locality
  ) {
    const campaignName = `${tenant.brand.businessName} local launch`;

    await paymentsDb.query(
      `
        DELETE FROM "advertising_campaigns"
        WHERE "businessPageId" = $1
      `,
      [businessPage.id]
    );

    const campaign = await paymentsDb.query(
      `INSERT INTO "advertising_campaigns" ("businessPageId", "userId", "name", "status", "startsAt", "endsAt")
       VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '90 days') RETURNING "id"`,
      [businessPage.id, owner.userId, campaignName]
    );
    const campaignId = campaign.rows[0].id;
    await paymentsDb.query(
      `INSERT INTO "advertising_campaign_creatives" ("campaignId", "placementType", "headline", "body", "ctaLabel", "ctaUrl")
       VALUES ($1, 'on-page', $2, $3, 'Learn more', $4)`,
      [
        campaignId,
        tenant.brand.businessName,
        tenant.brand.tagline,
        `https://${tenant.site.slug}.local`,
      ]
    );
    await paymentsDb.query(
      `INSERT INTO "advertising_campaign_target_placements" ("campaignId", "targetType", "targetId", "placementType")
       VALUES ($1, 'community', $2, 'on-page')`,
      [campaignId, locality.id]
    );
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
      const { status, data } = await fetchJson(
        `${GATEWAY_URL}/authentication/register`,
        {
          method: 'POST',
          body: JSON.stringify({
            email: userData.email,
            fn: userData.firstName,
            ln: userData.lastName,
            password: userData.password,
            confirm: userData.password,
            bio: userData.bio,
          }),
        }
      );

      if (data?.data?.user?.id) {
        userId = data.data.user.id;
        logger.log(`Registered user: ${userData.email} (${userId})`);
      } else if (
        status === 409 ||
        JSON.stringify(data).includes('already exists')
      ) {
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

      token = extractToken(data);

      if (!token) {
        logger.warn(`No token received for ${userData.email}, skipping...`);
        continue;
      }

      const tokenPayload = decodeJwtPayload(token);
      userId =
        userId ||
        tokenPayload?.userId ||
        tokenPayload?.sub ||
        tokenPayload?.user_id;
      if (userId) {
        logger.log(`Resolved userId: ${userId}`);
      }

      try {
        const { data: exchangeData } = await fetchJson(
          `${GATEWAY_URL}/authentication/exchange`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              targetAppId: APP_SCOPE,
            }),
          }
        );
        profileId = extractProfileId(exchangeData) || profileId;
        token = extractToken(exchangeData) || token;
        logger.log(`Resolved profileId via exchange: ${profileId}`);
      } catch (e) {
        logger.warn(
          `Could not exchange token for ${userData.email}: ${e.message}`
        );
      }

      if (userId && profileId && token) {
        const roleName = OWNER_EMAILS.has(userData.email)
          ? 'business_site_owner'
          : 'business_site_client';

        try {
          await assignRole(profileId, roleName);
          logger.log(`Assigned role ${roleName} to ${userData.email}`);
        } catch (error) {
          logger.error(
            `Could not assign ${roleName} to ${userData.email}: ${error.message}`
          );
          throw error;
        }

        authenticatedUsers.push({
          userId,
          profileId,
          token,
          email: userData.email,
        });
        logger.log(
          `Authenticated: ${userData.email} (userId: ${userId}, profileId: ${profileId})`
        );
      }
    } catch (err) {
      logger.warn(`Login failed for ${userData.email}: ${err.message}`);
    }

    await sleep(100);
  }

  logger.log(`=== Business User Seed Complete ===`);
  logger.log(`Successfully authenticated ${authenticatedUsers.length} users`);

  const localityAnchors = await Promise.all(
    DEV_BUSINESS_LOCALITY_SLUGS.map((slug) => loadCommunityAnchor(slug))
  );

  for (const [index, tenant] of DEV_BUSINESS_TENANT_PRESETS.entries()) {
    const owner = authenticatedUsers.find(
      (user) => user.email === tenant.owner.email
    );
    if (!owner?.profileId) {
      logger.warn(
        `Skipping tenant ${tenant.site.slug}; owner profile missing.`
      );
      continue;
    }
    await upsertBusinessSiteConfig(tenant, owner.profileId, owner.userId);
    const businessPage = await upsertBusinessPageSeed(
      tenant,
      owner,
      localityAnchors[index % localityAnchors.length],
      index
    );
    await seedAdvertisingCampaign(
      tenant,
      owner,
      businessPage,
      localityAnchors[index % localityAnchors.length]
    );
    logger.log(`Hosted tenant ready at /sites/${tenant.site.slug}`);
  }

  const owner = authenticatedUsers.find((user) => {
    const preset = DEV_BUSINESS_TENANT_PRESETS.find(
      (tenant) => tenant.site.slug === PRIMARY_WORKFLOW_TENANT_SLUG
    );
    return user.email === preset?.owner.email;
  });
  const acceptedClient = authenticatedUsers.find(
    (user) => user.email === 'client@localbusiness.test'
  );
  const pendingClient = authenticatedUsers.find(
    (user) => user.email === 'pending-client@localbusiness.test'
  );

  if (owner && acceptedClient && pendingClient) {
    await seedAvailability(owner);
    await createLeadForUser(owner, acceptedClient, true);
    await createLeadForUser(owner, pendingClient, false);
  } else {
    logger.warn(
      'Skipping client-acceptance seed setup because one or more users are missing.'
    );
  }

  for (const user of authenticatedUsers) {
    const seedUser = SEED_USERS.find((u) => u.email === user.email);
    logger.log(`Email: ${user.email}, Password: ${seedUser?.password}`);
  }

  await permissionsDb.end();
  await storeDb.end();
  await paymentsDb.end();
}

bootstrap().catch((err) => {
  console.error('Business seed failed:', err);
  process.exit(1);
});
