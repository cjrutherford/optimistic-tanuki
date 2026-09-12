import type {
  ConfigurablePluginManifest,
  ConfigurableSurfaceType,
} from '@optimistic-tanuki/app-config-models';

export type ConfigurableFeaturePlacement = 'public' | 'owner' | 'client';

export type ConfigurableCapabilityPlacementSlot =
  | 'public-navigation'
  | 'public-content'
  | 'owner-navigation'
  | 'client-navigation';

export interface ConfigurableCapabilityCatalogEntry {
  id: string;
  product: 'blogging' | 'forum' | 'store' | 'social';
  surfaceTypes: readonly ConfigurableSurfaceType[];
  placementSlots: readonly ConfigurableCapabilityPlacementSlot[];
  eligibility: {
    authenticated: boolean;
    requiredAppScopes?: readonly string[];
  };
  requiredPermissions: readonly string[];
  policySchema: Readonly<Record<string, 'boolean' | 'string' | 'string[]'>>;
  resourceRefType: string;
  deepLinkTemplate: string;
}

/**
 * Metadata only. Product services remain the source of truth for referenced
 * records, authoring flows, and runtime authorization.
 */
export const CONFIGURABLE_CAPABILITY_CATALOG: readonly ConfigurableCapabilityCatalogEntry[] =
  [
    {
      id: 'blogging.posts',
      product: 'blogging',
      surfaceTypes: ['business-site', 'community', 'generic'],
      placementSlots: [
        'public-navigation',
        'public-content',
        'owner-navigation',
      ],
      eligibility: { authenticated: false },
      requiredPermissions: ['blog.post.read'],
      policySchema: {
        catalogId: 'string',
        showAuthor: 'boolean',
        tagIds: 'string[]',
      },
      resourceRefType: 'blog-catalog',
      deepLinkTemplate: '/blog',
    },
    {
      id: 'forum.discussions',
      product: 'forum',
      surfaceTypes: ['community', 'generic'],
      placementSlots: [
        'public-navigation',
        'public-content',
        'owner-navigation',
      ],
      eligibility: { authenticated: false, requiredAppScopes: ['forum'] },
      requiredPermissions: [],
      policySchema: { topicId: 'string', showComposer: 'boolean' },
      resourceRefType: 'forum',
      deepLinkTemplate: '/forum',
    },
    {
      id: 'store.catalog',
      product: 'store',
      surfaceTypes: ['business-site', 'community', 'generic'],
      placementSlots: [
        'public-navigation',
        'public-content',
        'owner-navigation',
      ],
      eligibility: { authenticated: false, requiredAppScopes: ['store'] },
      requiredPermissions: [],
      policySchema: { catalogId: 'string', showPrices: 'boolean' },
      resourceRefType: 'store-catalog',
      deepLinkTemplate: '/catalog',
    },
    {
      id: 'social.community',
      product: 'social',
      surfaceTypes: ['community', 'generic'],
      placementSlots: [
        'public-navigation',
        'owner-navigation',
        'client-navigation',
      ],
      eligibility: { authenticated: true, requiredAppScopes: ['social'] },
      requiredPermissions: ['community.update'],
      policySchema: { showMemberCount: 'boolean' },
      resourceRefType: 'community',
      deepLinkTemplate: '/communities',
    },
    {
      id: 'social.feed',
      product: 'social',
      surfaceTypes: ['community', 'generic'],
      placementSlots: ['public-content', 'client-navigation'],
      eligibility: { authenticated: true, requiredAppScopes: ['social'] },
      requiredPermissions: ['social.post.read'],
      policySchema: { contentFilter: 'string', showComposer: 'boolean' },
      resourceRefType: 'social-feed',
      deepLinkTemplate: '/feed',
    },
  ];

export function getConfigurableCapability(
  capabilityId: string
): ConfigurableCapabilityCatalogEntry | undefined {
  return CONFIGURABLE_CAPABILITY_CATALOG.find(
    (capability) => capability.id === capabilityId
  );
}

/** Returns policy errors without reading product records or product UI. */
export function validateConfigurableCapabilityManifest(
  manifest: ConfigurablePluginManifest
): string[] {
  return Object.entries(manifest.capabilities).flatMap(
    ([capabilityId, configuredCapability]) => {
      const capability = getConfigurableCapability(capabilityId);
      if (!capability) {
        return [`Unknown configurable capability: ${capabilityId}`];
      }

      const errors: string[] = [];
      if (!capability.surfaceTypes.includes(manifest.surfaceType)) {
        errors.push(
          `${capabilityId} is not eligible for ${manifest.surfaceType}`
        );
      }
      if (
        configuredCapability.placement &&
        !capability.placementSlots.includes(
          configuredCapability.placement as ConfigurableCapabilityPlacementSlot
        )
      ) {
        errors.push(
          `${capabilityId} does not allow placement ${configuredCapability.placement}`
        );
      }
      for (const permission of configuredCapability.permissions ?? []) {
        if (!capability.requiredPermissions.includes(permission)) {
          errors.push(
            `${capabilityId} does not allow permission ${permission}`
          );
        }
      }
      for (const setting of Object.keys(configuredCapability.settings ?? {})) {
        if (!(setting in capability.policySchema)) {
          errors.push(`${capabilityId} does not allow setting ${setting}`);
        }
      }
      if (
        configuredCapability.resourceRef &&
        configuredCapability.resourceRef.type !== capability.resourceRefType
      ) {
        errors.push(
          `${capabilityId} requires resource type ${capability.resourceRefType}`
        );
      }
      if (
        configuredCapability.deepLink &&
        configuredCapability.deepLink.path !== capability.deepLinkTemplate
      ) {
        errors.push(
          `${capabilityId} requires deep link ${capability.deepLinkTemplate}`
        );
      }

      return errors;
    }
  );
}

export interface ConfigurableFeatureRoute {
  id: string;
  capabilityId: string;
  placement: ConfigurableFeaturePlacement;
}

export interface ConfigurableFeatureShell {
  id: string;
  surfaceType: ConfigurableSurfaceType;
  routes: readonly ConfigurableFeatureRoute[];
}

export function resolveEnabledFeatureRoutes(
  shell: ConfigurableFeatureShell,
  manifest: ConfigurablePluginManifest
): ConfigurableFeatureRoute[] {
  if (shell.surfaceType !== manifest.surfaceType) {
    return [];
  }

  return shell.routes.filter(
    (route) => manifest.capabilities[route.capabilityId]?.enabled === true
  );
}
