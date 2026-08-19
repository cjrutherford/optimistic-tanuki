export const CONFIGURABLE_MANIFEST_VERSION = 1 as const;

export type ConfigurableSurfaceType = 'business-site' | 'community' | 'generic';

export interface ConfigurableCapabilityManifest {
  enabled: boolean;
  placement?: string;
  permissions?: string[];
  settings?: Record<string, unknown>;
  resourceRef?: {
    type: string;
    id: string;
  };
  deepLink?: {
    path: string;
    label?: string;
  };
}

export interface ConfigurablePluginManifest {
  schemaVersion: typeof CONFIGURABLE_MANIFEST_VERSION;
  surfaceType: ConfigurableSurfaceType;
  capabilities: Record<string, ConfigurableCapabilityManifest>;
}

export function isConfigurablePluginManifest(
  value: unknown
): value is ConfigurablePluginManifest {
  if (
    !isRecord(value) ||
    value['schemaVersion'] !== CONFIGURABLE_MANIFEST_VERSION
  ) {
    return false;
  }

  if (
    value['surfaceType'] !== 'business-site' &&
    value['surfaceType'] !== 'community' &&
    value['surfaceType'] !== 'generic'
  ) {
    return false;
  }

  if (!isRecord(value['capabilities'])) {
    return false;
  }

  return Object.values(value['capabilities']).every(
    isConfigurableCapabilityManifest
  );
}

function isConfigurableCapabilityManifest(value: unknown): boolean {
  if (!isRecord(value) || typeof value['enabled'] !== 'boolean') {
    return false;
  }

  if (
    value['placement'] !== undefined &&
    typeof value['placement'] !== 'string'
  ) {
    return false;
  }

  if (
    value['permissions'] !== undefined &&
    (!Array.isArray(value['permissions']) ||
      !value['permissions'].every(
        (permission) => typeof permission === 'string'
      ))
  ) {
    return false;
  }

  if (value['settings'] !== undefined && !isRecord(value['settings'])) {
    return false;
  }

  if (
    value['resourceRef'] !== undefined &&
    (!isRecord(value['resourceRef']) ||
      typeof value['resourceRef']['type'] !== 'string' ||
      typeof value['resourceRef']['id'] !== 'string')
  ) {
    return false;
  }

  if (
    value['deepLink'] !== undefined &&
    (!isRecord(value['deepLink']) ||
      typeof value['deepLink']['path'] !== 'string' ||
      (value['deepLink']['label'] !== undefined &&
        typeof value['deepLink']['label'] !== 'string'))
  ) {
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
