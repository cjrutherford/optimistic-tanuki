import type { PublishedFeatureRegistryEntry } from '@optimistic-tanuki/configurable-client-ui';

/**
 * The public runtime registry is intentionally static. Persisted route data
 * selects one of these entries; it can never supply an import path or class.
 *
 * Blogging is loaded only through the dedicated anonymous public data
 * boundary; persisted configuration cannot provide an import path or class.
 */
export const PUBLISHED_FEATURE_REGISTRY: readonly PublishedFeatureRegistryEntry[] =
  [
    {
      capabilityId: 'blogging.posts',
      featureName: 'blogging',
      load: () =>
        import('@optimistic-tanuki/blogging-feature').then(
          (module) => module.PublishedBloggingFeatureComponent
        ),
    },
  ];
