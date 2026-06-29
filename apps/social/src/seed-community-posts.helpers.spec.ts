import { buildMetroCastChannelPromoPost } from './seed-community-posts.helpers';

describe('buildMetroCastChannelPromoPost', () => {
  it('builds a Towne Square post payload that promotes a MetroCast channel', () => {
    const post = buildMetroCastChannelPromoPost({
      communityId: 'community-1',
      profileId: 'profile-1',
      channelSlug: 'savannah-signal',
      channelName: 'Savannah Signal',
    });

    expect(post.title).toContain('Savannah Signal');
    expect(post.crossAppCard).toEqual(
      expect.objectContaining({
        appId: 'video-platform',
        appName: 'MetroCast',
        ctaLabel: 'Watch on MetroCast',
        targetPath: '/c/savannah-signal',
        channelSlug: 'savannah-signal',
      })
    );
    expect(post.communityId).toBe('community-1');
    expect(post.profileId).toBe('profile-1');
  });
});
