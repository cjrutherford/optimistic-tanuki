import { randomUUID } from 'node:crypto';
import { PermissionsAccountDeletionOwnerService } from './account-deletion-owner.service';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
describe('Permissions deletion owner', () => {
  const account = randomUUID(),
    profile = randomUUID(),
    operation = randomUUID();
  const grant = {
    contractVersion: 1,
    operationId: operation,
    accountId: account,
    appId: 'local-hub',
    owner: 'permissions',
    action: 'erase',
    attempt: 1,
    leaseOwner: randomUUID(),
    expiresAt: new Date(Date.now() + 30000).toISOString(),
    signature: 'a'.repeat(64),
  };
  let manager: any,
    authority: any,
    service: PermissionsAccountDeletionOwnerService,
    remaining: string;
  beforeEach(() => {
    remaining = '1';
    manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT "operationId"'))
          return [{ operationId: operation }];
        if (sql.startsWith('SELECT id')) return [{ id: randomUUID() }];
        if (sql.startsWith('DELETE FROM')) remaining = '0';
        return sql.includes('count(*)') ? [{ count: remaining }] : [];
      }),
    };
    authority = {
      validate: jest.fn().mockResolvedValue({
        accountId: account,
        scope: { currentProfileIds: [profile], legacyProfileIds: [] },
      }),
    };
    service = new PermissionsAccountDeletionOwnerService(
      { transaction: (fn: any) => fn(manager) } as never,
      authority
    );
  });
  it('deletes only assignment subjects in the frozen profile domain', async () => {
    expect(await service.execute(grant, 'erase')).toEqual({
      verified: true,
      remaining: 0,
    });
    expect(manager.query).toHaveBeenCalledWith(
      'DELETE FROM role_assignment WHERE lower("profileId")=ANY($1::text[])',
      [[profile]]
    );
    const mutations = manager.query.mock.calls.filter(([sql]: [string]) =>
      sql.startsWith('DELETE FROM')
    );
    expect(mutations).toHaveLength(1);
  });
  it('rejects wrong owner and wrong action before database access', async () => {
    await expect(
      service.execute({ ...grant, owner: 'social' }, 'erase')
    ).rejects.toThrow('GRANT_INVALID');
    await expect(service.execute(grant, 'readback')).rejects.toThrow(
      'GRANT_INVALID'
    );
    expect(manager.query).not.toHaveBeenCalled();
  });
  it('does not call an unavailable or malformed count empty', async () => {
    remaining = '';
    await expect(
      service.execute({ ...grant, action: 'readback' }, 'readback')
    ).rejects.toThrow('READBACK_INVALID');
  });
  it('rejects a nonempty readback and an unproven identity scope', async () => {
    await expect(
      service.execute({ ...grant, action: 'readback' }, 'readback')
    ).rejects.toThrow('READBACK_NONEMPTY');
    authority.validate.mockResolvedValue({ accountId: account, scope: null });
    await expect(service.execute(grant, 'erase')).rejects.toThrow(
      'SCOPE_INVALID'
    );
  });
});
