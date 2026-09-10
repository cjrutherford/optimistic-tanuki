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
import { seedStoreCatalogForTenant } from './seed-trainer-store.mjs';

const defaultLogger = {
  log: (msg) => console.log(`[BusinessSeed] ${msg}`),
  warn: (msg) => console.warn(`[BusinessSeed] ${msg}`),
  error: (msg) => console.error(`[BusinessSeed] ${msg}`),
};

const DEFAULT_GATEWAY_URL = 'http://gateway:3000/api';
const DEFAULT_APP_SCOPE = 'business-site';
const { Client: PgClient } = pg;
async function fetchJson(url, options = {}, appScope = DEFAULT_APP_SCOPE) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-ot-appscope': appScope,
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

export class SeedOperationError extends Error {
  constructor(stage, subject, cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(
      `Required seed operation failed [${stage}] for ${subject}: ${reason}`
    );
    this.name = 'SeedOperationError';
    this.stage = stage;
    this.subject = subject;
    this.cause = cause;
  }
}

function asSeedOperationError(stage, subject, error) {
  return error instanceof SeedOperationError
    ? error
    : new SeedOperationError(stage, subject, error);
}

export async function bootstrap(options = {}) {
  const logger = options.logger || defaultLogger;
  const dependencies = options.dependencies || {};
  const gatewayUrl =
    options.gatewayUrl ||
    options.env?.GATEWAY_URL ||
    process.env.GATEWAY_URL ||
    DEFAULT_GATEWAY_URL;
  const appScope =
    options.appScope ||
    options.env?.APP_SCOPE ||
    process.env.APP_SCOPE ||
    DEFAULT_APP_SCOPE;
  const tenants = options.tenants || DEV_BUSINESS_TENANT_PRESETS;
  const users = options.users || [
    ...tenants.map((tenant) => tenant.owner),
    ...WORKFLOW_CLIENT_USERS,
  ];
  const ownerEmails = new Set(tenants.map((tenant) => tenant.owner.email));
  const sleep =
    dependencies.sleep ||
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const requestJson =
    dependencies.fetchJson ||
    ((url, requestOptions = {}) => fetchJson(url, requestOptions, appScope));
  const PgClient = dependencies.PgClient || pg.Client;

  logger.log(`=== Starting Business User Seed ===`);
  logger.log(`Gateway URL: ${gatewayUrl}`);
  logger.log(`App Scope: ${appScope}`);

  const env = options.env || process.env;
  const permissionsDb = new PgClient({
    host: env.POSTGRES_HOST || 'db',
    port: Number(env.POSTGRES_PORT || 5432),
    user: env.POSTGRES_USER || 'postgres',
    password: env.POSTGRES_PASSWORD || 'postgres',
    database: env.PERMISSIONS_DB || 'ot_permissions',
  });
  const storeDb = new PgClient({
    host: env.POSTGRES_HOST || 'db',
    port: Number(env.POSTGRES_PORT || 5432),
    user: env.POSTGRES_USER || 'postgres',
    password: env.POSTGRES_PASSWORD || 'postgres',
    database: env.STORE_DB || 'ot_store',
  });

  await permissionsDb.connect();
  await storeDb.connect();

  // Test connectivity
  try {
    await requestJson(`${gatewayUrl.replace(/\/api$/, '')}/api-docs`);
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

  async function upsertBusinessSiteConfig(
    tenant,
    ownerProfileId,
    ownerUserId,
    catalogId = null
  ) {
    logger.log(`Upserting hosted site config for ${tenant.site.slug}...`);

    const site = {
      ...tenant.site,
      ownerProfileId,
      ownerUserId,
    };
    const leadContext = {
      profileId: ownerProfileId,
      appScope,
    };

    const serviceCatalog = catalogId
      ? { ...tenant.serviceCatalog, catalogId }
      : tenant.serviceCatalog;

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
        JSON.stringify(serviceCatalog),
        JSON.stringify(tenant.services),
        JSON.stringify(tenant.landingPage),
        JSON.stringify(tenant.clientPortal),
        JSON.stringify(tenant.testimonials),
        JSON.stringify(tenant.theme),
      ]
    );
  }

  async function provisionBusinessSiteWorkspace(tenant, owner) {
    logger.log(`Provisioning workspace for ${tenant.site.slug}...`);

    const response = await requestJson(
      `${gatewayUrl}/workspaces/business-sites/provision`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.token}` },
        body: JSON.stringify({
          slug: tenant.site.slug,
          displayName: tenant.brand.businessName,
        }),
      }
    );

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Workspace provisioning failed for ${tenant.site.slug} (${
          response.status
        }): ${JSON.stringify(response.data)}`
      );
    }

    if (!response.data?.workspace?.workspaceId) {
      throw new Error(
        `Workspace provisioning returned no workspace for ${tenant.site.slug}`
      );
    }

    return response.data.workspace;
  }

  async function optionalRequest(label, url, requestOptions) {
    try {
      const response = await requestJson(url, requestOptions);
      if (response.status < 200 || response.status >= 300) {
        throw new Error(
          `HTTP ${response.status}: ${JSON.stringify(response.data)}`
        );
      }
      return response;
    } catch (error) {
      logger.warn(`Optional ${label} fixture skipped: ${error.message}`);
      return undefined;
    }
  }

  async function createLeadForUser(owner, client, approved = false) {
    logger.log(
      `${
        approved ? 'Seeding accepted client lead' : 'Seeding queued client lead'
      } for ${client.email}`
    );

    const leadResponse = await optionalRequest(
      `lead for ${client.email}`,
      `${gatewayUrl}/business/leads`,
      {
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
      }
    );

    if (approved && leadResponse?.data?.id) {
      await optionalRequest(
        `approval for ${client.email}`,
        `${gatewayUrl}/business/owner/leads/${leadResponse.data.id}/approve`,
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

    await optionalRequest(
      'recurring availability',
      `${gatewayUrl}/business/owner/availabilities`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.token}` },
        body: JSON.stringify({
          dayOfWeek: 0,
          startTime: '09:00:00',
          endTime: '17:00:00',
          hourlyRate: 150,
          serviceType: 'Strategy consultation',
        }),
      }
    );

    await optionalRequest(
      'availability override',
      `${gatewayUrl}/business/owner/availability-overrides`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.token}` },
        body: JSON.stringify({
          mode: 'blocked',
          startTime: '2026-05-10T12:00:00.000Z',
          endTime: '2026-05-10T13:00:00.000Z',
          hourlyRate: 150,
          serviceType: 'Strategy consultation',
        }),
      }
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
      [profileId, roleName, appScope]
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
        [roleName, appScope]
      );

      if (!roleCheck.rowCount) {
        throw new Error(`Role ${roleName} not found for ${appScope}`);
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

  for (const userData of users) {
    let userId;
    let token;
    let profileId;

    // Try register
    try {
      logger.log(`Registering user: ${userData.email}`);
      const { status, data } = await requestJson(
        `${gatewayUrl}/authentication/register`,
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
      } else {
        throw new Error(
          `Registration returned ${status}: ${JSON.stringify(data)}`
        );
      }
    } catch (err) {
      throw asSeedOperationError('registration', userData.email, err);
    }

    await sleep(200);

    // Try login
    try {
      logger.log(`Logging in user: ${userData.email}`);
      const { status, data } = await requestJson(
        `${gatewayUrl}/authentication/login`,
        {
          method: 'POST',
          body: JSON.stringify({
            email: userData.email,
            password: userData.password,
          }),
        }
      );

      if (status < 200 || status >= 300) {
        throw new Error(`Login returned ${status}: ${JSON.stringify(data)}`);
      }

      token = extractToken(data);

      if (!token) {
        throw new Error('Login returned no authentication token');
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
        const { status: exchangeStatus, data: exchangeData } =
          await requestJson(`${gatewayUrl}/authentication/exchange`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              targetAppId: appScope,
            }),
          });
        if (exchangeStatus < 200 || exchangeStatus >= 300) {
          throw new Error(
            `Token exchange returned ${exchangeStatus}: ${JSON.stringify(
              exchangeData
            )}`
          );
        }
        profileId = extractProfileId(exchangeData) || profileId;
        token = extractToken(exchangeData) || token;
        logger.log(`Resolved profileId via exchange: ${profileId}`);
      } catch (e) {
        throw asSeedOperationError('token exchange', userData.email, e);
      }

      if (!userId || !profileId || !token) {
        throw new Error('Login did not resolve user, profile, and token');
      }

      if (userId && profileId && token) {
        const roleName = ownerEmails.has(userData.email)
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
      throw asSeedOperationError('login', userData.email, err);
    }

    await sleep(100);
  }

  for (const tenant of tenants) {
    const owner = authenticatedUsers.find(
      (user) => user.email === tenant.owner.email
    );
    if (!owner?.profileId || !owner.token) {
      throw asSeedOperationError(
        'tenant authentication',
        tenant.site.slug,
        new Error('owner authentication missing')
      );
    }
    try {
      await upsertBusinessSiteConfig(tenant, owner.profileId, owner.userId);
    } catch (error) {
      throw asSeedOperationError('configuration', tenant.site.slug, error);
    }
    try {
      const workspace = await provisionBusinessSiteWorkspace(tenant, owner);
      if (
        tenant.features?.store?.enabled &&
        tenant.serviceCatalog?.source === 'store'
      ) {
        const storeSeed = await seedStoreCatalogForTenant({
          tenant,
          owner,
          workspace,
          gatewayUrl,
          fetchJson: requestJson,
          logger,
        });
        await upsertBusinessSiteConfig(
          tenant,
          owner.profileId,
          owner.userId,
          storeSeed?.catalogId || null
        );
        logger.log(
          `Store catalog ready for ${tenant.site.slug}: ${storeSeed.catalogId} (${storeSeed.productNames.length} products)`
        );
      }
    } catch (error) {
      throw asSeedOperationError(
        tenant.features?.store?.enabled
          ? 'provisioning/store seed'
          : 'provisioning',
        tenant.site.slug,
        error
      );
    }
    logger.log(`Hosted tenant ready at /sites/${tenant.site.slug}`);
  }

  const owner = authenticatedUsers.find((user) => {
    const preset = tenants.find(
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

  logger.log(`=== Business User Seed Complete ===`);
  logger.log(`Successfully authenticated ${authenticatedUsers.length} users`);

  for (const user of authenticatedUsers) {
    const seedUser = users.find((u) => u.email === user.email);
    logger.log(`Email: ${user.email}, Password: ${seedUser?.password}`);
  }

  await permissionsDb.end();
  await storeDb.end();
}

if (process.argv[1]?.endsWith('/seed-trainer.mjs')) {
  bootstrap().catch((err) => {
    console.error('Business seed failed:', err);
    process.exitCode = 1;
  });
}
