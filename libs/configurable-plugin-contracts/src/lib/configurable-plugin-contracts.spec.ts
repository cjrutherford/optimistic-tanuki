import type { ConfigurablePluginManifest } from '@optimistic-tanuki/app-config-models';
import {
  CONFIGURABLE_CAPABILITY_CATALOG,
  getConfigurableCapability,
  type ConfigurableFeatureShell,
  resolveEnabledFeatureRoutes,
  validateConfigurableCapabilityManifest,
} from './configurable-plugin-contracts';

describe('configurable feature shells', () => {
  it('registers five product capabilities without importing product UI', () => {
    expect(CONFIGURABLE_CAPABILITY_CATALOG.map((entry) => entry.id)).toEqual([
      'blogging.posts',
      'forum.discussions',
      'store.catalog',
      'social.community',
      'social.feed',
    ]);
    expect(getConfigurableCapability('store.catalog')).toEqual(
      expect.objectContaining({
        product: 'store',
        placementSlots: expect.arrayContaining(['public-content']),
      })
    );
  });

  it('rejects persisted capability policy that is not declared by the catalog', () => {
    const manifest: ConfigurablePluginManifest = {
      schemaVersion: 1,
      surfaceType: 'business-site',
      capabilities: {
        'store.catalog': {
          enabled: true,
          placement: 'client-navigation',
          permissions: ['store.product.read'],
          settings: { unsupported: true },
        },
      },
    };

    expect(validateConfigurableCapabilityManifest(manifest)).toEqual([
      'store.catalog does not allow placement client-navigation',
      'store.catalog does not allow permission store.product.read',
      'store.catalog does not allow setting unsupported',
    ]);
  });

  it('declares catalog resource references for Store and Blogging', () => {
    expect(getConfigurableCapability('store.catalog')).toEqual(
      expect.objectContaining({
        resourceRefType: 'store-catalog',
        policySchema: expect.objectContaining({ catalogId: 'string' }),
      })
    );
    expect(getConfigurableCapability('blogging.posts')).toEqual(
      expect.objectContaining({
        resourceRefType: 'blog-catalog',
        policySchema: expect.objectContaining({ catalogId: 'string' }),
      })
    );
  });

  it('resolves only routes with enabled manifest capabilities', () => {
    const shell: ConfigurableFeatureShell = {
      id: 'business-site-presence',
      surfaceType: 'business-site',
      routes: [
        {
          id: 'landing',
          capabilityId: 'business-site.presence',
          placement: 'public',
        },
        {
          id: 'booking',
          capabilityId: 'business-site.booking',
          placement: 'public',
        },
      ],
    };
    const manifest: ConfigurablePluginManifest = {
      schemaVersion: 1 as const,
      surfaceType: 'business-site',
      capabilities: {
        'business-site.presence': { enabled: true },
        'business-site.booking': { enabled: false },
      },
    };
    expect(resolveEnabledFeatureRoutes(shell, manifest)).toEqual([
      {
        id: 'landing',
        capabilityId: 'business-site.presence',
        placement: 'public',
      },
    ]);
  });

  it('does not resolve a shell against a different manifest surface', () => {
    const shell: ConfigurableFeatureShell = {
      id: 'business-site-presence',
      surfaceType: 'business-site',
      routes: [
        {
          id: 'landing',
          capabilityId: 'business-site.presence',
          placement: 'public',
        },
      ],
    };
    const manifest: ConfigurablePluginManifest = {
      schemaVersion: 1 as const,
      surfaceType: 'community',
      capabilities: {
        'business-site.presence': { enabled: true },
      },
    };

    expect(resolveEnabledFeatureRoutes(shell, manifest)).toEqual([]);
  });
});
