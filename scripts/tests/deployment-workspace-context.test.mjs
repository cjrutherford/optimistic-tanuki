import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveDeploymentWorkspaceContext } from '../lib/deployment-workspace-context.mjs';

function makeRepoFixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-context-'));
  fs.mkdirSync(path.join(repoRoot, 'k8s', 'argo-app'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'k8s', 'overlays', 'production'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(repoRoot, 'k8s', 'argo-app', 'application.yaml'),
    'kind: Application\n'
  );
  return repoRoot;
}

test('resolveDeploymentWorkspaceContext returns workspace metadata when generated workspace exists', () => {
  const repoRoot = makeRepoFixture();
  const workspaceDir = path.join(repoRoot, 'dist', 'admin-env', 'production');
  fs.mkdirSync(path.join(workspaceDir, 'argocd'), { recursive: true });
  fs.mkdirSync(path.join(workspaceDir, 'k8s'), { recursive: true });
  fs.writeFileSync(
    path.join(workspaceDir, 'deployment.yaml'),
    `deploymentName: production
argocd:
  applicationName: optimistic-tanuki-prod
`
  );
  fs.writeFileSync(
    path.join(workspaceDir, 'argocd', 'application.yaml'),
    `metadata:
  name: optimistic-tanuki-prod
`
  );

  const context = resolveDeploymentWorkspaceContext({
    repoRootPath: repoRoot,
    deploymentName: 'production',
    environment: 'production',
  });

  assert.equal(context.mode, 'workspace');
  assert.equal(context.appName, 'optimistic-tanuki-prod');
  assert.equal(
    context.argocdAppFile,
    path.join(workspaceDir, 'argocd', 'application.yaml')
  );
  assert.equal(context.kustomizeDir, path.join(workspaceDir, 'k8s'));
});

test('resolveDeploymentWorkspaceContext falls back to root compatibility paths', () => {
  const repoRoot = makeRepoFixture();

  const context = resolveDeploymentWorkspaceContext({
    repoRootPath: repoRoot,
    deploymentName: 'production',
    environment: 'production',
  });

  assert.equal(context.mode, 'root');
  assert.equal(context.appName, 'optimistic-tanuki');
  assert.match(context.argocdAppFile, /k8s\/argo-app\/application\.yaml$/);
  assert.match(context.kustomizeDir, /k8s\/overlays\/production$/);
});
