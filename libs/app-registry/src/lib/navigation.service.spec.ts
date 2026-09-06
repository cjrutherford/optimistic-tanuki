import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NavigationService } from './navigation.service';

describe('NavigationService', () => {
  const originalWindow = global.window;

  function createService(registry: object, platformId = 'browser') {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platformId }],
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

  it('getLinks returns links sourced from the given app, sorted by sortOrder', (done) => {
    const registry = { getAllApps: jest.fn().mockReturnValue(of([])) };
    const service = createService(registry);

    service.getLinks('hai').subscribe((links) => {
      expect(links.map((l) => l.linkId)).toEqual([
        'hai-footer-store',
        'hai-footer-opportunity-compass',
        'hai-to-configurator',
      ]);
      done();
    });
  });

  it('getFilteredLinks maps raw links into generated links, falling back when the target app is unknown', (done) => {
    const registry = {
      getAllApps: jest.fn().mockReturnValue(of([])),
      getAppSync: jest
        .fn()
        .mockImplementation((appId: string) =>
          appId === 'store'
            ? { appId: 'store', name: 'Store', domain: 'store.example.com' }
            : null
        ),
      getAppUrl: jest.fn().mockReturnValue('https://example.com/target'),
    };
    const service = createService(registry);

    service
      .getFilteredLinks({
        currentAppId: 'hai',
        currentPath: '/',
        isAuthenticated: false,
      })
      .subscribe((links) => {
        const storeLink = links.find((l) => l.meta.label === 'Store');
        expect(storeLink?.target).toEqual({
          appId: 'store',
          name: 'Store',
          domain: 'store.example.com',
        });

        const compassLink = links.find(
          (l) => l.meta.label === 'Opportunity Compass'
        );
        expect(compassLink?.target).toMatchObject({
          appId: 'opportunity-compass',
          name: 'Opportunity Compass',
          appType: 'client',
          visibility: 'public',
        });
        expect(compassLink?.url).toBe('https://example.com/target');
        done();
      });
  });

  describe('navigate', () => {
    it('does nothing on the server (non-browser)', () => {
      const registry = { getAppUrl: jest.fn() };
      const service = createService(registry, 'server');
      service.navigate('store');
      expect(registry.getAppUrl).not.toHaveBeenCalled();
    });

    it('opens a new tab when newTab is requested', () => {
      Object.defineProperty(global, 'window', {
        configurable: true,
        value: {
          open: jest.fn(),
          location: { pathname: '/', search: '', origin: 'https://x.com' },
        },
      });
      const registry = {
        getAppUrl: jest.fn().mockReturnValue('https://store.example.com'),
      };
      const service = createService(registry);
      service.navigate('store', '/checkout', { newTab: true });
      expect(window.open).toHaveBeenCalledWith(
        'https://store.example.com',
        '_blank'
      );
    });

    it('navigates in the current tab by default, preserving the query string when requested', () => {
      const locationStub: { href: string; pathname: string; search: string } = {
        href: '',
        pathname: '/checkout',
        search: '?sku=1',
      };
      Object.defineProperty(global, 'window', {
        configurable: true,
        value: { open: jest.fn(), location: locationStub },
      });
      const registry = {
        getAppUrl: jest.fn().mockReturnValue('https://store.example.com/next'),
      };
      const service = createService(registry);

      service.navigate('store', '/next', { preserveQuery: true });

      expect(registry.getAppUrl).toHaveBeenCalledWith('store', '/next', {
        returnTo: '/checkout?sku=1',
      });
      expect(locationStub.href).toBe('https://store.example.com/next');
    });

    it('includes only the pathname as returnTo when includeReturn is requested', () => {
      const locationStub = {
        href: '',
        pathname: '/checkout',
        search: '?sku=1',
      };
      Object.defineProperty(global, 'window', {
        configurable: true,
        value: { open: jest.fn(), location: locationStub },
      });
      const registry = {
        getAppUrl: jest.fn().mockReturnValue('https://store.example.com/next'),
      };
      const service = createService(registry);

      service.navigate('store', '/next', { includeReturn: true });

      expect(registry.getAppUrl).toHaveBeenCalledWith('store', '/next', {
        returnTo: '/checkout',
      });
    });

    it('passes undefined query params when no return option is set', () => {
      const locationStub = { href: '', pathname: '/checkout', search: '' };
      Object.defineProperty(global, 'window', {
        configurable: true,
        value: { open: jest.fn(), location: locationStub },
      });
      const registry = {
        getAppUrl: jest.fn().mockReturnValue('https://store.example.com/next'),
      };
      const service = createService(registry);

      service.navigate('store', '/next');

      expect(registry.getAppUrl).toHaveBeenCalledWith(
        'store',
        '/next',
        undefined
      );
    });
  });

  describe('openNewTab', () => {
    it('does nothing on the server', () => {
      const registry = { getAppUrl: jest.fn() };
      const service = createService(registry, 'server');
      service.openNewTab('store');
      expect(registry.getAppUrl).not.toHaveBeenCalled();
    });

    it('opens the generated URL in a new tab in the browser', () => {
      Object.defineProperty(global, 'window', {
        configurable: true,
        value: { open: jest.fn() },
      });
      const registry = {
        getAppUrl: jest.fn().mockReturnValue('https://store.example.com'),
      };
      const service = createService(registry);
      service.openNewTab('store', '/p', { q: '1' });
      expect(registry.getAppUrl).toHaveBeenCalledWith('store', '/p', {
        q: '1',
      });
      expect(window.open).toHaveBeenCalledWith(
        'https://store.example.com',
        '_blank'
      );
    });
  });

  describe('server-side (non-browser) fallbacks', () => {
    it('getReturnLink uses an empty returnTo and captureReturnTo returns null', () => {
      const registry = { getAppUrl: jest.fn().mockReturnValue('url') };
      const service = createService(registry, 'server');

      service.getReturnLink({
        currentAppId: 'hai',
        currentPath: '/',
        isAuthenticated: false,
      });
      expect(registry.getAppUrl).toHaveBeenCalledWith('hai', '/', {
        returnTo: '',
      });
      expect(service.captureReturnTo()).toBeNull();
    });
  });

  it('captureReturnTo returns null when no returnTo query param is present', () => {
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: { location: { search: '' } },
    });
    const service = createService({ getAppUrl: jest.fn() });
    expect(service.captureReturnTo()).toBeNull();
  });
});
