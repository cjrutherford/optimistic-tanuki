/** Shared-policy composition for published Social entry points. */
export function resolveSocialPublishedComposition() {
  return [
    {
      kind: 'capability' as const,
      capabilityId: 'social.community',
      enabled: true,
      placement: 'client-navigation' as const,
      permissions: ['community.update'],
      resourceRef: { type: 'community', id: 'community-north-star' },
    },
    {
      kind: 'capability' as const,
      capabilityId: 'social.feed',
      enabled: true,
      placement: 'client-navigation' as const,
      permissions: ['social.post.read'],
      resourceRef: { type: 'social-feed', id: 'feed-north-star' },
    },
  ];
}
