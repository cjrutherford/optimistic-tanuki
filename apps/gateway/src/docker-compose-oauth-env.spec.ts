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
});
