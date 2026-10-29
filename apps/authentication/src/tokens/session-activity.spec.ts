import { assertRollingSession } from './session-activity';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tokenId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const profileId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const payload = { userId: accountId, profileId, iat: 1700000000 };
describe('rolling session activity boundary', () => {
  it('uses a read-only authoritative check for internal validation', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([{ expiresAt: new Date('2026-11-03T00:00:00Z') }]);
    expect(await assertRollingSession({ query }, tokenId, payload, false)).toBe(
      '2026-11-03T00:00:00.000Z'
    );
    expect(query.mock.calls[0][0]).not.toContain('UPDATE');
    expect(query.mock.calls[0][0]).toContain('clock_timestamp()');
    expect(query.mock.calls[0][0]).toContain('account_deletion_write_fence');
  });
  it('touches only an unrevoked, still-current, exact account/profile binding', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([
        [{ expiresAt: new Date('2026-11-03T00:00:00Z') }],
        1,
      ]);
    await assertRollingSession({ query }, tokenId, payload, true);
    expect(query.mock.calls[0][0]).toContain('UPDATE');
    expect(query.mock.calls[0][0]).toContain('IS NOT DISTINCT FROM');
    expect(query.mock.calls[0][1].slice(0, 4)).toEqual([
      tokenId,
      accountId,
      payload.iat,
      profileId,
    ]);
  });
  it('fails closed for expired, revoked, fenced, mismatched and malformed results', async () => {
    for (const rows of [
      [],
      [{ expiresAt: 'bad' }],
      null,
      [{ expiresAt: new Date('invalid') }],
      [{ expiresAt: new Date() }, { expiresAt: new Date() }],
    ])
      await expect(
        assertRollingSession(
          { query: jest.fn().mockResolvedValue(rows) },
          tokenId,
          payload,
          true
        )
      ).rejects.toThrow();
  });
  it('does not bootstrap a session from missing or malformed signed issuance', async () => {
    for (const iat of [undefined, 0, -1, NaN, 1.5, '1700000000']) {
      const query = jest.fn();
      await expect(
        assertRollingSession({ query }, tokenId, { ...payload, iat }, true)
      ).rejects.toThrow();
      expect(query).not.toHaveBeenCalled();
    }
  });
});
