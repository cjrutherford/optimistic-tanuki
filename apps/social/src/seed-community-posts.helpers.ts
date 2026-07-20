export function buildMetroCastChannelPromoPost(input: {
  communityId: string;
  profileId: string;
  channelSlug: string;
  channelName: string;
}) {
  return {
    title: `${input.channelName} is live for Savannah tonight`,
    content:
      '<p>Towne Square neighbors can jump straight into tonight’s local stream for interviews, neighborhood updates, and community replays.</p>',
    profileId: input.profileId,
    communityId: input.communityId,
    crossAppCard: {
      appId: 'video-platform',
      appName: 'MetroCast',
      kind: 'channel-promotion',
      headline: `Watch ${input.channelName} tonight`,
      body: 'Local updates, interviews, and replays from around the community.',
      ctaLabel: 'Watch on MetroCast',
      targetPath: `/c/${input.channelSlug}`,
      channelSlug: input.channelSlug,
    },
  };
}
