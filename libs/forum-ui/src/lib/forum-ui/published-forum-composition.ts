import { resolvePublishedCapabilityPolicy } from '@optimistic-tanuki/configurable-plugin-contracts';

/** Shared-policy composition for published Forum discussions. */
export function resolveForumPublishedComposition() {
  return resolvePublishedCapabilityPolicy(
    'forum.discussions',
    'public-content'
  );
}
