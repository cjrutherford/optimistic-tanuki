#!/usr/bin/env node

const SHARED_COMPOSE_FILE = 'e2e/docker-compose.e2e-stack.yaml';

function lifecyclePhases({
  app,
  backendDependencies,
  completedServices,
  profile,
  port,
}) {
  const services = new Set([...backendDependencies, app]);
  const phases = [];
  const add = (name, phaseServices, options = {}) => {
    const included = phaseServices.filter((service) => services.has(service));
    if (included.length) phases.push({ name, services: included, ...options });
  };

  add('infrastructure', ['db', 'redis'], { startWithDependencies: true });
  add('database-seed', ['db-setup'], {
    completion: 'completed-successfully',
    startWithDependencies: true,
  });
  add('permissions-seed', ['permissions-seed'], {
    completion: 'completed-successfully',
  });
  add(
    'dependencies',
    [...backendDependencies].filter(
      (service) =>
        ![
          'db',
          'redis',
          'db-setup',
          'permissions-seed',
          'app-configurator',
          'app-configurator-seed',
          'gateway',
        ].includes(service)
    )
  );
  if (app !== 'app-configurator') add('app-configurator', ['app-configurator']);
  add('app-configurator-seed', ['app-configurator-seed'], {
    completion: 'completed-successfully',
  });
  add('gateway', ['gateway']);
  if (app !== 'gateway') add('application', [app], profile ? { profile } : {});
  return { phases };
}

function sharedEntry({
  project,
  app,
  suiteKind,
  baseUrl,
  port,
  backendDependencies,
  profile = null,
  imageBudget,
  environmentGroup = 'shared-e2e-stack',
  gatewayNoDeps = false,
  readinessUrl = baseUrl,
  completedServices = ['db-setup'],
}) {
  const resolvedCompletedServices = backendDependencies.includes(
    'permissions-seed'
  )
    ? [...new Set([...completedServices, 'permissions-seed'])]
    : completedServices;

  return {
    nx: { project, target: 'e2e' },
    app,
    suiteKind,
    concurrencyGroup: suiteKind === 'ui' ? 'ui-e2e' : 'microservices-e2e',
    environmentGroup,
    ci: { enabled: true },
    stack: {
      mode: 'shared',
      composeFile: SHARED_COMPOSE_FILE,
      service: app,
      profile,
    },
    startup: gatewayNoDeps
      ? { gateway: { service: 'gateway', noDeps: true } }
      : undefined,
    baseUrl,
    backendDependencies,
    readiness: {
      url: readinessUrl,
      urls: readinessUrl
        ? [
            readinessUrl,
            ...(suiteKind === 'ui' && backendDependencies.includes('gateway')
              ? ['http://127.0.0.1:3000/api-docs']
              : []),
          ]
        : [],
      port,
    },
    completedServices: resolvedCompletedServices,
    lifecycle: lifecyclePhases({
      app,
      backendDependencies,
      completedServices: resolvedCompletedServices,
      profile,
      port,
    }),
    imageBudget: { maxPullServices: imageBudget },
  };
}

const MICROSERVICE_ENTRIES = [
  sharedEntry({
    project: 'authentication-e2e',
    app: 'authentication',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3001',
    port: 3001,
    backendDependencies: ['db', 'db-setup'],
    imageBudget: 3,
    readinessUrl: null,
  }),
  sharedEntry({
    project: 'profile-e2e',
    app: 'profile',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3002',
    port: 3002,
    backendDependencies: ['db', 'db-setup', 'permissions'],
    imageBudget: 4,
    readinessUrl: null,
  }),
  sharedEntry({
    project: 'social-e2e',
    app: 'social',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3003',
    port: 3003,
    backendDependencies: [
      'db',
      'db-setup',
      'authentication',
      'profile',
      'permissions',
    ],
    imageBudget: 6,
    readinessUrl: null,
  }),
  sharedEntry({
    project: 'assets-e2e',
    app: 'assets',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3005',
    port: 3005,
    backendDependencies: ['db', 'db-setup'],
    imageBudget: 3,
    readinessUrl: null,
  }),
  sharedEntry({
    project: 'blogging-e2e',
    app: 'blogging',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3011',
    port: 3011,
    backendDependencies: ['db', 'db-setup'],
    imageBudget: 3,
    readinessUrl: null,
  }),
  sharedEntry({
    project: 'gateway-e2e',
    app: 'gateway',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3000',
    port: 3000,
    backendDependencies: [
      'db',
      'redis',
      'db-setup',
      'authentication',
      'profile',
      'social',
      'assets',
      'project-planning',
      'chat-collector',
      'telos-docs-service',
      'prompt-proxy',
      'blogging',
      'permissions',
      'store',
      'app-configurator',
      'app-configurator-seed',
      'lead-tracker',
      'permissions-seed',
    ],
    imageBudget: 19,
    completedServices: ['db-setup', 'app-configurator-seed'],
  }),
  sharedEntry({
    project: 'permissions-e2e',
    app: 'permissions',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3012',
    port: 3012,
    backendDependencies: ['db', 'db-setup'],
    imageBudget: 3,
    readinessUrl: null,
  }),
  sharedEntry({
    project: 'project-planning-e2e',
    app: 'project-planning',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3006',
    port: 3006,
    backendDependencies: ['db', 'db-setup'],
    imageBudget: 3,
    readinessUrl: null,
  }),
  sharedEntry({
    project: 'chat-collector-e2e',
    app: 'chat-collector',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3007',
    port: 3007,
    backendDependencies: ['db', 'db-setup'],
    imageBudget: 3,
    readinessUrl: null,
  }),
  sharedEntry({
    project: 'prompt-proxy-e2e',
    app: 'prompt-proxy',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3009',
    port: 3009,
    backendDependencies: ['db', 'db-setup'],
    imageBudget: 3,
    readinessUrl: null,
  }),
  sharedEntry({
    project: 'telos-docs-service-e2e',
    app: 'telos-docs-service',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3008',
    port: 3008,
    backendDependencies: ['db', 'db-setup'],
    imageBudget: 3,
    readinessUrl: null,
  }),
  sharedEntry({
    project: 'ai-orchestrator-e2e',
    app: 'ai-orchestrator',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3010',
    port: 3010,
    backendDependencies: [
      'db',
      'db-setup',
      'redis',
      'profile',
      'telos-docs-service',
      'chat-collector',
      'project-planning',
      'gateway',
    ],
    imageBudget: 9,
    readinessUrl: null,
  }),
  sharedEntry({
    project: 'app-configurator-e2e',
    app: 'app-configurator',
    suiteKind: 'microservice',
    baseUrl: 'http://127.0.0.1:3014',
    port: 3014,
    backendDependencies: ['db', 'redis', 'db-setup'],
    imageBudget: 4,
    readinessUrl: null,
  }),
];

const UI_ENVIRONMENTS = [
  {
    project: 'client-interface-e2e',
    app: 'client-interface',
    baseUrl: 'http://127.0.0.1:8080',
    port: 8080,
    profile: 'client-interface',
    environmentGroup: 'client-community',
    backendDependencies: [
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
    ],
  },
  {
    project: 'forgeofwill-e2e',
    app: 'forgeofwill',
    baseUrl: 'http://127.0.0.1:8081',
    port: 8081,
    profile: 'forgeofwill',
    environmentGroup: 'forge-project-chat',
    backendDependencies: [
      'db',
      'db-setup',
      'authentication',
      'profile',
      'permissions',
      'permissions-seed',
      'client-interface',
      'oauth-provider',
      'gateway',
    ],
  },
  {
    project: 'fin-commander-e2e',
    app: 'fin-commander',
    baseUrl: 'http://127.0.0.1:8089',
    port: 8089,
    profile: 'fin-commander',
    environmentGroup: 'fin-cookie-auth',
    backendDependencies: [
      'db',
      'db-setup',
      'authentication',
      'profile',
      'permissions',
      'permissions-seed',
      'client-interface',
      'oauth-provider',
      'gateway',
    ],
  },
  {
    project: 'digital-homestead-e2e',
    app: 'digital-homestead',
    baseUrl: 'http://127.0.0.1:8082',
    port: 8082,
    profile: 'digital-homestead',
    environmentGroup: 'digital-blogging',
    backendDependencies: [
      'db',
      'db-setup',
      'authentication',
      'profile',
      'permissions',
      'permissions-seed',
      'blogging',
      'client-interface',
      'oauth-provider',
      'gateway',
    ],
  },
  {
    project: 'christopherrutherford-net-e2e',
    app: 'christopherrutherford-net',
    baseUrl: 'http://127.0.0.1:8083',
    port: 8083,
    profile: 'christopherrutherford-net',
    environmentGroup: 'crdn-public-auth',
    backendDependencies: [
      'db',
      'db-setup',
      'authentication',
      'permissions',
      'permissions-seed',
      'gateway',
    ],
  },
  {
    project: 'owner-console-e2e',
    app: 'owner-console',
    baseUrl: 'http://127.0.0.1:8084',
    port: 8084,
    profile: 'owner-console',
    environmentGroup: 'owner-configuration',
    backendDependencies: [
      'db',
      'redis',
      'db-setup',
      'authentication',
      'permissions',
      'permissions-seed',
      'app-configurator',
      'app-configurator-seed',
      'gateway',
    ],
    completedServices: ['db-setup', 'app-configurator-seed'],
  },
  {
    project: 'store-client-e2e',
    app: 'store-client',
    baseUrl: 'http://127.0.0.1:8085',
    port: 8085,
    profile: 'store-client',
    environmentGroup: 'store-commerce',
    backendDependencies: [
      'db',
      'db-setup',
      'authentication',
      'profile',
      'permissions',
      'permissions-seed',
      'store',
      'gateway',
    ],
  },
  {
    project: 'configurable-client-e2e',
    app: 'configurable-client',
    baseUrl: 'http://127.0.0.1:8090',
    port: 8090,
    profile: 'configurable-client',
    environmentGroup: 'configurable-configurator',
    backendDependencies: [
      'db',
      'redis',
      'db-setup',
      'app-configurator',
      'app-configurator-seed',
      'gateway',
    ],
    completedServices: ['db-setup', 'app-configurator-seed'],
  },
];

const UI_ENTRIES = UI_ENVIRONMENTS.map((environment) =>
  sharedEntry({
    ...environment,
    suiteKind: 'ui',
    imageBudget: environment.backendDependencies.length + 1,
    gatewayNoDeps: true,
  })
);

const BUSINESS_SITE_ENTRY = {
  nx: { project: 'business-site-e2e', target: 'e2e' },
  app: 'business-site',
  suiteKind: 'dedicated-overlay',
  concurrencyGroup: 'business-site-dedicated-overlay',
  environmentGroup: 'business-site-dedicated-overlay',
  ci: {
    enabled: false,
    reason:
      'Uses a dedicated docker-compose overlay and is not a shared-stack CI suite.',
  },
  stack: {
    mode: 'dedicated-overlay',
    composeFiles: [
      'docker-compose.yaml',
      'docker-compose.dev.yaml',
      'apps/business-site-e2e/docker-compose.e2e.yaml',
    ],
    service: 'business-site',
    profile: null,
  },
  baseUrl: 'http://127.0.0.1:8094',
  backendDependencies: [
    'postgres',
    'redis',
    'db-setup',
    'authentication',
    'profile',
    'permissions',
    'store',
    'lead-tracker',
    'gateway',
  ],
  readiness: {
    url: 'http://127.0.0.1:8094/api/business/site-config',
    urls: ['http://127.0.0.1:8094/api/business/site-config'],
    port: 8094,
  },
  completedServices: ['db-setup'],
  lifecycle: lifecyclePhases({
    app: 'business-site',
    backendDependencies: [
      'postgres',
      'redis',
      'db-setup',
      'authentication',
      'profile',
      'permissions',
      'store',
      'lead-tracker',
      'gateway',
    ],
    completedServices: ['db-setup'],
    port: 8094,
  }),
  imageBudget: { maxPullServices: 10 },
};

export const E2E_ENVIRONMENT_MANIFEST = Object.freeze([
  ...MICROSERVICE_ENTRIES,
  ...UI_ENTRIES,
  BUSINESS_SITE_ENTRY,
]);

export const E2E_SUITE_KINDS = Object.freeze([
  'microservice',
  'ui',
  'dedicated-overlay',
]);

export function listE2eTargets(suiteKind) {
  if (!E2E_SUITE_KINDS.includes(suiteKind)) {
    throw new Error(`Unknown E2E suite kind: ${suiteKind}`);
  }
  return E2E_ENVIRONMENT_MANIFEST.filter(
    (entry) => entry.suiteKind === suiteKind
  );
}

export function resolveE2eTarget(project) {
  const entry = E2E_ENVIRONMENT_MANIFEST.find(
    (candidate) => candidate.nx.project === project
  );
  if (!entry) throw new Error(`Unknown E2E target: ${project}`);
  return entry;
}

export function resolveE2eServices(project) {
  const entry =
    typeof project === 'string' ? resolveE2eTarget(project) : project;
  return [...new Set([...entry.backendDependencies, entry.stack.service])];
}

export function resolveE2eLifecyclePhases(project) {
  const entry =
    typeof project === 'string' ? resolveE2eTarget(project) : project;
  return entry.lifecycle.phases;
}

function parseCliArgs(argv) {
  const args = { suiteKind: '', target: '', services: false, phases: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--kind') args.suiteKind = argv[++index];
    else if (arg === '--target') args.target = argv[++index];
    else if (arg === '--services') args.services = true;
    else if (arg === '--phases') args.phases = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.target) {
    const output = args.services
      ? resolveE2eServices(args.target)
      : args.phases
      ? resolveE2eLifecyclePhases(args.target)
      : resolveE2eTarget(args.target);
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else if (args.suiteKind) {
    process.stdout.write(
      `${JSON.stringify(listE2eTargets(args.suiteKind), null, 2)}\n`
    );
  } else {
    process.stdout.write(
      `${JSON.stringify(E2E_ENVIRONMENT_MANIFEST, null, 2)}\n`
    );
  }
}
