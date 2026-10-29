import { randomUUID } from 'node:crypto';
import { ProfileAccountDeletionOwnerService } from './account-deletion-owner.service';
import { DataSource } from 'typeorm';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const account = randomUUID();
const profile = randomUUID();
const operation = randomUUID();
const grant = {
  contractVersion: 1,
  operationId: operation,
  accountId: account,
  appId: 'client-interface',
  owner: 'profile',
  action: 'fence',
  attempt: 1,
  leaseOwner: randomUUID(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  signature: 'a'.repeat(64),
};
describe('Profile deletion owner', () => {
  let calls: Array<{ sql: string; args: unknown[] }>;
  let scans: unknown[][];
  let legacy: Record<string, string[]>;
  let runner: any;
  let authority: any;
  let audit: any;
  let service: ProfileAccountDeletionOwnerService;
  beforeEach(() => {
    calls = [];
    scans = [];
    legacy = { goal: [], project: [], timeline: [] };
    const query = jest.fn(async (sql: string, args: unknown[] = []) => {
      calls.push({ sql, args });
      if (
        sql.includes('SELECT "operationId" FROM account_deletion_write_fence')
      )
        return [{ operationId: operation }];
      if (sql.startsWith('SELECT "id" FROM "profile"'))
        return scans.shift() ?? [{ id: profile }];
      if (sql.startsWith('SELECT "id", "userId", "appScope"'))
        return [{ id: profile, userId: account, appScope: 'client-interface' }];
      const table = sql.match(/^SELECT "id" FROM "(goal|project|timeline)"/);
      if (table) return legacy[table[1]].map((id) => ({ id }));
      if (sql.includes('COUNT(*)') || sql.includes('count(*)'))
        return [{ count: 0 }];
      return [];
    });
    runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      query,
      manager: { query },
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
    };
    authority = {
      validate: jest.fn(async () => ({ accountId: account, scope: null })),
      recordProfileScope: jest.fn(),
    };
    audit = {
      eraseParticipation: jest
        .fn()
        .mockResolvedValue({ allDeclaredSourcesVerified: true }),
    };
    service = new ProfileAccountDeletionOwnerService(
      { createQueryRunner: () => runner } as unknown as DataSource,
      authority,
      audit
    );
  });
  it('discovers, installs one sorted identity fence, rediscoveries, then records scope after commit', async () => {
    await expect(service.execute(grant, 'fence')).resolves.toMatchObject({
      fenced: true,
      profileCount: 1,
    });
    const scanCalls = calls
      .map((c, i) => (c.sql.startsWith('SELECT "id" FROM "profile"') ? i : -1))
      .filter((i) => i >= 0);
    const install = calls.findIndex((c) =>
      c.sql.startsWith('INSERT INTO account_deletion_write_fence')
    );
    expect(scanCalls).toHaveLength(2);
    expect(install).toBeGreaterThan(scanCalls[0]);
    expect(install).toBeLessThan(scanCalls[1]);
    expect(authority.recordProfileScope).toHaveBeenCalledWith(grant, {
      currentProfileIds: [profile],
      legacyProfileIds: [],
    });
    expect(runner.commitTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      authority.recordProfileScope.mock.invocationCallOrder[0]
    );
  });
  it('rolls back a changed discovery set without recording a false scope', async () => {
    scans = [[{ id: profile }], []];
    await expect(service.execute(grant, 'fence')).rejects.toThrow(
      'PROFILE_DISCOVERY_CHANGED'
    );
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(authority.recordProfileScope).not.toHaveBeenCalled();
  });
  it('rejects malformed stored identities', async () => {
    scans = [[{ id: 'not-a-profile' }]];
    await expect(service.execute(grant, 'fence')).rejects.toThrow(
      'PROFILE_ID_INVALID'
    );
  });
  it('rejects scope widening and unsupported independent legacy identity keys', async () => {
    authority.validate.mockResolvedValue({
      accountId: account,
      scope: { currentProfileIds: [], legacyProfileIds: [] },
    });
    await expect(service.execute(grant, 'fence')).rejects.toThrow(
      'SCOPE_MISMATCH'
    );
    authority.validate.mockResolvedValue({
      accountId: account,
      scope: {
        currentProfileIds: [profile],
        legacyProfileIds: ['legacy-unproven'],
      },
    });
    await expect(
      service.execute({ ...grant, action: 'erase' }, 'erase')
    ).rejects.toThrow('LEGACY_PROFILE_CATALOG_UNAVAILABLE');
  });
  it('rejects caller-supplied identity lists and payload fields before any RPC', async () => {
    await expect(
      service.execute(
        { ...grant, profileIds: [profile], bio: 'private' },
        'fence'
      )
    ).rejects.toThrow('GRANT_INVALID');
    expect(authority.validate).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });
  it('detaches legacy reference cycles, retains profile identity, and releases locks before audit redaction', async () => {
    authority.validate.mockResolvedValue({
      accountId: account,
      scope: { currentProfileIds: [profile], legacyProfileIds: [] },
    });
    legacy = {
      goal: [randomUUID()],
      project: [randomUUID()],
      timeline: [randomUUID()],
    };
    await service.execute({ ...grant, action: 'erase' }, 'erase');
    expect(calls.some((c) => c.sql.includes('"timeLineEventsId" = NULL'))).toBe(
      true
    );
    expect(calls.some((c) => c.sql.includes('DELETE FROM "profile"'))).toBe(
      false
    );
    expect(runner.release.mock.invocationCallOrder[0]).toBeLessThan(
      audit.eraseParticipation.mock.invocationCallOrder[0]
    );
  });
  it('does not report completion when audit redaction is unverified', async () => {
    authority.validate.mockResolvedValue({
      accountId: account,
      scope: { currentProfileIds: [profile], legacyProfileIds: [] },
    });
    audit.eraseParticipation.mockResolvedValue({
      allDeclaredSourcesVerified: false,
    });
    await expect(
      service.execute({ ...grant, action: 'erase' }, 'erase')
    ).rejects.toThrow('AUDIT_ERASURE_INCOMPLETE');
  });
});
