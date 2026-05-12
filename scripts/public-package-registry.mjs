import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const registryPath = path.join(
  workspaceRoot,
  'tools/public-packages/public-packages.json'
);

function readRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function getPublicPackages() {
  return readRegistry().packages;
}

function getProjectList() {
  return getPublicPackages().map((entry) => entry.project);
}

function getArgValue(name) {
  const prefixedArg = process.argv.find((arg) => arg.startsWith(`${name}=`));

  if (prefixedArg) {
    return prefixedArg.slice(name.length + 1);
  }

  const argIndex = process.argv.indexOf(name);

  if (argIndex >= 0) {
    return process.argv[argIndex + 1];
  }

  return undefined;
}

function runNxTarget(target) {
  const projects = getProjectList();
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'nx',
      'run-many',
      '--target',
      target,
      '--projects',
      projects.join(','),
      '--outputStyle=static',
    ],
    {
      cwd: workspaceRoot,
      stdio: 'inherit',
    }
  );

  process.exit(result.status ?? 1);
}

const command = process.argv[2];

if (command === 'list') {
  const format = getArgValue('--format') ?? 'projects';
  const packages = getPublicPackages();

  if (format === 'json') {
    console.log(JSON.stringify(packages, null, 2));
    process.exit(0);
  }

  if (format === 'package-names') {
    console.log(packages.map((entry) => entry.packageName).join(','));
    process.exit(0);
  }

  console.log(packages.map((entry) => entry.project).join(','));
  process.exit(0);
}

if (command === 'run-many') {
  const target = getArgValue('--target');

  if (!target) {
    console.error('Missing required --target for run-many command.');
    process.exit(1);
  }

  runNxTarget(target);
}

console.error(
  'Usage: node scripts/public-package-registry.mjs <list|run-many> [options]'
);
process.exit(1);
