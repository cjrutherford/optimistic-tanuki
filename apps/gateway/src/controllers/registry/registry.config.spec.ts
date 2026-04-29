import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DEFAULT_APP_REGISTRY } from '@optimistic-tanuki/app-registry-backend';
import { loadConfiguredRegistry } from './registry.config';

describe('registry config', () => {
  it('loads a configured registry JSON file when a path is provided', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-registry-'));
    const file = path.join(dir, 'registry.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        ...DEFAULT_APP_REGISTRY,
        apps: [
          {
            ...DEFAULT_APP_REGISTRY.apps[0],
            appId: 'configured-hai',
            name: 'Configured HAI',
          },
        ],
      })
    );

    const registry = loadConfiguredRegistry(file);

    expect(registry.apps.map((app) => app.appId)).toEqual(['configured-hai']);
  });

  it('falls back to the generated default registry when no path is provided', () => {
    expect(loadConfiguredRegistry(undefined)).toEqual(DEFAULT_APP_REGISTRY);
  });
});
