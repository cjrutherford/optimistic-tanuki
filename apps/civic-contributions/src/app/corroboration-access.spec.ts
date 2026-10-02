import { corroborationRefusal } from './corroboration-access';

const actor = (roles?: readonly string[]) => ({
  userId: 'u',
  profileId: 'p',
  handle: 'h',
  ...(roles ? { roles } : {}),
});

describe('corroborationRefusal (D20)', () => {
  it('lets a member corroborate', () => {
    expect(corroborationRefusal(actor(['local_hub_member']), false)).toBeNull();
  });

  it('refuses a verified official', () => {
    expect(
      corroborationRefusal(actor(['local_hub_verified_official']), false)
    ).toMatch(/verified official cannot corroborate/u);
  });

  it('refuses an official who is also a member, whichever order the roles come in', () => {
    for (const roles of [
      ['local_hub_member', 'local_hub_verified_official'],
      ['local_hub_verified_official', 'local_hub_member'],
    ]) {
      expect(corroborationRefusal(actor(roles), false)).toMatch(
        /verified official/u
      );
    }
  });

  it('refuses an admin-only account, which holds no corroboration grant', () => {
    expect(corroborationRefusal(actor(['local_hub_admin']), false)).toMatch(
      /not permitted/u
    );
    expect(corroborationRefusal(actor([]), false)).toMatch(/not permitted/u);
  });

  it('ignores roles it does not know', () => {
    expect(
      corroborationRefusal(
        actor(['local_hub_member', 'some_other_role']),
        false
      )
    ).toBeNull();
  });

  it('knows nothing of roles when none are sent, so only the recorded standing refuses', () => {
    expect(corroborationRefusal(actor(), false)).toBeNull();
    expect(corroborationRefusal(actor(), true)).toMatch(/verified official/u);
    expect(corroborationRefusal(actor(['local_hub_member']), true)).toMatch(
      /verified official/u
    );
  });
});
