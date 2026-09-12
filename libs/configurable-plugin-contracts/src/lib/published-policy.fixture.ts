import {
  getConfigurableCapability,
  type ConfigurableCapabilityPlacementSlot,
} from './configurable-plugin-contracts';

export interface PublishedCapabilityPolicy {
  capabilityId: string;
  enabled: boolean;
  placement: ConfigurableCapabilityPlacementSlot;
  permissions: readonly string[];
  resourceRef: {
    type: string;
    id: string;
  };
}

export interface PublishedPolicyFixture {
  version: 1;
  surfaceType: 'generic';
  capabilities: readonly PublishedCapabilityPolicy[];
  fallback: {
    kind: 'hidden';
    reason: 'unsupported-placement';
  };
}

export type PublishedCapabilityPolicyResolution =
  | ({ kind: 'capability' } & PublishedCapabilityPolicy)
  | {
      kind: 'hidden';
      reason: 'unsupported-placement';
      capabilityId: string;
      requestedPlacement: ConfigurableCapabilityPlacementSlot;
    };

function publishedCapability(
  capabilityId: string,
  placement: ConfigurableCapabilityPlacementSlot,
  resourceId: string
): PublishedCapabilityPolicy {
  const capability = getConfigurableCapability(capabilityId);

  if (!capability) {
    throw new Error(`Unknown configurable capability: ${capabilityId}`);
  }

  if (!capability.surfaceTypes.includes('generic')) {
    throw new Error(`${capabilityId} is not eligible for generic`);
  }

  if (!capability.placementSlots.includes(placement)) {
    throw new Error(`${capabilityId} does not allow placement ${placement}`);
  }

  return {
    capabilityId,
    enabled: true,
    placement,
    permissions: capability.requiredPermissions,
    resourceRef: { type: capability.resourceRefType, id: resourceId },
  };
}

/**
 * Portable, versioned published-policy example. It deliberately uses the
 * generic surface so one fixture exercises every registered product
 * capability before C12.2 wires it into individual product composition.
 */
export const PUBLISHED_POLICY_FIXTURE: PublishedPolicyFixture = {
  version: 1,
  surfaceType: 'generic',
  capabilities: [
    publishedCapability('blogging.posts', 'public-content', 'blog-north-star'),
    publishedCapability(
      'forum.discussions',
      'public-content',
      'forum-north-star'
    ),
    publishedCapability(
      'store.catalog',
      'public-content',
      'catalog-north-star'
    ),
    publishedCapability(
      'social.community',
      'client-navigation',
      'community-north-star'
    ),
    publishedCapability('social.feed', 'client-navigation', 'feed-north-star'),
  ],
  fallback: { kind: 'hidden', reason: 'unsupported-placement' },
};

export function resolvePublishedCapabilityPolicy(
  capabilityId: string,
  requestedPlacement: ConfigurableCapabilityPlacementSlot
): PublishedCapabilityPolicyResolution {
  const capability = getConfigurableCapability(capabilityId);
  const policy = PUBLISHED_POLICY_FIXTURE.capabilities.find(
    (entry) => entry.capabilityId === capabilityId
  );

  if (
    !capability ||
    !policy ||
    !capability.placementSlots.includes(requestedPlacement) ||
    policy.placement !== requestedPlacement
  ) {
    return {
      ...PUBLISHED_POLICY_FIXTURE.fallback,
      capabilityId,
      requestedPlacement,
    };
  }

  return { kind: 'capability', ...policy };
}
