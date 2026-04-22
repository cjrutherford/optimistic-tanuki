import * as fs from 'fs';
import { AppRegistry } from '../../../../../libs/app-registry/src/lib/app-registry.types';
import { DEFAULT_APP_REGISTRY } from '../../../../../libs/app-registry/src/lib/default-registry';

export function loadConfiguredRegistry(path?: string): AppRegistry {
  if (!path) {
    return DEFAULT_APP_REGISTRY;
  }

  const registry = JSON.parse(fs.readFileSync(path, 'utf8')) as AppRegistry;
  return registry;
}
