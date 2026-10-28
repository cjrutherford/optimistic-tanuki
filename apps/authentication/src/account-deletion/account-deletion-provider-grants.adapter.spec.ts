import { randomUUID } from 'node:crypto';
import { AccountDeletionProviderGrantsAdapter } from './account-deletion-provider-grants.adapter';
import { DeletionNonOrmSubject } from './account-deletion-non-orm.service';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const grant = {
  contractVersion: 1,
  accountId: randomUUID(),
  operationId: randomUUID(),
  appId: 'local-hub',
  owner: 'authentication' as const,
  action: 'readback' as const,
  attempt: 1,
  leaseOwner: randomUUID(),
  expiresAt: new Date(Date.now() + 30000).toISOString(),
  signature: 'a'.repeat(64),
};
const subject: DeletionNonOrmSubject = {
  accountId: grant.accountId,
  operationId: grant.operationId,
  profileIds: [],
  grant: grant as DeletionNonOrmSubject['grant'],
};
const setup = () => {
  const owner = {
    readback: jest.fn(async () => ({
      complete: true,
      counts: { oauth_provider: 0 },
      unresolvedAttribution: [],
    })),
  };
  return {
    owner,
    adapter: new AccountDeletionProviderGrantsAdapter(owner as never),
  };
};
it('invokes real owner boundary on purge and independent readback instead of trusting persisted progress', async () => {
  const { owner, adapter } = setup();
  await adapter.purge(subject);
  expect(await adapter.readback(subject)).toBe(0);
  expect(owner.readback).toHaveBeenCalledTimes(2);
  expect(owner.readback).toHaveBeenNthCalledWith(1, grant);
});
it('refuses missing, mismatched, other-owner and wrong-action grants before invoking the owner', async () => {
  const { owner, adapter } = setup();
  for (const candidate of [
    { ...subject, accountId: randomUUID() },
    { ...subject, operationId: randomUUID() },
    { ...subject, grant: undefined },
    { ...subject, grant: { ...grant, owner: 'social' } },
    { ...subject, grant: { ...grant, action: 'erase' } },
  ])
    await expect(adapter.purge(candidate as never)).rejects.toThrow(
      'DELETION_PROVIDER_GRANT_INVALID'
    );
  expect(owner.readback).not.toHaveBeenCalled();
});
it('fails closed on malformed/nonzero counts, unresolved attribution, and unavailable owner', async () => {
  const { owner, adapter } = setup();
  for (const counts of [
    {},
    { oauth_provider: 1 },
    { oauth_provider: -1 },
    { oauth_provider: '0' },
  ]) {
    owner.readback.mockResolvedValueOnce({
      complete: true,
      counts,
      unresolvedAttribution: [],
    } as never);
    await expect(adapter.purge(subject)).rejects.toThrow();
  }
  owner.readback.mockResolvedValueOnce({
    complete: false,
    counts: { oauth_provider: 0 },
    unresolvedAttribution: [],
  });
  await expect(adapter.purge(subject)).rejects.toThrow(
    'DELETION_PROVIDER_READBACK_INVALID'
  );
  owner.readback.mockRejectedValueOnce(Error('OWNER_UNAVAILABLE'));
  await expect(adapter.purge(subject)).rejects.toThrow('OWNER_UNAVAILABLE');
});
