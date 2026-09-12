import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
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
  getConfigurationByName: jest.Mock<
    Observable<AppConfiguration>,
    [string, string?]
  >;
  getConfigurationByDomain: jest.Mock<Observable<AppConfiguration>, [string]>;
  setConfiguration: jest.Mock<void, [AppConfiguration]>;
  setProtectedConfiguration: jest.Mock<void, [AppConfiguration]>;
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

  interface HarnessOptions {
    platform?: 'browser' | 'server';
    appNameParam?: string | null;
    queryParams?: Record<string, string>;
    hostname?: string;
    session?: 'signed-in' | 'signed-out' | 'pending';
  }

  async function createComponent(
    options: HarnessOptions = {}
  ): Promise<ComponentFixture<AppResolverComponent>> {
    const {
      platform = 'browser',
      appNameParam = null,
      queryParams = {},
      hostname = 'localhost',
      session = appNameParam || queryParams['appName']
        ? 'signed-in'
        : 'signed-out',
    } = options;

    useHostname(hostname);

    const routeStub = {
      snapshot: {
        paramMap: convertToParamMap(
          appNameParam === null ? {} : { appName: appNameParam }
        ),
        queryParamMap: convertToParamMap(queryParams),
      },
      queryParams: of(queryParams),
    };

    TestBed.configureTestingModule({
      imports: [AppResolverComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ConfigurationService, useValue: configService },
        { provide: TenantThemeService, useValue: tenantTheme },
        { provide: PLATFORM_ID, useValue: platform },
        // Declared after provideRouter() so it wins over the router's own
        // root ActivatedRoute.
        { provide: ActivatedRoute, useValue: routeStub },
      ],
    });

    const fixture = TestBed.createComponent(AppResolverComponent);
    fixture.detectChanges();

    if (platform === 'browser' && session !== 'pending') {
      const sessionRequest = TestBed.inject(HttpTestingController).match(
        '/api/authentication/session'
      )[0];
      if (sessionRequest) {
        if (session === 'signed-in') {
          sessionRequest.flush({ data: { id: 'test-user' } });
        } else {
          sessionRequest.flush(null, {
            status: 401,
            statusText: 'Unauthorized',
          });
        }
        await settle();
        fixture.detectChanges();
      }
    }

    return fixture;
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
      setProtectedConfiguration: jest.fn(),
      getCurrentConfiguration: jest.fn(),
    };
    tenantTheme = {
      apply: jest.fn().mockResolvedValue(undefined),
      applyDefaults: jest.fn().mockResolvedValue(undefined),
    };
    logSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: realLocation,
    });
    TestBed.resetTestingModule();
  });

  describe('server-side rendering', () => {
    it('skips configuration loading and drops straight out of the loading state', async () => {
      const fixture = await createComponent({ platform: 'server' });
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

      const fixture = await createComponent({ appNameParam: 'route-app' });
      const component = fixture.componentInstance;

      expect(tenantTheme.applyDefaults).toHaveBeenCalledTimes(1);
      expect(configService.getConfigurationByName).toHaveBeenCalledWith(
        'route-app',
        undefined
      );
      expect(configService.setProtectedConfiguration).toHaveBeenCalledWith(
        config
      );
      expect(tenantTheme.apply).toHaveBeenCalledWith(config.theme);
      expect(component.loadingMessage).toBe('Loading app: route-app');

      await settle();
      fixture.detectChanges();
      expect(component.loading).toBe(false);
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('router-outlet')
      ).toBeTruthy();
    });

    it('prefers the route parameter over a non-local hostname', async () => {
      configService.getConfigurationByName.mockReturnValue(of(makeConfig()));

      const fixture = await createComponent({
        appNameParam: 'route-app',
        hostname: 'tenant.example.com',
      });

      expect(configService.getConfigurationByName).toHaveBeenCalledWith(
        'route-app',
        undefined
      );
      expect(configService.getConfigurationByDomain).not.toHaveBeenCalled();
    });

    it('loads by hostname when there is no route parameter', async () => {
      configService.getConfigurationByDomain.mockReturnValue(of(makeConfig()));

      const fixture = await createComponent({ hostname: 'tenant.example.com' });

      expect(configService.getConfigurationByDomain).toHaveBeenCalledWith(
        'tenant.example.com'
      );
      expect(configService.getConfigurationByName).not.toHaveBeenCalled();
      expect(fixture.componentInstance.loadingMessage).toBe(
        'Loading configuration for: tenant.example.com'
      );
    });

    // The explicit local hosts fall through to the query-parameter branch.
    it.each(['localhost', '127.0.0.1'])(
      'treats %s as local development and falls back to the query parameter',
      async (hostname) => {
        configService.getConfigurationByName.mockReturnValue(of(makeConfig()));

        const fixture = await createComponent({
          hostname,
          queryParams: { appName: 'query-app' },
        });

        expect(configService.getConfigurationByDomain).not.toHaveBeenCalled();
        expect(configService.getConfigurationByName).toHaveBeenCalledWith(
          'query-app',
          undefined
        );
        expect(fixture.componentInstance.loadingMessage).toBe(
          'Loading app: query-app'
        );
      }
    );

    it('keeps an unqualified local root on public discovery', async () => {
      configService.getConfigurationByName.mockReturnValue(of(makeConfig()));

      const fixture = await createComponent();

      expect(configService.getConfigurationByName).not.toHaveBeenCalled();
      expect(fixture.componentInstance.publicRoot).toBe(true);
      expect(fixture.componentInstance.outcome).toBe('discovery');
    });
  });

  describe('loading state', () => {
    it('renders the spinner and the loading message until the config arrives', async () => {
      // Never emits, so the component is pinned in its loading state.
      configService.getConfigurationByName.mockReturnValue(
        new Subject<AppConfiguration>()
      );

      const fixture = await createComponent({ appNameParam: 'slow-app' });

      const element = fixture.nativeElement as HTMLElement;
      expect(fixture.componentInstance.loading).toBe(true);
      expect(element.querySelector('otui-landing-status')).toBeTruthy();
      expect(fixture.componentInstance.loadingMessage).toBe(
        'Loading app: slow-app'
      );
      expect(element.querySelector('router-outlet')).toBeNull();
    });
  });

  describe('load-by-name failures', () => {
    it.each<[number, string]>([
      [
        404,
        'Failed to load application configuration for "missing-app". Configuration not found.',
      ],
      [
        500,
        'We couldn\'t load application configuration for "missing-app" right now. Try again.',
      ],
    ])('reports HTTP %i as "%s"', async (status, expectedError) => {
      configService.getConfigurationByName.mockReturnValue(
        throwError(() => ({ status }))
      );

      const fixture = await createComponent({ appNameParam: 'missing-app' });
      await settle();
      fixture.detectChanges();

      const component = fixture.componentInstance;
      expect(component.error).toBe(expectedError);
      expect(component.loading).toBe(false);
      expect(configService.setProtectedConfiguration).not.toHaveBeenCalled();
      expect(tenantTheme.apply).not.toHaveBeenCalled();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('otui-landing-status')).toBeTruthy();
      expect(element.querySelector('router-outlet')).toBeNull();
    });

    it('surfaces the failing app name in the current error contract', async () => {
      const failure = { status: 500 };
      configService.getConfigurationByName.mockReturnValue(
        throwError(() => failure)
      );

      const fixture = await createComponent({ appNameParam: 'missing-app' });

      expect(fixture.componentInstance.error).toContain('missing-app');
    });
  });

  describe('load-by-domain', () => {
    it('stores the configuration and themes the shell on success', async () => {
      const config = makeConfig({
        name: 'tenant',
        theme: { mode: 'light', primaryColor: '#abcdef' },
        publishedVersion: 1,
      } as Partial<AppConfiguration> & { publishedVersion: number });
      configService.getConfigurationByDomain.mockReturnValue(of(config));

      const fixture = await createComponent({ hostname: 'tenant.example.com' });

      expect(configService.setConfiguration).toHaveBeenCalledWith(config);
      expect(tenantTheme.apply).toHaveBeenCalledWith(config.theme);

      await settle();
      expect(fixture.componentInstance.loading).toBe(false);
      expect(fixture.componentInstance.error).toBeNull();
    });

    it('falls back to the protected query app when the domain is not published', async () => {
      configService.getConfigurationByDomain.mockReturnValue(
        throwError(() => ({ status: 404 }))
      );
      configService.getConfigurationByName.mockReturnValue(of(makeConfig()));
      const fixture = await createComponent({
        hostname: 'tenant.example.com',
        queryParams: { appName: 'query-app' },
      });

      expect(configService.getConfigurationByName).toHaveBeenCalledWith(
        'query-app',
        undefined
      );
      expect(configService.setProtectedConfiguration).toHaveBeenCalled();
      expect(fixture.componentInstance.outcome).toBe('resolved');
      expect(fixture.componentInstance.error).toBeNull();
    });

    it('reports a transient failure when the domain service fails', async () => {
      configService.getConfigurationByDomain.mockReturnValue(
        throwError(() => ({ status: 500 }))
      );

      const fixture = await createComponent({ hostname: 'tenant.example.com' });

      expect(configService.getConfigurationByName).not.toHaveBeenCalled();
      expect(fixture.componentInstance.outcome).toBe('transient-failure');
      expect(fixture.componentInstance.error).toContain(
        "couldn't load the published experience"
      );
    });
  });
});
