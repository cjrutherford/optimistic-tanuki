import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeDeploymentInventory,
  validateComposeImageNames,
  validateDockerWorkflowMatrix,
} from '../lib/deployment-inventory-validation.mjs';

test('validateDockerWorkflowMatrix accepts dynamic matrix workflows that resolve apps from the docker plan', () => {
  const errors = validateDockerWorkflowMatrix(
    'build-push',
    {
      jobs: {
        'determine-changes': {
          steps: [
            {
              name: 'Resolve changed app matrix',
              run: `MATRIX=$(node --input-type=module -e "import fs from 'node:fs'; import { resolveDockerBuildMatrix } from './scripts/lib/docker-build-matrix.mjs'; const plan = JSON.parse(fs.readFileSync('tmp/docker-workflow/services.plan.json', 'utf8')); process.stdout.write(JSON.stringify(resolveDockerBuildMatrix({ buildApps: plan.buildApps || [] })));")`,
            },
          ],
        },
        'build-and-push': {
          strategy: {
            matrix: '${{ fromJson(needs.determine-changes.outputs.matrix) }}',
          },
        },
      },
    },
    'determine-changes',
    'build-and-push',
    ['authentication', 'gateway']
  );

  assert.deepEqual(errors, []);
});

test('validateComposeImageNames allows extra compose-only images while requiring deployable images', () => {
  const errors = validateComposeImageNames(
    ['cjrutherford/optimistic_tanuki_gateway'],
    [
      'cjrutherford/optimistic_tanuki_business-configurator',
      'cjrutherford/optimistic_tanuki_gateway',
    ]
  );

  assert.deepEqual(errors, []);
});

test('normalizeDeploymentInventory adds legacy aliases for camelCase inventory apps', () => {
  const normalized = normalizeDeploymentInventory({
    apps: [
      {
        id: 'gateway',
        buildAppId: 'gateway',
        composeServiceName: 'gateway',
        dockerfile: 'apps/gateway/Dockerfile',
        imageName: 'cjrutherford/optimistic_tanuki_gateway',
        k8sManifestPath: 'k8s/base/gateway.yaml',
      },
    ],
  });

  assert.deepEqual(normalized.apps[0], {
    id: 'gateway',
    buildAppId: 'gateway',
    composeServiceName: 'gateway',
    dockerfile: 'apps/gateway/Dockerfile',
    imageName: 'cjrutherford/optimistic_tanuki_gateway',
    k8sManifestPath: 'k8s/base/gateway.yaml',
    ID: 'gateway',
    BuildAppID: 'gateway',
    ComposeServiceName: 'gateway',
    Dockerfile: 'apps/gateway/Dockerfile',
    ImageName: 'cjrutherford/optimistic_tanuki_gateway',
    K8sManifestPath: 'k8s/base/gateway.yaml',
  });
});
