import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const DEFAULT_IGNORED_NAMES = new Set([
  '.git',
  '.angular',
  '.nx',
  '.pnpm-store',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'screenshots',
  'storybook-static',
  'test-results',
  'tmp',
]);

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function hashText(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
}

function listExistingPaths(paths) {
  return paths.filter((filePath) => fs.existsSync(filePath));
}

function normalizeDependsOn(dependsOn) {
  if (!dependsOn) {
    return [];
  }

  if (Array.isArray(dependsOn)) {
    return [...dependsOn].sort();
  }

  return Object.keys(dependsOn).sort();
}

function parseDockerfileCopySources(dockerfileContents) {
  const sources = [];
  const lines = dockerfileContents.replace(/\\\s*\n\s*/g, ' ').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const copyMatch = line.match(/^COPY\s+(.*)$/i);
    if (!copyMatch) {
      continue;
    }

    let args = copyMatch[1].trim();
    if (args.startsWith('--from=')) {
      continue;
    }

    while (args.startsWith('--')) {
      const spaceIndex = args.indexOf(' ');
      if (spaceIndex === -1) {
        args = '';
        break;
      }
      args = args.slice(spaceIndex + 1).trim();
    }

    if (!args) {
      continue;
    }

    if (args.startsWith('[')) {
      const parsed = JSON.parse(args);
      sources.push(...parsed.slice(0, -1));
      continue;
    }

    const tokens = args.match(/(?:"[^"]*"|'[^']*'|\S)+/g) || [];
    for (const token of tokens.slice(0, -1)) {
      sources.push(token.replace(/^['"]|['"]$/g, ''));
    }
  }

  return [...new Set(sources)].sort();
}

function isIgnoredPath(filePath) {
  return filePath
    .split(path.sep)
    .filter(Boolean)
    .some((segment) => DEFAULT_IGNORED_NAMES.has(segment));
}

function hashFileSystemEntry(filePath, memo) {
  const normalizedPath = path.resolve(filePath);
  if (memo.has(normalizedPath)) {
    return memo.get(normalizedPath);
  }

  if (!fs.existsSync(normalizedPath)) {
    const missingHash = hashText(`missing:${normalizedPath}`);
    memo.set(normalizedPath, missingHash);
    return missingHash;
  }

  const stat = fs.lstatSync(normalizedPath);

  if (stat.isSymbolicLink()) {
    const linkHash = hashText(`symlink:${fs.readlinkSync(normalizedPath)}`);
    memo.set(normalizedPath, linkHash);
    return linkHash;
  }

  if (stat.isDirectory()) {
    const children = fs
      .readdirSync(normalizedPath, { withFileTypes: true })
      .filter((entry) => !DEFAULT_IGNORED_NAMES.has(entry.name))
      .map((entry) => {
        const childPath = path.join(normalizedPath, entry.name);
        return `${entry.name}:${hashFileSystemEntry(childPath, memo)}`;
      })
      .sort();

    const directoryHash = hashText(
      `dir:${normalizedPath}:${children.join('|')}`
    );
    memo.set(normalizedPath, directoryHash);
    return directoryHash;
  }

  const fileHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(normalizedPath))
    .digest('hex');
  memo.set(normalizedPath, fileHash);
  return fileHash;
}

function inferAppId(serviceName, serviceConfig, composeDir) {
  const dockerfilePath = serviceConfig?.build?.dockerfile;
  if (!dockerfilePath) {
    return serviceName;
  }

  const match = toPosixPath(
    path.relative(composeDir, path.resolve(composeDir, dockerfilePath))
  ).match(/^apps\/([^/]+)\/Dockerfile$/);

  return match?.[1] || serviceName;
}

function collectSharedWorkspaceInputs(workspaceRoot) {
  return listExistingPaths([
    path.join(workspaceRoot, 'package.json'),
    path.join(workspaceRoot, 'pnpm-lock.yaml'),
    path.join(workspaceRoot, 'pnpm-workspace.yaml'),
    path.join(workspaceRoot, 'nx.json'),
    path.join(workspaceRoot, 'tsconfig.base.json'),
    path.join(workspaceRoot, 'tsconfig.json'),
  ]);
}

function collectServiceInputs({
  workspaceRoot,
  composeFilePath,
  serviceName,
  serviceConfig,
}) {
  const composeDir = path.dirname(composeFilePath);
  const build = serviceConfig.build;
  const buildContext = path.resolve(composeDir, build.context || '.');
  const dockerfilePath = build.dockerfile
    ? path.resolve(composeDir, build.dockerfile)
    : path.join(buildContext, 'Dockerfile');

  const inputs = new Set([
    composeFilePath,
    ...collectSharedWorkspaceInputs(workspaceRoot),
  ]);

  if (fs.existsSync(dockerfilePath)) {
    inputs.add(dockerfilePath);
    const copySources = parseDockerfileCopySources(
      fs.readFileSync(dockerfilePath, 'utf8')
    );
    for (const source of copySources) {
      if (source === '.' || source === './') {
        inputs.add(buildContext);
        continue;
      }

      const absoluteSource = path.resolve(buildContext, source);
      if (fs.existsSync(absoluteSource)) {
        inputs.add(absoluteSource);
      }
    }
  }

  const normalizedInputs = [...inputs]
    .map((filePath) => path.resolve(filePath))
    .filter((filePath) => filePath.startsWith(path.resolve(workspaceRoot)))
    .filter(
      (filePath) => !isIgnoredPath(path.relative(workspaceRoot, filePath))
    )
    .sort();

  return {
    serviceName,
    appId: inferAppId(serviceName, serviceConfig, composeDir),
    composeServiceName: serviceName,
    dockerfilePath,
    inputPaths: normalizedInputs,
    relativeInputPaths: normalizedInputs.map((filePath) =>
      toPosixPath(path.relative(workspaceRoot, filePath))
    ),
  };
}

function buildServiceFingerprint({
  workspaceRoot,
  serviceConfig,
  serviceInputs,
  memo,
}) {
  const hash = crypto.createHash('sha256');
  hash.update(stableStringify(serviceConfig));

  for (const relativeInputPath of serviceInputs.relativeInputPaths) {
    const absolutePath = path.join(workspaceRoot, relativeInputPath);
    hash.update(relativeInputPath);
    hash.update(hashFileSystemEntry(absolutePath, memo));
  }

  return hash.digest('hex');
}

function buildReverseDependencyMap(services) {
  const reverseDependencies = new Map();
  for (const serviceName of Object.keys(services)) {
    reverseDependencies.set(serviceName, new Set());
  }

  for (const [serviceName, serviceConfig] of Object.entries(services)) {
    for (const dependencyName of normalizeDependsOn(serviceConfig.depends_on)) {
      if (!reverseDependencies.has(dependencyName)) {
        reverseDependencies.set(dependencyName, new Set());
      }
      reverseDependencies.get(dependencyName).add(serviceName);
    }
  }

  return reverseDependencies;
}

function collectRestartServices(changedServices, reverseDependencies) {
  const queue = [...changedServices];
  const seen = new Set(changedServices);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const dependent of reverseDependencies.get(current) || []) {
      if (seen.has(dependent)) {
        continue;
      }
      seen.add(dependent);
      queue.push(dependent);
    }
  }

  return [...seen].sort();
}

function normalizeChangedFiles(changedFiles, workspaceRoot) {
  return new Set(
    (changedFiles || []).map((filePath) => {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceRoot, filePath);
      return toPosixPath(path.relative(workspaceRoot, absolutePath));
    })
  );
}

function serviceMatchesChangedFiles(serviceInputs, changedFilesSet) {
  if (changedFilesSet.size === 0) {
    return false;
  }

  return serviceInputs.relativeInputPaths.some((inputPath) => {
    for (const changedPath of changedFilesSet) {
      if (
        changedPath === inputPath ||
        changedPath.startsWith(`${inputPath}/`) ||
        inputPath.startsWith(`${changedPath}/`)
      ) {
        return true;
      }
    }
    return false;
  });
}

function eligibleBuildServices(services) {
  return Object.entries(services)
    .filter(([serviceName, serviceConfig]) => {
      if (!serviceConfig.build) {
        return false;
      }

      return serviceName !== 'db-setup' && !serviceName.endsWith('-seed');
    })
    .sort(([left], [right]) => left.localeCompare(right));
}

export function loadPlannerState(stateFilePath) {
  if (!stateFilePath || !fs.existsSync(stateFilePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
}

export function savePlannerState(stateFilePath, state) {
  fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
  fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
}

export async function createComposeBuildPlan({
  workspaceRoot,
  composeFile = 'docker-compose.yaml',
  previousState = null,
  changedFiles = null,
  forceAll = false,
} = {}) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot || process.cwd());
  const composeFilePath = path.resolve(resolvedWorkspaceRoot, composeFile);
  const composeDocument = readYaml(composeFilePath);
  const services = composeDocument.services || {};
  const reverseDependencies = buildReverseDependencyMap(services);
  const changedFilesSet = normalizeChangedFiles(
    changedFiles,
    resolvedWorkspaceRoot
  );
  const memo = new Map();

  const serviceEntries = eligibleBuildServices(services).map(
    ([serviceName, serviceConfig]) => {
      const serviceInputs = collectServiceInputs({
        workspaceRoot: resolvedWorkspaceRoot,
        composeFilePath,
        serviceName,
        serviceConfig,
      });

      return {
        serviceName,
        serviceConfig,
        serviceInputs,
      };
    }
  );

  const stateServices = {};
  const buildServices = [];
  const reasons = {};

  for (const entry of serviceEntries) {
    const fingerprint = buildServiceFingerprint({
      workspaceRoot: resolvedWorkspaceRoot,
      serviceConfig: entry.serviceConfig,
      serviceInputs: entry.serviceInputs,
      memo,
    });

    stateServices[entry.serviceName] = {
      fingerprint,
      appId: entry.serviceInputs.appId,
      inputPaths: entry.serviceInputs.relativeInputPaths,
    };

    const previousFingerprint =
      previousState?.services?.[entry.serviceName]?.fingerprint;
    const fingerprintChanged = previousState
      ? previousFingerprint !== fingerprint
      : false;
    const changedFileMatch = serviceMatchesChangedFiles(
      entry.serviceInputs,
      changedFilesSet
    );

    if (
      forceAll ||
      (!previousState && changedFilesSet.size === 0) ||
      fingerprintChanged ||
      changedFileMatch
    ) {
      buildServices.push(entry.serviceName);
      reasons[entry.serviceName] = forceAll
        ? 'forced'
        : !previousState && changedFilesSet.size === 0
        ? 'initial'
        : fingerprintChanged
        ? 'fingerprint-changed'
        : 'changed-files';
    }
  }

  const restartServices = collectRestartServices(
    buildServices,
    reverseDependencies
  );
  const buildApps = serviceEntries
    .filter((entry) => buildServices.includes(entry.serviceName))
    .map((entry) => entry.serviceInputs.appId)
    .sort();

  return {
    composeFile,
    buildServices,
    buildApps,
    restartServices,
    reasons,
    services: Object.fromEntries(
      serviceEntries.map((entry) => [entry.serviceName, entry.serviceInputs])
    ),
    state: {
      version: 1,
      composeFile,
      generatedAt: new Date().toISOString(),
      services: stateServices,
    },
  };
}
