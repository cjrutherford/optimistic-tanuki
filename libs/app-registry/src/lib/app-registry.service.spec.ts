import { of, throwError } from 'rxjs';
import { DEFAULT_APP_REGISTRY } from '@optimistic-tanuki/app-registry-backend';
import { AppRegistryService } from './app-registry.service';

describe('AppRegistryService', () => {
  const browserPlatformId = 'browser' as any;
  const serverPlatformId = 'server' as any;

  it('uses the generated registry JSON as the build-time fallback', () => {
    expect(DEFAULT_APP_REGISTRY.apps.map((app) => app.appId)).toContain('hai');
    expect(DEFAULT_APP_REGISTRY.apps.map((app) => app.appId)).toContain(
      'system-configurator'
    );
  });

  it('loads the runtime registry on service creation', () => {
    const http = {
      get: jest.fn().mockReturnValue(
        of({
          success: true,
          data: DEFAULT_APP_REGISTRY,
        })
      ),
    };

    new AppRegistryService(
      http as any,
      '/api/registry/apps',
      300000,
      browserPlatformId
    );

    expect(http.get).toHaveBeenCalledWith('/api/registry/apps');
  });

  it('polls the runtime registry on the configured refresh interval', () => {
    jest.useFakeTimers();
    const http = {
      get: jest.fn().mockReturnValue(
        of({
          success: true,
          data: DEFAULT_APP_REGISTRY,
        })
      ),
    };

    const service = new AppRegistryService(
      http as any,
      '/api/registry/apps',
      1000,
      browserPlatformId
    );

    expect(http.get).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);

    expect(http.get).toHaveBeenCalledTimes(2);

    service.ngOnDestroy();
    jest.useRealTimers();
  });

  it('does not poll when the refresh interval is disabled', () => {
    jest.useFakeTimers();
    const http = {
      get: jest.fn().mockReturnValue(
        of({
          success: true,
          data: DEFAULT_APP_REGISTRY,
        })
      ),
    };

    new AppRegistryService(http as any, '/api/registry/apps', 0, browserPlatformId);

    jest.advanceTimersByTime(5000);

    expect(http.get).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('returns bundled apps when the runtime registry is unavailable', (done) => {
    const service = new AppRegistryService({
      get: jest.fn().mockReturnValue(throwError(() => new Error('offline'))),
    } as any, '/api/registry/apps', 300000, browserPlatformId);

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
    } as any, '/api/registry/apps', 300000, browserPlatformId);

    service.getApp('runtime-app').subscribe((app) => {
      expect(app?.name).toBe('Runtime App');
      done();
    });
  });

  it('generates app URLs with path and query params', () => {
    const service = new AppRegistryService(
      { get: jest.fn() } as any,
      '/api/registry/apps',
      300000,
      serverPlatformId
    );

    expect(
      service.getAppUrl('system-configurator', '/build/new', {
        source: 'hai',
      })
    ).toBe('https://haicomputer.com/build/new?source=hai');
  });
});
