import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationService } from './navigation.service';

describe('NavigationService', () => {
  const originalWindow = global.window;

  function createService(registry: object, platformId = 'browser') {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });

    return TestBed.runInInjectionContext(
      () => new NavigationService(registry as any)
    );
  }

  afterEach(() => {
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: originalWindow,
    });
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('generates cross-app URLs through the registry service', () => {
    const service = createService({
      getAppUrl: jest
        .fn()
        .mockReturnValue('https://haicomputer.com/build/new?source=hai'),
    });

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
    const service = createService(registry);

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
    const service = createService({ getAppUrl: jest.fn() });

    expect(service.captureReturnTo()).toBe(
      'https://haidev.com/services?source=configurator'
    );
    expect(service.consumeReturnTo()).toBe(
      'https://haidev.com/services?source=configurator'
    );
    expect(service.consumeReturnTo()).toBeNull();
  });
});
