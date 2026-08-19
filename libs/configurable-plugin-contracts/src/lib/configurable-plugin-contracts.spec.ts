import type { ConfigurablePluginManifest } from '@optimistic-tanuki/app-config-models';
import {
  type ConfigurableFeatureShell,
  resolveEnabledFeatureRoutes,
} from './configurable-plugin-contracts';

describe('configurable feature shells', () => {
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
