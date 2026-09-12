import { resolvePublishedCapabilityPolicy } from '@optimistic-tanuki/configurable-plugin-contracts';

/** Shared-policy composition for a published Blogging placement. */
export function resolveBloggingPublishedComposition() {
  return resolvePublishedCapabilityPolicy('blogging.posts', 'public-content');
}
