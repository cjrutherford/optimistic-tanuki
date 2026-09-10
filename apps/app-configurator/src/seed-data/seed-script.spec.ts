import { seedDemoConfiguration } from './seed-helper';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('seedDemoConfiguration', () => {
  afterEach(() => {
    delete process.env.APP_CONFIG_SEED_CONFIG_NAME;
    delete process.env.APP_CONFIG_SEED_ACCESS_POLICY;
    delete process.env.APP_CONFIG_SEED_DOMAIN;
    delete process.env.APP_CONFIG_SEED_PUBLISH;
  });

  it('supports deterministic published P11 policy fixtures', async () => {
    process.env.APP_CONFIG_SEED_CONFIG_NAME = 'p11-request-only';
    process.env.APP_CONFIG_SEED_ACCESS_POLICY = 'request-only';
    process.env.APP_CONFIG_SEED_DOMAIN = 'p11-request-only.local';
    process.env.APP_CONFIG_SEED_PUBLISH = 'true';
    const created = {
      id: 'config-p11',
      name: 'p11-request-only',
      revision: 1,
      release: { publishedVersion: null, publishedSnapshot: null },
    };
    const published = {
      ...created,
      revision: 2,
      release: {
        publishedVersion: 1,
        publishedSnapshot: { accessPolicy: 'request-only' },
      },
    };
    const service = {
      reconcileSeedConfiguration: jest.fn().mockResolvedValue(created),
      resolveContext: jest.fn().mockResolvedValue({
        appInstanceId: 'app-1',
        membershipId: 'membership-1',
      }),
      publishConfiguration: jest.fn().mockResolvedValue(published),
      getAllConfigurations: jest.fn().mockResolvedValue([published]),
    };

    const result = await seedDemoConfiguration(service as any, {} as any, {
      log: jest.fn(),
    });

    expect(service.reconcileSeedConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'p11-request-only',
        domain: 'p11-request-only.local',
        accessPolicy: 'request-only',
      }),
      expect.anything()
    );
    expect(service.publishConfiguration).toHaveBeenCalledWith(
      'config-p11',
      expect.objectContaining({ expectedRevision: 1 }),
      expect.objectContaining({ appInstanceId: 'app-1' })
    );
    expect(result.created).toBe(published);
  });

  it('republishes when the canonical landing content differs from the published snapshot', async () => {
    process.env.APP_CONFIG_SEED_PUBLISH = 'true';
    const created = {
      id: 'config-stale-published-copy',
      name: 'demo-app',
      revision: 4,
      release: {
        status: 'published',
        publishedVersion: 3,
        publishedSnapshot: {
          name: 'demo-app',
          domain: undefined,
          accessPolicy: 'public',
          landingPage: {
            layout: 'single-column',
            sections: [
              {
                id: 'hero-1',
                type: 'hero',
                title: 'Welcome to Our Platform — P13 draft',
              },
            ],
          },
        },
      },
    };
    const published = {
      ...created,
      revision: 5,
      release: { ...created.release, publishedVersion: 4 },
    };
    const service = {
      reconcileSeedConfiguration: jest.fn().mockResolvedValue(created),
      resolveContext: jest.fn().mockResolvedValue({
        appInstanceId: 'app-1',
        membershipId: 'membership-1',
      }),
      publishConfiguration: jest.fn().mockResolvedValue(published),
      getAllConfigurations: jest.fn().mockResolvedValue([published]),
    };

    await seedDemoConfiguration(service as any, {} as any, { log: jest.fn() });

    expect(service.publishConfiguration).toHaveBeenCalledWith(
      created.id,
      expect.objectContaining({ expectedRevision: created.revision }),
      expect.objectContaining({ appInstanceId: 'app-1' })
    );
  });

  it('creates before listing so an empty app-config database can bootstrap its context', async () => {
    const calls: string[] = [];
    const service = {
      reconcileSeedConfiguration: jest.fn(async () => {
        calls.push('reconcile');
        return { id: 'config-1', name: 'demo-app' };
      }),
      getAllConfigurations: jest.fn(async () => {
        calls.push('list');
        return [{ id: 'config-1', name: 'demo-app' }];
      }),
    };
    const context = {
      ownerUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ownerProfileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      appScope: 'business-site',
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      appInstanceId: '123e4567-e89b-12d3-a456-426614174001',
      membershipId: '123e4567-e89b-12d3-a456-426614174002',
      membershipRole: 'owner' as const,
      membershipStatus: 'active' as const,
    };

    const result = await seedDemoConfiguration(service as any, context, {
      log: jest.fn(),
    });

    expect(calls).toEqual(['reconcile', 'list']);
    expect(result.configurations).toHaveLength(1);
  });

  it('delegates an equivalent existing configuration to transactional reconciliation', async () => {
    const existing = { id: 'config-1', name: 'demo-app', revision: 7 };
    const service = {
      reconcileSeedConfiguration: jest.fn().mockResolvedValue(existing),
      getAllConfigurations: jest.fn().mockResolvedValue([existing]),
    };

    const result = await seedDemoConfiguration(service as any, {} as any, {
      log: jest.fn(),
    });

    expect(service.reconcileSeedConfiguration).toHaveBeenCalledTimes(1);
    expect(result.created).toBe(existing);
    expect(result.configurations).toEqual([existing]);
  });

  it('delegates a differing existing configuration to revisioned reconciliation', async () => {
    const updated = { id: 'config-1', name: 'demo-app', revision: 8 };
    const service = {
      reconcileSeedConfiguration: jest.fn().mockResolvedValue(updated),
      getAllConfigurations: jest.fn().mockResolvedValue([updated]),
    };

    const result = await seedDemoConfiguration(service as any, {} as any, {
      log: jest.fn(),
    });

    expect(service.reconcileSeedConfiguration).toHaveBeenCalledTimes(1);
    expect(result.created).toBe(updated);
    expect(result.configurations).toEqual([updated]);
  });

  it('uses the reconciled app-instance ID when listing the seeded configuration', async () => {
    const legacyAppInstanceId = '99999999-9999-4999-8999-999999999999';
    const context = {
      ownerUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ownerProfileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      appScope: 'business-site',
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      appInstanceId: '123e4567-e89b-12d3-a456-426614174001',
      membershipId: '123e4567-e89b-12d3-a456-426614174002',
      membershipRole: 'owner' as const,
      membershipStatus: 'active' as const,
    };
    const service = {
      reconcileSeedConfiguration: jest.fn().mockResolvedValue({
        id: 'config-1',
        name: 'demo-app',
        appInstanceId: legacyAppInstanceId,
      }),
      getAllConfigurations: jest.fn().mockResolvedValue([]),
    };

    await seedDemoConfiguration(service as any, context, { log: jest.fn() });

    expect(service.getAllConfigurations).toHaveBeenCalledWith({
      ...context,
      appInstanceId: legacyAppInstanceId,
    });
  });

  it('uses the authoritative app-instance and membership IDs when listing after reconciliation', async () => {
    const context = {
      ownerUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ownerProfileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      appScope: 'business-site',
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      appInstanceId: '123e4567-e89b-12d3-a456-426614174001',
      membershipId: '123e4567-e89b-12d3-a456-426614174002',
      membershipRole: 'owner' as const,
      membershipStatus: 'active' as const,
    };
    const service = {
      reconcileSeedConfiguration: jest.fn().mockResolvedValue({
        id: 'config-1',
        name: 'demo-app',
        appInstanceId: '99999999-9999-4999-8999-999999999999',
      }),
      resolveContext: jest.fn().mockResolvedValue({
        ...context,
        appInstanceId: '99999999-9999-4999-8999-999999999999',
        membershipId: '88888888-8888-4888-8888-888888888888',
      }),
      getAllConfigurations: jest.fn().mockResolvedValue([]),
    };

    await seedDemoConfiguration(service as any, context, { log: jest.fn() });

    expect(service.resolveContext).toHaveBeenCalledWith({
      ownerUserId: context.ownerUserId,
      ownerProfileId: context.ownerProfileId,
      appScope: context.appScope,
      workspaceId: context.workspaceId,
    });
    expect(service.getAllConfigurations).toHaveBeenCalledWith({
      ...context,
      appInstanceId: '99999999-9999-4999-8999-999999999999',
      membershipId: '88888888-8888-4888-8888-888888888888',
    });
  });

  it('derives the configurable-client fixture ID instead of reusing a fixed primary key', () => {
    const script = readFileSync(
      join(__dirname, '../../../../scripts/dev-seed.sh'),
      'utf8'
    );
    const configurableBlock = script.slice(
      script.indexOf('seed_app_configuration owner-configurable-client'),
      script.indexOf('verify_seed_configuration owner-configurable-client')
    );

    expect(configurableBlock).toMatch(
      /\$\(scoped_fixture_id app-instance configurable-client "\$\{CONFIGURABLE_CLIENT_WORKSPACE_ID\}"\)/
    );
    expect(configurableBlock).not.toMatch(
      /APP_CONFIG_SEED_CONFIGURABLE_CLIENT_APP_INSTANCE_ID:-/
    );
    expect(configurableBlock).toMatch(
      /\$\(scoped_fixture_id membership configurable-client "\$\{CONFIGURABLE_CLIENT_WORKSPACE_ID\}"\)/
    );
    expect(configurableBlock).not.toMatch(
      /APP_CONFIG_SEED_CONFIGURABLE_CLIENT_MEMBERSHIP_ID:-/
    );
  });

  it('keeps internal policy fixture keys separate from user-facing app names', () => {
    const script = readFileSync(
      join(__dirname, '../../../../scripts/dev-seed.sh'),
      'utf8'
    );

    expect(script).toMatch(
      /seed_app_configuration p11-joinable[\s\S]*Open Community joinable community\.configurable-client\.local/
    );
    expect(script).toMatch(
      /seed_app_configuration p11-request-only[\s\S]*Access Request Hub request-only access\.configurable-client\.local/
    );
    expect(script).toMatch(
      /seed_app_configuration p11-private[\s\S]*Private Studio private private\.configurable-client\.local/
    );
    expect(script).not.toMatch(
      /configurable-client "p11-(joinable|request-only|private)" (joinable|request-only|private)/
    );
  });

  it('isolates each P11 discovery fixture to its own app-instance boundary', () => {
    const script = readFileSync(
      join(__dirname, '../../../../scripts/dev-seed.sh'),
      'utf8'
    );
    const p11Block = script.slice(
      script.indexOf('seed_app_configuration p11-joinable'),
      script.indexOf('foreign_email=')
    );

    expect(p11Block).toMatch(
      /P11_JOINABLE_WORKSPACE_ID[\s\S]*scoped_fixture_id app-instance configurable-client "\$\{P11_JOINABLE_WORKSPACE_ID\}"/
    );
    expect(p11Block).toMatch(
      /P11_REQUEST_ONLY_WORKSPACE_ID[\s\S]*scoped_fixture_id app-instance configurable-client "\$\{P11_REQUEST_ONLY_WORKSPACE_ID\}"/
    );
    expect(p11Block).toMatch(
      /P11_PRIVATE_WORKSPACE_ID[\s\S]*scoped_fixture_id app-instance configurable-client "\$\{P11_PRIVATE_WORKSPACE_ID\}"/
    );
    expect(p11Block).not.toMatch(
      /scoped_fixture_id app-instance configurable-client "\$\{CONFIGURABLE_CLIENT_WORKSPACE_ID\}"/
    );
  });

  it('cleans legacy labels from each isolated discovery fixture workspace', () => {
    const script = readFileSync(
      join(__dirname, '../../../../scripts/dev-seed.sh'),
      'utf8'
    );

    expect(script).toMatch(
      /verify_seed_configuration p11-joinable[\s\S]*cleanup_legacy_p11_configurations "\$\{P11_JOINABLE_COOKIE\}"[\s\S]*"\$\{P11_JOINABLE_WORKSPACE_SLUG\}"/
    );
    expect(script).toMatch(
      /verify_seed_configuration p11-request-only[\s\S]*cleanup_legacy_p11_configurations "\$\{P11_REQUEST_ONLY_COOKIE\}"[\s\S]*"\$\{P11_REQUEST_ONLY_WORKSPACE_SLUG\}"/
    );
    expect(script).toMatch(
      /verify_seed_configuration p11-private[\s\S]*cleanup_legacy_p11_configurations "\$\{P11_PRIVATE_COOKIE\}"[\s\S]*"\$\{P11_PRIVATE_WORKSPACE_SLUG\}"/
    );
  });

  it('publishes the configurable-client owner fixture after canonical reconciliation', () => {
    const script = readFileSync(
      join(__dirname, '../../../../scripts/dev-seed.sh'),
      'utf8'
    );
    const ownerBlock = script.slice(
      script.indexOf('seed_app_configuration owner-configurable-client'),
      script.indexOf('verify_seed_configuration owner-configurable-client')
    );

    expect(ownerBlock).toMatch(
      /configurable-client "\$\{CONFIGURABLE_CLIENT_BLOG_CATALOG_ID\}" true/
    );
  });
});
