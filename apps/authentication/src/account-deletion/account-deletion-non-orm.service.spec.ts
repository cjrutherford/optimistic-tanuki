import {
  AccountDeletionNonOrmService,
  DELETION_NON_ORM_STORES,
} from './account-deletion-non-orm.service';
import { randomUUID } from 'node:crypto';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const grant = {
  owner: 'authentication',
  action: 'readback',
  accountId: randomUUID(),
  operationId: randomUUID(),
} as never;
function fixture() {
  const profile = randomUUID();
  const authority = {
    validateGrant: jest.fn(async () => ({
      scope: { currentProfileIds: [profile], legacyProfileIds: [] },
    })),
    clearNonOrm: jest.fn(async () => {}),
    recordNonOrm: jest.fn(async () => {}),
  };
  return {
    authority,
    adapters: new Map(
      DELETION_NON_ORM_STORES.map((s) => [
        s,
        { purge: jest.fn(async () => {}), readback: jest.fn(async () => 0) },
      ])
    ),
  };
}
it('blocks missing adapters without recording global cleanup', async () => {
  const { authority } = fixture();
  const result = await new AccountDeletionNonOrmService(
    authority as never,
    new Map()
  ).execute(grant);
  expect(result.verified).toBe(false);
  expect(result.results).toHaveLength(8);
  expect(result.results.every((r) => r.code === 'ADAPTER_UNAVAILABLE')).toBe(
    true
  );
  expect(authority.recordNonOrm).not.toHaveBeenCalled();
});
it.each([1, -1, NaN, undefined])(
  'rejects nonzero or malformed readback %s',
  async (count) => {
    const { authority, adapters } = fixture();
    adapters.get('jobs-and-spools')!.readback = jest.fn(
      async () => count as number
    );
    const result = await new AccountDeletionNonOrmService(
      authority as never,
      adapters
    ).execute(grant);
    expect(result.verified).toBe(false);
    expect(authority.recordNonOrm).not.toHaveBeenCalled();
  }
);
it('keeps adapter failure retriable, preserves the frozen subject and only records all verified stores', async () => {
  const { authority, adapters } = fixture();
  const adapter = adapters.get('jobs-and-spools')!;
  adapter.purge.mockRejectedValueOnce(Error('PRIVATE_ERROR'));
  const service = new AccountDeletionNonOrmService(
    authority as never,
    adapters
  );
  expect((await service.execute(grant)).verified).toBe(false);
  expect(authority.recordNonOrm).not.toHaveBeenCalled();
  expect((await service.execute(grant)).verified).toBe(true);
  expect(authority.recordNonOrm).toHaveBeenCalledWith(
    grant,
    DELETION_NON_ORM_STORES
  );
  const subject = (adapter.purge.mock.calls as any)[0][0];
  expect(Object.isFrozen(subject)).toBe(true);
  expect(Object.isFrozen(subject.profileIds)).toBe(true);
});
