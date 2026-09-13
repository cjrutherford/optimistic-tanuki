import axios, { AxiosInstance } from 'axios';
import { Pool, type PoolConfig } from 'pg';

const APP_SCOPE = 'business-site';
const FIXTURE_PREFIX = 'p33-gateway-app-config';
const WORKSPACE_SCOPE_PREFIX = 'workspace:';

const IDS = {
  workspace: 'a3333333-3333-4333-8333-333333333333',
  foreignWorkspace: 'b3333333-3333-4333-8333-333333333333',
  source: 'a4444444-4444-4444-8444-444444444444',
  foreignSource: 'b4444444-4444-4444-8444-444444444444',
  appInstance: 'a5555555-5555-4555-8555-555555555555',
  foreignAppInstance: 'b5555555-5555-4555-8555-555555555555',
  membership: 'a6666666-6666-4666-8666-666666666666',
  foreignMembership: 'b6666666-6666-4666-8666-666666666666',
  configuration: 'a7777777-7777-4777-8777-777777777777',
  foreignConfiguration: 'b7777777-7777-4777-8777-777777777777',
  forgedAppInstance: 'f5555555-5555-4555-8555-555555555555',
  forgedMembership: 'f6666666-6666-4666-8666-666666666666',
} as const;

type Identity = {
  email: string;
  password: string;
  userId: string;
  profileId: string;
  token: string;
};

type WorkspaceRow = {
  id: string;
  slug: string;
  displayName: string;
};

type ConfigurationRow = {
  id: string;
  domain: string;
};

export type AppConfigGovernanceFixture = {
  owner: Identity;
  foreign: Identity;
  workspace: WorkspaceRow;
  foreignWorkspace: WorkspaceRow;
  appInstance: { id: string };
  configuration: ConfigurationRow;
  forged: {
    appInstanceId: string;
    membershipId: string;
  };
  anonymous: AxiosInstance;
  apiFor(identity: Identity): AxiosInstance;
  reset(): Promise<void>;
  setMembershipRole(
    role: 'owner' | 'admin' | 'moderator' | 'member'
  ): Promise<void>;
  removeOwnerAppInstance(): Promise<void>;
  setAppInstanceStatus(
    status: 'pending' | 'active' | 'suspended' | 'revoked'
  ): Promise<void>;
  readOwnerConfiguration(): Promise<Record<string, unknown> | null>;
  cleanup(): Promise<void>;
};

function databaseOptions(database: string): PoolConfig {
  return {
    host:
      process.env.E2E_POSTGRES_HOST ?? process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(
      process.env.E2E_POSTGRES_PORT ?? process.env.POSTGRES_PORT ?? '5432'
    ),
    user:
      process.env.E2E_POSTGRES_USER ?? process.env.POSTGRES_USER ?? 'postgres',
    password:
      process.env.E2E_POSTGRES_PASSWORD ??
      process.env.POSTGRES_PASSWORD ??
      'postgres',
    database,
  };
}

function decodeJwtPayload(token: string): { profileId?: string } {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function createApi(baseURL: string, token?: string): AxiosInstance {
  return axios.create({
    baseURL: `${baseURL}/api`,
    timeout: 10_000,
    headers: {
      'x-ot-appscope': APP_SCOPE,
      'x-ot-app-id': APP_SCOPE,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    validateStatus: () => true,
  });
}

async function registerIdentity(
  api: AxiosInstance,
  label: string,
  runId: string
): Promise<Identity> {
  const password = 'Test@Password123';
  const email = `${FIXTURE_PREFIX}-${label}-${runId}@example.com`;
  const registration = await api.post('/authentication/register', {
    email,
    fn: 'P33',
    ln: label,
    password,
    confirm: password,
    bio: 'P3.3 app-config governance fixture',
  });
  if (registration.status !== 201 || !registration.data?.data?.user?.id) {
    throw new Error(
      `P3.3 registration failed for ${label}: ${
        registration.status
      } ${JSON.stringify(registration.data)}`
    );
  }

  const login = await api.post('/authentication/login', { email, password });
  const token = login.data?.data?.newToken as string | undefined;
  if (login.status !== 201 || !token) {
    throw new Error(
      `P3.3 login failed for ${label}: ${login.status} ${JSON.stringify(
        login.data
      )}`
    );
  }

  const profileId = decodeJwtPayload(token).profileId;
  if (!profileId) {
    throw new Error(`P3.3 login did not return a profile for ${label}`);
  }

  return {
    email,
    password,
    userId: registration.data.data.user.id,
    profileId,
    token,
  };
}

async function clearWorkspaceFixtureRows(
  workspacePool: Pool,
  permissionPool: Pool
): Promise<void> {
  const workspaceIds = [IDS.workspace, IDS.foreignWorkspace];
  const scopeNames = workspaceIds.map((id) => `${WORKSPACE_SCOPE_PREFIX}${id}`);

  await permissionPool.query(
    `DELETE FROM "role_assignment"
     WHERE "appScopeId" IN (
       SELECT "id" FROM "app_scope" WHERE "name" = ANY($1::text[])
     )`,
    [scopeNames]
  );
  await permissionPool.query(
    'DELETE FROM "app_scope" WHERE "name" = ANY($1::text[])',
    [scopeNames]
  );
  await workspacePool.query(
    `DELETE FROM "workspaces"
     WHERE "id" = ANY($1::uuid[])
        OR "slug" LIKE $2`,
    [workspaceIds, `${FIXTURE_PREFIX}-%`]
  );
}

async function insertWorkspaceFixtureRows(
  workspacePool: Pool,
  permissionPool: Pool,
  owner: Identity,
  foreign: Identity
): Promise<void> {
  await workspacePool.query(
    `INSERT INTO "workspaces"
      ("id", "kind", "slug", "displayName", "appScope", "ownerUserId", "ownerProfileId", "status", "sourceService", "sourceId")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9),
            ($10, $2, $11, $12, $5, $13, $14, 'active', $8, $15)`,
    [
      IDS.workspace,
      'business-site',
      `${FIXTURE_PREFIX}-a`,
      'P33 Workspace A',
      APP_SCOPE,
      owner.userId,
      owner.profileId,
      'store',
      IDS.source,
      IDS.foreignWorkspace,
      `${FIXTURE_PREFIX}-b`,
      'P33 Workspace B',
      foreign.userId,
      foreign.profileId,
      IDS.foreignSource,
    ]
  );

  const appScope = await permissionPool.query<{ id: string }>(
    'SELECT "id" FROM "app_scope" WHERE "name" = $1',
    [APP_SCOPE]
  );
  const ownerRole = await permissionPool.query<{ id: string }>(
    `SELECT "role"."id"
       FROM "role"
       JOIN "app_scope" ON "app_scope"."id" = "role"."appScopeId"
      WHERE "role"."name" = 'business_site_owner'
        AND "app_scope"."name" = $1`,
    [APP_SCOPE]
  );
  if (!appScope.rows[0]?.id || !ownerRole.rows[0]?.id) {
    throw new Error(
      'P3.3 fixture requires seeded business-site app scope and business_site_owner role'
    );
  }

  for (const [workspaceId, profileId] of [
    [IDS.workspace, owner.profileId],
    [IDS.foreignWorkspace, foreign.profileId],
  ]) {
    const scope = await permissionPool.query<{ id: string }>(
      `INSERT INTO "app_scope" ("name", "description", "active")
       VALUES ($1, $2, true)
       RETURNING "id"`,
      [
        `${WORKSPACE_SCOPE_PREFIX}${workspaceId}`,
        `${FIXTURE_PREFIX} workspace permission scope`,
      ]
    );
    await permissionPool.query(
      `INSERT INTO "role_assignment" ("profileId", "targetId", "roleId", "appScopeId")
       VALUES ($1, NULL, $2, $3)`,
      [profileId, ownerRole.rows[0].id, scope.rows[0].id]
    );
  }
}

function snapshot(domain: string): Record<string, unknown> {
  return {
    name: `${FIXTURE_PREFIX}-configuration`,
    description: 'P33 published configuration',
    domain,
    landingPage: { sections: [], layout: 'single-column' },
    routes: [],
    features: {},
    theme: {},
    active: true,
  };
}

async function clearAppConfigRows(appConfigPool: Pool): Promise<void> {
  await appConfigPool.query(
    `DELETE FROM "app_configuration_entity"
     WHERE "id" = ANY($1::uuid[])
        OR "domain" LIKE $2`,
    [[IDS.configuration, IDS.foreignConfiguration], `${FIXTURE_PREFIX}-%`]
  );
  await appConfigPool.query(
    'DELETE FROM "app_memberships" WHERE "id" = ANY($1::uuid[])',
    [[IDS.membership, IDS.foreignMembership]]
  );
  await appConfigPool.query(
    'DELETE FROM "app_instances" WHERE "id" = ANY($1::uuid[])',
    [[IDS.appInstance, IDS.foreignAppInstance]]
  );
}

async function insertAppConfigRows(
  appConfigPool: Pool,
  owner: Identity,
  foreign: Identity
): Promise<void> {
  await appConfigPool.query(
    `INSERT INTO "app_instances"
      ("id", "workspaceId", "appScope", "ownerUserId", "ownerProfileId", "status")
     VALUES ($1, $2, $3, $4, $5, 'active'),
            ($6, $7, $3, $8, $9, 'active')`,
    [
      IDS.appInstance,
      IDS.workspace,
      APP_SCOPE,
      owner.userId,
      owner.profileId,
      IDS.foreignAppInstance,
      IDS.foreignWorkspace,
      foreign.userId,
      foreign.profileId,
    ]
  );
  await appConfigPool.query(
    `INSERT INTO "app_memberships"
      ("id", "workspaceId", "appInstanceId", "appScope", "userId", "profileId", "role", "status")
     VALUES ($1, $2, $3, $4, $5, $6, 'owner', 'active'),
            ($7, $8, $9, $4, $10, $11, 'owner', 'active')`,
    [
      IDS.membership,
      IDS.workspace,
      IDS.appInstance,
      APP_SCOPE,
      owner.userId,
      owner.profileId,
      IDS.foreignMembership,
      IDS.foreignWorkspace,
      IDS.foreignAppInstance,
      foreign.userId,
      foreign.profileId,
    ]
  );

  const ownerDomain = `${FIXTURE_PREFIX}-a.example.test`;
  const foreignDomain = `${FIXTURE_PREFIX}-b.example.test`;
  // A publication only counts if its history holds the matching `publish`
  // revision: hasConfirmedPublication requires an entry whose version equals
  // publishedVersion and whose snapshot serialises identically to
  // publishedSnapshot. With `history: []` the anonymous by-domain lookup could
  // never find this configuration and answered 404.
  const release = (domain: string) =>
    JSON.stringify({
      status: 'published',
      publishedVersion: 1,
      releaseNotes: 'P33 fixture release',
      changeSummary: 'P33 fixture release',
      publishedSnapshot: snapshot(domain),
      history: [
        {
          version: 1,
          action: 'publish',
          releaseNotes: 'P33 fixture release',
          changeSummary: 'P33 fixture release',
          snapshot: snapshot(domain),
        },
      ],
    });

  await appConfigPool.query(
    `INSERT INTO "app_configuration_entity"
      ("id", "name", "workspaceId", "appInstanceId", "ownerUserId", "ownerProfileId", "appScope", "description", "domain", "landingPage", "routes", "features", "theme", "active", "revision", "release")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, true, 1, $11::jsonb),
            ($12, $2 || '-foreign', $13, $14, $15, $16, $7, $8, $17, $18::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, true, 1, $19::jsonb)`,
    [
      IDS.configuration,
      `${FIXTURE_PREFIX}-configuration`,
      IDS.workspace,
      IDS.appInstance,
      owner.userId,
      owner.profileId,
      APP_SCOPE,
      'P33 published configuration',
      ownerDomain,
      JSON.stringify({ sections: [], layout: 'single-column' }),
      release(ownerDomain),
      IDS.foreignConfiguration,
      IDS.foreignWorkspace,
      IDS.foreignAppInstance,
      foreign.userId,
      foreign.profileId,
      foreignDomain,
      JSON.stringify({ sections: [], layout: 'single-column' }),
      release(foreignDomain),
    ]
  );
}

export async function createAppConfigGovernanceFixture(
  baseURL: string
): Promise<AppConfigGovernanceFixture> {
  const anonymous = createApi(baseURL);
  const workspacePool = new Pool(
    databaseOptions(process.env.E2E_WORKSPACE_DATABASE ?? 'ot_workspace')
  );
  const permissionPool = new Pool(
    databaseOptions(process.env.E2E_PERMISSIONS_DATABASE ?? 'ot_permissions')
  );
  const appConfigPool = new Pool(
    databaseOptions(
      process.env.E2E_APP_CONFIG_DATABASE ?? 'ot_app_configurator'
    )
  );
  const runId = `${Date.now()}-${process.pid}`;
  let owner: Identity | undefined;
  let foreign: Identity | undefined;

  try {
    await Promise.all([
      workspacePool.query('SELECT 1'),
      permissionPool.query('SELECT 1'),
      appConfigPool.query('SELECT 1'),
    ]);
    owner = await registerIdentity(anonymous, 'owner', runId);
    foreign = await registerIdentity(anonymous, 'foreign', runId);

    await clearWorkspaceFixtureRows(workspacePool, permissionPool);
    await insertWorkspaceFixtureRows(
      workspacePool,
      permissionPool,
      owner,
      foreign
    );
    await clearAppConfigRows(appConfigPool);
    await insertAppConfigRows(appConfigPool, owner, foreign);

    const fixture: AppConfigGovernanceFixture = {
      owner,
      foreign,
      workspace: {
        id: IDS.workspace,
        slug: `${FIXTURE_PREFIX}-a`,
        displayName: 'P33 Workspace A',
      },
      foreignWorkspace: {
        id: IDS.foreignWorkspace,
        slug: `${FIXTURE_PREFIX}-b`,
        displayName: 'P33 Workspace B',
      },
      appInstance: { id: IDS.appInstance },
      configuration: {
        id: IDS.configuration,
        domain: `${FIXTURE_PREFIX}-a.example.test`,
      },
      forged: {
        appInstanceId: IDS.forgedAppInstance,
        membershipId: IDS.forgedMembership,
      },
      anonymous,
      apiFor: (identity) => createApi(baseURL, identity.token),
      reset: async () => {
        await clearAppConfigRows(appConfigPool);
        await insertAppConfigRows(appConfigPool, owner!, foreign!);
      },
      setMembershipRole: async (role) => {
        await appConfigPool.query(
          'UPDATE "app_memberships" SET "role" = $1 WHERE "id" = $2',
          [role, IDS.membership]
        );
      },
      removeOwnerAppInstance: async () => {
        await appConfigPool.query(
          'DELETE FROM "app_configuration_entity" WHERE "id" = $1',
          [IDS.configuration]
        );
        await appConfigPool.query(
          'DELETE FROM "app_memberships" WHERE "id" = $1',
          [IDS.membership]
        );
        await appConfigPool.query(
          'DELETE FROM "app_instances" WHERE "id" = $1',
          [IDS.appInstance]
        );
      },
      setAppInstanceStatus: async (status) => {
        await appConfigPool.query(
          'UPDATE "app_instances" SET "status" = $1 WHERE "id" = $2',
          [status, IDS.appInstance]
        );
      },
      readOwnerConfiguration: async () => {
        const result = await appConfigPool.query(
          'SELECT * FROM "app_configuration_entity" WHERE "id" = $1',
          [IDS.configuration]
        );
        return result.rows[0] ?? null;
      },
      cleanup: async () => {
        await clearAppConfigRows(appConfigPool);
        await clearWorkspaceFixtureRows(workspacePool, permissionPool);
        await Promise.all([
          appConfigPool.end(),
          workspacePool.end(),
          permissionPool.end(),
        ]);
      },
    };

    return fixture;
  } catch (error) {
    await Promise.allSettled([
      clearAppConfigRows(appConfigPool),
      clearWorkspaceFixtureRows(workspacePool, permissionPool),
    ]);
    await Promise.all([
      appConfigPool.end(),
      workspacePool.end(),
      permissionPool.end(),
    ]);
    throw error;
  }
}
