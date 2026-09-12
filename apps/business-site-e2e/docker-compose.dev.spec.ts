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
      'dockerfile: ./docker/dev/ssr-runtime.Dockerfile'
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

  it('runs the business-site dev runtime as the local host user', () => {
    const compose = readFileSync(
      join(workspaceRoot, 'docker-compose.dev.yaml'),
      'utf8'
    );
    const businessSiteSection = compose.slice(
      compose.indexOf('  business-site:'),
      compose.indexOf('  crdn-client-interface:')
    );

    expect(businessSiteSection).toContain(
      "user: '${LOCAL_UID:-1000}:${LOCAL_GID:-1000}'"
    );
  });

  it('runs the Blogging dev runtime as the local host user', () => {
    const compose = readFileSync(
      join(workspaceRoot, 'docker-compose.dev.yaml'),
      'utf8'
    );
    const bloggingSection = compose.slice(
      compose.indexOf('  blogging:'),
      compose.indexOf('  gateway:')
    );

    expect(bloggingSection).toContain(
      "user: '${LOCAL_UID:-1000}:${LOCAL_GID:-1000}'"
    );
  });

  it('runs the Store dev runtime as the local host user', () => {
    const compose = readFileSync(
      join(workspaceRoot, 'docker-compose.dev.yaml'),
      'utf8'
    );
    const storeSection = compose.slice(
      compose.indexOf('  store:'),
      compose.indexOf('  chat-collector:')
    );

    expect(storeSection).toContain(
      "user: '${LOCAL_UID:-1000}:${LOCAL_GID:-1000}'"
    );
  });

  it('runs every dev service with a writable dist mount as the local host user', () => {
    const compose = readFileSync(
      join(workspaceRoot, 'docker-compose.dev.yaml'),
      'utf8'
    );
    const serviceSections = Array.from(
      compose.matchAll(
        /^ {2}([a-z0-9-]+):\n([\s\S]*?)(?=^ {2}[a-z0-9-]+:|^volumes:|\Z)/gim
      )
    );
    const servicesWithDistMounts = serviceSections.filter(([, , section]) =>
      section
        .split('\n')
        .some((line) => line.includes('./dist/apps') && !line.includes(':ro'))
    );

    expect(servicesWithDistMounts).not.toHaveLength(0);

    for (const [service, , section] of servicesWithDistMounts) {
      expect(section).toContain(
        "user: '${LOCAL_UID:-1000}:${LOCAL_GID:-1000}'"
      );
    }
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
