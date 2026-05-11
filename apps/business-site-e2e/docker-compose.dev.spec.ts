import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('business-site dev compose wiring', () => {
  const workspaceRoot = join(__dirname, '../../');

  it('builds business-site from a dev dockerfile with dev dependencies available', () => {
    const compose = readFileSync(
      join(workspaceRoot, 'docker-compose.dev.yaml'),
      'utf8'
    );
    const businessSiteSection = compose.slice(
      compose.indexOf('  business-site:'),
      compose.indexOf('  crdn-client-interface:')
    );

    expect(businessSiteSection).toContain(
      'dockerfile: ./apps/business-site/Dockerfile.dev'
    );
  });

  it('starts business-site with the image-local nodemon binary', () => {
    const compose = readFileSync(
      join(workspaceRoot, 'docker-compose.dev.yaml'),
      'utf8'
    );
    const businessSiteSection = compose.slice(
      compose.indexOf('  business-site:'),
      compose.indexOf('  crdn-client-interface:')
    );

    expect(businessSiteSection).toContain("'./node_modules/.bin/nodemon'");
    expect(businessSiteSection).not.toContain("\n        'nodemon',\n");
  });

  it('installs nodemon in the business-site dev image', () => {
    const dockerfile = readFileSync(
      join(workspaceRoot, 'apps/business-site/Dockerfile.dev'),
      'utf8'
    );

    expect(dockerfile).toContain(
      'RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm add -w nodemon'
    );
  });
});
