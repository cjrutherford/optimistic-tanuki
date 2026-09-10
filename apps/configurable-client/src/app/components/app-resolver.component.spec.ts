import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AppResolverComponent } from './app-resolver.component';

function routeFor(options: {
  appName?: string | null;
  configId?: string | null;
  appNameQuery?: string | null;
  workspaceSlug?: string | null;
}): ActivatedRoute {
  return {
    snapshot: {
      paramMap: {
        get: (key: string) =>
          key === 'appName'
            ? options.appName ?? null
            : options.configId ?? null,
      },
      queryParamMap: {
        get: (key: string) =>
          key === 'appName'
            ? options.appNameQuery ?? null
            : options.workspaceSlug ?? null,
      },
    },
    queryParams: of({}),
  } as unknown as ActivatedRoute;
}

function themeService() {
  return {
    applyDefaults: jest.fn().mockResolvedValue(undefined),
    apply: jest.fn().mockResolvedValue(undefined),
  };
}

function validConfiguration(overrides: Record<string, unknown> = {}) {
  return {
    id: 'config-1',
    name: 'demo-app',
    active: true,
    landingPage: { layout: 'single-column', sections: [] },
    routes: [],
    features: {},
    theme: {},
    ...overrides,
  };
}

describe('AppResolverComponent auth/public boundary', () => {
  it('uses the published resolver for a direct client-app route', async () => {
    const config = {
      getPublishedConfiguration: jest.fn().mockReturnValue(
        of({
          ...validConfiguration(),
          publishedVersion: 1,
        })
      ),
      setConfiguration: jest.fn(),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({ configId: 'published-app' }),
      'browser',
      {
        status: 'signed-out',
        sessionState$: of({ status: 'signed-out' }),
        restoreSession: jest.fn(),
      } as any,
      { url: '/config/published-app', navigate: jest.fn() } as unknown as Router
    );

    jest.spyOn(component as any, 'getHostname').mockReturnValue('127.0.0.1');
    component.ngOnInit();
    await Promise.resolve();

    expect(config.getPublishedConfiguration).toHaveBeenCalledWith(
      'published-app'
    );
    expect(component.outcome).toBe('resolved');
  });

  it('builds a tenant-scoped demo recovery URL only for unknown scoped apps', () => {
    const component = new AppResolverComponent(
      {} as any,
      themeService() as any,
      routeFor({ workspaceSlug: 'north-star' }),
      'server',
      {} as any,
      { url: '/app/missing-app', navigate: jest.fn() } as unknown as Router
    );

    component.outcome = 'unknown';
    component.workspaceSlug = 'north-star';

    expect(component.showScopedDemoRecovery).toBe(true);
    expect(component.demoHref).toBe('/app/demo-app?workspaceSlug=north-star');

    component.workspaceSlug = null;
    expect(component.showScopedDemoRecovery).toBe(false);
  });

  it('restores a loading root session once and resolves to anonymous discovery', async () => {
    const sessionState$ = new Subject<{ status: 'loading' | 'signed-out' }>();
    const auth = {
      status: 'loading' as const,
      sessionState$: sessionState$.asObservable(),
      restoreSession: jest.fn().mockResolvedValue(false),
    };
    const component = new AppResolverComponent(
      {
        getConfigurationByDomain: jest.fn(),
        setConfiguration: jest.fn(),
      } as any,
      themeService() as any,
      routeFor({}),
      'browser',
      auth as any,
      { url: '/', navigate: jest.fn() } as unknown as Router
    );
    jest.spyOn(component as any, 'getHostname').mockReturnValue('127.0.0.1');

    component.ngOnInit();
    expect(auth.restoreSession).toHaveBeenCalledTimes(1);
    expect(component.loading).toBe(true);

    sessionState$.next({ status: 'signed-out' });
    await Promise.resolve();

    expect(auth.restoreSession).toHaveBeenCalledTimes(1);
    expect(component.publicRoot).toBe(true);
    expect(component.rootMode).toBe('anonymous');
  });

  it('keeps the unqualified local root on the anonymous discovery surface', () => {
    const config = {
      getConfigurationByName: jest.fn(),
      getConfigurationByDomain: jest.fn(),
      setConfiguration: jest.fn(),
    };
    const auth = {
      status: 'signed-out' as const,
      sessionState$: of({ status: 'signed-out' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({}),
      'browser',
      auth as any,
      { url: '/', navigate: jest.fn() } as unknown as Router
    );
    jest.spyOn(component as any, 'getHostname').mockReturnValue('127.0.0.1');

    component.ngOnInit();

    expect(config.getConfigurationByName).not.toHaveBeenCalled();
    expect(config.getConfigurationByDomain).not.toHaveBeenCalled();
    expect(auth.restoreSession).not.toHaveBeenCalled();
    expect(component.publicRoot).toBe(true);
  });

  it('resolves a seeded local development domain instead of treating it as the root doorway', async () => {
    const publishedConfig = {
      ...validConfiguration(),
      publishedVersion: 1,
    };
    const config = {
      getConfigurationByName: jest.fn(),
      getConfigurationByDomain: jest.fn().mockReturnValue(of(publishedConfig)),
      setConfiguration: jest.fn(),
    };
    const auth = {
      status: 'signed-out' as const,
      sessionState$: of({ status: 'signed-out' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({}),
      'browser',
      auth as any,
      { url: '/', navigate: jest.fn() } as unknown as Router
    );
    jest
      .spyOn(component as any, 'getHostname')
      .mockReturnValue('demo-app.configurable-client.local');

    component.ngOnInit();
    await Promise.resolve();

    expect(config.getConfigurationByDomain).toHaveBeenCalledWith(
      'demo-app.configurable-client.local'
    );
    expect(component.outcome).toBe('resolved');
  });

  it('loads a published domain anonymously without consulting the session', () => {
    const config = {
      getConfigurationByDomain: jest.fn().mockReturnValue(of({ theme: {} })),
      setConfiguration: jest.fn(),
    };
    const auth = {
      status: 'signed-out' as const,
      sessionState$: of({ status: 'signed-out' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({}),
      'browser',
      auth as any,
      {
        url: '/',
        navigate: jest.fn(),
        createUrlTree: jest.fn(),
      } as unknown as Router
    );
    jest
      .spyOn(component as any, 'getHostname')
      .mockReturnValue('published.example');

    component.ngOnInit();

    expect(config.getConfigurationByDomain).toHaveBeenCalledWith(
      'published.example'
    );
    expect(auth.restoreSession).not.toHaveBeenCalled();
  });

  it('keeps an unmatched published domain on the anonymous discovery surface', () => {
    const config = {
      getConfigurationByDomain: jest
        .fn()
        .mockReturnValue(throwError(() => ({ status: 404 }))),
      getConfigurationByName: jest.fn(),
      setConfiguration: jest.fn(),
    };
    const auth = {
      status: 'signed-out' as const,
      sessionState$: of({ status: 'signed-out' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({}),
      'browser',
      auth as any,
      { url: '/', navigate: jest.fn() } as unknown as Router
    );
    jest
      .spyOn(component as any, 'getHostname')
      .mockReturnValue('unpublished.example');

    component.ngOnInit();

    expect(config.getConfigurationByName).not.toHaveBeenCalled();
    expect(auth.restoreSession).not.toHaveBeenCalled();
    expect(component.publicRoot).toBe(true);
  });

  it('prioritizes a published hostname over an app query on non-local hosts', () => {
    const config = {
      getConfigurationByDomain: jest.fn().mockReturnValue(of({ theme: {} })),
      getConfigurationByName: jest.fn(),
      setConfiguration: jest.fn(),
    };
    const auth = {
      status: 'signed-out' as const,
      sessionState$: of({ status: 'signed-out' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({ appNameQuery: 'private-app' }),
      'browser',
      auth as any,
      { url: '/', navigate: jest.fn() } as unknown as Router
    );
    jest
      .spyOn(component as any, 'getHostname')
      .mockReturnValue('published.example');

    component.ngOnInit();

    expect(config.getConfigurationByDomain).toHaveBeenCalledWith(
      'published.example'
    );
    expect(config.getConfigurationByName).not.toHaveBeenCalled();
    expect(auth.restoreSession).not.toHaveBeenCalled();
  });

  it('restores a loading session before making a protected name request', async () => {
    let status: 'loading' | 'signed-in' = 'loading';
    let completeRestore!: () => void;
    const config = {
      getConfigurationByName: jest.fn().mockReturnValue(of({ theme: {} })),
      setConfiguration: jest.fn(),
    };
    const auth = {
      get status() {
        return status;
      },
      sessionState$: of({ status: 'loading' as const }),
      restoreSession: jest.fn().mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            completeRestore = () => {
              status = 'signed-in';
              resolve(true);
            };
          })
      ),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({ appName: 'private-app', workspaceSlug: 'north-star' }),
      'browser',
      auth as any,
      {
        url: '/app/private-app?workspaceSlug=north-star',
        navigate: jest.fn(),
      } as unknown as Router
    );

    component.ngOnInit();
    expect(auth.restoreSession).toHaveBeenCalledTimes(1);
    expect(config.getConfigurationByName).not.toHaveBeenCalled();

    completeRestore();
    await Promise.resolve();

    expect(config.getConfigurationByName).toHaveBeenCalledWith(
      'private-app',
      'north-star'
    );
  });

  it('redirects signed-out protected access with a safe return target and no config request', async () => {
    const router = {
      url: '/app/private-app?workspaceSlug=north-star',
      navigate: jest.fn(),
    };
    const config = {
      getConfigurationByName: jest.fn(),
      setConfiguration: jest.fn(),
    };
    const auth = {
      status: 'signed-out' as const,
      sessionState$: of({ status: 'signed-out' as const }),
      restoreSession: jest.fn().mockResolvedValue(false),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({ appName: 'private-app', workspaceSlug: 'north-star' }),
      'browser',
      auth as any,
      router as unknown as Router
    );

    component.ngOnInit();
    await Promise.resolve();

    expect(config.getConfigurationByName).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnTo: '/app/private-app?workspaceSlug=north-star' },
    });
  });

  it('falls back to the root when the return target is unsafe', async () => {
    const router = { url: 'https://evil.example/steal', navigate: jest.fn() };
    const auth = {
      status: 'signed-out' as const,
      sessionState$: of({ status: 'signed-out' as const }),
      restoreSession: jest.fn().mockResolvedValue(false),
    };
    const component = new AppResolverComponent(
      { getConfigurationByName: jest.fn(), setConfiguration: jest.fn() } as any,
      themeService() as any,
      routeFor({ appName: 'private-app' }),
      'browser',
      auth as any,
      router as unknown as Router
    );

    component.ngOnInit();
    await Promise.resolve();

    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnTo: '/' },
    });
  });

  it('makes a signed-in protected request with workspace context', () => {
    const config = {
      getConfigurationByName: jest.fn().mockReturnValue(of({ theme: {} })),
      setConfiguration: jest.fn(),
    };
    const auth = {
      status: 'signed-in' as const,
      sessionState$: of({ status: 'signed-in' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({ appName: 'private-app', workspaceSlug: 'north-star' }),
      'browser',
      auth as any,
      {
        url: '/app/private-app?workspaceSlug=north-star',
        navigate: jest.fn(),
      } as unknown as Router
    );

    component.ngOnInit();

    expect(config.getConfigurationByName).toHaveBeenCalledWith(
      'private-app',
      'north-star'
    );
  });

  it('keeps a signed-out local root anonymous without restoring a session', () => {
    const auth = {
      status: 'signed-out' as const,
      sessionState$: of({ status: 'signed-out' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      { setConfiguration: jest.fn() } as any,
      themeService() as any,
      routeFor({}),
      'browser',
      auth as any,
      { url: '/', navigate: jest.fn() } as unknown as Router
    );
    jest.spyOn(component as any, 'getHostname').mockReturnValue('localhost');

    component.ngOnInit();

    expect(component.outcome).toBe('discovery');
    expect(component.rootMode).toBe('anonymous');
    expect(auth.restoreSession).not.toHaveBeenCalled();
  });

  it('shows authenticated owner and client choices when the root session is signed in', () => {
    const auth = {
      status: 'signed-in' as const,
      sessionState$: of({ status: 'signed-in' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      { setConfiguration: jest.fn() } as any,
      themeService() as any,
      routeFor({}),
      'browser',
      auth as any,
      { url: '/', navigate: jest.fn() } as unknown as Router
    );
    jest.spyOn(component as any, 'getHostname').mockReturnValue('localhost');

    component.ngOnInit();

    expect(component.outcome).toBe('authenticated-discovery');
    expect(component.rootMode).toBe('authenticated');
    expect(auth.restoreSession).not.toHaveBeenCalled();
  });

  it('keeps the root in an explicit loading outcome while session state is unresolved', () => {
    const auth = {
      status: 'loading' as const,
      sessionState$: of({ status: 'loading' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      { setConfiguration: jest.fn() } as any,
      themeService() as any,
      routeFor({}),
      'browser',
      auth as any,
      { url: '/', navigate: jest.fn() } as unknown as Router
    );
    jest.spyOn(component as any, 'getHostname').mockReturnValue('localhost');

    component.ngOnInit();

    expect(component.outcome).toBe('loading');
    expect(component.rootMode).toBe('loading');
    expect(auth.restoreSession).toHaveBeenCalledTimes(1);
  });

  it('records an unknown outcome for a missing named app', async () => {
    const config = {
      getConfigurationByName: jest
        .fn()
        .mockReturnValue(throwError(() => ({ status: 404 }))),
      setConfiguration: jest.fn(),
    };
    const auth = {
      status: 'signed-in' as const,
      sessionState$: of({ status: 'signed-in' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({ appName: 'missing-app' }),
      'browser',
      auth as any,
      { url: '/app/missing-app', navigate: jest.fn() } as unknown as Router
    );

    component.ngOnInit();
    await Promise.resolve();

    expect(component.outcome).toBe('unknown');
    expect(component.error).toContain('not found');
  });

  it('records an unavailable outcome for an inactive app', async () => {
    const config = {
      getConfigurationByName: jest
        .fn()
        .mockReturnValue(of(validConfiguration({ active: false }))),
      setConfiguration: jest.fn(),
    };
    const auth = {
      status: 'signed-in' as const,
      sessionState$: of({ status: 'signed-in' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({ appName: 'paused-app' }),
      'browser',
      auth as any,
      { url: '/app/paused-app', navigate: jest.fn() } as unknown as Router
    );

    component.ngOnInit();
    await Promise.resolve();

    expect(component.outcome).toBe('unavailable');
    expect(config.setConfiguration).not.toHaveBeenCalled();
  });

  it('records a misconfigured outcome without handing malformed data to the renderer', async () => {
    const config = {
      getConfigurationByName: jest
        .fn()
        .mockReturnValue(
          of({ id: 'broken', name: 'broken-app', active: true })
        ),
      setConfiguration: jest.fn(),
    };
    const auth = {
      status: 'signed-in' as const,
      sessionState$: of({ status: 'signed-in' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({ appName: 'broken-app' }),
      'browser',
      auth as any,
      { url: '/app/broken-app', navigate: jest.fn() } as unknown as Router
    );

    component.ngOnInit();
    await Promise.resolve();

    expect(component.outcome).toBe('misconfigured');
    expect(config.setConfiguration).not.toHaveBeenCalled();
  });

  it('offers retry for transient configuration failure and resolves after retry', async () => {
    const getConfigurationByName = jest
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 503 })))
      .mockReturnValueOnce(of(validConfiguration()));
    const config = {
      getConfigurationByName,
      setConfiguration: jest.fn(),
      setProtectedConfiguration: jest.fn(),
    };
    const auth = {
      status: 'signed-in' as const,
      sessionState$: of({ status: 'signed-in' as const }),
      restoreSession: jest.fn(),
    };
    const component = new AppResolverComponent(
      config as any,
      themeService() as any,
      routeFor({ appName: 'flaky-app' }),
      'browser',
      auth as any,
      { url: '/app/flaky-app', navigate: jest.fn() } as unknown as Router
    );

    component.ngOnInit();
    await Promise.resolve();
    expect(component.outcome).toBe('transient-failure');

    component.retry();
    await Promise.resolve();
    await Promise.resolve();

    expect(getConfigurationByName).toHaveBeenCalledTimes(2);
    expect(component.outcome).toBe('resolved');
    expect(config.setProtectedConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'demo-app' })
    );
    expect(config.setConfiguration).not.toHaveBeenCalled();
  });
});
