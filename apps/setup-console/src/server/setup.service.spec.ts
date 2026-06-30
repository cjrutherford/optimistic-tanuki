import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SetupService } from './setup.service';

describe('SetupService', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-service-'));
    fs.mkdirSync(path.join(workspaceRoot, 'ops', 'deployments'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(workspaceRoot, 'apps', 'authentication', 'src'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(workspaceRoot, 'apps', 'assets', 'src', 'app'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(workspaceRoot, 'apps', 'gateway', 'src'), {
      recursive: true,
    });

    fs.writeFileSync(
      path.join(workspaceRoot, 'apps', 'authentication', 'src', 'config.ts'),
      [
        'export declare type AuthConfigType = {',
        '  listenPort: number;',
        '  database: {',
        '    host: string;',
        '    port: number;',
        '    username: string;',
        '    password: string;',
        '    database: string;',
        '  };',
        '  auth: {',
        '    jwt_secret: string;',
        '  };',
        '};',
        'const loadConfig = () => ({',
        '  database: { password: process.env.POSTGRES_PASSWORD, username: process.env.POSTGRES_USER },',
        '  auth: { jwt_secret: process.env.JWT_SECRET },',
        "  listenPort: Number(process.env.PORT || '3001'),",
        '});',
      ].join('\n')
    );

    fs.writeFileSync(
      path.join(workspaceRoot, 'apps', 'assets', 'src', 'app', 'config.ts'),
      [
        'export declare type AssetsConfigType = {',
        '  listenPort: number;',
        '  database: {',
        '    host: string;',
        '    port: number;',
        '    username: string;',
        '    password: string;',
        '    database: string;',
        '  };',
        "  storageStrategy?: 'local' | 'network';",
        '  storagePath: string;',
        '  s3?: {',
        '    endpoint: string;',
        '    bucket: string;',
        '    accessKey: string;',
        '    secretKey: string;',
        '  };',
        '};',
        'export const loadConfig = () => ({',
        '  storagePath: process.env.LOCAL_STORAGE_PATH,',
        '  storageStrategy: process.env.STORAGE_STRATEGY,',
        '  s3: { endpoint: process.env.S3_ENDPOINT, bucket: process.env.S3_BUCKET, accessKey: process.env.S3_ACCESS_KEY, secretKey: process.env.S3_SECRET_KEY },',
        '  database: { password: process.env.POSTGRES_PASSWORD, username: process.env.POSTGRES_USER },',
        '});',
      ].join('\n')
    );

    fs.writeFileSync(
      path.join(workspaceRoot, 'apps', 'gateway', 'src', 'config.ts'),
      [
        'export type Config = {',
        '  listenPort: number;',
        '  jwtSecret: string;',
        '  redis: {',
        '    host: string;',
        '    port: number;',
        '  };',
        '};',
        'export const loadConfig = () => ({',
        "  listenPort: Number(process.env.LISTEN_PORT || '3000'),",
        '  jwtSecret: process.env.JWT_SECRET,',
        "  redis: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT || '6379') },",
        '});',
      ].join('\n')
    );

    process.env['SETUP_WORKSPACE_ROOT'] = workspaceRoot;
    process.env['ADMIN_API_DEPLOYMENT_PATH'] =
      './ops/deployments/production.yaml';
    process.env['ADMIN_API_SECRETS_PATH'] = './.secrets';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('lists deployment environments from the deployments directory', async () => {
    fs.writeFileSync(
      path.join(workspaceRoot, 'ops', 'deployments', 'production.yaml'),
      'version: v1alpha1\nenvironment:\n  name: production\n'
    );
    fs.writeFileSync(
      path.join(workspaceRoot, 'ops', 'deployments', 'qa.yaml'),
      'version: v1alpha1\nenvironment:\n  name: qa\n'
    );

    const service = new SetupService();

    await expect(service.listEnvironments()).resolves.toEqual({
      activeEnvironment: 'production',
      environments: ['production', 'qa'],
    });
  });

  it('loads secrets from an environment-specific secrets file', async () => {
    fs.writeFileSync(
      path.join(workspaceRoot, 'ops', 'deployments', 'qa.secrets.env'),
      'JWT_SECRET=qa-secret\n'
    );

    const service = new SetupService();

    await expect(service.loadSecrets('qa')).resolves.toEqual({
      JWT_SECRET: 'qa-secret',
    });
  });

  it('returns saved operator summary without exposing the password', async () => {
    const service = new SetupService();
    await service.saveOperator(
      'Existing Operator',
      'owner@example.com',
      'secret'
    );

    await expect(service.getSavedOperatorSummary()).resolves.toEqual({
      name: 'Existing Operator',
      email: 'owner@example.com',
      passwordSaved: true,
      source: 'saved',
      existingUser: false,
      existingCount: 0,
    });
  });

  it('marks a saved operator when the owner-console account already exists', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'owner-1',
          email: 'owner@example.com',
          firstName: 'Existing',
          lastName: 'Owner',
        },
      ],
    }) as typeof fetch;

    const service = new SetupService();
    await service.saveOperator(
      'Existing Operator',
      'OWNER@EXAMPLE.COM',
      'secret'
    );

    await expect(service.getSavedOperatorSummary()).resolves.toEqual({
      name: 'Existing Operator',
      email: 'owner@example.com',
      passwordSaved: true,
      source: 'saved-existing',
      existingUser: true,
      existingCount: 1,
      userId: 'owner-1',
    });
  });

  it('falls back to the existing owner-console account when no saved operator exists', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'owner-2',
          email: 'console@example.com',
          name: 'Console Owner',
        },
      ],
    }) as typeof fetch;

    const service = new SetupService();

    await expect(service.getSavedOperatorSummary()).resolves.toEqual({
      name: 'Console Owner',
      email: 'console@example.com',
      passwordSaved: false,
      source: 'existing',
      existingUser: true,
      existingCount: 1,
      userId: 'owner-2',
    });
  });

  it('tracks deploy progress snapshots during backend deployment work', async () => {
    const service = new SetupService();

    expect(service.getDeployProgress()).toEqual(
      expect.objectContaining({
        activePhase: 'idle',
        phases: expect.arrayContaining([
          expect.objectContaining({ id: 'building' }),
          expect.objectContaining({ id: 'activating' }),
        ]),
      })
    );

    await expect(service.buildImages()).resolves.toEqual(
      expect.objectContaining({
        success: false,
      })
    );

    expect(service.getDeployProgress()).toEqual(
      expect.objectContaining({
        activePhase: 'error',
        error: expect.stringContaining('admin-env binary not found'),
        phases: expect.arrayContaining([
          expect.objectContaining({
            id: 'building',
            substeps: expect.arrayContaining([
              expect.objectContaining({
                id: 'build-or-pull',
                status: 'error',
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it('deploys only enabled services in image compose mode', async () => {
    fs.writeFileSync(
      path.join(workspaceRoot, 'docker-compose.yaml'),
      [
        'services:',
        '  gateway:',
        '    image: cjrutherford/optimistic_tanuki_gateway:${PRODUCTION_IMAGE_TAG:-latest}',
        '  authentication:',
        '    image: cjrutherford/optimistic_tanuki_authentication:${PRODUCTION_IMAGE_TAG:-latest}',
        '  profile:',
        '    image: cjrutherford/optimistic_tanuki_profile:${PRODUCTION_IMAGE_TAG:-latest}',
      ].join('\n')
    );
    fs.writeFileSync(
      path.join(workspaceRoot, 'ops', 'deployments', 'production.yaml'),
      [
        'version: v1alpha1',
        'environment:',
        '  name: production',
        '  composeMode: image',
        '  defaultTag: sha-target',
        'services:',
        '  - serviceId: gateway',
        '    enabled: true',
        '  - serviceId: authentication',
        '    enabled: false',
        '  - serviceId: profile',
        '    enabled: true',
      ].join('\n')
    );

    const service = new SetupService();
    const runStreamingCommand = jest
      .spyOn(service as any, 'runStreamingCommand')
      .mockImplementation(async () => undefined);

    await expect(service.deployServices()).resolves.toEqual({
      success: true,
      message:
        'Services pulled, recreated, and seeded through the batched production rollout script.',
    });

    expect(runStreamingCommand).toHaveBeenCalledTimes(2);
    expect(runStreamingCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        command: 'docker',
        args: [
          'compose',
          '-f',
          path.join(workspaceRoot, 'docker-compose.yaml'),
          'pull',
          'gateway',
          'profile',
        ],
      })
    );
    expect(runStreamingCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        command: 'docker',
        args: [
          'compose',
          '-f',
          path.join(workspaceRoot, 'docker-compose.yaml'),
          'up',
          '-d',
          '--no-build',
          '--force-recreate',
          'gateway',
          'profile',
        ],
        env: expect.objectContaining({
          PRODUCTION_IMAGE_TAG: 'sha-target',
        }),
      })
    );
  });

  it('browses host paths and stores managed files for an environment', async () => {
    const browseRoot = path.join(workspaceRoot, 'browse');
    fs.mkdirSync(path.join(browseRoot, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(browseRoot, 'sample.json'), '{"ok":true}');

    const service = new SetupService();
    const listing = await service.browseHostPath(browseRoot);
    const upload = await service.storeManagedFile({
      environmentName: 'qa',
      filename: 'registry.json',
      contentBase64: Buffer.from('{"apps":[]}').toString('base64'),
    });

    expect(listing.currentPath).toBe(browseRoot);
    expect(listing.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'nested', directory: true }),
        expect.objectContaining({ name: 'sample.json', file: true }),
      ])
    );
    expect(fs.readFileSync(upload.path, 'utf-8')).toBe('{"apps":[]}');
  });

  it('takes over an existing deployment and imports a combined env file', async () => {
    const importedDir = path.join(workspaceRoot, 'external');
    fs.mkdirSync(importedDir, { recursive: true });
    fs.writeFileSync(
      path.join(importedDir, 'legacy.yaml'),
      [
        'version: v1alpha1',
        'environment:',
        '  name: legacy',
        '  namespace: legacy-ns',
        '  targets: [compose]',
        '  composeMode: image',
        '  provider: local',
        '  imageOwner: cjrutherford',
        '  defaultTag: sha-legacy',
        '  infra: [postgres]',
        '  capabilities: []',
        '  services: [gateway, authentication]',
        'services:',
        '  - serviceId: gateway',
        '    enabled: true',
        '  - serviceId: authentication',
        '    enabled: true',
        'apps:',
        '  - appId: client-interface',
        '    domain: legacy.example.com',
        '    uiBaseUrl: https://legacy.example.com',
        '    apiBaseUrl: https://legacy.example.com/api',
        '    appType: client',
        '    visibility: public',
        'oauth:',
        '  enabled: true',
        '  bridgeAppId: client-interface',
        '  providers:',
        '    google:',
        '      enabled: false',
        '      clientIdKey: GOOGLE_CLIENT_ID',
        '      clientSecretKey: GOOGLE_CLIENT_SECRET',
        "      redirectUri: ''",
      ].join('\n')
    );
    fs.writeFileSync(
      path.join(importedDir, 'legacy.env'),
      [
        'JWT_SECRET=legacy-secret',
        'CLIENT_INTERFACE_UI_BASE_URL=https://app.legacy.example.com',
        'CLIENT_INTERFACE_DOMAIN=app.legacy.example.com',
        'PRODUCTION_IMAGE_TAG=sha-imported',
        'POSTGRES_HOST=postgres.internal',
        'POSTGRES_PORT=5544',
        'POSTGRES_DB=ot_legacy',
        'POSTGRES_USER=legacy_user',
        'GOOGLE_CLIENT_ID=google-client-id',
        'GOOGLE_CLIENT_SECRET=google-client-secret',
        'GOOGLE_REDIRECT_URI=https://gateway.legacy.example.com/api/oauth/callback/google',
      ].join('\n')
    );

    const service = new SetupService();
    const result = await service.takeOverDeployment({
      deploymentPath: path.join(importedDir, 'legacy.yaml'),
      secretsPath: path.join(importedDir, 'legacy.env'),
      environmentName: 'adopted',
    });

    expect(result.environment).toBe('adopted');
    expect(result.data.environment.name).toBe('adopted');
    await expect(service.loadSecrets('adopted')).resolves.toEqual({
      JWT_SECRET: 'legacy-secret',
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
    });
    await expect(service.loadConfig('adopted')).resolves.toEqual(
      expect.objectContaining({
        environment: expect.objectContaining({
          name: 'adopted',
          defaultTag: 'sha-imported',
        }),
        databases: expect.arrayContaining([
          expect.objectContaining({
            id: 'postgres-primary',
            host: 'postgres.internal',
            port: 5544,
            databaseName: 'ot_legacy',
            username: 'legacy_user',
          }),
        ]),
        settings: expect.objectContaining({
          targets: expect.objectContaining({
            'client-interface': expect.objectContaining({
              uiBaseUrl: 'https://app.legacy.example.com',
              domain: 'app.legacy.example.com',
            }),
          }),
        }),
        oauth: expect.objectContaining({
          providers: expect.objectContaining({
            google: expect.objectContaining({
              enabled: true,
              redirectUri:
                'https://gateway.legacy.example.com/api/oauth/callback/google',
            }),
          }),
        }),
      })
    );
    await expect(service.getOAuthProviders('adopted')).resolves.toEqual(
      expect.objectContaining({
        providers: expect.arrayContaining([
          expect.objectContaining({
            name: 'google',
            clientIdValue: 'google-client-id',
            clientSecretValue: 'google-client-secret',
          }),
        ]),
      })
    );
  });

  it('overwrites an existing managed environment when importing with the same name', async () => {
    fs.writeFileSync(
      path.join(workspaceRoot, 'ops', 'deployments', 'production.yaml'),
      [
        'version: v1alpha1',
        'environment:',
        '  name: production',
        '  namespace: optimistic-tanuki',
        '  targets: [compose]',
        '  composeMode: image',
        '  provider: local',
        '  imageOwner: cjrutherford',
        '  defaultTag: old-tag',
        '  infra: [postgres]',
        '  capabilities: []',
        '  services: [gateway]',
        'services:',
        '  - serviceId: gateway',
        '    enabled: true',
        'apps: []',
        'oauth:',
        '  enabled: true',
        '  bridgeAppId: client-interface',
        '  providers: {}',
      ].join('\n')
    );
    fs.writeFileSync(path.join(workspaceRoot, '.secrets'), 'JWT_SECRET=old\n');

    const importedDir = path.join(workspaceRoot, 'external');
    fs.mkdirSync(importedDir, { recursive: true });
    fs.writeFileSync(
      path.join(importedDir, 'replacement.yaml'),
      [
        'version: v1alpha1',
        'environment:',
        '  name: replacement',
        '  defaultTag: new-tag',
        'apps: []',
        'oauth:',
        '  providers: {}',
        'services:',
        '  - serviceId: gateway',
        '    enabled: true',
      ].join('\n')
    );
    fs.writeFileSync(
      path.join(importedDir, 'replacement.env'),
      'JWT_SECRET=new\n'
    );

    const service = new SetupService();
    await service.takeOverDeployment({
      deploymentPath: path.join(importedDir, 'replacement.yaml'),
      secretsPath: path.join(importedDir, 'replacement.env'),
      environmentName: 'production',
    });

    await expect(service.loadConfig('production')).resolves.toEqual(
      expect.objectContaining({
        environment: expect.objectContaining({
          name: 'production',
          defaultTag: 'new-tag',
        }),
      })
    );
    await expect(service.loadSecrets('production')).resolves.toEqual({
      JWT_SECRET: 'new',
    });
  });

  it('creates the owner through the admin-api bootstrap endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'owner-1' }),
    }) as typeof fetch;

    const service = new SetupService();
    await service.createOwner('Owner Console', 'OWNER@EXAMPLE.COM', 'password');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8098/api/bootstrap/owner',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('activates setup through the admin-api bootstrap endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ activated: true }),
    }) as typeof fetch;

    const service = new SetupService();
    await service.completeSetup();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8098/api/bootstrap/owner/activate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('does not silently finish setup when the saved owner email already exists', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'owner-1',
            email: 'owner@example.com',
            firstName: 'Existing',
            lastName: 'Owner',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activated: true }),
      });
    global.fetch = fetchMock as typeof fetch;

    const service = new SetupService();
    await service.saveOperator(
      'Owner Console',
      'owner@example.com',
      'password'
    );

    await expect(service.completeSetup()).rejects.toThrow(
      'Owner account owner@example.com already exists. The setup bootstrap does not change existing passwords.'
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/users?scope=owner-console',
      expect.any(Object)
    );
  });

  it('stays editable in reconfigure mode even after setup completed', async () => {
    fs.writeFileSync(path.join(workspaceRoot, '.setup-complete'), 'done');
    fs.writeFileSync(
      path.join(workspaceRoot, 'ops', 'deployments', 'production.yaml'),
      [
        'version: v1alpha1',
        'environment:',
        '  name: production',
        'services: []',
        'apps: []',
        'oauth:',
        '  enabled: false',
        '  bridgeAppId: client-interface',
        '  providers: {}',
      ].join('\n')
    );
    fs.writeFileSync(path.join(workspaceRoot, '.secrets'), 'JWT_SECRET=test\n');
    process.env['SETUP_CONSOLE_MODE'] = 'reconfigure';

    const service = new SetupService();

    await expect(service.getStatus()).resolves.toEqual(
      expect.objectContaining({
        configured: false,
        phase: 'reconfigure',
      })
    );
  });

  it('normalizes legacy config with settings and database slots', async () => {
    fs.writeFileSync(
      path.join(workspaceRoot, 'ops', 'deployments', 'production.yaml'),
      [
        'version: v1alpha1',
        'environment:',
        '  name: production',
        '  namespace: optimistic-tanuki',
        '  targets: [compose]',
        '  composeMode: image',
        '  provider: local',
        '  imageOwner: cjrutherford',
        '  defaultTag: latest',
        '  infra: [postgres, redis]',
        '  capabilities: []',
        '  services: [gateway, authentication, assets]',
        'services:',
        '  - serviceId: gateway',
        '    enabled: true',
        '  - serviceId: authentication',
        '    enabled: true',
        '  - serviceId: assets',
        '    enabled: true',
        'apps:',
        '  - appId: client-interface',
        '    domain: localhost',
        '    uiBaseUrl: http://localhost:8080',
        '    apiBaseUrl: http://localhost:3300',
        '    appType: client',
        '    visibility: public',
        'oauth:',
        '  enabled: true',
        '  bridgeAppId: client-interface',
        '  providers: {}',
      ].join('\n')
    );

    const service = new SetupService();
    const config = await service.loadConfig();

    expect(config.settings?.targets['client-interface']).toEqual(
      expect.objectContaining({
        domain: 'localhost',
        uiBaseUrl: 'http://localhost:8080',
        apiBaseUrl: 'http://localhost:3300',
      })
    );
    expect(config.databases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'postgres-primary', infra: 'postgres' }),
        expect.objectContaining({ id: 'redis-primary', infra: 'redis' }),
      ])
    );
    expect(config.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceId: 'authentication',
          database: expect.objectContaining({ slotId: 'postgres-primary' }),
        }),
      ])
    );
  });

  it('fills missing wizard fields when importing a legacy deployment shape', async () => {
    fs.writeFileSync(
      path.join(workspaceRoot, 'ops', 'deployments', 'production.yaml'),
      [
        'version: 1.0.0',
        'apps:',
        '  - appId: owner-console',
        '    domain: localhost',
        '    uiBaseUrl: http://localhost:8084',
        '    apiBaseUrl: http://localhost:3300',
        '    appType: admin',
        '    visibility: internal',
        '  - appId: client-interface',
        '    domain: optimistic-tanuki.com',
        '    uiBaseUrl: http://localhost:8080',
        '    apiBaseUrl: https://optimistic-tanuki.com/api',
        '    appType: client',
        '    visibility: public',
        'environment:',
        '  name: production',
        '  defaultTag: sha-legacy',
        '  services:',
        '    - gateway',
        '    - authentication',
        'oauth:',
        '  providers:',
        '    google:',
        '      enabled: true',
        '      clientIdKey: GOOGLE_CLIENT_ID',
        '      clientSecretKey: GOOGLE_CLIENT_SECRET',
        '      redirectUri: https://gateway.example.com/api/oauth/callback/google',
        'services:',
        '  - serviceId: gateway',
        '    enabled: true',
        '  - serviceId: authentication',
        '    enabled: true',
      ].join('\n')
    );

    const service = new SetupService();
    const config = await service.loadConfig('production');

    expect(config.environment).toEqual(
      expect.objectContaining({
        name: 'production',
        namespace: 'optimistic-tanuki',
        targets: ['compose'],
        composeMode: 'image',
        provider: 'local',
        imageOwner: 'cjrutherford',
        defaultTag: 'sha-legacy',
      })
    );
    expect(config.oauth).toEqual(
      expect.objectContaining({
        enabled: true,
        bridgeAppId: 'client-interface',
        providers: expect.objectContaining({
          google: expect.objectContaining({
            enabled: true,
          }),
          github: expect.objectContaining({
            enabled: false,
          }),
        }),
      })
    );
  });

  it('builds a settings catalog from app and service config sources', async () => {
    fs.writeFileSync(
      path.join(workspaceRoot, 'ops', 'deployments', 'production.yaml'),
      [
        'version: v1alpha1',
        'environment:',
        '  name: production',
        '  namespace: optimistic-tanuki',
        '  targets: [compose]',
        '  composeMode: image',
        '  provider: local',
        '  imageOwner: cjrutherford',
        '  defaultTag: latest',
        '  infra: [postgres, redis]',
        '  capabilities: []',
        '  services: [authentication, assets]',
        'services:',
        '  - serviceId: authentication',
        '    enabled: true',
        '  - serviceId: assets',
        '    enabled: true',
        'apps:',
        '  - appId: client-interface',
        '    domain: localhost',
        '    uiBaseUrl: http://localhost:8080',
        '    apiBaseUrl: http://localhost:3300',
        '    appType: client',
        '    visibility: public',
        'oauth:',
        '  enabled: true',
        '  bridgeAppId: client-interface',
        '  providers: {}',
      ].join('\n')
    );

    const service = new SetupService();
    const catalog = await service.getSettingsCatalog();

    expect(catalog.groups.map((group) => group.id)).toEqual([
      'clients',
      'admins',
      'services',
    ]);
    expect(catalog.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'client-interface',
          targetKind: 'app',
          fields: expect.arrayContaining([
            expect.objectContaining({ key: 'domain' }),
            expect.objectContaining({ key: 'uiBaseUrl' }),
          ]),
        }),
        expect.objectContaining({
          id: 'authentication',
          targetKind: 'service',
          connections: expect.arrayContaining([
            expect.objectContaining({ infra: 'postgres' }),
          ]),
          secrets: expect.arrayContaining([
            expect.objectContaining({ envKey: 'JWT_SECRET' }),
          ]),
        }),
        expect.objectContaining({
          id: 'assets',
          targetKind: 'service',
          fields: expect.arrayContaining([
            expect.objectContaining({
              envKey: 'LOCAL_STORAGE_PATH',
              valueType: 'path',
            }),
            expect.objectContaining({ envKey: 'STORAGE_STRATEGY' }),
          ]),
          secrets: expect.arrayContaining([
            expect.objectContaining({ envKey: 'S3_SECRET_KEY' }),
          ]),
        }),
      ])
    );
  });
});
