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

  it('creates the owner through the owner-console app scope', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: { id: 'owner-1' } } }),
    }) as typeof fetch;

    const service = new SetupService();
    await service.createOwner('Owner Console', 'OWNER@EXAMPLE.COM', 'password');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/authentication/register',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-ot-appscope': 'owner-console',
        }),
      })
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
            expect.objectContaining({ envKey: 'LOCAL_STORAGE_PATH' }),
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
