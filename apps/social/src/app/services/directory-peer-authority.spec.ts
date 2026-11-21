import { withDirectoryPeerAuthority } from './directory-peer-authority';

const id = {
  sourceEpoch: '11111111-1111-4111-8111-111111111111',
  recoveryEpoch: '22222222-2222-4222-8222-222222222222',
  owner: '33333333-3333-4333-8333-333333333333',
  activationId: '44444444-4444-4444-8444-444444444444',
  socialGeneration: '1',
  directoryGeneration: '1',
};
const peer = {
  ...id,
  authorityEpoch: id.recoveryEpoch,
  phase: 'enabled',
  cursor: null,
  enabledPayload: {
    version: 'directory-enabled-v1',
    preparedDigest: 'a'.repeat(64),
    retirementCount: '0',
    retirementDigest: 'b'.repeat(64),
  },
};
const local = {
  ...id,
  directoryRecoveryEpoch: id.recoveryEpoch,
  phase: 'active',
  fenced: false,
  preparedPayload: {
    accepted: { version: 'directory-enabled-v1', digest: 'c'.repeat(64) },
  },
};
function setup(remote: any = peer, socialRow: any = local) {
  const events: string[] = [];
  const runner = (name: string) => ({
    isReleased: false,
    connect: jest.fn(async () => {
      events.push(`${name}:connect`);
    }),
    startTransaction: jest.fn(async () => {
      events.push(`${name}:begin`);
    }),
    commitTransaction: jest.fn(async () => {
      events.push(`${name}:commit`);
    }),
    rollbackTransaction: jest.fn(async () => {
      events.push(`${name}:rollback`);
    }),
    release: jest.fn(async () => {
      events.push(`${name}:release`);
    }),
    query: jest.fn(async (sql: string) => {
      events.push(`${name}:${sql}`);
      if (sql.includes('FROM directory_census_progress'))
        return remote ? [remote] : [];
      if (sql.includes('FROM community_directory_epoch'))
        return socialRow ? [socialRow] : [];
      return [];
    }),
    manager: null as any,
  });
  const d = runner('d'),
    s = runner('s');
  s.manager = { query: s.query, queryRunner: { isTransactionActive: true } };
  return {
    d,
    s,
    events,
    directory: { createQueryRunner: () => d } as any,
    social: { createQueryRunner: () => s } as any,
  };
}

it('locks Directory before Social and holds it until after Social commit', async () => {
  const t = setup();
  await expect(
    withDirectoryPeerAuthority(t.directory, t.social, async () => 42)
  ).resolves.toBe(42);
  expect(
    t.events.findIndex((e) => e.includes('pg_advisory_xact_lock_shared'))
  ).toBeLessThan(t.events.indexOf('s:begin'));
  expect(t.events.indexOf('s:commit')).toBeLessThan(
    t.events.indexOf('d:commit')
  );
});

it('rejects missing, fenced, malformed and mismatched peer identities without committing', async () => {
  for (const value of [
    null,
    { ...peer, phase: 'blocked' },
    { ...peer, authorityEpoch: id.sourceEpoch },
    { ...peer, enabledPayload: null },
    ...Object.keys(id).map((k) => ({
      ...peer,
      [k]: k.includes('Generation')
        ? '2'
        : '55555555-5555-4555-8555-555555555555',
    })),
  ]) {
    const t = setup(value);
    await expect(
      withDirectoryPeerAuthority(t.directory, t.social, async () => 1)
    ).rejects.toThrow('Directory peer authority unavailable');
    expect(t.s.commitTransaction).not.toHaveBeenCalled();
  }
});

it('rolls back on unavailable Directory and on absent accepted Social attestation', async () => {
  const t = setup();
  t.d.query.mockRejectedValueOnce(new Error('secret connection string'));
  await expect(
    withDirectoryPeerAuthority(t.directory, t.social, async () => 1)
  ).rejects.toThrow('Directory peer authority unavailable');
  expect(t.d.rollbackTransaction).toHaveBeenCalled();
  const u = setup(peer, { ...local, preparedPayload: null });
  await expect(
    withDirectoryPeerAuthority(u.directory, u.social, async () => 1)
  ).rejects.toThrow('Directory peer authority unavailable');
  expect(u.s.rollbackTransaction).toHaveBeenCalled();
});
