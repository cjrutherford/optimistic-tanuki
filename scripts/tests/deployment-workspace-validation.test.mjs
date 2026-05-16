import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { validateGeneratedWorkspace } from '../lib/deployment-workspace-validation.mjs';

function makeTempWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deployment-workspace-'));
  fs.mkdirSync(path.join(dir, 'compose'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'k8s', 'base'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'argocd'), { recursive: true });
  return dir;
}

function writeWorkspaceFixture(dir) {
  fs.writeFileSync(
    path.join(dir, 'deployment.yaml'),
    `deploymentName: demo
targets:
  - compose
  - k8s
services:
  - serviceID: gateway
    enabled: true
  - serviceID: authentication
    enabled: true
argocd:
  applicationName: demo
`
  );
  fs.writeFileSync(
    path.join(dir, 'compose', 'docker-compose.yaml'),
    `services:
  gateway:
    image: cjrutherford/optimistic_tanuki_gateway:latest
    ports:
      - "3000:3000"
  authentication:
    image: cjrutherford/optimistic_tanuki_authentication:latest
    ports:
      - "3001:3001"
`
  );
  fs.writeFileSync(
    path.join(dir, 'k8s', 'base', 'kustomization.yaml'),
    `resources:
  - gateway.yaml
  - authentication.yaml
`
  );
  fs.writeFileSync(
    path.join(dir, 'k8s', 'base', 'gateway.yaml'),
    `kind: Deployment
metadata:
  name: gateway
spec:
  template:
    spec:
      containers:
        - ports:
            - containerPort: 3000
`
  );
  fs.writeFileSync(
    path.join(dir, 'k8s', 'base', 'authentication.yaml'),
    `kind: Deployment
metadata:
  name: authentication
spec:
  template:
    spec:
      containers:
        - ports:
            - containerPort: 3001
`
  );
  fs.writeFileSync(
    path.join(dir, 'argocd', 'application.yaml'),
    `spec:
  source:
    repoURL: https://github.com/cjrutherford/optimistic-tanuki.git
    targetRevision: main
    path: dist/admin-env/demo/k8s
`
  );
}

const inventory = {
  apps: [
    {
      ID: 'gateway',
      ComposeServiceName: 'gateway',
      ImageName: 'cjrutherford/optimistic_tanuki_gateway',
      K8sManifestPath: 'k8s/base/gateway.yaml',
    },
    {
      ID: 'authentication',
      ComposeServiceName: 'authentication',
      ImageName: 'cjrutherford/optimistic_tanuki_authentication',
      K8sManifestPath: 'k8s/base/services/authentication.yaml',
    },
  ],
};

test('validateGeneratedWorkspace accepts a generated deployment workspace subset', () => {
  const dir = makeTempWorkspace();
  writeWorkspaceFixture(dir);

  const errors = validateGeneratedWorkspace({
    workspaceDir: dir,
    inventory,
  });

  assert.deepEqual(errors, []);
});

test('validateGeneratedWorkspace reports missing k8s resources for enabled apps', () => {
  const dir = makeTempWorkspace();
  writeWorkspaceFixture(dir);
  fs.writeFileSync(
    path.join(dir, 'k8s', 'base', 'kustomization.yaml'),
    `resources:
  - gateway.yaml
`
  );

  const errors = validateGeneratedWorkspace({
    workspaceDir: dir,
    inventory,
  });

  assert.match(errors.join('\n'), /authentication\.yaml/);
});

test('validate-compose-k8s-parity.sh supports DEPLOYMENT_WORKSPACE_DIR', () => {
  const dir = makeTempWorkspace();
  writeWorkspaceFixture(dir);
  const inventoryPath = path.join(dir, 'inventory.json');
  fs.writeFileSync(inventoryPath, JSON.stringify(inventory));

  const result = spawnSync('bash', ['scripts/validate-compose-k8s-parity.sh'], {
    cwd: path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      '..',
      '..'
    ),
    env: {
      ...process.env,
      DEPLOYMENT_WORKSPACE_DIR: dir,
      DEPLOYMENT_INVENTORY_FILE: inventoryPath,
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Parity validation completed successfully/);
});
