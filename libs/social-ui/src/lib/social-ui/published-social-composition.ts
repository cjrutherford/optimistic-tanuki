import { resolvePublishedCapabilityPolicy } from '@optimistic-tanuki/configurable-plugin-contracts';

/** Shared-policy composition for published Social entry points. */
export function resolveSocialPublishedComposition() {
  return [
    resolvePublishedCapabilityPolicy('social.community', 'client-navigation'),
    resolvePublishedCapabilityPolicy('social.feed', 'client-navigation'),
  ];
}
