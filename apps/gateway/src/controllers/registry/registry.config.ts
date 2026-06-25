import * as fs from 'fs';
import * as path from 'path';
import {
  AppRegistry,
  DEFAULT_APP_REGISTRY,
} from '@optimistic-tanuki/app-registry-backend';

const BOOTSTRAP_APP_REGISTRY: AppRegistry = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  apps: [
    {
      appId: 'client-interface',
      name: 'Optimistic Tanuki',
      domain: 'localhost',
      uiBaseUrl: 'http://localhost:8080',
      apiBaseUrl: 'http://localhost:3300',
      appType: 'client',
      visibility: 'public',
      description: 'Social media, identity, messaging, and utility workflows.',
      iconUrl: 'http://localhost:8080/assets/tanuki.svg',
      sortOrder: 10,
    },
  ],
};

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

    console.warn(`${message} Falling back to bootstrap app registry.`);
    return BOOTSTRAP_APP_REGISTRY;
  }
}
