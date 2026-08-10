import * as fs from 'fs';
import * as path from 'path';

describe('docker compose oauth environment wiring', () => {
  it('passes oauth provider secrets only into the gateway', () => {
    const composePath = path.resolve(__dirname, '../../../docker-compose.yaml');
    const compose = fs.readFileSync(composePath, 'utf8');

    const expectedLines = [
      'GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}',
      'GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}',
      'GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI:-}',
      'GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID:-}',
      'GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET:-}',
      'GITHUB_REDIRECT_URI: ${GITHUB_REDIRECT_URI:-}',
      'MICROSOFT_CLIENT_ID: ${MICROSOFT_CLIENT_ID:-}',
      'MICROSOFT_CLIENT_SECRET: ${MICROSOFT_CLIENT_SECRET:-}',
      'MICROSOFT_REDIRECT_URI: ${MICROSOFT_REDIRECT_URI:-}',
      'FACEBOOK_CLIENT_ID: ${FACEBOOK_CLIENT_ID:-}',
      'FACEBOOK_CLIENT_SECRET: ${FACEBOOK_CLIENT_SECRET:-}',
      'FACEBOOK_REDIRECT_URI: ${FACEBOOK_REDIRECT_URI:-}',
    ];

    const authenticationSection = compose.match(
      /^ {2}authentication:\n([\s\S]*?)(?=^ {2}[a-z0-9-]+:|$(?![\s\S]))/im
    )?.[1];
    const gatewaySection = compose.match(
      /^ {2}gateway:\n([\s\S]*?)(?=^ {2}[a-z0-9-]+:|$(?![\s\S]))/im
    )?.[1];

    expect(authenticationSection).toBeTruthy();
    expect(gatewaySection).toBeTruthy();

    for (const line of expectedLines) {
      expect(gatewaySection).toContain(line);
      expect(authenticationSection).not.toContain(line);
    }
  });

  it('disables automatic email verification by default in the production stack', () => {
    const composePath = path.resolve(__dirname, '../../../docker-compose.yaml');
    const compose = fs.readFileSync(composePath, 'utf8');
    const authenticationSection = compose.match(
      /^ {2}authentication:\n([\s\S]*?)(?=^ {2}[a-z0-9-]+:|$(?![\s\S]))/im
    )?.[1];

    expect(authenticationSection).toContain(
      'AUTH_AUTO_VERIFY_EMAILS: ${AUTH_AUTO_VERIFY_EMAILS:-false}'
    );
  });

  it('includes the default owner-console origin in production CORS origins', () => {
    const composePath = path.resolve(__dirname, '../../../docker-compose.yaml');
    const compose = fs.readFileSync(composePath, 'utf8');
    const gatewaySection = compose.match(
      /^ {2}gateway:\n([\s\S]*?)(?=^ {2}[a-z0-9-]+:|$(?![\s\S]))/im
    )?.[1];

    expect(gatewaySection).toContain(
      'CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS:-http://localhost:8084,'
    );
  });

  it('keeps the Forge production origin in the base compose stack without a local scope override', () => {
    const composePath = path.resolve(__dirname, '../../../docker-compose.yaml');
    const compose = fs.readFileSync(composePath, 'utf8');
    const gatewaySection = compose.match(
      /^ {2}gateway:\n([\s\S]*?)(?=^ {2}[a-z0-9-]+:|$(?![\s\S]))/im
    )?.[1];

    expect(gatewaySection).toContain('https://forgeofwill.com');
    expect(gatewaySection).not.toContain('forgeofwill.localhost');
    expect(gatewaySection).not.toContain('APP_SCOPE_ORIGINS');
  });

  it('supplies a development-only OAuth state secret when the dev override replaces gateway environment', () => {
    const composePath = path.resolve(
      __dirname,
      '../../../docker-compose.dev.yaml'
    );
    const compose = fs.readFileSync(composePath, 'utf8');
    const gatewaySection = compose.match(
      /^ {2}gateway:\n([\s\S]*?)(?=^ {2}[a-z0-9-]+:|$(?![\s\S]))/im
    )?.[1];

    expect(gatewaySection).toContain(
      'OAUTH_STATE_SECRET=${OAUTH_STATE_SECRET:-development-oauth-state-secret}'
    );
  });

  it('keeps the dev default callback proxy neutral while registering Forge as an exact app origin', () => {
    const composePath = path.resolve(
      __dirname,
      '../../../docker-compose.dev.yaml'
    );
    const compose = fs.readFileSync(composePath, 'utf8');
    const gatewaySection = compose.match(
      /^ {2}gateway:\n([\s\S]*?)(?=^ {2}[a-z0-9-]+:|$(?![\s\S]))/im
    )?.[1];

    expect(gatewaySection).toContain(
      'APP_SCOPE_ORIGINS={"forgeofwill":"http://forgeofwill.localhost:8081"}'
    );
    expect(gatewaySection).toContain(
      'CORS_ALLOWED_ORIGINS=http://forgeofwill.localhost:8081'
    );
    expect(gatewaySection).toContain(
      'CLIENT_INTERFACE_UI_BASE_URL=http://localhost:8080'
    );
    expect(gatewaySection).toContain('CLIENT_INTERFACE_DOMAIN=localhost');
    expect(gatewaySection).toContain(
      'GOOGLE_REDIRECT_URI=http://localhost:8080/api/oauth/callback/google'
    );
    expect(gatewaySection).not.toContain(
      'CLIENT_INTERFACE_UI_BASE_URL=http://forgeofwill.localhost:8081'
    );
  });

  it('keeps the deterministic E2E provider on a different host from the app while aligning the callback origin', () => {
    const composePath = path.resolve(
      __dirname,
      '../../../e2e/docker-compose.e2e-stack.yaml'
    );
    const compose = fs.readFileSync(composePath, 'utf8');
    const gatewaySection = compose.match(
      /^ {2}gateway:\n([\s\S]*?)(?=^ {2}[a-z0-9-]+:|$(?![\s\S]))/im
    )?.[1];

    expect(gatewaySection).toBeTruthy();
    expect(gatewaySection).toContain(
      'CLIENT_INTERFACE_UI_BASE_URL: http://localhost:8080'
    );
    expect(gatewaySection).toContain('CLIENT_INTERFACE_DOMAIN: localhost');
    expect(gatewaySection).toContain(
      'CI_GOOGLE_CLIENT_ID: e2e-google-client-id'
    );
    expect(gatewaySection).toContain(
      'CI_GOOGLE_CLIENT_SECRET: e2e-google-client-secret'
    );
    expect(gatewaySection).toContain(
      'CI_GOOGLE_AUTHORIZATION_ENDPOINT: http://127.0.0.1:3016/authorize'
    );
    expect(gatewaySection).toContain(
      'CI_GOOGLE_TOKEN_ENDPOINT: http://oauth-provider:3016/token'
    );
    expect(gatewaySection).toContain(
      'CI_GOOGLE_USER_INFO_ENDPOINT: http://oauth-provider:3016/userinfo'
    );
  });
});
