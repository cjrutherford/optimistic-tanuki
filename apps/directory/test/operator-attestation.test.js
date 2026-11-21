const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const {
  signOperatorAttestation,
  verifyOperatorAttestation,
} = require('../../../libs/social/contracts/src/lib/directory-operator-attestation');
const id = '11111111-1111-4111-8111-111111111111';
const identity = {
  sourceEpoch: id,
  recoveryEpoch: id,
  owner: id,
  activationId: id,
  socialGeneration: '1',
  directoryGeneration: '2',
};
const social = generateKeyPairSync('ed25519');
const directory = generateKeyPairSync('ed25519');
const prerequisite = { version: 'social-traversal-v2', digest: 'a'.repeat(64) };
const config = {
  socialPublicKey: social.publicKey,
  directoryPublicKey: directory.publicKey,
  socialKeyId: 'social-1',
  directoryKeyId: 'directory-1',
};

test('typed attestations bind every identity and prerequisite field to distinct operator keys', () => {
  const prepared = signOperatorAttestation(
    'social-prepared',
    identity,
    prerequisite,
    social.privateKey,
    config
  );
  verifyOperatorAttestation(
    prepared,
    'social-prepared',
    identity,
    prerequisite,
    config
  );
  for (const field of Object.keys(identity)) {
    const changed = {
      ...identity,
      [field]: field.endsWith('Generation')
        ? '3'
        : '22222222-2222-4222-8222-222222222222',
    };
    assert.throws(() =>
      verifyOperatorAttestation(
        prepared,
        'social-prepared',
        changed,
        prerequisite,
        config
      )
    );
  }
  for (const field of [
    'purpose',
    'issuer',
    'audience',
    'keyId',
    'protocolVersion',
    'signature',
  ])
    assert.throws(() =>
      verifyOperatorAttestation(
        { ...prepared, [field]: 'wrong' },
        'social-prepared',
        identity,
        prerequisite,
        config
      )
    );
  assert.throws(() =>
    verifyOperatorAttestation(
      prepared,
      'directory-enabled',
      identity,
      prerequisite,
      config
    )
  );
  assert.throws(() =>
    verifyOperatorAttestation(
      prepared,
      'social-prepared',
      identity,
      { ...prerequisite, digest: 'b'.repeat(64) },
      config
    )
  );
  assert.throws(() =>
    verifyOperatorAttestation(
      { ...prepared, extra: true },
      'social-prepared',
      identity,
      prerequisite,
      config
    )
  );
  assert.throws(() =>
    verifyOperatorAttestation(
      prepared,
      'social-prepared',
      identity,
      prerequisite,
      { ...config, socialPublicKey: generateKeyPairSync('ed25519').publicKey }
    )
  );
  assert.throws(() =>
    verifyOperatorAttestation(
      { ...prepared, signature: '0'.repeat(64) },
      'social-prepared',
      identity,
      prerequisite,
      config
    )
  );
  assert.throws(() =>
    signOperatorAttestation(
      'social-prepared',
      identity,
      prerequisite,
      directory.privateKey,
      config
    )
  );
  assert.throws(() =>
    signOperatorAttestation(
      'social-prepared',
      identity,
      prerequisite,
      social.privateKey,
      { ...config, directoryPublicKey: social.publicKey }
    )
  );
  const enabled = signOperatorAttestation(
    'directory-enabled',
    identity,
    { version: 'social-prepared-v1', digest: 'b'.repeat(64) },
    directory.privateKey,
    config
  );
  verifyOperatorAttestation(
    enabled,
    'directory-enabled',
    identity,
    { version: 'social-prepared-v1', digest: 'b'.repeat(64) },
    config
  );
});
