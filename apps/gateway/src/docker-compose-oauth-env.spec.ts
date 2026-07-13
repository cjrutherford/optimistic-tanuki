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
      /authentication:\n([\s\S]*?)(?:\n\s{2}[a-z0-9-]+:|$)/i
    )?.[1];
    const gatewaySection = compose.match(
      /gateway:\n([\s\S]*?)(?:\n\s{2}[a-z0-9-]+:|$)/i
    )?.[1];

    expect(authenticationSection).toBeTruthy();
    expect(gatewaySection).toBeTruthy();

    for (const line of expectedLines) {
      expect(gatewaySection).toContain(line);
      expect(authenticationSection).not.toContain(line);
    }
  });
});
