import * as reads from './community-directory-register-read';

const source = '11111111-1111-4111-8111-111111111111',
  activation = '22222222-2222-4222-8222-222222222222',
  id = '33333333-3333-4333-8333-333333333333',
  token = '44444444-4444-4444-8444-444444444444';
const identity = {
  sourceEpoch: source,
  activationId: activation,
  socialGeneration: '1',
};
const active = {
  sourceEpoch: source,
  registerBaselineEpoch: source,
  fenced: false,
  phase: 'capture-only',
  directoryRecoveryEpoch: null,
  activationId: activation,
  socialGeneration: '1',
  owner: null,
  directoryGeneration: null,
  preparedPayload: null,
};
const reader = (reads as any).readCurrentDirectoryGeography;
function manager(row: unknown) {
  return {
    queryRunner: { isTransactionActive: true },
    query: jest
      .fn()
      .mockResolvedValueOnce([active])
      .mockResolvedValueOnce([row]),
  };
}

test('returns minimal current geography and an incarnation-bound token only for eligible communities', async () => {
  expect(typeof reader).toBe('function');
  const current = {
    communityId: id,
    changeToken: token,
    operation: 'changed',
    dirty: true,
    exists: true,
    eligible: true,
    name: 'Local Community',
    city: 'Town',
    adminArea: 'GA',
    countryCode: 'US',
    localityType: 'town',
    lat: '31.500000',
    lng: '-82.500000',
    description: 'private detail',
  };
  const m = manager(current);
  expect(await reader(m, identity, id)).toEqual({
    status: 'current',
    changeToken: token,
    geography: {
      communityId: id,
      name: 'Local Community',
      city: 'Town',
      adminArea: 'GA',
      countryCode: 'US',
      localityType: 'town',
      referencePoint: [-82.5, 31.5],
    },
  });
  expect(m.query.mock.calls[1][0]).not.toContain('description');
  expect(
    await reader(manager({ ...current, eligible: false }), identity, id)
  ).toEqual({ status: 'current', changeToken: token, geography: null });
  expect(
    await reader(manager({ ...current, lat: null }), identity, id)
  ).toMatchObject({ status: 'current', geography: { referencePoint: null } });
});

test('fails closed for fenced authority and malformed register state', async () => {
  expect(typeof reader).toBe('function');
  const fenced = { ...active, fenced: true };
  const m = {
    queryRunner: { isTransactionActive: true },
    query: jest.fn().mockResolvedValueOnce([fenced]),
  };
  await expect(reader(m, identity, id)).rejects.toThrow('authority');
  await expect(
    reader(manager({ communityId: null, exists: true }), identity, id)
  ).rejects.toThrow('invariant');
  await expect(
    reader(
      manager({
        communityId: id,
        changeToken: token,
        operation: 'changed',
        dirty: false,
        exists: true,
      }),
      identity,
      id
    )
  ).rejects.toThrow('invariant');
  expect(
    await reader(manager({ communityId: null, exists: false }), identity, id)
  ).toEqual({ status: 'absent' });
});

test('invalid reference coordinates become unavailable rather than guessed', async () => {
  const row = {
    communityId: id,
    changeToken: token,
    operation: 'changed',
    dirty: true,
    exists: true,
    eligible: true,
    city: 'Town',
    adminArea: 'GA',
    countryCode: 'US',
    localityType: 'town',
  };
  for (const coordinates of [
    { lat: 91, lng: 0 },
    { lat: ' ', lng: '0' },
    { lat: '1', lng: 181 },
    { lat: null, lng: 0 },
  ]) {
    expect(
      await reader(manager({ ...row, ...coordinates }), identity, id)
    ).toMatchObject({ status: 'current', geography: { referencePoint: null } });
  }
});
