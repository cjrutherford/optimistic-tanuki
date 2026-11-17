const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  registerWorkerConfig,
  RegisterWorkerHealth,
} = require('../src/register-runtime');
const identity = {
  sourceEpoch: '00000000-0000-4000-8000-000000000001',
  recoveryEpoch: '00000000-0000-4000-8000-000000000002',
  owner: '00000000-0000-4000-8000-000000000003',
  activationId: '00000000-0000-4000-8000-000000000004',
  socialGeneration: '1',
  directoryGeneration: '2',
};
const env = () => ({
  DIRECTORY_DATABASE_URL: 'postgres://localhost/directory',
  SOCIAL_HOST: '127.0.0.1',
  SOCIAL_PORT: '3003',
  DIRECTORY_REGISTER_READ_SECRET: 'r'.repeat(32),
  DIRECTORY_REGISTER_REPAIR_SECRET: 'p'.repeat(32),
  DIRECTORY_EXTERNAL_FENCE_ASSERTION: 'fenced',
  DIRECTORY_REGISTER_RUNTIME_IDENTITY: JSON.stringify(identity),
});
test('register worker requires explicit fenced mode configuration and complete identity', () => {
  assert.deepEqual(registerWorkerConfig(env()).identity, identity);
  for (const change of [
    (e) => delete e.DIRECTORY_EXTERNAL_FENCE_ASSERTION,
    (e) => (e.DIRECTORY_EXTERNAL_FENCE_ASSERTION = 'yes'),
    (e) =>
      (e.DIRECTORY_REGISTER_REPAIR_SECRET = e.DIRECTORY_REGISTER_READ_SECRET),
    (e) =>
      (e.DIRECTORY_REGISTER_RUNTIME_IDENTITY = JSON.stringify({
        ...identity,
        directoryGeneration: '0',
      })),
    (e) =>
      (e.DIRECTORY_REGISTER_RUNTIME_IDENTITY = JSON.stringify({
        ...identity,
        extra: true,
      })),
  ]) {
    const e = env();
    change(e);
    assert.throws(() => registerWorkerConfig(e));
  }
});
test('readiness waits for bootstrap and a recent complete sweep, and errors clear readiness', () => {
  const health = new RegisterWorkerHealth(1000);
  assert.equal(health.live(), true);
  assert.equal(health.ready(), false);
  health.bootstrapComplete();
  assert.equal(health.ready(), false);
  health.sweepComplete();
  assert.equal(health.ready(), true);
  health.error();
  assert.equal(health.ready(), false);
  health.sweepComplete();
  assert.equal(health.ready(), true);
});
