#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';

const [, , overlayPathArg, imageTag] = process.argv;

if (!overlayPathArg || !imageTag) {
  console.error('Usage: node scripts/update-k8s-overlay-images.mjs <overlay-kustomization-path> <image-tag>');
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const overlayPath = path.resolve(repoRoot, overlayPathArg);

const inventoryJson = process.env.DEPLOYMENT_INVENTORY_FILE
  ? fs.readFileSync(process.env.DEPLOYMENT_INVENTORY_FILE, 'utf8')
  : execFileSync(
      'go',
      ['run', './cmd/deployment-inventory'],
      {
        cwd: path.join(repoRoot, 'tools/admin-env-wizard'),
        env: { ...process.env, GOCACHE: process.env.GOCACHE || '/tmp/go-build' },
        encoding: 'utf8',
      },
    );

const inventory = JSON.parse(inventoryJson);
const overlay = yaml.load(fs.readFileSync(overlayPath, 'utf8'));

overlay.images = inventory.apps
  .map((app) => ({
    name: app.ImageName,
    newTag: imageTag,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(overlayPath, yaml.dump(overlay, { lineWidth: 120, noRefs: true }));
console.log(`Updated ${path.relative(repoRoot, overlayPath)} with ${overlay.images.length} image overrides.`);
