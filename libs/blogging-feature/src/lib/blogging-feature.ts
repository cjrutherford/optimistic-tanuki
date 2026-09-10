import type { ConfigurableFeatureShell } from '@optimistic-tanuki/configurable-plugin-contracts';

export const BLOGGING_POSTS_FEATURE: ConfigurableFeatureShell = {
  id: 'blogging-posts',
  surfaceType: 'business-site',
  routes: [
    {
      id: 'blogging-posts-public',
      capabilityId: 'blogging.posts',
      placement: 'public',
    },
    {
      id: 'blogging-posts-owner',
      capabilityId: 'blogging.posts',
      placement: 'owner',
    },
  ],
};
