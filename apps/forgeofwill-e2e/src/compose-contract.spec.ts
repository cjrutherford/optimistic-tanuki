import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';

type ComposeService = {
  image?: string;
  environment?: Record<string, string | number>;
  depends_on?: Record<string, { condition?: string }>;
  network_mode?: string;
  command?: string | string[];
  restart?: string;
  healthcheck?: {
    test?: string[];
    interval?: string;
    timeout?: string;
    retries?: number;
  };
};

type ComposeDocument = {
  services: Record<string, ComposeService>;
};

const compose = load(
  readFileSync(
    resolve(__dirname, '../../../e2e/docker-compose.forgeofwill-e2e.yaml'),
    'utf8'
  )
) as ComposeDocument;

const globalSetup = readFileSync(
  resolve(__dirname, '../global-setup.ts'),
  'utf8'
);
const globalTeardown = readFileSync(
  resolve(__dirname, '../global-teardown.ts'),
  'utf8'
);
const playwrightConfig = readFileSync(
  resolve(__dirname, '../playwright.config.ts'),
  'utf8'
);

test.describe('Forge E2E compose contract', () => {
  test('seeds permissions before a permission-aware gateway and browser client start', () => {
    const authentication = compose.services.authentication;
    const profile = compose.services.profile;
    const projectPlanning = compose.services['project-planning'];
    const permissions = compose.services.permissions;
    const permissionsSeed = compose.services['permissions-seed'];
    const gateway = compose.services.gateway;
    const client = compose.services['forgeofwill-client-interface'];

    expect(permissions).toEqual(
      expect.objectContaining({
        image: expect.stringMatching(/optimistic_tanuki_permissions/),
        environment: expect.objectContaining({
          DATABASE_HOST: 'db',
          DATABASE_NAME: 'postgres',
        }),
        depends_on: expect.objectContaining({
          'db-setup': expect.objectContaining({
            condition: 'service_completed_successfully',
          }),
        }),
      })
    );
    expect(permissionsSeed).toEqual(
      expect.objectContaining({
        image: permissions.image,
        command: ['node', './seed-permissions.js'],
        restart: 'no',
        depends_on: expect.objectContaining({
          permissions: expect.objectContaining({
            condition: 'service_healthy',
          }),
        }),
      })
    );
    expect(gateway).toEqual(
      expect.objectContaining({
        environment: expect.objectContaining({
          PERMISSIONS_HOST: 'permissions',
          PERMISSIONS_PORT: 3012,
        }),
        depends_on: expect.objectContaining({
          authentication: expect.objectContaining({
            condition: 'service_healthy',
          }),
          profile: expect.objectContaining({ condition: 'service_healthy' }),
          'project-planning': expect.objectContaining({
            condition: 'service_healthy',
          }),
          permissions: expect.objectContaining({
            condition: 'service_healthy',
          }),
          'permissions-seed': expect.objectContaining({
            condition: 'service_completed_successfully',
          }),
        }),
      })
    );
    for (const [service, port] of [
      [authentication, 3001],
      [profile, 3002],
      [projectPlanning, 3006],
    ]) {
      expect(service.healthcheck).toEqual(
        expect.objectContaining({
          test: expect.arrayContaining([
            expect.stringMatching(new RegExp(`connect\\(${port}`)),
          ]),
          interval: '5s',
          timeout: '3s',
          retries: 12,
        })
      );
    }
    expect(globalSetup).toContain(
      "'db-setup,authentication,profile,project-planning,permissions,gateway,oauth-provider,forgeofwill-client-interface'"
    );
    expect(globalSetup).not.toContain('setTimeout');
    expect(client.depends_on).toEqual(
      expect.objectContaining({
        gateway: expect.objectContaining({ condition: 'service_healthy' }),
      })
    );
  });

  test('keeps cookie-session OAuth hermetic to the Forge origin', () => {
    const gateway = compose.services.gateway;
    const forge = compose.services['forgeofwill-client-interface'];
    const oauthProvider = compose.services['oauth-provider'];

    expect(oauthProvider).toEqual(
      expect.objectContaining({
        image: expect.stringMatching(/optimistic_tanuki_oauth-provider/),
      })
    );
    expect(gateway.environment).toEqual(
      expect.objectContaining({
        NODE_ENV: 'test',
        OAUTH_STATE_SECRET: 'e2e-oauth-state-secret',
        APP_SCOPE_ORIGINS:
          '{"forgeofwill":"http://forgeofwill.localhost:8081"}',
        CORS_ALLOWED_ORIGINS: 'http://forgeofwill.localhost:8081',
        CLIENT_INTERFACE_UI_BASE_URL: 'http://forgeofwill.localhost:8081',
        CLIENT_INTERFACE_DOMAIN: 'forgeofwill.localhost',
        GOOGLE_CLIENT_ID: 'e2e-google-client-id',
        GOOGLE_CLIENT_SECRET: 'e2e-google-client-secret',
        GOOGLE_REDIRECT_URI:
          'http://forgeofwill.localhost:8081/api/oauth/callback/google',
        GOOGLE_AUTHORIZATION_ENDPOINT: 'http://127.0.0.1:3016/authorize',
        GOOGLE_TOKEN_ENDPOINT: 'http://oauth-provider:3016/token',
        GOOGLE_USER_INFO_ENDPOINT: 'http://oauth-provider:3016/userinfo',
      })
    );
    expect(forge.depends_on).toEqual(
      expect.objectContaining({
        gateway: expect.objectContaining({ condition: 'service_healthy' }),
        'oauth-provider': expect.objectContaining({
          condition: 'service_started',
        }),
      })
    );
    expect(globalSetup).toContain(
      "'db-setup,authentication,profile,project-planning,permissions,gateway,oauth-provider,forgeofwill-client-interface'"
    );
    expect(globalSetup).toContain("process.env['SKIP_SETUP'] === 'true'");
    expect(globalTeardown).toContain("process.env['SKIP_SETUP'] === 'true'");
    expect(compose.services['client-interface']).toBeUndefined();
  });

  test('uses host-loopback origins when the Playwright runner executes in Docker', () => {
    expect(compose.services['playwright-runner']).toEqual(
      expect.objectContaining({
        network_mode: 'host',
        environment: expect.objectContaining({
          BASE_URL: 'http://forgeofwill.localhost:8081',
        }),
      })
    );
  });

  test('targets the hermetic Forge composition instead of starting a second dev server', () => {
    expect(playwrightConfig).toContain(
      "process.env['BASE_URL'] || 'http://forgeofwill.localhost:8081'"
    );
    expect(playwrightConfig).toContain('webServer: undefined');
  });
});
