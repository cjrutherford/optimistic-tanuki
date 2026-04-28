import { NavigationService } from './navigation.service';

describe('NavigationService', () => {
  const originalWindow = global.window;

  afterEach(() => {
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: originalWindow,
    });
    sessionStorage.clear();
  });

  it('generates cross-app URLs through the registry service', () => {
    const service = new NavigationService({
      getAppUrl: jest
        .fn()
        .mockReturnValue('https://haicomputer.com/build/new?source=hai'),
    } as any);

    expect(
      service.generateUrl('system-configurator', '/build/new', {
        source: 'hai',
      })
    ).toBe('https://haicomputer.com/build/new?source=hai');
  });

  it('creates a return link from the current full browser URL', () => {
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: {
        location: {
          origin: 'https://haicomputer.com',
          pathname: '/build/new',
          search: '?sku=hai-mini',
          hash: '#review',
        },
      },
    });
    const registry = {
      getAppUrl: jest.fn().mockReturnValue('https://haidev.com?returnTo=value'),
    };
    const service = new NavigationService(registry as any);

    const link = service.getReturnLink({
      currentAppId: 'hai',
      currentPath: '/',
      isAuthenticated: false,
    });

    expect(link).toBe('https://haidev.com?returnTo=value');
    expect(registry.getAppUrl).toHaveBeenCalledWith('hai', '/', {
      returnTo: 'https://haicomputer.com/build/new?sku=hai-mini#review',
    });
  });

  it('stores incoming returnTo query params and consumes them once', () => {
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: {
        location: {
          origin: 'https://haicomputer.com',
          pathname: '/checkout',
          search:
            '?returnTo=https%3A%2F%2Fhaidev.com%2Fservices%3Fsource%3Dconfigurator',
          hash: '',
        },
      },
    });
    const service = new NavigationService({ getAppUrl: jest.fn() } as any);

    expect(service.captureReturnTo()).toBe(
      'https://haidev.com/services?source=configurator'
    );
    expect(service.consumeReturnTo()).toBe(
      'https://haidev.com/services?source=configurator'
    );
    expect(service.consumeReturnTo()).toBeNull();
  });
});
