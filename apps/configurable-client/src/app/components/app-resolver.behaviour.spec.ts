import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import type {
  AppConfiguration,
  ThemeConfig,
} from '@optimistic-tanuki/app-config-models';

import { AppResolverComponent } from './app-resolver.component';
import { ConfigurationService } from '../services/configuration.service';
import { TenantThemeService } from '../services/tenant-theme.service';

// Named interfaces (not index signatures) because
// noPropertyAccessFromIndexSignature is on for this project.
interface ConfigurationServiceStub {
  getConfigurationByName: jest.Mock<Observable<AppConfiguration>, [string]>;
  getConfigurationByDomain: jest.Mock<Observable<AppConfiguration>, [string]>;
  setConfiguration: jest.Mock<void, [AppConfiguration]>;
  getCurrentConfiguration: jest.Mock<AppConfiguration | null, []>;
}

interface TenantThemeServiceStub {
  apply: jest.Mock<Promise<void>, [ThemeConfig | undefined | null]>;
  applyDefaults: jest.Mock<Promise<void>, []>;
}

function makeConfig(
  overrides: Partial<AppConfiguration> = {}
): AppConfiguration {
  return {
    id: 'cfg-1',
    name: 'demo-app',
    landingPage: { layout: 'single-column', sections: [] },
    routes: [],
    features: {},
    theme: { mode: 'dark', personalityId: 'electric' },
    active: true,
    ...overrides,
  };
}

const realLocation = window.location;

/**
 * `window.location` cannot be assigned in jsdom, but the property slot on
 * `window` is configurable, so it can be swapped for a plain snapshot of the
 * real location with a different hostname. Angular's BrowserPlatformLocation
 * captures `window.location` when the Router is first injected, so the swap
 * has to happen before the component (and therefore the Router) is created —
 * hence `hostname` is part of the harness options rather than a mid-test call.
 */
function useHostname(hostname: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...realLocation, hostname },
  });
}

describe('AppResolverComponent', () => {
  let configService: ConfigurationServiceStub;
  let tenantTheme: TenantThemeServiceStub;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  interface HarnessOptions {
    platform?: 'browser' | 'server';
    appNameParam?: string | null;
    queryParams?: Record<string, string>;
    hostname?: string;
  }

  function createComponent(
    options: HarnessOptions = {}
  ): ComponentFixture<AppResolverComponent> {
    const {
      platform = 'browser',
      appNameParam = null,
      queryParams = {},
      hostname = 'localhost',
    } = options;

    useHostname(hostname);

    const routeStub = {
      snapshot: {
        paramMap: convertToParamMap(
          appNameParam === null ? {} : { appName: appNameParam }
        ),
      },
      queryParams: of(queryParams),
    };

    TestBed.configureTestingModule({
      imports: [AppResolverComponent],
      providers: [
        provideRouter([]),
        { provide: ConfigurationService, useValue: configService },
        { provide: TenantThemeService, useValue: tenantTheme },
        { provide: PLATFORM_ID, useValue: platform },
        // Declared after provideRouter() so it wins over the router's own
        // root ActivatedRoute.
        { provide: ActivatedRoute, useValue: routeStub },
      ],
    });

    return TestBed.createComponent(AppResolverComponent);
  }

  /** Lets `apply().finally(...)` (and any chained microtask) settle. */
  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve));
  }

  beforeEach(() => {
    configService = {
      getConfigurationByName: jest.fn(),
      getConfigurationByDomain: jest.fn(),
      setConfiguration: jest.fn(),
      getCurrentConfiguration: jest.fn(),
    };
    tenantTheme = {
      apply: jest.fn().mockResolvedValue(undefined),
      applyDefaults: jest.fn().mockResolvedValue(undefined),
    };
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: realLocation,
    });
    TestBed.resetTestingModule();
  });

  describe('server-side rendering', () => {
    it('skips configuration loading and drops straight out of the loading state', () => {
      const fixture = createComponent({ platform: 'server' });
      fixture.detectChanges();

      const component = fixture.componentInstance;
      expect(component.loading).toBe(false);
      expect(component.error).toBeNull();
      expect(tenantTheme.applyDefaults).not.toHaveBeenCalled();
      expect(configService.getConfigurationByName).not.toHaveBeenCalled();
      expect(configService.getConfigurationByDomain).not.toHaveBeenCalled();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('router-outlet')
      ).toBeTruthy();
    });
  });

  describe('selection priority', () => {
    it('loads by route parameter and applies the tenant theme', async () => {
      const config = makeConfig({ name: 'route-app' });
      configService.getConfigurationByName.mockReturnValue(of(config));

      const fixture = createComponent({ appNameParam: 'route-app' });
      fixture.detectChanges();
      const component = fixture.componentInstance;

      expect(tenantTheme.applyDefaults).toHaveBeenCalledTimes(1);
      expect(configService.getConfigurationByName).toHaveBeenCalledWith(
        'route-app'
      );
      expect(configService.setConfiguration).toHaveBeenCalledWith(config);
      expect(tenantTheme.apply).toHaveBeenCalledWith(config.theme);
      expect(component.loadingMessage).toBe('Loading app: route-app');

      await settle();
      fixture.detectChanges();
      expect(component.loading).toBe(false);
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('router-outlet')
      ).toBeTruthy();
    });

    it('prefers the route parameter over a non-local hostname', () => {
      configService.getConfigurationByName.mockReturnValue(of(makeConfig()));

      const fixture = createComponent({
        appNameParam: 'route-app',
        hostname: 'tenant.example.com',
      });
      fixture.detectChanges();

      expect(configService.getConfigurationByName).toHaveBeenCalledWith(
        'route-app'
      );
      expect(configService.getConfigurationByDomain).not.toHaveBeenCalled();
    });

    it('loads by hostname when there is no route parameter', () => {
      configService.getConfigurationByDomain.mockReturnValue(of(makeConfig()));

      const fixture = createComponent({ hostname: 'tenant.example.com' });
      fixture.detectChanges();

      expect(configService.getConfigurationByDomain).toHaveBeenCalledWith(
        'tenant.example.com'
      );
      expect(configService.getConfigurationByName).not.toHaveBeenCalled();
      expect(fixture.componentInstance.loadingMessage).toBe(
        'Loading configuration for: tenant.example.com'
      );
    });

    // Development hosts must never hit the domain lookup; they fall through
    // to the query-parameter/default branch instead.
    it.each(['localhost', '127.0.0.1', 'acme.local'])(
      'treats %s as local development and falls back to the query parameter',
      (hostname) => {
        configService.getConfigurationByName.mockReturnValue(of(makeConfig()));

        const fixture = createComponent({
          hostname,
          queryParams: { appName: 'query-app' },
        });
        fixture.detectChanges();

        expect(configService.getConfigurationByDomain).not.toHaveBeenCalled();
        expect(configService.getConfigurationByName).toHaveBeenCalledWith(
          'query-app'
        );
        expect(fixture.componentInstance.loadingMessage).toBe(
          'Loading app: query-app'
        );
      }
    );

    it('falls back to demo-app when nothing selects an application', () => {
      configService.getConfigurationByName.mockReturnValue(of(makeConfig()));

      const fixture = createComponent();
      fixture.detectChanges();

      expect(configService.getConfigurationByName).toHaveBeenCalledWith(
        'demo-app'
      );
      expect(fixture.componentInstance.loadingMessage).toBe(
        'Loading default application'
      );
    });
  });

  describe('loading state', () => {
    it('renders the spinner and the loading message until the config arrives', () => {
      // Never emits, so the component is pinned in its loading state.
      configService.getConfigurationByName.mockReturnValue(
        new Subject<AppConfiguration>()
      );

      const fixture = createComponent({ appNameParam: 'slow-app' });
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(fixture.componentInstance.loading).toBe(true);
      expect(element.querySelector('.loading-spinner')).toBeTruthy();
      expect(element.querySelector('.loading-message')?.textContent).toContain(
        'Loading app: slow-app'
      );
      expect(element.querySelector('router-outlet')).toBeNull();
    });
  });

  describe('load-by-name failures', () => {
    it.each<[number, string]>([
      [404, 'Configuration not found.'],
      [500, 'Server error.'],
    ])('reports HTTP %i as "%s"', async (status, expectedHint) => {
      configService.getConfigurationByName.mockReturnValue(
        throwError(() => ({ status }))
      );

      const fixture = createComponent({ appNameParam: 'missing-app' });
      fixture.detectChanges();
      await settle();
      fixture.detectChanges();

      const component = fixture.componentInstance;
      expect(component.error).toBe(
        `Failed to load application configuration for "missing-app". ${expectedHint}`
      );
      expect(component.loading).toBe(false);
      expect(configService.setConfiguration).not.toHaveBeenCalled();
      expect(tenantTheme.apply).not.toHaveBeenCalled();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.error-message')?.textContent).toContain(
        expectedHint
      );
      expect(element.querySelector('router-outlet')).toBeNull();
    });

    it('logs the failing app name alongside the error', () => {
      const failure = { status: 500 };
      configService.getConfigurationByName.mockReturnValue(
        throwError(() => failure)
      );

      const fixture = createComponent({ appNameParam: 'missing-app' });
      fixture.detectChanges();

      expect(errorSpy).toHaveBeenCalledWith(
        '[AppResolver] Failed to load configuration by name:',
        'missing-app',
        failure
      );
    });
  });

  describe('load-by-domain', () => {
    it('stores the configuration and themes the shell on success', async () => {
      const config = makeConfig({
        name: 'tenant',
        theme: { mode: 'light', primaryColor: '#abcdef' },
      });
      configService.getConfigurationByDomain.mockReturnValue(of(config));

      const fixture = createComponent({ hostname: 'tenant.example.com' });
      fixture.detectChanges();

      expect(configService.setConfiguration).toHaveBeenCalledWith(config);
      expect(tenantTheme.apply).toHaveBeenCalledWith(config.theme);

      await settle();
      expect(fixture.componentInstance.loading).toBe(false);
      expect(fixture.componentInstance.error).toBeNull();
    });

    it('falls back to the query parameter when the domain lookup fails', () => {
      configService.getConfigurationByDomain.mockReturnValue(
        throwError(() => ({ status: 404 }))
      );
      configService.getConfigurationByName.mockReturnValue(of(makeConfig()));

      const fixture = createComponent({
        hostname: 'tenant.example.com',
        queryParams: { appName: 'query-app' },
      });
      fixture.detectChanges();

      expect(configService.getConfigurationByName).toHaveBeenCalledWith(
        'query-app'
      );
      expect(fixture.componentInstance.loadingMessage).toBe(
        'Domain not found, loading: query-app'
      );
      expect(fixture.componentInstance.error).toBeNull();
    });

    it('falls back to demo-app when the domain lookup fails with no query parameter', () => {
      configService.getConfigurationByDomain.mockReturnValue(
        throwError(() => ({ status: 404 }))
      );
      configService.getConfigurationByName.mockReturnValue(of(makeConfig()));

      const fixture = createComponent({ hostname: 'tenant.example.com' });
      fixture.detectChanges();

      expect(configService.getConfigurationByName).toHaveBeenCalledWith(
        'demo-app'
      );
      expect(fixture.componentInstance.loadingMessage).toBe(
        'Domain not found, loading default application'
      );
    });

    it('surfaces an error when the domain lookup and its by-name fallback both fail', async () => {
      configService.getConfigurationByDomain.mockReturnValue(
        throwError(() => ({ status: 500 }))
      );
      configService.getConfigurationByName.mockReturnValue(
        throwError(() => ({ status: 404 }))
      );

      const fixture = createComponent({ hostname: 'tenant.example.com' });
      fixture.detectChanges();
      await settle();

      expect(fixture.componentInstance.error).toBe(
        'Failed to load application configuration for "demo-app". Configuration not found.'
      );
      expect(fixture.componentInstance.loading).toBe(false);
    });
  });
});
