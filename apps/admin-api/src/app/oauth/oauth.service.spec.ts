import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { OAuthService } from './oauth.service';

const SAMPLE_CONFIG = `
oauth:
  enabled: true
  bridgeAppId: client-interface
  providers:
    google:
      enabled: true
      clientIdKey: GOOGLE_CLIENT_ID
      clientSecretKey: GOOGLE_CLIENT_SECRET
      redirectUri: https://example.com/cb/google
    github:
      enabled: false
      clientIdKey: GITHUB_CLIENT_ID
      clientSecretKey: GITHUB_CLIENT_SECRET
      redirectUri: ''
apps:
  - appId: client-interface
    domain: app.example.com
    appType: client
    uiBaseUrl: https://app.example.com
  - appId: admin-console
    domain: admin.example.com
    appType: admin
    uiBaseUrl: https://admin.example.com
  - appId: internal-tool
    domain: internal.example.com
    appType: internal
    uiBaseUrl: https://internal.example.com
`;

const CONFIG_MISSING_BRIDGE_APP = `
oauth:
  enabled: true
  bridgeAppId: missing-app
  providers:
    google:
      enabled: true
      clientIdKey: GOOGLE_CLIENT_ID
      clientSecretKey: GOOGLE_CLIENT_SECRET
      redirectUri: ''
apps: []
`;

const CONFIG_OAUTH_DISABLED = `
oauth:
  enabled: false
  bridgeAppId: client-interface
  providers: {}
apps: []
`;

describe('OAuthService', () => {
  let workspaceRoot: string;
  let deploymentPath: string;
  let secretsPath: string;

  const buildService = () =>
    new OAuthService({
      get: jest.fn((key: string) => {
        switch (key) {
          case 'admin-api.workspaceRoot':
            return workspaceRoot;
          case 'admin-api.deploymentPath':
            return deploymentPath;
          case 'admin-api.secretsPath':
            return secretsPath;
          default:
            return undefined;
        }
      }),
    } as unknown as ConfigService);

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oauth-service-'));
    deploymentPath = './production.yaml';
    secretsPath = './.secrets';
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { force: true, recursive: true });
  });

  function writeConfig(content: string) {
    fs.writeFileSync(path.join(workspaceRoot, 'production.yaml'), content);
  }

  function writeSecrets(content: string) {
    fs.writeFileSync(path.join(workspaceRoot, '.secrets'), content);
  }

  describe('getProviders', () => {
    it('marks providers configured when credentials are present, pending otherwise', async () => {
      writeConfig(SAMPLE_CONFIG);
      writeSecrets(
        'GOOGLE_CLIENT_ID=abc\nGOOGLE_CLIENT_SECRET=secret\n# comment\n\n'
      );
      const service = buildService();
      const result = await service.getProviders();

      expect(result.enabled).toBe(true);
      expect(result.bridgeAppId).toBe('client-interface');
      expect(result.bridgeAppDomain).toBe('app.example.com');

      const google = result.providers.find((p) => p.name === 'google');
      expect(google).toMatchObject({
        enabled: true,
        status: 'configured',
        clientIdPresent: true,
        clientSecretPresent: true,
        redirectUri: 'https://example.com/cb/google',
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        userInfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',
        scopes: ['openid', 'profile', 'email'],
        validationErrors: [],
      });

      const github = result.providers.find((p) => p.name === 'github');
      expect(github).toMatchObject({
        enabled: false,
        status: 'pending',
        clientIdPresent: false,
        clientSecretPresent: false,
        validationErrors: [],
        scopes: ['read:user', 'user:email'],
      });
    });

    it('falls back to empty bridge domain when no secrets file exists and bridge app is missing', async () => {
      writeConfig(CONFIG_MISSING_BRIDGE_APP);
      const service = buildService();
      const result = await service.getProviders();
      expect(result.bridgeAppDomain).toBe('');
      const google = result.providers.find((p) => p.name === 'google');
      expect(google?.status).toBe('pending');
      expect(google?.validationErrors).toEqual(
        expect.arrayContaining([
          'clientId is missing',
          'clientSecret is missing',
          'redirectUri is missing',
        ])
      );
    });

    it('quote-strips secret values and skips blank/comment lines', async () => {
      writeConfig(SAMPLE_CONFIG);
      writeSecrets(
        '# leading comment\n\nGOOGLE_CLIENT_ID="quoted-id"\nGOOGLE_CLIENT_SECRET=\'quoted-secret\'\n'
      );
      const service = buildService();
      const result = await service.getProviders();
      const google = result.providers.find((p) => p.name === 'google');
      expect(google?.clientIdPresent).toBe(true);
      expect(google?.clientSecretPresent).toBe(true);
    });
  });

  describe('getApps', () => {
    it('flags client/admin apps as oauth-eligible and lists enabled providers', async () => {
      writeConfig(SAMPLE_CONFIG);
      const service = buildService();
      const result = await service.getApps();
      expect(result.apps).toHaveLength(3);
      const client = result.apps.find((a) => a.appId === 'client-interface');
      expect(client).toMatchObject({
        oauthEligible: true,
        allowedProviders: ['google'],
        returnToOrigin: 'https://app.example.com',
      });
      const internal = result.apps.find((a) => a.appId === 'internal-tool');
      expect(internal?.oauthEligible).toBe(false);
    });
  });

  describe('validate', () => {
    it('returns valid immediately when oauth is disabled', async () => {
      writeConfig(CONFIG_OAUTH_DISABLED);
      const service = buildService();
      await expect(service.validate()).resolves.toEqual({
        valid: true,
        issues: [],
      });
    });

    it('flags a missing bridge app and missing credentials as errors', async () => {
      writeConfig(CONFIG_MISSING_BRIDGE_APP);
      const service = buildService();
      const result = await service.validate();
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.message.includes('Bridge app'))).toBe(
        true
      );
      expect(result.issues.some((i) => i.provider === 'google')).toBe(true);
    });

    it('is valid when the enabled provider has full credentials and a bridge app', async () => {
      writeConfig(SAMPLE_CONFIG);
      writeSecrets('GOOGLE_CLIENT_ID=abc\nGOOGLE_CLIENT_SECRET=secret\n');
      const service = buildService();
      const result = await service.validate();
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  describe('testProvider', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('reports full reachability when all endpoints behave as expected', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('token')) {
          return Promise.resolve({ ok: false, status: 400 });
        }
        return Promise.resolve({ ok: true, status: 200 });
      }) as unknown as typeof fetch;

      const service = buildService();
      const result = await service.testProvider('google');
      expect(result.provider).toBe('google');
      expect(result.reachable).toBe(true);
      expect(result.authorizationEndpointOk).toBe(true);
      expect(result.tokenEndpointOk).toBe(true);
      expect(result.userInfoEndpointOk).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('flags unreachable endpoints and invalid credential acceptance', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('token')) {
          return Promise.resolve({ ok: true, status: 200 });
        }
        return Promise.reject(new Error('network down'));
      }) as unknown as typeof fetch;

      const service = buildService();
      const result = await service.testProvider('google');
      expect(result.reachable).toBe(false);
      expect(result.authorizationEndpointOk).toBe(false);
      expect(result.userInfoEndpointOk).toBe(false);
      expect(result.credentialValid).toBe(false);
      expect(result.tokenEndpointOk).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Authorization endpoint unreachable',
          'Token endpoint accepted invalid credentials',
          'User info endpoint unreachable',
        ])
      );
    });

    it('reports an unexpected token endpoint status as a token error', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('token')) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve({ ok: true, status: 200 });
      }) as unknown as typeof fetch;

      const service = buildService();
      const result = await service.testProvider('github');
      expect(result.tokenEndpointOk).toBe(false);
      expect(result.errors[0]).toContain('unexpected status 500');
    });
  });
});
