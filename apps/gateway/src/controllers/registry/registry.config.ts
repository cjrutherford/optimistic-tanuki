import * as fs from 'fs';
import {
  AppRegistry,
  DEFAULT_APP_REGISTRY,
} from '@optimistic-tanuki/app-registry-backend';

export function loadConfiguredRegistry(path?: string): AppRegistry {
  if (!path) {
    return DEFAULT_APP_REGISTRY;
  }

  try {
    const registry = JSON.parse(fs.readFileSync(path, 'utf8')) as AppRegistry;
    return registry;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const message = `Failed to load app registry from "${path}". ${errorMessage}`;

    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(message);
    }

    console.warn(`${message} Falling back to default app registry.`);
    return DEFAULT_APP_REGISTRY;
  }
}
