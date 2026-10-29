import { randomUUID } from 'node:crypto';
import { SocialAccountDeletionStateService } from './account-deletion-state.service';
describe('Social personal state boundaries', () => {
  const account = randomUUID(),
    profile = randomUUID(),
    other = randomUUID(),
    community = randomUUID(),
    id = randomUUID();
  const service = new SocialAccountDeletionStateService();
  it('uses the account domain for presence and invitees and the profile domain for relationships', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await service.erase({ query } as never, account, [profile]);
    expect(
      query.mock.calls.some(
        ([sql, args]) =>
          sql.includes('FROM "user_presence"') &&
          sql.includes('"userId"::text') &&
          args[0] === account
      )
    ).toBe(true);
    expect(
      query.mock.calls.some(
        ([sql]) =>
          sql.includes('FROM "community_invite"') && sql.includes('"inviteeId"')
      )
    ).toBe(true);
    expect(
      query.mock.calls.some(
        ([sql, args]) =>
          sql.startsWith('UPDATE "user_block"') && args[0][0] === profile
      )
    ).toBe(true);
  });
  it('does not mutate ambiguous membership or stewardship bindings', async () => {
    const query = jest.fn(async (sql: string) =>
      sql.includes('FROM "community_member"')
        ? [{ id, userId: account, profileId: other, communityId: community }]
        : []
    );
    await expect(
      service.erase({ query } as never, account, [profile])
    ).rejects.toThrow('MEMBERSHIP_BINDING_CONFLICT');
    expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true
    );
  });
  it('rejects remaining and malformed stores instead of claiming absence', async () => {
    const query = jest.fn(async (sql: string) =>
      sql.includes('FROM "saved_item"') ? [{ id }] : []
    );
    await expect(
      service.readback({ query } as never, account, [profile])
    ).rejects.toThrow('STATE_REMAINS');
    await expect(
      service.readback(
        { query: jest.fn().mockResolvedValue(null) } as never,
        account,
        [profile]
      )
    ).rejects.toThrow('STATE_BOUND');
  });
});
