import { lockSocialRuntimeAuthority } from './social-authority';

const sourceEpoch = '11111111-1111-4111-8111-111111111111';
const recoveryEpoch = '22222222-2222-4222-8222-222222222222';
const active = {
  sourceEpoch,
  directoryRecoveryEpoch: recoveryEpoch,
  activationId: '33333333-3333-4333-8333-333333333333',
  owner: '44444444-4444-4444-8444-444444444444',
  socialGeneration: '1',
  directoryGeneration: '1',
  phase: 'active',
  fenced: false,
  preparedPayload: {
    accepted: { version: 'directory-enabled-v1', digest: 'a'.repeat(64) },
  },
};
const expected = { sourceEpoch, recoveryEpoch };

it('holds a shared row lock and requires complete authority, accepted attestation and both expected epochs', async () => {
  const query = jest.fn().mockResolvedValue([active]);
  await expect(
    lockSocialRuntimeAuthority(
      { query, queryRunner: { isTransactionActive: true } } as any,
      expected
    )
  ).resolves.toEqual(active);
  expect(query.mock.calls[0][0]).toContain('FOR SHARE');
  for (const row of [
    undefined,
    { ...active, fenced: true },
    { ...active, phase: 'prepared' },
    { ...active, owner: null },
    { ...active, preparedPayload: null },
    {
      ...active,
      preparedPayload: {
        accepted: { version: 'directory-enabled-v1', digest: 'bad' },
      },
    },
  ]) {
    query.mockResolvedValueOnce(row ? [row] : []);
    await expect(
      lockSocialRuntimeAuthority(
        { query, queryRunner: { isTransactionActive: true } } as any,
        expected
      )
    ).rejects.toThrow();
  }
  for (const pair of [
    undefined,
    { ...expected, sourceEpoch: recoveryEpoch },
    { ...expected, recoveryEpoch: sourceEpoch },
  ]) {
    query.mockResolvedValueOnce([active]);
    await expect(
      lockSocialRuntimeAuthority(
        { query, queryRunner: { isTransactionActive: true } } as any,
        pair
      )
    ).rejects.toThrow();
  }
});
