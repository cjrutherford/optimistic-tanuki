#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..'
);

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function rootContext(repoRootPath, environment) {
  const envName = environment || 'production';
  return {
    mode: 'root',
    deploymentWorkspaceDir: '',
    argocdAppFile: path.join(
      repoRootPath,
      'k8s',
      'argo-app',
      'application.yaml'
    ),
    kustomizeDir: path.join(repoRootPath, 'k8s', 'overlays', envName),
    appName:
      envName === 'staging' ? 'optimistic-tanuki-staging' : 'optimistic-tanuki',
  };
}

export function resolveDeploymentWorkspaceContext({
  repoRootPath = repoRoot,
  deploymentWorkspaceDir = '',
  deploymentName = '',
  environment = '',
} = {}) {
  const requestedDir = deploymentWorkspaceDir
    ? path.resolve(repoRootPath, deploymentWorkspaceDir)
    : deploymentName
    ? path.join(repoRootPath, 'dist', 'admin-env', deploymentName)
    : '';

  if (!requestedDir) {
    return rootContext(repoRootPath, environment);
  }

  const deploymentManifestPath = path.join(requestedDir, 'deployment.yaml');
  const argocdAppFile = path.join(requestedDir, 'argocd', 'application.yaml');
  const kustomizeDir = path.join(requestedDir, 'k8s');

  if (
    !fs.existsSync(deploymentManifestPath) ||
    !fs.existsSync(argocdAppFile) ||
    !fs.existsSync(kustomizeDir)
  ) {
    return rootContext(repoRootPath, environment);
  }

  const workspace = readYaml(deploymentManifestPath) || {};
  const argocdApplication = readYaml(argocdAppFile) || {};

  return {
    mode: 'workspace',
    deploymentWorkspaceDir: requestedDir,
    argocdAppFile,
    kustomizeDir,
    appName:
      argocdApplication?.metadata?.name ||
      workspace?.argocd?.applicationName ||
      workspace?.deploymentName ||
      deploymentName ||
      'optimistic-tanuki',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const context = resolveDeploymentWorkspaceContext({
    deploymentWorkspaceDir: process.env.DEPLOYMENT_WORKSPACE_DIR || '',
    deploymentName: process.env.DEPLOYMENT_NAME || '',
    environment: process.env.ARGO_ENV || process.env.DEPLOY_ENV || '',
  });
  process.stdout.write(`${JSON.stringify(context)}\n`);
}
