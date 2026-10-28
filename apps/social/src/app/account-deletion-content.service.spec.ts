import { randomUUID } from 'node:crypto';
import {
  decodePollBallots,
  stripEventAttendance,
  SocialAccountDeletionContentService,
} from './account-deletion-content.service';
describe('Social deletion identity domains and compound fields', () => {
  const account = randomUUID(),
    profile = randomUUID(),
    other = randomUUID();
  it('decodes comma-containing multiple-choice JSON ballots without splitting the objects', () => {
    const raw =
      JSON.stringify({ userId: account, optionIndices: [0, 2] }) +
      ',' +
      JSON.stringify({ userId: profile, optionIndices: [1] });
    const ballots = decodePollBallots(raw, 3);
    expect(ballots.filter((b) => b.userId !== account)).toEqual([
      { userId: profile, optionIndices: [1] },
    ]);
  });
  it('removes profile attendance without treating the account UUID as a profile', () => {
    expect(
      stripEventAttendance(`${profile},${account},${other}`, [profile])
    ).toEqual([account, other]);
  });
  it('rejects malformed, unknown-shape, over-bound and impossible ballots', () => {
    for (const raw of [
      '{bad',
      JSON.stringify({ userId: account, optionIndices: [99] }),
      JSON.stringify({ userId: account, optionIndices: [0], extra: 'private' }),
      'x'.repeat(65537),
    ])
      expect(() => decodePollBallots(raw, 2)).toThrow();
    expect(() => stripEventAttendance('not-a-profile', [profile])).toThrow(
      'ATTENDANCE_INVALID'
    );
  });
  it('fails on ambiguous account/profile attribution and does not write', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([
        { id: randomUUID(), userId: account, profileId: other },
      ]);
    await expect(
      new SocialAccountDeletionContentService().inspect(
        { query } as never,
        account,
        [profile]
      )
    ).rejects.toThrow('IDENTITY_CONFLICT');
    expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true
    );
  });
  it('rejects a malformed store result rather than calling it empty', async () => {
    await expect(
      new SocialAccountDeletionContentService().readback(
        { query: jest.fn().mockResolvedValue(null) } as never,
        account,
        [profile]
      )
    ).rejects.toThrow('ROW_BOUND');
  });
});
