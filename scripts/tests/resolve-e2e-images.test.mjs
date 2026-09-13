import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LOCALLY_BUILT,
  resolveE2eImages,
  splitImageRef,
} from '../resolve-e2e-images.mjs';

test('splits a tagged reference, and defaults an untagged one', () => {
  assert.deepEqual(
    splitImageRef('cjrutherford/optimistic_tanuki_gateway:main'),
    {
      repository: 'cjrutherford/optimistic_tanuki_gateway',
      tag: 'main',
    }
  );
  assert.deepEqual(splitImageRef('cjrutherford/optimistic_tanuki_gateway'), {
    repository: 'cjrutherford/optimistic_tanuki_gateway',
    tag: 'latest',
  });
});

test('a port in the registry host is not mistaken for a tag', () => {
  assert.deepEqual(splitImageRef('registry.local:5000/team/app'), {
    repository: 'registry.local:5000/team/app',
    tag: 'latest',
  });
  assert.deepEqual(splitImageRef('registry.local:5000/team/app:sha-abc1234'), {
    repository: 'registry.local:5000/team/app',
    tag: 'sha-abc1234',
  });
});

test('every service gets a sha reference and a fallback', () => {
  const plan = resolveE2eImages({
    services: ['authentication', 'gateway'],
    images: new Map([
      [
        'authentication',
        'cjrutherford/optimistic_tanuki_authentication:latest',
      ],
      ['gateway', 'cjrutherford/optimistic_tanuki_gateway:latest'],
    ]),
    shaTag: 'sha-abc1234',
    fallbackTag: 'main',
  });

  assert.deepEqual(plan, [
    {
      service: 'authentication',
      repository: 'cjrutherford/optimistic_tanuki_authentication',
      shaRef: 'cjrutherford/optimistic_tanuki_authentication:sha-abc1234',
      fallbackRef: 'cjrutherford/optimistic_tanuki_authentication:main',
    },
    {
      service: 'gateway',
      repository: 'cjrutherford/optimistic_tanuki_gateway',
      shaRef: 'cjrutherford/optimistic_tanuki_gateway:sha-abc1234',
      fallbackRef: 'cjrutherford/optimistic_tanuki_gateway:main',
    },
  ]);
});

test('services the workflow builds locally are left out', () => {
  const plan = resolveE2eImages({
    services: [...LOCALLY_BUILT, 'gateway'],
    images: new Map([
      ['db', 'postgres:latest'],
      ['redis', 'redis:7'],
      [
        'oauth-provider',
        'cjrutherford/optimistic_tanuki_oauth-provider:latest',
      ],
      ['gateway', 'cjrutherford/optimistic_tanuki_gateway:latest'],
    ]),
    shaTag: 'sha-abc1234',
    fallbackTag: 'main',
  });

  assert.deepEqual(
    plan.map((entry) => entry.service),
    ['gateway']
  );
});

test('a service with no image of its own is skipped', () => {
  // db-setup is the standing example: compose builds it, so it has no image.
  const plan = resolveE2eImages({
    services: ['learning-runner', 'nothing-here'],
    images: new Map([
      [
        'learning-runner',
        'cjrutherford/optimistic_tanuki_learning-runner:latest',
      ],
    ]),
    shaTag: 'sha-abc1234',
    fallbackTag: 'main',
  });

  assert.deepEqual(
    plan.map((entry) => entry.service),
    ['learning-runner']
  );
});

test('services sharing one image are pulled once', () => {
  const plan = resolveE2eImages({
    services: ['permissions', 'permissions-seed'],
    images: new Map([
      ['permissions', 'cjrutherford/optimistic_tanuki_permissions:latest'],
      ['permissions-seed', 'cjrutherford/optimistic_tanuki_permissions:latest'],
    ]),
    shaTag: 'sha-abc1234',
    fallbackTag: 'main',
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0].service, 'permissions');
});
