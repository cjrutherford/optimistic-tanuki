import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeDeploymentInventory } from '../lib/deployment-inventory-normalization.mjs';

test('normalizeDeploymentInventory adds legacy aliases for camelCase app fields', () => {
  const normalized = normalizeDeploymentInventory({
    apps: [
      {
        id: 'admin-api',
        buildAppId: 'admin-api',
        composeServiceName: 'admin-api',
        imageName: 'cjrutherford/optimistic_tanuki_admin-api',
        k8sManifestPath: 'k8s/base/services/admin-api.yaml',
      },
    ],
  });

  assert.deepEqual(normalized.apps[0], {
    id: 'admin-api',
    ID: 'admin-api',
    buildAppId: 'admin-api',
    BuildAppID: 'admin-api',
    composeServiceName: 'admin-api',
    ComposeServiceName: 'admin-api',
    imageName: 'cjrutherford/optimistic_tanuki_admin-api',
    ImageName: 'cjrutherford/optimistic_tanuki_admin-api',
    k8sManifestPath: 'k8s/base/services/admin-api.yaml',
    K8sManifestPath: 'k8s/base/services/admin-api.yaml',
  });
});
