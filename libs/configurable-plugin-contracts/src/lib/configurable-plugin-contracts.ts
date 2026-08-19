import type {
  ConfigurablePluginManifest,
  ConfigurableSurfaceType,
} from '@optimistic-tanuki/app-config-models';

export type ConfigurableFeaturePlacement = 'public' | 'owner' | 'client';

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
