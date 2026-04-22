import { of, throwError } from 'rxjs';
import { AppRegistryService } from './app-registry.service';
import { DEFAULT_APP_REGISTRY } from './default-registry';

describe('AppRegistryService', () => {
  it('returns bundled apps when the runtime registry is unavailable', (done) => {
    const service = new AppRegistryService({
      get: jest.fn().mockReturnValue(throwError(() => new Error('offline'))),
    } as any);

    service.getAllApps().subscribe((apps) => {
      expect(apps.map((app) => app.appId)).toContain('hai');
      expect(apps.map((app) => app.appId)).toContain('system-configurator');
      done();
    });
  });

  it('uses runtime registry data when the gateway returns it', (done) => {
    const service = new AppRegistryService({
      get: jest.fn().mockReturnValue(
        of({
          success: true,
          data: {
            ...DEFAULT_APP_REGISTRY,
            apps: [
              {
                ...DEFAULT_APP_REGISTRY.apps[0],
                appId: 'runtime-app',
                name: 'Runtime App',
              },
            ],
          },
        })
      ),
    } as any);

    service.getApp('runtime-app').subscribe((app) => {
      expect(app?.name).toBe('Runtime App');
      done();
    });
  });

  it('generates app URLs with path and query params', () => {
    const service = new AppRegistryService({ get: jest.fn() } as any);

    expect(
      service.getAppUrl('system-configurator', '/build/new', {
        source: 'hai',
      })
    ).toBe('https://haicomputer.com/build/new?source=hai');
  });
});
