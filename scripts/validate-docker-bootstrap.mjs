#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url);
const packageJson = JSON.parse(
  readFileSync(new URL('package.json', root), 'utf8')
);

const dockerScripts = Object.entries(packageJson.scripts).filter(([name]) =>
  name.startsWith('docker:')
);

assert.equal(
  packageJson.scripts['docker:dev:up'],
  './scripts/docker-start-phased.sh docker-compose.dev.yaml 5',
  'docker:dev:up must start services with the development compose overlay'
);

assert.equal(
  packageJson.scripts['docker:dev:phased'],
  './scripts/docker-start-phased.sh docker-compose.dev.yaml 5',
  'docker:dev:phased must start services with the development compose overlay'
);

assert.equal(
  packageJson.scripts['docker:dev'],
  './scripts/docker-dev-refresh.sh',
  'docker:dev must use the incremental docker dev refresh wrapper'
);

assert.equal(
  packageJson.scripts['docker:dev:plan'],
  './scripts/docker-build-batched.sh --dry-run docker-compose.dev.yaml && ./scripts/docker-start-phased.sh --dry-run docker-compose.dev.yaml 5',
  'docker:dev:plan must report the incremental docker build and restart plan without mutating local services'
);

assert.equal(
  packageJson.scripts['docker:dev:bootstrap'],
  'pnpm run build:docker:dev && pnpm run docker:build:dev && pnpm run docker:dev:up && pnpm run docker:dev:seed',
  'docker:dev:bootstrap must do the full build, startup, and seed flow'
);

assert.equal(
  packageJson.scripts['docker:dev:reset'],
  'pnpm run build:docker:dev && pnpm run docker:build:dev && ./scripts/docker-start-phased.sh docker-compose.dev.yaml 5 --force-recreate --renew-anon-volumes',
  'docker:dev:reset must use the docker-specific development build set'
);

assert.equal(
  packageJson.scripts['docker:dev:watch'],
  'pnpm run build:docker:dev && pnpm run docker:dev:up && pnpm run watch:docker:dev',
  'docker:dev:watch must use the docker-specific development build set'
);

assert.equal(
  packageJson.scripts['slice:checkpoint:dev'],
  './scripts/verify-dev-slice-checkpoint.sh',
  'slice:checkpoint:dev must use the dedicated Docker slice checkpoint wrapper'
);

assert.equal(
  packageJson.scripts['docker:prod:bootstrap'],
  './scripts/docker-compose-deploy.sh',
  'docker:prod:bootstrap must use the explicit compose deploy entrypoint'
);

assert.match(
  packageJson.scripts['build:docker:dev'],
  /--projects=.*video-client.* --configuration=development$/,
  'build:docker:dev must define the docker development project list'
);

assert.match(
  packageJson.scripts['build:docker:dev'],
  /marketing-generator.*business-site|business-site.*marketing-generator/,
  'build:docker:dev must include apps in the docker dev compose stack'
);

assert.match(
  packageJson.scripts['watch:docker:dev'],
  /--projects=.*video-client.* --configuration=development --watch$/,
  'watch:docker:dev must define the docker development project watch list'
);

assert.match(
  packageJson.scripts['watch:docker:dev'],
  /marketing-generator.*business-site|business-site.*marketing-generator/,
  'watch:docker:dev must include apps in the docker dev compose stack'
);

const referencedScripts = new Set();
const directlyInvokedScripts = new Set();

for (const [, command] of dockerScripts) {
  for (const match of command.matchAll(
    /(?:^|\s)(sh\s+)?(\.\/scripts\/[^\s;&|]+\.sh)\b/g
  )) {
    const script = match[2];
    const usesShell = Boolean(match[1]);
    if (!usesShell) {
      directlyInvokedScripts.add(script);
    }
    referencedScripts.add(script);
  }
}

assert.deepEqual([...referencedScripts].sort(), [
  './scripts/dev-seed.sh',
  './scripts/docker-build-batched.sh',
  './scripts/docker-compose-deploy.sh',
  './scripts/docker-dev-refresh.sh',
  './scripts/docker-start-phased.sh',
  './scripts/prod-seed.sh',
]);

for (const script of referencedScripts) {
  const path = new URL(script.slice(2), root);
  assert.equal(existsSync(path), true, `${script} must exist`);
  if (directlyInvokedScripts.has(script)) {
    assert.equal(
      (statSync(path).mode & 0o111) !== 0,
      true,
      `${script} must be executable`
    );
  }
}

function collectServiceNames(fileName) {
  const content = readFileSync(new URL(fileName, root), 'utf8');
  const services = new Set();
  let inServices = false;

  for (const line of content.split('\n')) {
    if (line === 'services:') {
      inServices = true;
      continue;
    }
    if (inServices && /^\S/.test(line) && line.trim() !== '') {
      break;
    }
    const match = inServices ? line.match(/^  ([a-zA-Z0-9_-]+):\s*$/) : null;
    if (match) {
      services.add(match[1]);
    }
  }

  return services;
}

const composeServices = new Set([
  ...collectServiceNames('docker-compose.yaml'),
  ...collectServiceNames('docker-compose.dev.yaml'),
]);

const phasedStartupServices = [
  'postgres',
  'redis',
  'db-setup',
  'authentication',
  'profile',
  'social',
  'permissions',
  'app-configurator',
  'system-configurator-api',
  'finance',
  'payments',
  'store',
  'assets',
  'project-planning',
  'chat-collector',
  'prompt-proxy',
  'telos-docs-service',
  'blogging',
  'forum',
  'wellness',
  'classifieds',
  'ai-orchestration',
  'lead-tracker',
  'video-transcoder-worker',
  'videos',
  'gateway',
  'app-configurator-seed',
  'ot-client-interface',
  'forgeofwill-client-interface',
  'digital-homestead-client-interface',
  'hai-client-interface',
  'local-hub-client-interface',
  'crdn-client-interface',
  'leads-app',
  'store-client',
  'configurable-client',
  'fin-commander',
  'marketing-generator',
  'business-site',
  'owner-console',
  'd6',
  'system-configurator',
];

for (const service of phasedStartupServices) {
  assert.equal(
    composeServices.has(service),
    true,
    `${service} must exist in compose files`
  );
}

const composeYaml = readFileSync(new URL('docker-compose.yaml', root), 'utf8');
assert.match(
  composeYaml,
  /command:\s+\/bin\/sh -c "command -v pg_isready && sh \.\/scripts\/setup-and-migrate\.sh"/,
  'db-setup must invoke scripts/setup-and-migrate.sh directly to avoid pnpm non-TTY module purge prompts'
);

assert.equal(
  packageJson.scripts['db:setup'],
  'sh ./scripts/setup-and-migrate.sh',
  'db:setup must invoke scripts/setup-and-migrate.sh from the scripts directory'
);

assert.equal(
  existsSync(new URL('scripts/setup-and-migrate.sh', root)),
  true,
  'scripts/setup-and-migrate.sh must exist'
);
const dockerfileReferences = [
  ...composeYaml.matchAll(/^\s+dockerfile:\s+(.+)$/gm),
].map((match) => match[1].replace(/^['"]|['"]$/g, ''));

assert.equal(
  dockerfileReferences.includes('./docker/db-setup/Dockerfile'),
  true,
  'db-setup Dockerfile must be referenced by docker-compose.yaml'
);

for (const dockerfile of dockerfileReferences) {
  const normalizedPath = normalize(dockerfile.replace(/^\.\//, ''));
  const dockerfileUrl = new URL(normalizedPath, root);
  assert.equal(existsSync(dockerfileUrl), true, `${dockerfile} must exist`);
  assert.equal(
    existsSync(new URL(dirname(normalizedPath), root)),
    true,
    `${dirname(dockerfile)} directory must exist`
  );
}

const tempDir = mkdtempSync(join(tmpdir(), 'docker-bootstrap-'));
const bakeFile = join(tempDir, 'bake.json');
writeFileSync(
  bakeFile,
  JSON.stringify({
    target: {
      'db-setup': {},
      authentication: {},
      gateway: {},
      profile: {},
      'app-configurator-seed': {},
      'store-seed': {},
    },
  })
);

function execForOutput(command, args, options) {
  try {
    return execFileSync(command, args, options);
  } catch (error) {
    if (
      error?.code === 'EPERM' &&
      error.status === 0 &&
      typeof error.stdout === 'string'
    ) {
      return error.stdout;
    }
    throw error;
  }
}

const buildOutput = execForOutput(
  'bash',
  [
    './scripts/docker-build-batched.sh',
    '--dry-run',
    '2',
    'docker-compose.dev.yaml',
  ],
  {
    cwd: root,
    env: { ...process.env, DOCKER_BUILD_BAKE_FILE: bakeFile },
    encoding: 'utf8',
  }
);

assert.match(
  buildOutput,
  /Compose flags: -f docker-compose\.yaml -f docker-compose\.dev\.yaml/
);
assert.match(buildOutput, /DRY RUN: docker buildx bake -f .* db-setup/);
assert.match(
  buildOutput,
  /(Found [0-9]+ services to build|No changed services to build for docker-compose\.dev\.yaml)/
);
assert.doesNotMatch(buildOutput, /app-configurator-seed|store-seed/);

const startupOutput = execForOutput(
  'bash',
  [
    './scripts/docker-start-phased.sh',
    '--dry-run',
    'docker-compose.dev.yaml',
    '0',
    '--force-recreate',
  ],
  {
    cwd: root,
    encoding: 'utf8',
  }
);

assert.match(
  startupOutput,
  /Compose flags: -f docker-compose\.yaml -f docker-compose\.dev\.yaml/
);
assert.match(startupOutput, /Extra flags: --force-recreate/);
if (/No changed services require restart/.test(startupOutput)) {
  assert.match(startupOutput, /DRY RUN: docker compose .* ps/);
} else if (/=== Incremental restart ===/.test(startupOutput)) {
  assert.match(
    startupOutput,
    /DRY RUN: docker compose .* up -d --no-deps --force-recreate .*gateway/
  );
  assert.match(startupOutput, /DRY RUN: docker compose .* ps/);
} else {
  assert.match(
    startupOutput,
    /DRY RUN: docker compose .* up -d --force-recreate postgres redis/
  );
  assert.match(startupOutput, /DRY RUN: docker compose .* wait db-setup/);
  assert.match(
    startupOutput,
    /DRY RUN: docker compose .* up -d --no-deps --force-recreate .*gateway/
  );
  assert.match(
    startupOutput,
    /DRY RUN: docker compose .* up -d --no-deps --force-recreate .*video-transcoder-worker .*videos/
  );
}

const seedRuntimeEntries = [
  {
    path: 'dist/apps/telos-docs-service/seed-persona.js',
    label: 'telos docs persona seed',
  },
  {
    path: 'dist/apps/permissions/seed-permissions.js',
    label: 'permissions seed',
  },
  { path: 'dist/apps/store/seed-store.js', label: 'store seed' },
  { path: 'dist/apps/social/seed-social.js', label: 'social seed' },
  {
    path: 'dist/apps/social/seed-local-communities.js',
    label: 'local communities seed',
  },
  {
    path: 'dist/apps/social/seed-community-posts.js',
    label: 'community posts seed',
  },
  {
    path: 'dist/apps/payments/seed-products.js',
    label: 'payments products seed',
  },
  { path: 'dist/apps/videos/seed-videos.js', label: 'videos seed' },
  {
    path: 'dist/apps/classifieds/seed-classifieds.js',
    label: 'classifieds seed',
  },
];

for (const entry of seedRuntimeEntries) {
  assert.equal(
    existsSync(new URL(entry.path, root)),
    true,
    `${entry.label} runtime entry must exist at ${entry.path}`
  );
}

const devSeedScript = readFileSync(
  new URL('scripts/dev-seed.sh', root),
  'utf8'
);
const dockerComposeDev = readFileSync(
  new URL('docker-compose.dev.yaml', root),
  'utf8'
);
const videosDockerfile = readFileSync(
  new URL('apps/videos/Dockerfile', root),
  'utf8'
);
const prodSeedScript = readFileSync(
  new URL('scripts/prod-seed.sh', root),
  'utf8'
);
const runSeedScript = readFileSync(
  new URL('scripts/run-seed.sh', root),
  'utf8'
);
const classifiedsDevBlockMatch = dockerComposeDev.match(
  /\n  classifieds:\n[\s\S]*?\n  payments:\n/
);
const assetsDevBlockMatch = dockerComposeDev.match(
  /\n  assets:\n[\s\S]*?\n  d6:\n/
);
const videosDevBlockMatch = dockerComposeDev.match(
  /\n  videos:\n[\s\S]*?\n  video-transcoder-worker:\n/
);
assert.notEqual(
  classifiedsDevBlockMatch,
  null,
  'classifieds dev service block must exist before payments'
);
assert.notEqual(
  assetsDevBlockMatch,
  null,
  'assets dev service block must exist before d6'
);
assert.notEqual(
  videosDevBlockMatch,
  null,
  'videos dev service block must exist before video-transcoder-worker'
);
assert.equal(
  classifiedsDevBlockMatch[0].includes(
    "        './node_modules/.bin/nodemon',"
  ),
  true,
  'classifieds dev service must invoke the bundled nodemon binary'
);
assert.equal(
  classifiedsDevBlockMatch[0].includes('      - ./dist/apps:/app/dist/apps'),
  true,
  'classifieds dev service must mount the shared dist/apps root to avoid stale leaf bind mounts'
);
assert.equal(
  classifiedsDevBlockMatch[0].includes("        '/app/dist/apps/classifieds',"),
  true,
  'classifieds dev service must watch the stable dist/apps/classifieds path'
);
assert.equal(
  classifiedsDevBlockMatch[0].includes(
    "        'dist/apps/classifieds/main.js',"
  ),
  true,
  'classifieds dev service must execute the classifieds runtime from the shared dist/apps mount'
);
assert.equal(
  classifiedsDevBlockMatch[0].includes(
    '      - ./apps/classifieds/src/assets:/app/dist/apps/assets'
  ),
  true,
  'classifieds dev service must mount config assets where the compiled runtime resolves them'
);
assert.equal(
  assetsDevBlockMatch[0].includes("    user: '0:0'"),
  true,
  'assets dev service must run as root so the local storage volume is writable'
);
assert.equal(
  videosDevBlockMatch[0].includes('      - ./dist/apps:/usr/src/app/dist/apps'),
  true,
  'videos dev service must mount the shared dist/apps root to avoid stale leaf bind mounts'
);
assert.equal(
  videosDevBlockMatch[0].includes("        '/usr/src/app/dist/apps/videos',"),
  true,
  'videos dev service must watch the stable dist/apps/videos path'
);
assert.equal(
  videosDevBlockMatch[0].includes("        'dist/apps/videos/main.js',"),
  true,
  'videos dev service must execute the videos runtime from the shared dist/apps mount'
);
assert.equal(
  dockerComposeDev.includes("        'nodemon',"),
  false,
  'docker-compose.dev services must not rely on bare nodemon being on PATH'
);
assert.match(
  videosDockerfile,
  /pnpm add -w nodemon\b/,
  'videos Dockerfile runner must install nodemon for the dev compose command'
);

for (const token of [
  'run_seed telos-docs-service "${APP_RUNTIME_DIR}" node ./seed-persona.js',
  'run_seed permissions "${APP_RUNTIME_DIR}" node ./seed-permissions.js',
  'run_seed store "${APP_RUNTIME_DIR}" node ./seed-store.js',
  'run_seed_from_workspace_env owner-console "/app/apps/owner-console" GATEWAY_URL "${GATEWAY_API_URL}" node ./src/seed-owner.mjs',
  'run_seed_with_env social "${APP_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_API_URL}" node ./seed-social.js',
  'run_seed_with_run social "${APP_RUNTIME_DIR}" node ./seed-local-communities.js',
  'run_seed_with_env social "${APP_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_API_URL}" node ./seed-community-posts.js',
  'run_seed_with_env classifieds "${CLASSIFIEDS_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_BASE_URL}" node ./dist/apps/classifieds/seed-classifieds.js',
  'run_seed_with_run payments "${APP_RUNTIME_DIR}" node ./seed-products.js',
  'run_seed_with_media_volume videos "${APP_RUNTIME_DIR}" node ./dist/apps/videos/seed-videos.js',
]) {
  assert.equal(
    devSeedScript.includes(token),
    true,
    `dev seed script must include ${token}`
  );
}

assert.equal(
  prodSeedScript.includes(
    'run_seed permissions "${APP_RUNTIME_DIR}" node ./seed-permissions.js'
  ),
  true,
  'prod seed script must use the permissions runtime seed entrypoint'
);
assert.equal(
  prodSeedScript.includes(
    'run_seed social "${APP_RUNTIME_DIR}" node ./seed-local-communities.js'
  ),
  true,
  'prod seed script must seed only local communities for the social service'
);
assert.equal(
  prodSeedScript.includes('seed-social.js'),
  false,
  'prod seed script must not invoke the client-interface social content seed'
);
assert.equal(
  prodSeedScript.includes('seed-community-posts.js'),
  false,
  'prod seed script must not invoke the local-hub community content seed'
);
assert.equal(
  runSeedScript.includes(
    'social) run_seed_k8s "social" "node /usr/src/app/seed-local-communities.js" ;;'
  ),
  true,
  'run-seed k8s social target must use the local communities seed only'
);
assert.equal(
  runSeedScript.includes(
    'social) run_seed_docker "social" "node /usr/src/app/seed-local-communities.js" ;;'
  ),
  true,
  'run-seed docker social target must use the local communities seed only'
);
assert.equal(
  runSeedScript.includes(
    'run_seed_k8s "social" "node /usr/src/app/seed-local-communities.js"'
  ),
  true,
  'run-seed k8s all target must use the local communities seed only'
);
assert.equal(
  runSeedScript.includes(
    'run_seed_docker "social" "node /usr/src/app/seed-local-communities.js"'
  ),
  true,
  'run-seed docker all target must use the local communities seed only'
);

const ignoredPackageManagerScanDirs = new Set([
  '.angular',
  '.claude',
  '.git',
  '.nx',
  '.vscode',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'storybook-static',
  'test-results',
  'tmp',
]);
const ignoredPackageManagerScanFiles = new Set([
  // Prose describing the public SDK's `npm install` for external developers —
  // the published package is consumed via npm, not this repo's pnpm workspace.
  '.github/prompts/generate-email-campaign.prompt.md',
  'apps/ui-playground/public/generated/compodoc',
  'ollama-screener-results-graphs.html',
  'libs/app-catalog-contracts/README.md',
  'libs/billing/contracts/README.md',
  'libs/billing-sdk/README.md',
  'libs/constants/README.md',
  'libs/encryption/README.md',
  'libs/leads/contracts/README.md',
  'libs/logger/README.md',
  'opencode.json',
  'pnpm-lock.yaml',
  'scripts/validate-docker-bootstrap.mjs',
  'tools/stack-client/stack-client',
]);
const ignoredPackageManagerScanExtensions = new Set([
  '.db',
  '.gif',
  '.ico',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.zip',
]);

const forbiddenPackageManagerPatterns = [
  {
    pattern: /\bnpm\s+(?:run|install|ci|i|audit|start)\b/,
    label: 'npm command',
  },
  { pattern: /\bnpx\b/, label: 'npx command' },
  { pattern: /package-lock\.json/, label: 'package-lock.json reference' },
  { pattern: /package\*\.json/, label: 'package*.json Docker copy glob' },
  {
    pattern: /pnpm install --legacy-peer-deps/,
    label: 'legacy npm peer flag on pnpm install',
  },
  {
    pattern: /--omit=dev --legacy-peer-deps/,
    label: 'legacy npm peer flag on production install',
  },
  {
    pattern: /RUN .*pnpm install --frozen-lockfile\s+\S/,
    label: 'pnpm install used where pnpm add is required',
  },
];

function collectFiles(dirUrl, relativeDir = '') {
  const files = [];
  for (const entry of readdirSync(dirUrl, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (ignoredPackageManagerScanDirs.has(entry.name)) {
        continue;
      }
      files.push(
        ...collectFiles(
          new URL(`${entry.name}/`, dirUrl),
          join(relativeDir, entry.name)
        )
      );
      continue;
    }

    const file = join(relativeDir, entry.name);
    if (file.startsWith('apps/ui-playground/public/generated/compodoc/')) {
      continue;
    }
    const extension = entry.name.includes('.')
      ? entry.name.slice(entry.name.lastIndexOf('.'))
      : '';
    if (
      !entry.isFile() ||
      ignoredPackageManagerScanFiles.has(entry.name) ||
      ignoredPackageManagerScanFiles.has(file) ||
      ignoredPackageManagerScanExtensions.has(extension)
    ) {
      continue;
    }
    files.push(file);
  }
  return files;
}

const packageManagerViolations = [];
for (const file of collectFiles(root)) {
  const content = readFileSync(new URL(file, root), 'utf8');
  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes('cdn.jsdelivr.net/npm/')) {
      continue;
    }
    for (const { pattern, label } of forbiddenPackageManagerPatterns) {
      if (pattern.test(line)) {
        packageManagerViolations.push(`${file}:${index + 1}: ${label}`);
      }
    }
  }
}

assert.deepEqual(
  packageManagerViolations,
  [],
  'package operations must use pnpm'
);
