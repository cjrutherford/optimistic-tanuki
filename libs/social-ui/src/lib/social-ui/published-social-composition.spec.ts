import { resolveSocialPublishedComposition } from './published-social-composition';

describe('Social published composition', () => {
  it('resolves shared published policy for community and feed entry points', () => {
    expect(resolveSocialPublishedComposition()).toEqual([
      expect.objectContaining({
        kind: 'capability',
        capabilityId: 'social.community',
        placement: 'client-navigation',
      }),
      expect.objectContaining({
        kind: 'capability',
        capabilityId: 'social.feed',
        placement: 'client-navigation',
      }),
    ]);
  });
});
