#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.yaml}"
K8S_BASE_DIR="${K8S_BASE_DIR:-$PROJECT_DIR/k8s/base}"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Error: docker-compose file not found: $COMPOSE_FILE"
  exit 1
fi

if [ ! -d "$K8S_BASE_DIR" ]; then
  echo "Error: k8s base directory not found: $K8S_BASE_DIR"
  exit 1
fi

node - "$COMPOSE_FILE" "$K8S_BASE_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');

const composeFile = process.argv[2];
const k8sBaseDir = process.argv[3];

const skipServices = new Set(['postgres', 'redis', 'db-setup', 'app-configurator-seed']);
const serviceNameMap = {
  'ot-client-interface': 'client-interface',
  'forgeofwill-client-interface': 'forgeofwill',
  'digital-homestead-client-interface': 'digital-homestead',
  'crdn-client-interface': 'christopherrutherford-net'
};
const clientServices = new Set([
  'client-interface',
  'forgeofwill',
  'digital-homestead',
  'christopherrutherford-net',
  'owner-console',
  'store-client',
  'configurable-client',
  'system-configurator',
  'd6'
]);

const composeContent = fs.readFileSync(composeFile, 'utf8').split(/\r?\n/);
let inServices = false;
let currentService = null;
const parsed = new Map();

for (const line of composeContent) {
  if (!inServices) {
    if (/^services:\s*$/.test(line)) {
      inServices = true;
    }
    continue;
  }

  if (/^\S/.test(line) && !/^services:\s*$/.test(line)) {
    inServices = false;
    currentService = null;
    continue;
  }

  const serviceMatch = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
  if (serviceMatch) {
    currentService = serviceMatch[1];
    if (!parsed.has(currentService)) {
      parsed.set(currentService, { containerPort: null });
    }
    continue;
  }

  if (!currentService) {
    continue;
  }

  if (parsed.get(currentService).containerPort !== null) {
    continue;
  }

  const portMatch = line.match(/^\s*-\s*['"]?(\d+):(\d+)['"]?\s*$/);
  if (portMatch) {
    parsed.get(currentService).containerPort = Number(portMatch[2]);
  }
}

const expected = [];
for (const [composeService, info] of parsed.entries()) {
  if (skipServices.has(composeService)) {
    continue;
  }
  if (info.containerPort === null) {
    continue;
  }

  const k8sName = serviceNameMap[composeService] || composeService;
  const manifestCandidates = [
    path.join(k8sBaseDir, 'services', `${k8sName}.yaml`),
    path.join(k8sBaseDir, 'clients', `${k8sName}.yaml`),
    path.join(k8sBaseDir, `${k8sName}.yaml`)
  ];
  const manifestPath = manifestCandidates.find((candidate) => fs.existsSync(candidate))
    || (clientServices.has(k8sName)
      ? path.join(k8sBaseDir, 'clients', `${k8sName}.yaml`)
      : path.join(k8sBaseDir, 'services', `${k8sName}.yaml`));

  expected.push({
    composeService,
    k8sName,
    containerPort: info.containerPort,
    manifestPath
  });
}

const errors = [];
for (const item of expected) {
  if (!fs.existsSync(item.manifestPath)) {
    errors.push(`Missing manifest for ${item.composeService} -> expected ${item.manifestPath}`);
    continue;
  }

  const manifest = fs.readFileSync(item.manifestPath, 'utf8');
  const deploymentNameMatch = manifest.match(/kind:\s*Deployment[\s\S]*?metadata:\s*\n\s*name:\s*([A-Za-z0-9-]+)/);
  const containerPortMatch = manifest.match(/containerPort:\s*(\d+)/);

  const deploymentName = deploymentNameMatch ? deploymentNameMatch[1] : null;
  const containerPort = containerPortMatch ? Number(containerPortMatch[1]) : null;

  if (!deploymentName) {
    errors.push(`No Deployment metadata.name found in ${item.manifestPath}`);
  } else if (deploymentName !== item.k8sName) {
    errors.push(`Deployment name mismatch in ${item.manifestPath}: expected ${item.k8sName}, found ${deploymentName}`);
  }

  if (containerPort === null) {
    errors.push(`No containerPort found in ${item.manifestPath}`);
  } else if (containerPort !== item.containerPort) {
    errors.push(`Port mismatch for ${item.composeService}: compose container port ${item.containerPort}, k8s manifest port ${containerPort} (${item.manifestPath})`);
  }
}

if (errors.length > 0) {
  console.error('Compose ↔ K8s parity validation failed:');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log(`Compose ↔ K8s parity validation passed for ${expected.length} services.`);
NODE

echo "Validating kustomization paths..."
if grep -q -- "- ../base" "$PROJECT_DIR/k8s/overlays/production/kustomization.yaml" || grep -q -- "- ../base" "$PROJECT_DIR/k8s/overlays/staging/kustomization.yaml"; then
  echo "Error: overlay kustomization uses '../base' but should point to '../../base'."
  exit 1
fi

echo "Parity validation completed successfully."
