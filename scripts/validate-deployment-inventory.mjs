#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';

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

const inventory = JSON.parse(inventoryJson);
const expectedApps = inventory.apps
  .map((app) => app.BuildAppID || app.ID)
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

const buildPush = readYaml(
  path.join(repoRoot, '.github/workflows/build-push.yml')
);
const matrixApps = buildPush.jobs['build-and-push'].strategy.matrix.include
  .map((entry) => entry.app)
  .sort();

const baseKustomization = readYaml(
  path.join(repoRoot, 'k8s/base/kustomization.yaml')
);
const expectedResources = inventory.apps
  .map((app) => app.K8sManifestPath.replace(/^k8s\/base\//, ''))
  .sort();
const actualResources = (baseKustomization.resources || [])
  .filter(
    (resource) =>
      resource !== 'ingress.yaml' && resource !== 'tailscale-ingress.yaml'
  )
  .sort();

const overlayFiles = [
  path.join(repoRoot, 'k8s/overlays/staging/kustomization.yaml'),
  path.join(repoRoot, 'k8s/overlays/production/kustomization.yaml'),
];
const expectedImageNames = inventory.apps.map((app) => app.ImageName).sort();

const errors = [
  ...compareList('build-push matrix apps', expectedApps, matrixApps),
  ...compareList(
    'base kustomization resources',
    expectedResources,
    actualResources
  ),
];

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
