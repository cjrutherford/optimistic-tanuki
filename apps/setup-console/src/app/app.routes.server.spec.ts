import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('setup-console server routes', () => {
  it('client-renders OAuth callback routes with provider parameters', () => {
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
