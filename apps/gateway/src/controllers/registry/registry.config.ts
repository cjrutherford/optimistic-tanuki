import * as fs from 'fs';
import { AppRegistry, DEFAULT_APP_REGISTRY } from '@optimistic-tanuki/app-registry';

export function loadConfiguredRegistry(path?: string): AppRegistry {
  if (!path) {
    return DEFAULT_APP_REGISTRY;
  }

  try {
    const registry = JSON.parse(fs.readFileSync(path, 'utf8')) as AppRegistry;
    return registry;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Failed to load app registry from "${path}". Falling back to default app registry. ${message}`
    );
    return DEFAULT_APP_REGISTRY;
  }
}
