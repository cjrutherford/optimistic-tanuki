import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('business-site server configuration', () => {
  it('routes SSR API requests directly through the configured gateway', () => {
    const source = readFileSync(
      resolve(__dirname, 'app.config.server.ts'),
      'utf8'
    );

    expect(source).toContain('provide: API_BASE_URL');
    expect(source).toContain(
      "process.env['GATEWAY_URL'] || 'http://gateway:3000'"
    );
  });
});
