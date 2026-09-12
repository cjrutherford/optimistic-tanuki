import {
  PUBLISHED_POLICY_FIXTURE,
  resolvePublishedCapabilityPolicy,
} from './published-policy.fixture';
import { CONFIGURABLE_CAPABILITY_CATALOG } from './configurable-plugin-contracts';

describe('published policy fixture', () => {
  it('publishes every registered capability with its placement, permissions, and resource reference', () => {
    expect(PUBLISHED_POLICY_FIXTURE.version).toBe(1);
    expect(PUBLISHED_POLICY_FIXTURE.surfaceType).toBe('generic');
    expect(
      PUBLISHED_POLICY_FIXTURE.capabilities.map(
        (capability) => capability.capabilityId
      )
    ).toEqual(
      CONFIGURABLE_CAPABILITY_CATALOG.map((capability) => capability.id)
    );

    for (const capability of PUBLISHED_POLICY_FIXTURE.capabilities) {
      const catalogEntry = CONFIGURABLE_CAPABILITY_CATALOG.find(
        (entry) => entry.id === capability.capabilityId
      );

      expect(catalogEntry).toBeDefined();
      expect(catalogEntry?.placementSlots).toContain(capability.placement);
      expect(capability.enabled).toBe(true);
      expect(capability.permissions).toEqual(catalogEntry?.requiredPermissions);
      expect(capability.resourceRef.type).toBe(catalogEntry?.resourceRefType);
    }
  });

  it('returns the declared hidden fallback for an unsupported placement', () => {
    expect(
      resolvePublishedCapabilityPolicy('social.feed', 'public-navigation')
    ).toEqual({
      kind: 'hidden',
      reason: 'unsupported-placement',
      capabilityId: 'social.feed',
      requestedPlacement: 'public-navigation',
    });
  });

  it('resolves the published capability when its requested placement is allowed', () => {
    expect(
      resolvePublishedCapabilityPolicy('store.catalog', 'public-content')
    ).toEqual(
      expect.objectContaining({
        kind: 'capability',
        capabilityId: 'store.catalog',
        placement: 'public-content',
        enabled: true,
        resourceRef: { type: 'store-catalog', id: 'catalog-north-star' },
      })
    );
  });
});
