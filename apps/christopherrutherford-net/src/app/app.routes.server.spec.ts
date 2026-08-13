import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('christopherrutherford-net server routes', () => {
  it('client-renders OAuth callback routes before the prerender fallback', () => {
    const source = readFileSync(
      join(__dirname, 'app.routes.server.ts'),
      'utf8'
    );

    expect(source).toMatch(
      /path: 'oauth\/callback',[\s\S]*?renderMode: RenderMode\.Client/
    );
    expect(source).toMatch(
      /path: 'oauth\/callback\/:provider',[\s\S]*?renderMode: RenderMode\.Client/
    );
  });
});
