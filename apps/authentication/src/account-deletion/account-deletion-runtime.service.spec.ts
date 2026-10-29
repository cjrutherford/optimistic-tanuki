import { randomUUID } from 'node:crypto';
import { AccountDeletionRuntimeService } from './account-deletion-runtime.service';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
function fixture() {
  const members = Array.from({ length: 5 }, () => ({
    purgeAccount: jest.fn(async () => undefined),
    readbackAccount: jest.fn(async () => 0),
  }));
  const store = {
    purgeAccountRuntime: members[2].purgeAccount,
    readbackAccountRuntime: members[2].readbackAccount,
  };
  return {
    members,
    service: new AccountDeletionRuntimeService(
      members[0] as never,
      members[1] as never,
      store as never,
      members[3] as never,
      members[4] as never,
      { query: async () => [] } as never
    ),
  };
}
it('drains every transient custody family and independently reads each one back', async () => {
  const f = fixture();
  const accountId = randomUUID();
  await f.service.fence(accountId);
  for (const member of f.members) {
    expect(member.purgeAccount).toHaveBeenCalledWith(accountId);
    expect(member.readbackAccount).toHaveBeenCalledWith(accountId);
  }
  expect(await f.service.readback(accountId)).toMatchObject({
    owner: 'authentication',
    remaining: 0,
  });
});
it('attempts every cleanup when one fails and retries without accepting surviving handles', async () => {
  const f = fixture();
  const accountId = randomUUID();
  f.members[1].purgeAccount.mockRejectedValueOnce(Error('CLOSE_FAILED'));
  await expect(f.service.fence(accountId)).rejects.toThrow(
    'AUTH_DELETION_RUNTIME_UNVERIFIED'
  );
  expect(f.members.every((v) => v.purgeAccount.mock.calls.length === 1)).toBe(
    true
  );
  f.members[2].readbackAccount.mockResolvedValueOnce(1);
  await expect(f.service.fence(accountId)).rejects.toThrow(
    'AUTH_DELETION_RUNTIME_UNVERIFIED'
  );
  await expect(f.service.fence(accountId)).resolves.toBeUndefined();
});
it('does not turn an unavailable readback into a zero count', async () => {
  const f = fixture();
  f.members[4].readbackAccount.mockRejectedValueOnce(Error('UNAVAILABLE'));
  await expect(f.service.readback(randomUUID())).rejects.toThrow('UNAVAILABLE');
});
