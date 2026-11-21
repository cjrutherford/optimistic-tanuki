import {
  scanDirectoryRegister,
  readDirectoryRegisterSnapshot,
  readCurrentDirectoryRegister,
} from './community-directory-register-read';

const source = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const token = '33333333-3333-4333-8333-333333333333';
const active = {
  sourceEpoch: source,
  registerBaselineEpoch: source,
  fenced: false,
  phase: 'capture-only',
  directoryRecoveryEpoch: null,
  activationId: id,
  socialGeneration: '1',
  owner: null,
  directoryGeneration: null,
  preparedPayload: null,
};
function manager(row: unknown = active, results: unknown[] = []) {
  return {
    queryRunner: { isTransactionActive: true },
    query: jest
      .fn()
      .mockResolvedValueOnce(row ? [row] : [])
      .mockResolvedValueOnce(results),
  };
}
describe('private register read', () => {
  it('accepts initialized capture authority including the normal activation id', async () => {
    const m = manager(active, [
      { communityId: id, changeToken: token, operation: 'changed' },
    ]);
    await expect(
      scanDirectoryRegister(m as any, source, null, 100)
    ).resolves.toEqual([
      { communityId: id, changeToken: token, operation: 'changed' },
    ]);
  });
  it.each([
    { ...active, fenced: true },
    { ...active, phase: 'active' },
    { ...active, registerBaselineEpoch: id },
    null,
  ])('rejects invalid local authority', async (row) => {
    await expect(
      scanDirectoryRegister(manager(row) as any, source, null, 100)
    ).rejects.toThrow();
  });
  it('distinguishes a superseded token from an ineligible current record', async () => {
    await expect(
      readDirectoryRegisterSnapshot(
        manager(active, []) as any,
        source,
        id,
        token
      )
    ).resolves.toEqual({ status: 'superseded' });
    await expect(
      readDirectoryRegisterSnapshot(
        manager(active, [
          {
            communityId: id,
            changeToken: token,
            operation: 'changed',
            eligible: false,
          },
        ]) as any,
        source,
        id,
        token
      )
    ).resolves.toEqual({ status: 'current', snapshot: null });
  });
  it('returns only eligible town fields without private content', async () => {
    const m = manager(active, [
      {
        communityId: id,
        changeToken: token,
        operation: 'changed',
        eligible: true,
        name: 'Town',
        slug: null,
        adminArea: 'GA',
        localityType: 'town',
      },
    ]);
    await expect(
      readDirectoryRegisterSnapshot(m as any, source, id, token)
    ).resolves.toEqual({
      status: 'current',
      snapshot: {
        id,
        name: 'Town',
        slug: null,
        adminArea: 'GA',
        appScope: 'local-hub',
        isPrivate: false,
        localityType: 'town',
      },
    });
    const sql = m.query.mock.calls[1][0] as string;
    expect(sql).toContain('local-hub');
    expect(sql).toContain('localityType');
    expect(sql).not.toContain('description');
  });
  it('rejects malformed persisted operations instead of treating them as deletion', async () => {
    await expect(
      scanDirectoryRegister(
        manager(active, [
          { communityId: id, changeToken: token, operation: 'unknown' },
        ]) as any,
        source,
        null,
        100
      )
    ).rejects.toThrow('Invalid register');
    await expect(
      readDirectoryRegisterSnapshot(
        manager(active, [
          {
            communityId: id,
            changeToken: token,
            operation: 'unknown',
            eligible: false,
          },
        ]) as any,
        source,
        id,
        token
      )
    ).rejects.toThrow('Invalid register');
  });

  it('binds current-by-id reads to the full Social incarnation and distinguishes absence from corruption', async () => {
    const incarnation = {
      sourceEpoch: source,
      activationId: id,
      socialGeneration: '1',
    };
    await expect(
      readCurrentDirectoryRegister(
        manager(active, [{ communityId: null, exists: false }]) as any,
        incarnation,
        id
      )
    ).resolves.toEqual({ status: 'absent' });
    await expect(
      readCurrentDirectoryRegister(
        manager(active, [{ communityId: null, exists: true }]) as any,
        incarnation,
        id
      )
    ).rejects.toThrow('invariant');
    await expect(
      readCurrentDirectoryRegister(
        manager({ ...active, activationId: token }) as any,
        incarnation,
        id
      )
    ).rejects.toThrow('authority');
    await expect(
      readCurrentDirectoryRegister(
        manager({ ...active, socialGeneration: '2' }) as any,
        incarnation,
        id
      )
    ).rejects.toThrow('authority');
  });
});
