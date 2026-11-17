import { isActiveSocialAuthority } from './social-authority';

const active = { sourceEpoch: '11111111-1111-4111-8111-111111111111', directoryRecoveryEpoch: '22222222-2222-4222-8222-222222222222', activationId: '33333333-3333-4333-8333-333333333333', owner: '44444444-4444-4444-8444-444444444444', socialGeneration: '1', directoryGeneration: '1', phase: 'active', fenced: false };

it('accepts only a complete intentional active identity', () => {
  expect(isActiveSocialAuthority(active)).toBe(true);
  for (const invalid of [ { phase: 'fenced' }, { fenced: true }, { activationId: null }, { owner: null }, { sourceEpoch: null }, { directoryRecoveryEpoch: null }, { socialGeneration: '0' }, { directoryGeneration: null }, { directoryGeneration: '0' } ]) {
    expect(isActiveSocialAuthority({ ...active, ...invalid })).toBe(false);
  }
});
