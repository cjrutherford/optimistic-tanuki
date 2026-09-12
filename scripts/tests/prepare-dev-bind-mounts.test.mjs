import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveNestedBindMountPaths } from '../prepare-dev-bind-mounts.mjs';

const workspaceRoot = '/workspace/optimistic-tanuki';

test('derives host directories Docker would otherwise create inside dist bind mounts', () => {
  const paths = deriveNestedBindMountPaths(
    {
      store: {
        volumes: [
          {
            type: 'bind',
            source: `${workspaceRoot}/dist/apps/store`,
            target: '/usr/src/app',
          },
          { type: 'volume', target: '/usr/src/app/node_modules' },
        ],
      },
      gateway: {
        volumes: [
          {
            type: 'bind',
            source: `${workspaceRoot}/dist/apps`,
            target: '/usr/src/app/dist/apps',
          },
          {
            type: 'bind',
            source: `${workspaceRoot}/apps/gateway/src/assets/config.yaml`,
            target: '/usr/src/app/dist/apps/gateway/assets/config.yaml',
          },
        ],
      },
    },
    workspaceRoot
  );

  assert.deepEqual(paths, [
    `${workspaceRoot}/dist/apps/gateway/assets`,
    `${workspaceRoot}/dist/apps/store/node_modules`,
  ]);
});
