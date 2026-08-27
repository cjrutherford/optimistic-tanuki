import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('developer-portal server routes', () => {
  it('client-renders OAuth callback routes with provider parameters', () => {
    const serverRoutesSource = readFileSync(
      join(__dirname, 'app.routes.server.ts'),
      'utf8'
    );

    expect(serverRoutesSource).toContain("path: 'oauth/callback'");
    expect(serverRoutesSource).toContain("path: 'oauth/callback/:provider'");
    expect(serverRoutesSource).toMatch(
      /path: 'oauth\/callback\/\:provider',[\s\S]*?renderMode: RenderMode\.Client/
    );
    expect(serverRoutesSource).toMatch(
      /path: '\*\*',[\s\S]*?renderMode: RenderMode\.Client/
    );
  });
});
