import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  E2E_ENVIRONMENT_MANIFEST,
  listE2eTargets,
  resolveE2eServices,
  resolveE2eTarget,
} from '../e2e-environment-manifest.mjs';
import { validateE2eEnvironment } from '../validate-e2e-environment.mjs';

test('the registry exposes the CI microservice and UI suites by kind', () => {
  assert.equal(listE2eTargets('microservice').length, 13);
  assert.equal(listE2eTargets('ui').length, 8);
  assert.equal(listE2eTargets('dedicated-overlay').length, 1);

  assert.deepEqual(
    listE2eTargets('ui').map((target) => target.nx.project),
    [
      'client-interface-e2e',
      'forgeofwill-e2e',
      'fin-commander-e2e',
      'digital-homestead-e2e',
      'christopherrutherford-net-e2e',
      'owner-console-e2e',
      'store-client-e2e',
      'configurable-client-e2e',
    ]
  );
  assert.equal(resolveE2eTarget('business-site-e2e').ci.enabled, false);
  assert.equal(resolveE2eTarget('ai-orchestrator-e2e').ci.enabled, false);
});

test('target resolution returns bounded, purpose-specific service sets for pull and start', () => {
  assert.deepEqual(resolveE2eServices('authentication-e2e'), [
    'db',
    'db-setup',
    'authentication',
  ]);
  assert.equal(resolveE2eTarget('authentication-e2e').readiness.url, null);
  assert.deepEqual(resolveE2eServices('client-interface-e2e'), [
    'db',
    'db-setup',
    'authentication',
    'profile',
    'social',
    'permissions',
    'permissions-seed',
    'chat-collector',
    'forum',
    'telos-docs-service',
    'oauth-provider',
    'gateway',
    'client-interface',
  ]);
  assert.deepEqual(resolveE2eServices('forgeofwill-e2e'), [
    'db',
    'db-setup',
    'authentication',
    'profile',
    'permissions',
    'permissions-seed',
    'client-interface',
    'oauth-provider',
    'gateway',
    'forgeofwill',
  ]);
  assert.deepEqual(resolveE2eServices('ai-orchestrator-e2e'), [
    'db',
    'db-setup',
    'redis',
    'profile',
    'telos-docs-service',
    'chat-collector',
    'project-planning',
    'gateway',
    'ai-orchestrator',
  ]);
  assert.deepEqual(resolveE2eTarget('owner-console-e2e').completedServices, [
    'db-setup',
    'app-configurator-seed',
    'permissions-seed',
  ]);
  assert.deepEqual(resolveE2eServices('configurable-client-e2e'), [
    'db',
    'redis',
    'db-setup',
    'app-configurator',
    'app-configurator-seed',
    'gateway',
    'configurable-client',
  ]);
  const uiServiceSets = listE2eTargets('ui').map((entry) =>
    resolveE2eServices(entry).join(',')
  );
  assert.equal(new Set(uiServiceSets).size, 8);
  assert.ok(
    uiServiceSets.every((services) => services.split(',').length <= 13)
  );
  assert.throws(() => resolveE2eTarget('missing-e2e'), /Unknown E2E target/);
});

test('client-interface closure includes every service reached by its chat and forum routes', () => {
  const client = resolveE2eTarget('client-interface-e2e');
  assert.ok(client.backendDependencies.includes('chat-collector'));
  assert.ok(client.backendDependencies.includes('forum'));
  assert.ok(client.backendDependencies.includes('telos-docs-service'));
  const forge = resolveE2eTarget('forgeofwill-e2e');
  assert.ok(forge.backendDependencies.includes('client-interface'));
  assert.ok(forge.backendDependencies.includes('oauth-provider'));

  const compose = readFileSync(
    new URL('../../e2e/docker-compose.e2e-stack.yaml', import.meta.url),
    'utf8'
  );
  assert.match(compose, /^  forum:\n[\s\S]*?POSTGRES_DB: ot_forum/m);
  assert.match(compose, /FORUM_HOST: forum/);
  assert.match(compose, /FORUM_PORT: 3015/);
  assert.match(compose, /forum:[\s\S]*?healthcheck:[\s\S]*?node -e/);
  assert.match(compose, /store:\n[\s\S]*?ports:\n\s+- ['"]3013:3013['"]/m);
  assert.match(compose, /STORE_HOST: store\n\s+STORE_PORT: 3013/);
});

test('gateway communities E2E runs after the real permissions corpus is seeded', () => {
  const gateway = resolveE2eTarget('gateway-e2e');

  assert.ok(gateway.backendDependencies.includes('permissions-seed'));
  assert.ok(gateway.completedServices.includes('permissions-seed'));
  assert.deepEqual(
    gateway.lifecycle.phases.find((phase) => phase.name === 'permissions-seed'),
    {
      name: 'permissions-seed',
      services: ['permissions-seed'],
      completion: 'completed-successfully',
    }
  );
});

test('gateway communities E2E proves authorization with a seeded app role', () => {
  const communitiesSpec = readFileSync(
    new URL(
      '../../apps/gateway-e2e/src/gateway/communities.spec.ts',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(communitiesSpec, /'x-ot-appscope': 'client-interface'/);
  assert.match(communitiesSpec, /'x-ot-app-id': 'client-interface'/);
  assert.match(communitiesSpec, /community_owner/);
  assert.doesNotMatch(communitiesSpec, /return; \/\/ Skip if/);
  assert.doesNotMatch(communitiesSpec, /expect\\(\\[201, 400, 500\\]\\)/);
});

test('shared client fixture drives the profile-editor modal and observes API outcomes', () => {
  const fixture = readFileSync(
    new URL('../../apps/e2e/support/workspace-ui.ts', import.meta.url),
    'utf8'
  );
  assert.match(fixture, /\[data-profile-editor-trigger\]/);
  assert.match(fixture, /lib-text-area\[formControlName="bio"\] textarea/);
  assert.match(fixture, /authentication\/register/);
  assert.match(fixture, /authentication\/login/);
  assert.match(fixture, /\/api\/profile/);
  assert.match(fixture, /submitProfileEditor\(page: Page\)/);
  assert.match(
    readFileSync(
      new URL(
        '../../apps/forgeofwill-e2e/src/user-journey.spec.ts',
        import.meta.url
      ),
      'utf8'
    ),
    /submitProfileEditor\(page\)/
  );
  assert.doesNotMatch(fixture, /waitForLoadState\('networkidle'\)/);
  assert.doesNotMatch(fixture, /waitForURL\(\/\\\/feed/);
});

test('local CI runner can narrow a Playwright run without changing the manifest target', () => {
  const runner = readFileSync(
    new URL('../run-ci-e2e-locally.sh', import.meta.url),
    'utf8'
  );
  assert.match(runner, /E2E_NX_ARGS/);
  assert.match(
    runner,
    /pnpm exec nx run "\$target:e2e" --configuration=ci -- "\$\{E2E_NX_ARGS_ARRAY\[@\]\}"/
  );
});

test('authenticated forum coverage verifies the authorized scoped topics request', () => {
  const forumSpec = readFileSync(
    new URL(
      '../../apps/client-interface-e2e/src/forum.spec.ts',
      import.meta.url
    ),
    'utf8'
  );
  const interceptor = readFileSync(
    new URL(
      '../../apps/client-interface/src/app/http.interceptor.ts',
      import.meta.url
    ),
    'utf8'
  );
  assert.match(forumSpec, /waitForResponse/);
  assert.match(forumSpec, /\/api\/forum\/topics/);
  assert.match(forumSpec, /authorization/);
  assert.match(forumSpec, /headers\.authorization/);
  assert.match(forumSpec, /x-ot-appscope/);
  assert.match(forumSpec, /headers\['x-ot-appscope'\]\)\.toBe\('forum'\)/);
  assert.match(
    interceptor,
    /url\.includes\('\/api\/forum'\)[\s\S]*?appScope = 'forum'/
  );
});

test('forum runtime configuration honors portable service environment overrides', () => {
  const config = readFileSync(
    new URL('../../apps/forum/src/config.ts', import.meta.url),
    'utf8'
  );
  const main = readFileSync(
    new URL('../../apps/forum/src/main.ts', import.meta.url),
    'utf8'
  );
  const dockerfile = readFileSync(
    new URL('../../apps/forum/Dockerfile', import.meta.url),
    'utf8'
  );

  for (const name of [
    'PORT',
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
  ])
    assert.match(config, new RegExp(`process\\.env\\.${name}`));
  assert.match(main, /getOrThrow<number>\('listenPort'\)/);
  assert.match(dockerfile, /ENV PORT=3015/);
  assert.match(dockerfile, /EXPOSE 3015/);
});

test('forum rejects malformed numeric port overrides and main uses the resolved port', () => {
  const config = readFileSync(
    new URL('../../apps/forum/src/config.ts', import.meta.url),
    'utf8'
  );
  const main = readFileSync(
    new URL('../../apps/forum/src/main.ts', import.meta.url),
    'utf8'
  );
  assert.match(config, /Invalid .*port override/);
  assert.match(config, /parsed <= 0/);
  assert.match(main, /getOrThrow<number>\('listenPort'\)/);
  assert.doesNotMatch(main, /listenPort'\) \|\|/);
});

test('manifest owns ordered lifecycle phases and multi-probe UI readiness', () => {
  const client = resolveE2eTarget('client-interface-e2e');
  assert.deepEqual(
    client.lifecycle.phases.map((phase) => phase.name),
    [
      'infrastructure',
      'database-seed',
      'permissions-seed',
      'dependencies',
      'gateway',
      'application',
    ]
  );
  assert.deepEqual(client.readiness.urls, [
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000/api-docs',
  ]);
  assert.equal(client.lifecycle.phases[0].startWithDependencies, true);
  assert.equal(client.lifecycle.phases[1].startWithDependencies, true);

  const owner = resolveE2eTarget('owner-console-e2e');
  assert.deepEqual(
    owner.lifecycle.phases.map((phase) => phase.name),
    [
      'infrastructure',
      'database-seed',
      'permissions-seed',
      'dependencies',
      'app-configurator',
      'app-configurator-seed',
      'gateway',
      'application',
    ]
  );
  assert.equal(
    owner.lifecycle.phases.find((phase) => phase.name === 'app-configurator')
      .readinessUrls,
    undefined
  );
  assert.equal(
    owner.lifecycle.phases.find(
      (phase) => phase.name === 'app-configurator-seed'
    ).completion,
    'completed-successfully'
  );
});

function makeProject(name, targets = { e2e: {} }) {
  return { name, data: { name, targets, projectType: 'application' } };
}

function makeValidNxGraph() {
  const nodes = {};
  const dependencies = {};
  for (const entry of E2E_ENVIRONMENT_MANIFEST) {
    nodes[entry.nx.project] = makeProject(entry.nx.project);
    nodes[entry.app] = makeProject(entry.app, { build: {} });
    dependencies[entry.nx.project] = [
      { source: entry.nx.project, target: entry.app, type: 'implicit' },
    ];
  }
  return { graph: { nodes, dependencies } };
}

function makeValidComposeConfig() {
  const services = {};
  for (const entry of E2E_ENVIRONMENT_MANIFEST) {
    if (entry.stack.mode !== 'shared') continue;
    services[entry.stack.service] = {
      profiles: entry.stack.profile ? [entry.stack.profile] : [],
      ports: [
        {
          published: String(entry.readiness.port),
          target: entry.readiness.port,
        },
      ],
    };
    for (const service of entry.backendDependencies) {
      services[service] ??= { ports: [] };
    }
  }
  services.gateway.environment = { NODE_ENV: 'test' };
  services.authentication.environment = { AUTH_AUTO_VERIFY_EMAILS: 'true' };
  return { services };
}

test('validator accepts a manifest that agrees with Nx and Compose metadata', () => {
  assert.deepEqual(
    validateE2eEnvironment({
      manifest: E2E_ENVIRONMENT_MANIFEST,
      nxGraph: makeValidNxGraph(),
      composeConfig: makeValidComposeConfig(),
    }),
    []
  );
});

test('validator reports missing Nx app links, profile coverage, and concurrent port conflicts', () => {
  const manifest = structuredClone(E2E_ENVIRONMENT_MANIFEST);
  const client = manifest.find(
    (entry) => entry.nx.project === 'client-interface-e2e'
  );
  const forge = manifest.find(
    (entry) => entry.nx.project === 'forgeofwill-e2e'
  );
  client.backendDependencies = ['missing-service'];
  client.completedServices = ['not-in-services'];
  forge.readiness.port = client.readiness.port;
  forge.baseUrl = client.baseUrl;

  const nxGraph = makeValidNxGraph();
  nxGraph.graph.dependencies['client-interface-e2e'] = [];
  const composeConfig = makeValidComposeConfig();
  composeConfig.services.forgeofwill.profiles = [];
  composeConfig.services.gateway.environment.NODE_ENV = 'production';
  composeConfig.services.authentication.environment.AUTH_AUTO_VERIFY_EMAILS =
    'false';

  const errors = validateE2eEnvironment({
    manifest,
    nxGraph,
    composeConfig,
  });

  assert.match(
    errors.join('\n'),
    /client-interface-e2e must depend on app client-interface/
  );
  assert.match(
    errors.join('\n'),
    /client-interface-e2e backend dependency missing-service is not a Compose service/
  );
  assert.match(
    errors.join('\n'),
    /client-interface-e2e completed service not-in-services is not in its resolved service set/
  );
  assert.match(
    errors.join('\n'),
    /forgeofwill-e2e profile forgeofwill is not declared/
  );
  assert.match(errors.join('\n'), /E2E gateway NODE_ENV must be test/);
  assert.match(
    errors.join('\n'),
    /E2E authentication must auto-verify test emails/
  );
  assert.match(errors.join('\n'), /ui-e2e reuses host port 8080/);
});

test('local runner captures a single diagnostic bundle before teardown for startup failures', () => {
  const runner = readFileSync(
    new URL('../run-ci-e2e-locally.sh', import.meta.url),
    'utf8'
  );

  assert.match(
    runner,
    /build_cmd=\([^)]*docker-build-batched\.sh --full-rebuild[^)]*\)[\s\S]*profile[\s\S]*build_cmd\+=\(--profile "\$profile"\)/
  );
  assert.match(
    runner,
    /compose_target\(\)[\s\S]*--profile "\$E2E_COMPOSE_PROFILE"[\s\S]*compose_target down -v/
  );
  assert.match(
    runner,
    /run_with_interrupts compose[\s\S]*up -d[\s\S]*\|\| return \$\?[\s\S]*run_with_interrupts node "\$READINESS_SCRIPT"[\s\S]*\|\| return \$\?/
  );
  assert.match(
    runner,
    /capture_target_failure\(\)[\s\S]*\[ "\$INTERRUPTED" = true \] \|\| \[ "\$status" -eq 130 \][\s\S]*return 130[\s\S]*capture_diagnostics/
  );
  assert.match(
    runner,
    /if prepare_target_images[\s\S]*else[\s\S]*capture_target_failure "\$target" "\$status"/
  );
  assert.match(
    runner,
    /if start_target_stack[\s\S]*else[\s\S]*capture_target_failure "\$target" "\$status"/
  );
  assert.match(
    runner,
    /capture_target_failure "\$target" "\$status"[\s\S]*run_with_interrupts compose_target down -v/
  );
});

test('the fake OAuth provider has a stable image tag for batched isolated builds', () => {
  const compose = readFileSync(
    new URL('../../e2e/docker-compose.e2e-stack.yaml', import.meta.url),
    'utf8'
  );

  assert.match(
    compose,
    /oauth-provider:\n(?:.*\n)*?\s+image: cjrutherford\/optimistic_tanuki_oauth-provider:\$\{E2E_IMAGE_TAG:-latest\}/
  );
});
