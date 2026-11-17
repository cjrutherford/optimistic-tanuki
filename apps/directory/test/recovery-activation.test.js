const { test } = require('node:test');
const assert = require('node:assert/strict');
const { activateRecovery } = require('../src/recovery-activation');
const { isEnabledDirectoryAuthority } = require('../src/activation-authority');
const id = '11111111-1111-4111-8111-111111111111';

test('legacy activation fails before touching either database', async () => {
  const db = new Proxy(
    {},
    {
      get() {
        throw new Error('database touched');
      },
    }
  );
  await assert.rejects(
    activateRecovery(
      db,
      db,
      { sourceEpoch: id, recoveryEpoch: id, owner: id },
      {},
      'secret'
    ),
    /six-field activation protocol is not implemented/
  );
});

test('enabled authority requires every valid identity field and an exhausted cursor', () => {
  const row = {
    phase: 'enabled',
    cursor: null,
    activationId: id,
    owner: id,
    sourceEpoch: id,
    recoveryEpoch: id,
    socialGeneration: '1',
    directoryGeneration: '2',
  };
  assert.equal(isEnabledDirectoryAuthority(row), true);
  for (const field of [
    'activationId',
    'owner',
    'sourceEpoch',
    'recoveryEpoch',
    'socialGeneration',
    'directoryGeneration',
  ]) {
    for (const value of [null, undefined, '', 'invalid'])
      assert.equal(
        isEnabledDirectoryAuthority({ ...row, [field]: value }),
        false,
        field
      );
  }
  for (const value of ['0', '-1', '01', 1])
    assert.equal(
      isEnabledDirectoryAuthority({ ...row, socialGeneration: value }),
      false
    );
  assert.equal(
    isEnabledDirectoryAuthority({ ...row, phase: 'traversed' }),
    false
  );
  assert.equal(isEnabledDirectoryAuthority({ ...row, cursor: id }), false);
});
