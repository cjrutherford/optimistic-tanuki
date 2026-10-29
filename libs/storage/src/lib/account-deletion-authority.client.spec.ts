import { of } from 'rxjs';
import { AccountDeletionAuthorityClient } from './account-deletion-authority.client';
import { AccountDeletionGrant } from '@optimistic-tanuki/models';
const grant: AccountDeletionGrant = {
  contractVersion: 1,
  operationId: '123e4567-e89b-42d3-a456-426614174000',
  accountId: '223e4567-e89b-42d3-a456-426614174000',
  appId: 'client-interface',
  owner: 'profile',
  action: 'fence',
  attempt: 1,
  leaseOwner: '323e4567-e89b-42d3-a456-426614174000',
  expiresAt: '2099-01-01T00:00:00.000Z',
  signature: 'a'.repeat(64),
};
describe('deletion owner authority RPC boundary', () => {
  const send = jest.fn();
  const client = new AccountDeletionAuthorityClient({ send } as never);
  beforeEach(() => send.mockReset());
  it('rejects a mismatched capability before any RPC', async () => {
    await expect(client.validate(grant, 'social', 'fence')).rejects.toThrow(
      'OWNER_OR_ACTION_INVALID'
    );
    expect(send).not.toHaveBeenCalled();
  });
  it('permits unfrozen scope only for the Profile fence entry', async () => {
    send.mockReturnValue(
      of({ valid: true, accountId: grant.accountId, scope: null })
    );
    expect(await client.validate(grant, 'profile', 'fence')).toEqual({
      accountId: grant.accountId,
      scope: null,
    });
    await expect(
      client.validate({ ...grant, owner: 'assets' }, 'assets', 'fence')
    ).rejects.toThrow('SCOPE_REQUIRED');
  });
  it.each([
    { valid: true, accountId: 'foreign', scope: null },
    {
      valid: true,
      accountId: grant.accountId,
      scope: null,
      extra: 'untrusted',
    },
    {
      valid: true,
      accountId: grant.accountId,
      scope: { currentProfileIds: ['malformed'], legacyProfileIds: [] },
    },
  ])('rejects malformed or mismatched authority replies', async (reply) => {
    send.mockReturnValue(of(reply));
    await expect(client.validate(grant, 'profile', 'fence')).rejects.toThrow(
      'REPLY_INVALID'
    );
  });
  it('requires the exact operation and attempt acknowledgement when freezing Profile identities', async () => {
    const scope = { currentProfileIds: [], legacyProfileIds: [] };
    send.mockReturnValue(
      of({
        recorded: true,
        operationId: grant.operationId,
        attempt: 2,
        profileCount: 0,
        legacyCount: 0,
      })
    );
    await expect(client.recordProfileScope(grant, scope)).rejects.toThrow(
      'SCOPE_REPLY_INVALID'
    );
    send.mockReturnValue(
      of({
        recorded: true,
        operationId: grant.operationId,
        attempt: 1,
        profileCount: 0,
        legacyCount: 0,
      })
    );
    await expect(
      client.recordProfileScope(grant, scope)
    ).resolves.toBeUndefined();
  });
});
