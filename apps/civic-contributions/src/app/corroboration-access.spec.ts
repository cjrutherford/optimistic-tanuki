import { corroborationRefusal } from './corroboration-access';

const actor = (roles?: readonly string[]) => ({
  userId: 'u',
  profileId: 'p',
  handle: 'h',
  ...(roles ? { roles } : {}),
});

describe('corroborationRefusal (D20)', () => {
  it('lets a member corroborate', () => {
    expect(
      corroborationRefusal(actor(['local_hub_contributor']), false)
    ).toBeNull();
  });

  it('refuses a verified official', () => {
    expect(
      corroborationRefusal(actor(['local_hub_verified_official']), false)
    ).toMatch(/verified official cannot corroborate/u);
  });

  it('refuses an official who is also a member, whichever order the roles come in', () => {
    for (const roles of [
      ['local_hub_contributor', 'local_hub_verified_official'],
      ['local_hub_verified_official', 'local_hub_contributor'],
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
        actor(['local_hub_contributor', 'some_other_role']),
        false
      )
    ).toBeNull();
  });

  it('refuses when no roles are sent (fail closed)', () => {
    expect(corroborationRefusal(actor(), false)).toMatch(
      /roles were not provided/u
    );
    expect(corroborationRefusal(actor(), true)).toMatch(/verified official/u);
    expect(
      corroborationRefusal(actor(['local_hub_contributor']), true)
    ).toMatch(/verified official/u);
  });
});
