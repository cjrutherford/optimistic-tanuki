import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { dump, load } from 'js-yaml';
import * as nodemailer from 'nodemailer';
import { SetupService } from './setup.service';

/**
 * Configuration-side coverage for SetupService: status probing, environment
 * cloning and takeover, the secrets/email surface, the OAuth endpoints and the
 * service-discovery pass that turns a service's `config.ts` into a settings
 * catalog target.
 *
 * Everything filesystem-shaped runs against a real temp workspace rather than a
 * mocked `fs` namespace, so the assertions read back the bytes the service
 * actually wrote. Only the two genuinely external collaborators are stubbed:
 * `nodemailer` (no SMTP server here) and `global.fetch`.
 */
const mockVerify = jest.fn();
const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    verify: mockVerify,
    sendMail: mockSendMail,
  })),
}));

const createTransportMock = nodemailer.createTransport as unknown as jest.Mock;

describe('SetupService configuration surface', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  let workspaceRoot: string;

  const deploymentsDir = (): string =>
    path.join(workspaceRoot, 'ops', 'deployments');

  const writeYaml = (fileName: string, config: Record<string, unknown>): void =>
    fs.writeFileSync(path.join(deploymentsDir(), fileName), dump(config));

  const readYaml = (fileName: string): Record<string, unknown> =>
    load(
      fs.readFileSync(path.join(deploymentsDir(), fileName), 'utf-8')
    ) as Record<string, unknown>;

  const writeSecrets = (lines: string[]): void =>
    fs.writeFileSync(path.join(workspaceRoot, '.secrets'), lines.join('\n'));

  const writeServiceConfig = (
    relativeDir: string[],
    contents: string[]
  ): void => {
    const dir = path.join(workspaceRoot, 'apps', ...relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.ts'), contents.join('\n'));
  };

  const app = (appId: string, appType: string): Record<string, unknown> => ({
    appId,
    domain: `${appId}.example.com`,
    uiBaseUrl: `https://${appId}.example.com`,
    apiBaseUrl: `https://${appId}.example.com/api`,
    appType,
    visibility: appType === 'admin' ? 'internal' : 'public',
  });

  const baseConfig = (
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> => ({
    version: 'v1alpha1',
    environment: { name: 'production' },
    services: [],
    apps: [app('client-interface', 'client')],
    oauth: { enabled: true, bridgeAppId: 'client-interface', providers: {} },
    ...overrides,
  });

  beforeEach(() => {
    mockVerify.mockReset().mockResolvedValue(true);
    mockSendMail.mockReset().mockResolvedValue({ messageId: 'message-1' });
    createTransportMock.mockClear();

    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-config-'));
    fs.mkdirSync(path.join(workspaceRoot, 'ops', 'deployments'), {
      recursive: true,
    });

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

  describe('getStatus', () => {
    it('short-circuits to ready when the setup-complete marker exists', async () => {
      fs.writeFileSync(path.join(workspaceRoot, '.setup-complete'), 'done');
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const service = new SetupService();

      await expect(service.getStatus()).resolves.toEqual({
        configured: true,
        phase: 'ready',
        wizardStep: 6,
        checks: [
          {
            name: 'deployment-config',
            status: 'info',
            message: 'No production.yaml',
          },
          { name: 'secrets', status: 'info', message: 'No .secrets' },
          {
            name: 'setup-complete',
            status: 'pass',
            message: 'Setup complete',
          },
        ],
      });
      // Ready is decided from disk alone, so the gateway is never probed.
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports the setup phase and an undetected gateway when nothing is configured', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      global.fetch = fetchMock as unknown as typeof fetch;

      // Without AbortSignal.timeout the service must still issue the probe,
      // just without a signal.
      const abortSignal = AbortSignal as unknown as { timeout?: unknown };
      const originalTimeout = abortSignal.timeout;
      abortSignal.timeout = undefined;

      try {
        const service = new SetupService();
        const status = await service.getStatus();

        expect(status).toEqual(
          expect.objectContaining({ configured: false, phase: 'setup' })
        );
        expect(status.checks).toContainEqual({
          name: 'gateway',
          status: 'info',
          message: 'Gateway not detected',
        });
        expect(fetchMock).toHaveBeenCalledWith(
          'http://localhost:3000/api-docs',
          {
            signal: undefined,
          }
        );
      } finally {
        abortSignal.timeout = originalTimeout;
      }
    });

    it('writes the setup-complete marker when the gateway already has owner users', async () => {
      writeYaml('production.yaml', baseConfig());
      writeSecrets(['JWT_SECRET=x']);
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'owner-1', email: 'owner@example.com' }],
        }) as unknown as typeof fetch;

      const service = new SetupService();

      await expect(service.getStatus()).resolves.toEqual(
        expect.objectContaining({
          configured: true,
          phase: 'ready',
          wizardStep: 6,
        })
      );
      expect(fs.existsSync(path.join(workspaceRoot, '.setup-complete'))).toBe(
        true
      );
    });

    it('falls back to the stored wizard step when the gateway has no owner users', async () => {
      writeYaml(
        'production.yaml',
        baseConfig({ wizard: { currentStep: 4, updatedAt: 'then' } })
      );
      writeSecrets(['JWT_SECRET=x']);
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        }) as unknown as typeof fetch;

      const service = new SetupService();
      const status = await service.getStatus();

      expect(status).toEqual(
        expect.objectContaining({
          configured: false,
          phase: 'setup',
          wizardStep: 4,
        })
      );
      expect(status.checks).toContainEqual({
        name: 'gateway',
        status: 'pass',
        message: 'Gateway is running',
      });
      expect(fs.existsSync(path.join(workspaceRoot, '.setup-complete'))).toBe(
        false
      );
    });

    it('reports the error phase when the deployment file cannot be parsed', async () => {
      fs.writeFileSync(
        path.join(deploymentsDir(), 'production.yaml'),
        'environment: [unclosed\n'
      );
      writeSecrets(['JWT_SECRET=x']);
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('down')) as unknown as typeof fetch;

      const service = new SetupService();

      await expect(service.getStatus()).resolves.toEqual(
        expect.objectContaining({ configured: false, phase: 'error' })
      );
    });
  });

  describe('listEnvironments', () => {
    it('prepends the active environment when it has no file yet', async () => {
      writeYaml('qa.yaml', baseConfig());
      const service = new SetupService();

      await expect(service.listEnvironments()).resolves.toEqual({
        activeEnvironment: 'production',
        environments: ['production', 'qa'],
      });
    });

    it('lists only the active environment when the deployments directory is absent', async () => {
      fs.rmSync(deploymentsDir(), { recursive: true, force: true });
      const service = new SetupService();

      await expect(service.listEnvironments()).resolves.toEqual({
        activeEnvironment: 'production',
        environments: ['production'],
      });
    });
  });

  describe('createEnvironment', () => {
    it('rejects a blank environment name', async () => {
      const service = new SetupService();

      await expect(service.createEnvironment('   ')).rejects.toThrow(
        'Environment name is required'
      );
    });

    it('clones the active deployment and its secrets under the new name', async () => {
      writeServiceConfig(
        ['authentication', 'src'],
        [
          'export type AuthConfigType = {',
          '  database: {',
          '    host: string;',
          '  };',
          '};',
          'export const loadConfig = () => ({',
          '  password: process.env.POSTGRES_PASSWORD,',
          '});',
        ]
      );
      writeYaml(
        'production.yaml',
        baseConfig({
          services: [
            {
              serviceId: 'authentication',
              enabled: true,
              database: { slotId: 'postgres-primary', username: 'auth_user' },
            },
          ],
          apps: [
            app('client-interface', 'client'),
            app('owner-console', 'admin'),
          ],
          oauth: {
            enabled: true,
            bridgeAppId: 'client-interface',
            providers: {
              google: {
                enabled: true,
                clientIdKey: 'GOOGLE_CLIENT_ID',
                clientSecretKey: 'GOOGLE_CLIENT_SECRET',
                redirectUri: 'https://example.com/cb',
              },
            },
          },
          databases: [
            {
              id: 'postgres-primary',
              infra: 'postgres',
              provisionMode: 'managed',
              host: 'postgres',
              port: 5432,
              databaseName: 'postgres',
              username: 'postgres',
              passwordKey: 'POSTGRES_PASSWORD',
            },
          ],
          settings: {
            global: { LOG_LEVEL: 'debug' },
            groups: { services: { TIMEOUT: '30' } },
            targets: { 'client-interface': { domain: 'kept.example.com' } },
          },
          wizard: { currentStep: 3, updatedAt: '2020-01-01T00:00:00.000Z' },
        })
      );
      writeSecrets(['JWT_SECRET=shared', 'GOOGLE_CLIENT_ID=gid']);

      const service = new SetupService();
      const cloned = await service.createEnvironment('  staging  ');

      expect(cloned.environment.name).toBe('staging');
      expect(cloned.wizard?.currentStep).toBe(3);
      // The clone is stamped with a fresh timestamp rather than the source one.
      expect(cloned.wizard?.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');

      await expect(service.loadConfig('staging')).resolves.toEqual(
        expect.objectContaining({
          environment: expect.objectContaining({ name: 'staging' }),
          settings: expect.objectContaining({
            global: { LOG_LEVEL: 'debug' },
            groups: expect.objectContaining({ services: { TIMEOUT: '30' } }),
            targets: expect.objectContaining({
              'client-interface': expect.objectContaining({
                domain: 'kept.example.com',
              }),
            }),
          }),
          databases: expect.arrayContaining([
            expect.objectContaining({ id: 'postgres-primary' }),
          ]),
        })
      );
      await expect(service.loadSecrets('staging')).resolves.toEqual({
        JWT_SECRET: 'shared',
        GOOGLE_CLIENT_ID: 'gid',
      });
      // The source environment is untouched by the clone.
      expect(readYaml('production.yaml')['environment']).toEqual(
        expect.objectContaining({ name: 'production' })
      );
    });
  });

  describe('saveConfig', () => {
    it('creates the deployment directory when it does not exist yet', async () => {
      process.env['ADMIN_API_DEPLOYMENT_PATH'] =
        './ops/generated/production.yaml';
      const service = new SetupService();

      await service.saveConfig(
        baseConfig() as unknown as Parameters<SetupService['saveConfig']>[0]
      );

      const written = load(
        fs.readFileSync(
          path.join(workspaceRoot, 'ops', 'generated', 'production.yaml'),
          'utf-8'
        )
      ) as Record<string, unknown>;
      expect(written['environment']).toEqual(
        expect.objectContaining({
          name: 'production',
          namespace: 'optimistic-tanuki',
          composeMode: 'image',
        })
      );
    });
  });

  describe('secrets parsing', () => {
    it('ignores comments and blank lines and strips surrounding quotes', async () => {
      writeSecrets([
        '# a comment',
        '',
        'PLAIN=value',
        'DOUBLE="quoted value"',
        "SINGLE='quoted value'",
        'WITH_EQUALS=a=b',
        'not-a-pair',
        '  SPACED  =  padded  ',
      ]);
      const service = new SetupService();

      await expect(service.loadSecrets()).resolves.toEqual({
        PLAIN: 'value',
        DOUBLE: 'quoted value',
        SINGLE: 'quoted value',
        WITH_EQUALS: 'a=b',
        SPACED: 'padded',
      });
    });
  });

  describe('email configuration', () => {
    it('reports Stalwart defaults when no SMTP secrets are stored', async () => {
      const service = new SetupService();

      await expect(service.getEmailStatus()).resolves.toEqual({
        host: 'mail.christopherrutherford.net',
        port: 465,
        secure: true,
        user: '',
        passwordPresent: false,
        from: '',
        configured: false,
      });
    });

    it('reports the stored SMTP settings as configured', async () => {
      writeSecrets([
        'SMTP_HOST=smtp.example.com',
        'SMTP_PORT=587',
        'SMTP_SECURE=false',
        'SMTP_USER=no-reply@example.com',
        'SMTP_PASS=hunter2',
        'SMTP_FROM=hello@example.com',
      ]);
      const service = new SetupService();

      await expect(service.getEmailStatus()).resolves.toEqual({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        user: 'no-reply@example.com',
        passwordPresent: true,
        from: 'hello@example.com',
        configured: true,
      });
    });

    it('persists SMTP settings, defaulting the host, port, TLS flag and sender', async () => {
      const service = new SetupService();

      await service.configureEmail({ user: '  ops@example.com  ' });

      await expect(service.loadSecrets()).resolves.toEqual({
        SMTP_HOST: 'mail.christopherrutherford.net',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'ops@example.com',
        SMTP_FROM: 'ops@example.com',
      });
    });

    it('keeps the existing password when a new one is not supplied', async () => {
      writeSecrets(['SMTP_PASS=existing', 'JWT_SECRET=untouched']);
      const service = new SetupService();

      await service.configureEmail({
        host: '  smtp.example.com ',
        port: 2525,
        secure: false,
        user: 'ops@example.com',
        from: ' billing@example.com ',
      });

      await expect(service.loadSecrets()).resolves.toEqual(
        expect.objectContaining({
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: '2525',
          SMTP_SECURE: 'false',
          SMTP_PASS: 'existing',
          SMTP_FROM: 'billing@example.com',
          JWT_SECRET: 'untouched',
        })
      );
    });

    it('rejects an out-of-range port before writing anything to disk', async () => {
      const service = new SetupService();

      await expect(
        service.configureEmail({ user: 'ops@example.com', port: 70000 })
      ).rejects.toThrow('SMTP_PORT must be a valid TCP port');
      expect(fs.existsSync(path.join(workspaceRoot, '.secrets'))).toBe(false);
    });

    it('verifies the transport and sends a test message from the stored sender', async () => {
      writeSecrets([
        'SMTP_HOST=smtp.example.com',
        'SMTP_PORT=587',
        'SMTP_USER=no-reply@example.com',
        'SMTP_PASS=hunter2',
        'SMTP_FROM=hello@example.com',
      ]);
      const service = new SetupService();

      await expect(
        service.testEmail('  someone@example.com  ', undefined)
      ).resolves.toEqual({ success: true, messageId: 'message-1' });

      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 587,
          auth: { user: 'no-reply@example.com', pass: 'hunter2' },
        })
      );
      expect(mockVerify).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'hello@example.com',
          to: 'someone@example.com',
          subject: 'Optimistic Tanuki email connection test',
          html: expect.stringContaining('Email connection confirmed'),
          text: expect.stringContaining('Email connection confirmed'),
        })
      );
    });

    it('prefers an explicitly supplied sender over the stored one', async () => {
      writeSecrets(['SMTP_FROM=hello@example.com', 'SMTP_USER=u@example.com']);
      const service = new SetupService();

      await service.testEmail('to@example.com', '  override@example.com ');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'override@example.com' })
      );
    });
  });

  describe('OAuth configuration', () => {
    const oauthConfig = (): Record<string, unknown> =>
      baseConfig({
        oauth: {
          enabled: true,
          bridgeAppId: 'client-interface',
          providers: {
            google: {
              enabled: true,
              clientIdKey: 'GOOGLE_CLIENT_ID',
              clientSecretKey: 'GOOGLE_CLIENT_SECRET',
              redirectUri: 'https://gw.example.com/cb/google',
            },
            github: {
              enabled: true,
              clientIdKey: 'GITHUB_CLIENT_ID',
              clientSecretKey: 'GITHUB_CLIENT_SECRET',
              redirectUri: '',
            },
          },
        },
        apps: [
          app('client-interface', 'client'),
          app('owner-console', 'admin'),
        ],
      });

    it('describes each provider with its endpoints, scopes and validation state', async () => {
      writeYaml('production.yaml', oauthConfig());
      writeSecrets(['GOOGLE_CLIENT_ID=gid', 'GOOGLE_CLIENT_SECRET=gsecret']);
      const service = new SetupService();

      const result = await service.getOAuthProviders();

      expect(result.enabled).toBe(true);
      expect(result.bridgeAppId).toBe('client-interface');
      expect(result.bridgeAppDomain).toBe('client-interface.example.com');
      expect(result.bridgeAppBaseUrl).toBe(
        'https://client-interface.example.com'
      );

      const google = result.providers.find((p) => p.name === 'google');
      expect(google).toEqual(
        expect.objectContaining({
          enabled: true,
          status: 'configured',
          clientIdPresent: true,
          clientSecretPresent: true,
          clientIdValue: 'gid',
          clientSecretValue: 'gsecret',
          authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenEndpoint: 'https://oauth2.googleapis.com/token',
          userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
          scopes: ['openid', 'email', 'profile'],
          validationErrors: [],
          lastTested: null,
        })
      );

      // Enabled but with nothing filled in: every missing piece is reported.
      expect(result.providers.find((p) => p.name === 'github')).toEqual(
        expect.objectContaining({
          status: 'pending',
          validationErrors: [
            'clientId is missing',
            'clientSecret is missing',
            'redirectUri is missing',
          ],
        })
      );

      // Disabled providers are normalized in but raise no errors.
      expect(result.providers.find((p) => p.name === 'facebook')).toEqual(
        expect.objectContaining({
          enabled: false,
          status: 'pending',
          validationErrors: [],
          scopes: ['email', 'public_profile'],
        })
      );
    });

    it('lists apps with their eligibility and the enabled providers', async () => {
      writeYaml('production.yaml', oauthConfig());
      const service = new SetupService();

      await expect(service.getOAuthApps()).resolves.toEqual({
        bridgeAppId: 'client-interface',
        bridgeAppDomain: 'client-interface.example.com',
        bridgeAppBaseUrl: 'https://client-interface.example.com',
        apps: [
          {
            appId: 'client-interface',
            domain: 'client-interface.example.com',
            oauthEligible: true,
            allowedProviders: ['google', 'github'],
            returnToOrigin: 'https://client-interface.example.com',
          },
          {
            appId: 'owner-console',
            domain: 'owner-console.example.com',
            oauthEligible: true,
            allowedProviders: ['google', 'github'],
            returnToOrigin: 'https://owner-console.example.com',
          },
        ],
      });
    });

    it('writes provider credentials to secrets and the provider block to the deployment', async () => {
      writeYaml('production.yaml', oauthConfig());
      writeSecrets(['JWT_SECRET=keep']);
      const service = new SetupService();

      await service.configureOAuthProvider('GitHub', {
        enabled: true,
        clientId: 'gh-id',
        clientSecret: 'gh-secret',
        redirectUri: 'https://gw.example.com/cb/github',
      });

      await expect(service.loadSecrets()).resolves.toEqual({
        JWT_SECRET: 'keep',
        GITHUB_CLIENT_ID: 'gh-id',
        GITHUB_CLIENT_SECRET: 'gh-secret',
      });

      const oauth = readYaml('production.yaml')['oauth'] as Record<
        string,
        Record<string, unknown>
      >;
      expect(oauth['providers']['github']).toEqual({
        enabled: true,
        clientIdKey: 'GITHUB_CLIENT_ID',
        clientSecretKey: 'GITHUB_CLIENT_SECRET',
        redirectUri: 'https://gw.example.com/cb/github',
      });
    });

    it('creates the providers map when the deployment has an empty oauth block', async () => {
      writeYaml(
        'production.yaml',
        baseConfig({
          oauth: { enabled: true, bridgeAppId: 'client-interface' },
        })
      );
      const service = new SetupService();

      await service.configureOAuthProvider('microsoft', {
        enabled: false,
        clientId: 'ms-id',
        clientSecret: 'ms-secret',
        redirectUri: '',
      });

      const oauth = readYaml('production.yaml')['oauth'] as Record<
        string,
        Record<string, unknown>
      >;
      expect(oauth['providers']['microsoft']).toEqual(
        expect.objectContaining({
          enabled: false,
          clientIdKey: 'MICROSOFT_CLIENT_ID',
        })
      );
    });

    it('still stores the credentials when there is no deployment file to patch', async () => {
      const service = new SetupService();

      await service.configureOAuthProvider('google', {
        enabled: true,
        clientId: 'g-id',
        clientSecret: 'g-secret',
        redirectUri: 'https://gw.example.com/cb/google',
      });

      await expect(service.loadSecrets()).resolves.toEqual({
        GOOGLE_CLIENT_ID: 'g-id',
        GOOGLE_CLIENT_SECRET: 'g-secret',
      });
      expect(
        fs.existsSync(path.join(deploymentsDir(), 'production.yaml'))
      ).toBe(false);
    });
  });

  describe('testOAuthProvider', () => {
    it('reports every endpoint healthy when the token endpoint rejects bad credentials', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({ ok: true }) as unknown as typeof fetch;

      const service = new SetupService();
      const result = await service.testOAuthProvider('google');

      expect(result).toEqual(
        expect.objectContaining({
          provider: 'google',
          reachable: true,
          credentialValid: true,
          authorizationEndpointOk: true,
          tokenEndpointOk: true,
          userInfoEndpointOk: true,
          errors: [],
        })
      );
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('flags a token endpoint that accepts an obviously invalid code', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: true }) as unknown as typeof fetch;

      const service = new SetupService();

      await expect(service.testOAuthProvider('github')).resolves.toEqual(
        expect.objectContaining({
          credentialValid: false,
          tokenEndpointOk: false,
          errors: ['Token endpoint accepted invalid credentials'],
        })
      );
    });

    it('flags an unexpected token endpoint status', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true }) as unknown as typeof fetch;

      const service = new SetupService();

      await expect(service.testOAuthProvider('microsoft')).resolves.toEqual(
        expect.objectContaining({
          tokenEndpointOk: false,
          errors: ['Token endpoint returned unexpected status 503'],
        })
      );
    });

    it('reports every endpoint unreachable when the network is down', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

      const service = new SetupService();

      await expect(service.testOAuthProvider('facebook')).resolves.toEqual(
        expect.objectContaining({
          reachable: false,
          authorizationEndpointOk: false,
          tokenEndpointOk: false,
          userInfoEndpointOk: false,
          errors: [
            'Authorization endpoint unreachable',
            'Token endpoint unreachable',
            'User info endpoint unreachable',
          ],
        })
      );
    });
  });

  describe('takeOverDeployment', () => {
    const externalDir = (): string => path.join(workspaceRoot, 'external');

    const writeExternalDeployment = (fileName: string): string => {
      fs.mkdirSync(externalDir(), { recursive: true });
      const filePath = path.join(externalDir(), fileName);
      fs.writeFileSync(filePath, dump(baseConfig()));
      return filePath;
    };

    it('rejects a blank deployment path', async () => {
      const service = new SetupService();

      await expect(
        service.takeOverDeployment({ deploymentPath: '   ' })
      ).rejects.toThrow('A deployment path is required');
    });

    it('rejects a deployment path that does not exist', async () => {
      const service = new SetupService();

      await expect(
        service.takeOverDeployment({ deploymentPath: './missing/legacy.yaml' })
      ).rejects.toThrow('Deployment file not found');
    });

    it('rejects an explicit secrets path that does not exist', async () => {
      const deploymentPath = writeExternalDeployment('legacy.yaml');
      const service = new SetupService();

      await expect(
        service.takeOverDeployment({
          deploymentPath,
          secretsPath: path.join(externalDir(), 'missing.env'),
        })
      ).rejects.toThrow('Secrets file not found');
    });

    it('adopts a deployment with no sibling secrets file and no explicit name', async () => {
      const deploymentPath = writeExternalDeployment('legacy.yaml');
      const service = new SetupService();

      const result = await service.takeOverDeployment({ deploymentPath });

      expect(result.environment).toBe('legacy');
      expect(result.data.environment.name).toBe('legacy');
      await expect(service.loadSecrets('legacy')).resolves.toEqual({});
    });

    it('discovers a sibling .secrets.env file next to the deployment', async () => {
      const deploymentPath = writeExternalDeployment('legacy.yaml');
      fs.writeFileSync(
        path.join(externalDir(), 'legacy.secrets.env'),
        'JWT_SECRET=sibling\n'
      );
      const service = new SetupService();

      await service.takeOverDeployment({ deploymentPath });

      await expect(service.loadSecrets('legacy')).resolves.toEqual({
        JWT_SECRET: 'sibling',
      });
    });

    it('routes imported env keys to secrets, app targets, connections and global settings', async () => {
      fs.mkdirSync(externalDir(), { recursive: true });
      fs.writeFileSync(
        path.join(externalDir(), 'legacy.yaml'),
        dump(baseConfig({ apps: [app('client-interface', 'client')] }))
      );
      fs.writeFileSync(
        path.join(externalDir(), 'legacy.env'),
        [
          'CLIENT_INTERFACE_API_BASE_URL=https://api.legacy.example.com',
          'REDIS_HOST=redis.internal',
          'REDIS_PORT=6380',
          'REDIS_DB=3',
          'LOG_LEVEL=debug',
          'SOME_ACCESS_KEY=ak-1',
        ].join('\n')
      );

      const service = new SetupService();
      const result = await service.takeOverDeployment({
        deploymentPath: path.join(externalDir(), 'legacy.yaml'),
        secretsPath: path.join(externalDir(), 'legacy.env'),
        environmentName: 'adopted',
      });

      expect(result.data.settings?.targets['client-interface']).toEqual(
        expect.objectContaining({
          apiBaseUrl: 'https://api.legacy.example.com',
        })
      );
      expect(result.data.settings?.global).toEqual({ LOG_LEVEL: 'debug' });
      expect(result.data.databases).toEqual([
        expect.objectContaining({
          id: 'redis-primary',
          infra: 'redis',
          host: 'redis.internal',
          port: 6380,
          databaseName: '3',
          username: 'default',
          passwordKey: 'REDIS_PASSWORD',
        }),
      ]);
      await expect(service.loadSecrets('adopted')).resolves.toEqual({
        SOME_ACCESS_KEY: 'ak-1',
      });
    });

    it('falls back to the default redis port when the imported value is not a number', async () => {
      fs.mkdirSync(externalDir(), { recursive: true });
      fs.writeFileSync(
        path.join(externalDir(), 'legacy.yaml'),
        dump(baseConfig())
      );
      fs.writeFileSync(
        path.join(externalDir(), 'legacy.env'),
        'REDIS_PORT=not-a-port\n'
      );

      const service = new SetupService();
      const result = await service.takeOverDeployment({
        deploymentPath: path.join(externalDir(), 'legacy.yaml'),
        secretsPath: path.join(externalDir(), 'legacy.env'),
        environmentName: 'adopted',
      });

      expect(result.data.databases).toEqual([
        expect.objectContaining({ id: 'redis-primary', port: 6379 }),
      ]);
    });
  });

  describe('browseHostPath', () => {
    it('sorts directories before files and files alphabetically, hiding dotfiles', async () => {
      const browseRoot = path.join(workspaceRoot, 'browse');
      fs.mkdirSync(path.join(browseRoot, 'zeta-dir'), { recursive: true });
      fs.mkdirSync(path.join(browseRoot, 'alpha-dir'), { recursive: true });
      fs.writeFileSync(path.join(browseRoot, 'beta.txt'), 'b');
      fs.writeFileSync(path.join(browseRoot, 'alpha.txt'), 'a');
      fs.writeFileSync(path.join(browseRoot, '.hidden'), 'x');

      const service = new SetupService();
      const listing = await service.browseHostPath(browseRoot);

      expect(listing.entries.map((entry) => entry.name)).toEqual([
        'alpha-dir',
        'zeta-dir',
        'alpha.txt',
        'beta.txt',
      ]);
      expect(listing.parentPath).toBe(workspaceRoot);
    });

    it('lists the containing directory when given a file path', async () => {
      const filePath = path.join(workspaceRoot, 'ops', 'deployments', 'a.yaml');
      fs.writeFileSync(filePath, 'x');

      const service = new SetupService();

      await expect(service.browseHostPath(filePath)).resolves.toEqual(
        expect.objectContaining({ currentPath: deploymentsDir() })
      );
    });

    it('throws when neither the path nor its parent directory exists', async () => {
      const service = new SetupService();

      await expect(
        service.browseHostPath(path.join(workspaceRoot, 'nope', 'deeper', 'x'))
      ).rejects.toThrow('Host path not found');
    });

    it('defaults to the workspace root when no path is supplied', async () => {
      const service = new SetupService();

      await expect(service.browseHostPath()).resolves.toEqual(
        expect.objectContaining({ currentPath: workspaceRoot })
      );
    });
  });

  describe('saved operator summary', () => {
    it('returns null when nothing is saved and the gateway lists no users', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => [],
        }) as unknown as typeof fetch;

      const service = new SetupService();

      await expect(service.getSavedOperatorSummary()).resolves.toBeNull();
    });

    it('ignores a corrupt operator file', async () => {
      fs.writeFileSync(
        path.join(workspaceRoot, '.setup-operator.json'),
        '{ not json'
      );
      global.fetch = jest
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => [],
        }) as unknown as typeof fetch;

      const service = new SetupService();

      await expect(service.getSavedOperatorSummary()).resolves.toBeNull();
    });

    it('treats a non-ok users response as no existing users', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 500,
        }) as unknown as typeof fetch;

      const service = new SetupService();
      await service.saveOperator('Ops', 'ops@example.com', 'pw');

      await expect(service.getSavedOperatorSummary()).resolves.toEqual(
        expect.objectContaining({ source: 'saved', existingCount: 0 })
      );
    });

    it('reads a wrapped user payload and drops entries without an email', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            null,
            'not-an-object',
            { id: 'no-email' },
            {
              userId: 'u-1',
              userEmail: '  Ops@Example.com ',
              fn: 'Ops',
              ln: 'Lead',
            },
          ],
        }),
      }) as unknown as typeof fetch;

      const service = new SetupService();

      await expect(service.getSavedOperatorSummary()).resolves.toEqual({
        name: 'Ops Lead',
        email: 'ops@example.com',
        passwordSaved: false,
        source: 'existing',
        existingUser: true,
        existingCount: 1,
        userId: 'u-1',
      });
    });
  });

  describe('service discovery for the settings catalog', () => {
    it('infers value types, placeholders and connections from a service config source', async () => {
      writeServiceConfig(
        ['videos', 'src'],
        [
          'export type VideosConfigType = {',
          '  // the parser skips lines that are not field declarations',
          '  listenPort: number;',
          '  database: {',
          '    host: string;',
          '  };',
          '  redis: {',
          '    host: string;',
          '  };',
          '};',
          'export const loadConfig = () => ({',
          "  seedDir: process.env['VIDEO_SEED_SOURCE_DIR'],",
          "  registry: process.env['APP_REGISTRY_HOST_PATH'],",
          "  cacheDir: process.env['VIDEOS_CACHE_DIR'],",
          "  certFile: process.env['VIDEOS_CERT_FILE'],",
          "  dataPath: process.env['VIDEOS_DATA_PATH'],",
          "  endpoint: process.env['VIDEOS_API_ENDPOINT'],",
          "  publicUrl: process.env['VIDEOS_PUBLIC_URL'],",
          "  port: process.env['VIDEOS_PORT'],",
          "  name: process.env['VIDEOS_NAME'],",
          "  token: process.env['VIDEOS_API_TOKEN'],",
          '});',
        ]
      );
      writeYaml(
        'production.yaml',
        baseConfig({
          services: [{ serviceId: 'videos', enabled: true }],
          apps: [],
        })
      );

      const service = new SetupService();
      const catalog = await service.getSettingsCatalog();
      const videos = catalog.targets.find((target) => target.id === 'videos');

      expect(videos).toEqual(
        expect.objectContaining({
          label: 'Videos',
          targetKind: 'service',
          groupId: 'services',
          sourcePath: path.join(
            workspaceRoot,
            'apps',
            'videos',
            'src',
            'config.ts'
          ),
        })
      );
      // Postgres/Redis are inferred from the config type block even though no
      // POSTGRES_/REDIS_ env key appears in the source.
      expect(videos?.connections).toEqual([
        expect.objectContaining({
          infra: 'postgres',
          fieldId: 'videos:postgres',
        }),
        expect.objectContaining({ infra: 'redis', fieldId: 'videos:redis' }),
      ]);

      const byKey = new Map(
        (videos?.fields || []).map((field) => [field.envKey, field])
      );
      expect(byKey.get('VIDEO_SEED_SOURCE_DIR')?.valueType).toBe('directory');
      expect(byKey.get('APP_REGISTRY_HOST_PATH')?.valueType).toBe('file');
      expect(byKey.get('VIDEOS_CACHE_DIR')?.valueType).toBe('directory');
      expect(byKey.get('VIDEOS_CERT_FILE')?.valueType).toBe('file');
      expect(byKey.get('VIDEOS_DATA_PATH')?.valueType).toBe('path');
      expect(byKey.get('VIDEOS_API_ENDPOINT')?.valueType).toBe('url');
      expect(byKey.get('VIDEOS_PUBLIC_URL')?.valueType).toBe('url');
      expect(byKey.get('VIDEOS_PORT')?.valueType).toBe('port');
      expect(byKey.get('VIDEOS_NAME')?.valueType).toBe('string');

      expect(byKey.get('VIDEOS_PORT')?.placeholder).toBe('3000');
      expect(byKey.get('VIDEOS_CACHE_DIR')?.placeholder).toBe(
        '/srv/optimistic-tanuki/data'
      );
      expect(byKey.get('VIDEOS_CERT_FILE')?.placeholder).toBe(
        '/srv/optimistic-tanuki/config/file.json'
      );
      expect(byKey.get('VIDEOS_API_ENDPOINT')?.placeholder).toBe(
        'https://example.com'
      );
      expect(byKey.get('VIDEOS_NAME')?.placeholder).toBeUndefined();

      // Secrets are split out of the field list entirely.
      expect(byKey.has('VIDEOS_API_TOKEN')).toBe(false);
      expect(videos?.secrets).toEqual([
        expect.objectContaining({
          envKey: 'VIDEOS_API_TOKEN',
          label: 'VIDEOS API TOKEN',
          targetId: 'videos',
          targetLabel: 'Videos',
        }),
      ]);
    });

    it('resolves a service through its directory override and nested loadConfig path', async () => {
      const dir = path.join(
        workspaceRoot,
        'apps',
        'ai-orchestrator',
        'src',
        'app'
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'loadConfig.ts'),
        [
          'export const loadConfig = () => ({',
          "  model: process.env['AI_MODEL_NAME'],",
          '});',
        ].join('\n')
      );
      writeYaml(
        'production.yaml',
        baseConfig({
          services: [{ serviceId: 'ai-orchestration', enabled: true }],
          apps: [],
        })
      );

      const service = new SetupService();
      const catalog = await service.getSettingsCatalog();

      expect(
        catalog.targets.find((target) => target.id === 'ai-orchestration')
      ).toEqual(
        expect.objectContaining({
          label: 'AI Orchestration',
          sourcePath: path.join(dir, 'loadConfig.ts'),
          connections: [],
          fields: [expect.objectContaining({ envKey: 'AI_MODEL_NAME' })],
        })
      );
    });

    it('returns an empty target for a service with no discoverable config source', async () => {
      writeYaml(
        'production.yaml',
        baseConfig({
          services: [
            { serviceId: 'custom-thing', enabled: true },
            { serviceId: 'disabled-thing', enabled: false },
          ],
          apps: [app('owner-console', 'admin')],
        })
      );

      const service = new SetupService();
      const catalog = await service.getSettingsCatalog();

      expect(catalog.targets.map((target) => target.id)).toEqual([
        'owner-console',
        'custom-thing',
      ]);
      expect(
        catalog.targets.find((target) => target.id === 'custom-thing')
      ).toEqual(
        expect.objectContaining({
          label: 'Custom Thing',
          sourcePath: undefined,
          fields: [],
          secrets: [],
          connections: [],
        })
      );
      // Admin apps land in the admins group rather than clients.
      expect(
        catalog.targets.find((target) => target.id === 'owner-console')?.groupId
      ).toBe('admins');
    });
  });

  describe('normalizeConfig bridge app defaulting', () => {
    it.each([
      {
        desc: 'prefers client-interface',
        apps: [
          app('owner-console', 'admin'),
          app('client-interface', 'client'),
        ],
        expected: 'client-interface',
      },
      {
        desc: 'falls back to the first client app',
        apps: [app('owner-console', 'admin'), app('storefront', 'client')],
        expected: 'storefront',
      },
      {
        desc: 'falls back to the first admin app',
        apps: [app('owner-console', 'admin')],
        expected: 'owner-console',
      },
      {
        desc: 'falls back to the first app of any type',
        apps: [app('kiosk', 'kiosk')],
        expected: 'kiosk',
      },
      {
        desc: 'falls back to client-interface when there are no apps',
        apps: [],
        expected: 'client-interface',
      },
    ])('$desc', async ({ apps, expected }) => {
      writeYaml(
        'production.yaml',
        baseConfig({ apps, oauth: { enabled: true, providers: {} } })
      );

      const service = new SetupService();
      const config = await service.loadConfig();

      expect(config.oauth.bridgeAppId).toBe(expected);
    });

    it('supplies the default gateway block when the deployment omits one', async () => {
      writeYaml('production.yaml', baseConfig());
      const service = new SetupService();

      await expect(service.loadConfig()).resolves.toEqual(
        expect.objectContaining({
          gateway: {
            publicUrl: '',
            publicWsUrl: '',
            internalUrl: 'http://gateway:3000',
            internalWsUrl: 'http://gateway:3300',
          },
        })
      );
    });

    it('keeps an explicit gateway block and explicit environment lists', async () => {
      writeYaml(
        'production.yaml',
        baseConfig({
          gateway: {
            publicUrl: 'https://gw.example.com',
            publicWsUrl: 'wss://gw.example.com',
            internalUrl: 'http://gateway:3000',
            internalWsUrl: 'http://gateway:3300',
          },
          environment: {
            name: 'production',
            targets: ['compose', 'k8s'],
            infra: ['postgres'],
            capabilities: ['video'],
            services: ['gateway'],
          },
        })
      );
      const service = new SetupService();
      const config = await service.loadConfig();

      expect(config.gateway?.publicUrl).toBe('https://gw.example.com');
      expect(config.environment).toEqual(
        expect.objectContaining({
          targets: ['compose', 'k8s'],
          infra: ['postgres'],
          capabilities: ['video'],
          services: ['gateway'],
        })
      );
    });
  });
});
