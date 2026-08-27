import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('setup-console server configuration', () => {
  it('registers its server route rendering modes with Angular SSR', () => {
    const source = readFileSync(
      join(__dirname, 'app.config.server.ts'),
      'utf8'
    );

    expect(source).toContain(
      "import { serverRoutes } from './app.routes.server';"
    );
    expect(source).toContain(
      'provideServerRendering(withRoutes(serverRoutes))'
    );
  });
});
