#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { validateGeneratedWorkspace } from './lib/deployment-workspace-validation.mjs';
import {
  normalizeDeploymentInventory,
  validateComposeImageNames,
  validateDockerWorkflowMatrix,
} from './lib/deployment-inventory-validation.mjs';
import { normalizeDeploymentInventory } from './lib/deployment-inventory-normalization.mjs';

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..'
);
const inventoryJson = process.env.DEPLOYMENT_INVENTORY_FILE
  ? fs.readFileSync(process.env.DEPLOYMENT_INVENTORY_FILE, 'utf8')
  : execFileSync('go', ['run', './cmd/deployment-inventory'], {
      cwd: path.join(repoRoot, 'tools/admin-env-wizard'),
      env: { ...process.env, GOCACHE: process.env.GOCACHE || '/tmp/go-build' },
      encoding: 'utf8',
    });

const inventory = normalizeDeploymentInventory(JSON.parse(inventoryJson));
const workspaceDir = process.env.DEPLOYMENT_WORKSPACE_DIR;
const expectedApps = inventory.apps
  .map((app) => app.buildAppId || app.id)
  .sort();

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function compareList(label, expected, actual) {
  const missing = expected.filter((item) => !actual.includes(item));
  const extra = actual.filter((item) => !expected.includes(item));

  if (missing.length === 0 && extra.length === 0) {
    return [];
  }

  const errors = [];
  if (missing.length > 0) {
    errors.push(`${label} missing: ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    errors.push(`${label} unexpected: ${extra.join(', ')}`);
  }
  return errors;
}

function compareRequiredList(label, expected, actual) {
  const missing = expected.filter((item) => !actual.includes(item));
  if (missing.length === 0) {
    return [];
  }
  return [`${label} missing: ${missing.join(', ')}`];
}

function parseSpaceLoopScript(script) {
  const match = script.match(/for service in\s+(.+?)\s*;\s*do\b/);
  if (!match) {
    throw new Error(`Unable to parse service loop from script: ${script}`);
  }
  return match[1].trim().split(/\s+/);
}

function parseNxProjectsScript(script) {
  const match = script.match(/--projects=([^\s]+)/);
  if (!match) {
    throw new Error(`Unable to parse --projects list from script: ${script}`);
  }
  return match[1].split(',');
}

const buildPush = readYaml(
  path.join(repoRoot, '.github/workflows/build-push.yml')
);

const dockerPublish = readYaml(
  path.join(repoRoot, '.github/workflows/docker-publish.yml')
);

const baseKustomization = readYaml(
  path.join(repoRoot, 'k8s/base/kustomization.yaml')
);
const expectedResources = inventory.apps
  .map((app) => app.k8sManifestPath.replace(/^k8s\/base\//, ''))
  .sort();
const actualResources = (baseKustomization.resources || [])
  .filter(
    (resource) =>
      resource !== 'ingress.yaml' &&
      resource !== 'tailscale-ingress.yaml' &&
      resource !== 'services/video-processing-data-pvc.yaml'
  )
  .sort();

const overlayFiles = [
  path.join(repoRoot, 'k8s/overlays/staging/kustomization.yaml'),
  path.join(repoRoot, 'k8s/overlays/production/kustomization.yaml'),
];
const expectedImageNames = inventory.apps.map((app) => app.imageName).sort();

const errors = [
  ...validateDockerWorkflowMatrix(
    'build-push',
    buildPush,
    'determine-changes',
    'build-and-push',
    expectedApps
  ),
  ...validateDockerWorkflowMatrix(
    'docker-publish',
    dockerPublish,
    'determine_changes',
    'build_and_push',
    expectedApps
  ),
  ...compareList(
    'base kustomization resources',
    expectedResources,
    actualResources
  ),
];

const packageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
);
const composeContent = fs.readFileSync(
  path.join(repoRoot, 'docker-compose.yaml'),
  'utf8'
);
const composeImageMatches = [
  ...composeContent.matchAll(
    /image:\s*(cjrutherford\/optimistic_tanuki_[^:\s]+)(?::([^\s]+))?/g
  ),
];
const composeImageNames = composeImageMatches.map((match) => match[1]);
const invalidComposeImageTags = composeImageMatches
  .filter((match) => match[2] !== '${PRODUCTION_IMAGE_TAG:-latest}')
  .map((match) =>
    match[2]
      ? `${match[1]} uses unexpected tag "${match[2]}"`
      : `${match[1]} is missing a tag`
  );
const uniqueComposeImageNames = [...new Set(composeImageNames)].sort();
const expectedComposeImageNames = [...expectedImageNames];
const expectedComposeServices = inventory.apps
  .map((app) => app.composeServiceName || app.id)
  .sort();

errors.push(
  ...validateComposeImageNames(
    expectedComposeImageNames,
    uniqueComposeImageNames
  )
);
errors.push(...invalidComposeImageTags);

errors.push(
  ...compareRequiredList(
    'package.json docker:build:slow services',
    expectedComposeServices,
    parseSpaceLoopScript(packageJson.scripts['docker:build:slow']).sort()
  )
);

for (const scriptName of [
  'build:dev',
  'build:docker:dev',
  'build',
  'watch:build',
  'watch:docker:dev',
]) {
  errors.push(
    ...compareRequiredList(
      `package.json ${scriptName} projects`,
      expectedApps,
      parseNxProjectsScript(packageJson.scripts[scriptName]).sort()
    )
  );
}

for (const overlayFile of overlayFiles) {
  const overlay = readYaml(overlayFile);
  const actualImageNames = (overlay.images || [])
    .map((image) => image.name)
    .sort();
  errors.push(
    ...compareList(
      `${path.relative(repoRoot, overlayFile)} image overrides`,
      expectedImageNames,
      actualImageNames
    )
  );
}

if (workspaceDir) {
  errors.push(
    ...validateGeneratedWorkspace({
      workspaceDir: path.resolve(workspaceDir),
      inventory,
    })
  );
}

if (errors.length > 0) {
  console.error('Deployment inventory validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Deployment inventory validation passed for ${expectedApps.length} apps.`
);
