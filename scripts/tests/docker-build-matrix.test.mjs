import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveDockerBuildMatrix } from '../lib/docker-build-matrix.mjs';

test('resolveDockerBuildMatrix returns changed apps as workflow matrix entries', () => {
  const matrix = resolveDockerBuildMatrix({
    buildApps: ['gateway', 'client-interface', 'authentication'],
  });

  assert.deepEqual(matrix, {
    include: [
      { app: 'authentication' },
      { app: 'client-interface' },
      { app: 'gateway' },
    ],
  });
});

test('resolveDockerBuildMatrix returns an empty matrix when nothing changed', () => {
  const matrix = resolveDockerBuildMatrix({ buildApps: [] });

  assert.deepEqual(matrix, { include: [] });
});
