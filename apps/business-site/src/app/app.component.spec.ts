import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { By } from '@angular/platform-browser';
import { NavigationEnd, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import {
  BusinessAuthService,
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
} from '@optimistic-tanuki/business-data-access';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { RouterLink } from '@angular/router';

describe('AppComponent', () => {
  function createStore(
    config: typeof DEFAULT_BUSINESS_SITE_CONFIG = DEFAULT_BUSINESS_SITE_CONFIG,
    configId: string | null = null,
    loadError: string | null = null
  ) {
    const site = signal(config);
    const configIdSignal = signal<string | null>(configId);
    const loadErrorSignal = signal<string | null>(loadError);

    return {
      site: site.asReadonly(),
      configId: configIdSignal.asReadonly(),
      loaded: signal(true).asReadonly(),
      loadError: loadErrorSignal.asReadonly(),
      fetch: jest.fn(() => of(config)),
      setSite: jest.fn((nextConfig: typeof DEFAULT_BUSINESS_SITE_CONFIG) => {
        site.set(nextConfig);
      }),
      __site: site,
      __configId: configIdSignal,
      __loadError: loadErrorSignal,
    };
  }

  function createThemeService() {
    return {
      setTheme: jest.fn(),
      setPersonality: jest.fn(),
      setPrimaryColor: jest.fn(),
      getTheme: jest.fn(() => 'light' as const),
      toggleTheme: jest.fn(),
      getPersonalityConfig: jest.fn(() => ({
        personalityId: 'classic',
        primaryColor: '#3f51b5',
        mode: 'light',
        version: '1.0.0',
      })),
    };
  }

  it('shows owner login and never renders trainer login copy', () => {
    localStorage.clear();
    const store = createStore();
    const trainerAuthService = {
      isAuthenticated: jest.fn(() => false),
      isClientAuthenticated: jest.fn(() => false),
      clientUser: jest.fn(() => null),
      logout: jest.fn(),
      logoutClient: jest.fn(),
    };
    const themeService = {
      setTheme: jest.fn(),
      setPersonality: jest.fn(),
      setPrimaryColor: jest.fn(),
      getTheme: jest.fn(() => 'light' as const),
      toggleTheme: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: themeService },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Owner Login');
    expect(text).not.toContain('Trainer Login');
  });

  it('applies the loaded site theme after site config arrives', () => {
    localStorage.clear();
    const siteConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      theme: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.theme,
        mode: 'dark' as const,
        personalityId: 'elegant',
        primaryColor: '#123456',
      },
    };
    const store = createStore(DEFAULT_BUSINESS_SITE_CONFIG);
    const trainerAuthService = {
      isAuthenticated: jest.fn(() => false),
      isClientAuthenticated: jest.fn(() => false),
      clientUser: jest.fn(() => null),
      logout: jest.fn(),
      logoutClient: jest.fn(),
    };
    const themeService = {
      setTheme: jest.fn(),
      setPersonality: jest.fn(),
      setPrimaryColor: jest.fn(),
      getTheme: jest.fn(() => 'light' as const),
      toggleTheme: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: themeService },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);

    expect(themeService.setTheme).toHaveBeenCalledWith('light');

    store.__site.set(siteConfig);
    fixture.detectChanges();

    expect(themeService.setTheme).toHaveBeenCalledWith('dark');
    expect(themeService.setPersonality).toHaveBeenCalledWith('elegant');
    expect(themeService.setPrimaryColor).toHaveBeenCalledWith('#123456');
  });

  it('surfaces a config-load-error notice when the site config store reports a load failure', () => {
    localStorage.clear();
    const store = createStore(DEFAULT_BUSINESS_SITE_CONFIG, null, null);
    const trainerAuthService = {
      isAuthenticated: jest.fn(() => false),
      isClientAuthenticated: jest.fn(() => false),
      clientUser: jest.fn(() => null),
      logout: jest.fn(),
      logoutClient: jest.fn(),
    };
    const themeService = {
      setTheme: jest.fn(),
      setPersonality: jest.fn(),
      setPrimaryColor: jest.fn(),
      getTheme: jest.fn(() => 'light' as const),
      toggleTheme: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: themeService },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.config-load-error')
    ).toBeNull();

    store.__loadError.set('Failed to load business site configuration.');
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.config-load-error');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain("couldn't refresh");

    store.__loadError.set(null);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.config-load-error')
    ).toBeNull();
  });

  it('applies the hosted business theme even when a user theme is already stored', () => {
    localStorage.setItem(
      'optimistic-tanuki-personality-theme',
      JSON.stringify({
        personalityId: 'classic',
        primaryColor: '#ff00aa',
        mode: 'light',
        version: '1.0.0',
      })
    );

    const store = createStore({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      site: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.site,
        slug: 'steady-hand-contracting',
      },
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'Steady Hand Contracting',
      },
      theme: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.theme,
        mode: 'dark',
        personalityId: 'grounded',
        primaryColor: '#8c4f28',
      },
    });
    const trainerAuthService = {
      isAuthenticated: jest.fn(() => false),
      isClientAuthenticated: jest.fn(() => false),
      clientUser: jest.fn(() => null),
      logout: jest.fn(),
      logoutClient: jest.fn(),
    };
    const themeService = createThemeService();

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: themeService },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      currentUrl: { set: (url: string) => void };
    };

    component.currentUrl.set('/sites/steady-hand-contracting');
    fixture.detectChanges();

    expect(themeService.setTheme).toHaveBeenCalledWith('dark');
    expect(themeService.setPersonality).toHaveBeenCalledWith('grounded');
    expect(themeService.setPrimaryColor).toHaveBeenCalledWith('#8c4f28');
  });

  it('keeps the hosted business theme active on business-scoped client auth routes', () => {
    localStorage.setItem(
      'optimistic-tanuki-personality-theme',
      JSON.stringify({
        personalityId: 'classic',
        primaryColor: '#ff00aa',
        mode: 'light',
        version: '1.0.0',
      })
    );

    const store = createStore({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      site: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.site,
        slug: 'steady-hand-contracting',
      },
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'Steady Hand Contracting',
      },
      theme: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.theme,
        mode: 'dark',
        personalityId: 'grounded',
        primaryColor: '#8c4f28',
      },
    });
    const trainerAuthService = {
      isAuthenticated: jest.fn(() => false),
      isClientAuthenticated: jest.fn(() => false),
      clientUser: jest.fn(() => null),
      logout: jest.fn(),
      logoutClient: jest.fn(),
    };
    const themeService = createThemeService();

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: themeService },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      currentUrl: { set: (url: string) => void };
    };

    component.currentUrl.set('/sites/steady-hand-contracting/client/login');
    fixture.detectChanges();

    expect(themeService.setTheme).toHaveBeenCalledWith('dark');
    expect(themeService.setPersonality).toHaveBeenCalledWith('grounded');
    expect(themeService.setPrimaryColor).toHaveBeenCalledWith('#8c4f28');
  });

  it('renders business-scoped client auth links on hosted business routes', () => {
    localStorage.clear();
    const store = createStore({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      site: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.site,
        slug: 'steady-hand-contracting',
      },
      features: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.features,
        clientPortal: {
          enabled: true,
        },
      },
    });
    const trainerAuthService = {
      isAuthenticated: jest.fn(() => false),
      isClientAuthenticated: jest.fn(() => false),
      clientUser: jest.fn(() => null),
      logout: jest.fn(),
      logoutClient: jest.fn(),
    };
    const themeService = createThemeService();

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: themeService },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      currentUrl: { set: (url: string) => void };
    };

    component.currentUrl.set('/sites/steady-hand-contracting');
    fixture.detectChanges();

    const clientLoginLink = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink))
      .find(
        (link) => link.href === '/sites/steady-hand-contracting/client/login'
      );

    expect(clientLoginLink).toBeTruthy();
  });

  it('keeps the hosted slug intact when the url carries a fragment or query', () => {
    localStorage.clear();
    const store = createStore({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      site: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.site,
        slug: 'canopy-tree-service',
      },
    });
    const trainerAuthService = {
      isAuthenticated: jest.fn(() => false),
      isClientAuthenticated: jest.fn(() => false),
      clientUser: jest.fn(() => null),
      logout: jest.fn(),
      logoutClient: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: createThemeService() },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      currentUrl: { set: (url: string) => void };
    };

    // Router urls include the fragment, so a nav click to an in-page anchor
    // lands here as `/sites/<slug>#results`. The slug must not absorb it —
    // otherwise the next routerLink re-encodes `#` to `%23` and the
    // corruption compounds on every subsequent click.
    for (const url of [
      '/sites/canopy-tree-service#results',
      '/sites/canopy-tree-service#contact',
      '/sites/canopy-tree-service?utm=x',
      '/sites/canopy-tree-service/book#top',
    ]) {
      component.currentUrl.set(url);
      fixture.detectChanges();

      expect(component.topNavLinks()[0].route).toEqual([
        '/sites',
        'canopy-tree-service',
      ]);
      expect(component.brandHomeLink()).toEqual([
        '/sites',
        'canopy-tree-service',
      ]);
    }
  });

  it('renders business-scoped owner auth links on hosted business routes', () => {
    localStorage.clear();
    const store = createStore({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      site: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.site,
        slug: 'steady-hand-contracting',
      },
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'Steady Hand Contracting',
      },
      features: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.features,
        clientPortal: {
          enabled: true,
        },
      },
    });
    const trainerAuthService = {
      isAuthenticated: jest.fn(() => false),
      isClientAuthenticated: jest.fn(() => false),
      clientUser: jest.fn(() => null),
      logout: jest.fn(),
      logoutClient: jest.fn(),
    };
    const themeService = createThemeService();

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: themeService },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      currentUrl: { set: (url: string) => void };
    };

    component.currentUrl.set('/sites/steady-hand-contracting');
    fixture.detectChanges();

    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink));

    expect(links.map((link) => link.href)).toContain(
      '/sites/steady-hand-contracting/owner/login'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Steady Hand Contracting'
    );
  });

  it('uses effective platform routes for top-level navigation on the platform home', () => {
    localStorage.clear();
    const store = createStore();
    const trainerAuthService = {
      isAuthenticated: jest.fn(() => false),
      isClientAuthenticated: jest.fn(() => false),
      clientUser: jest.fn(() => null),
      logout: jest.fn(),
      logoutClient: jest.fn(),
    };
    const themeService = {
      setTheme: jest.fn(),
      setPersonality: jest.fn(),
      setPrimaryColor: jest.fn(),
      getTheme: jest.fn(() => 'light' as const),
      toggleTheme: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: themeService },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink));

    expect(links.map((link) => link.href)).toEqual(
      expect.arrayContaining(['/', '/auth', '/client/login'])
    );
  });

  it('updates the browser title from the loaded business config', () => {
    localStorage.clear();
    const store = createStore();
    const trainerAuthService = {
      isAuthenticated: jest.fn(() => false),
      isClientAuthenticated: jest.fn(() => false),
      clientUser: jest.fn(() => null),
      logout: jest.fn(),
      logoutClient: jest.fn(),
    };
    const themeService = {
      setTheme: jest.fn(),
      setPersonality: jest.fn(),
      setPrimaryColor: jest.fn(),
      getTheme: jest.fn(() => 'light' as const),
      toggleTheme: jest.fn(),
    };
    const titleService = {
      setTitle: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: themeService },
        { provide: Title, useValue: titleService },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    store.__site.set({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'North Star Advisory',
        tagline: 'Operational guidance for growing service businesses.',
      },
    });
    fixture.detectChanges();

    expect(titleService.setTitle).toHaveBeenCalledWith(
      'North Star Advisory | Operational guidance for growing service businesses.'
    );
  });

  it('derives route-aware titles from the loaded business config', () => {
    localStorage.clear();
    const store = createStore();
    const trainerAuthService = {
      isAuthenticated: jest.fn(() => false),
      isClientAuthenticated: jest.fn(() => false),
      clientUser: jest.fn(() => null),
      logout: jest.fn(),
      logoutClient: jest.fn(),
    };
    const themeService = {
      setTheme: jest.fn(),
      setPersonality: jest.fn(),
      setPrimaryColor: jest.fn(),
      getTheme: jest.fn(() => 'light' as const),
      toggleTheme: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: themeService },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      pageTitleForUrl: (url: string) => string;
    };

    component.site.set({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'North Star Advisory',
        tagline: 'Operational guidance for growing service businesses.',
      },
      contact: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.contact,
        consultationLabel: 'Book strategy session',
      },
    });

    expect(component.pageTitleForUrl('/sites/north-star-advisory/book')).toBe(
      'Book strategy session | North Star Advisory'
    );
    expect(component.pageTitleForUrl('/client/login')).toBe(
      'Client Login | North Star Advisory'
    );
    expect(
      component.pageTitleForUrl('/sites/north-star-advisory/client/register')
    ).toBe('Client Registration | North Star Advisory');
    expect(component.pageTitleForUrl('/client/dashboard')).toBe(
      'Client Portal | North Star Advisory'
    );
    expect(component.pageTitleForUrl('/owner/login')).toBe(
      'Owner Login | North Star Advisory'
    );
    expect(component.pageTitleForUrl('/owner/register')).toBe(
      'Owner Registration | North Star Advisory'
    );
    expect(component.pageTitleForUrl('/owner/dashboard')).toBe(
      'Owner Workspace | North Star Advisory'
    );
  });

  it('hides client navigation when signed in as an owner', () => {
    localStorage.clear();
    const store = createStore();

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        {
          provide: BusinessAuthService,
          useValue: {
            isAuthenticated: jest.fn(() => true),
            isClientAuthenticated: jest.fn(() => false),
            clientUser: jest.fn(() => null),
            logout: jest.fn(),
            logoutClient: jest.fn(),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            setTheme: jest.fn(),
            setPersonality: jest.fn(),
            setPrimaryColor: jest.fn(),
            getTheme: jest.fn(() => 'light' as const),
            toggleTheme: jest.fn(),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Client Login');
    expect(fixture.nativeElement.textContent).toContain('Workspace');
  });

  it('hides owner navigation when signed in as a client', () => {
    localStorage.clear();
    const store = createStore();

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        {
          provide: BusinessAuthService,
          useValue: {
            isAuthenticated: jest.fn(() => false),
            isClientAuthenticated: jest.fn(() => true),
            clientUser: jest.fn(() => ({ userId: 'client-1' })),
            logout: jest.fn(),
            logoutClient: jest.fn(),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            setTheme: jest.fn(),
            setPersonality: jest.fn(),
            setPrimaryColor: jest.fn(),
            getTheme: jest.fn(() => 'light' as const),
            toggleTheme: jest.fn(),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Owner Login');
    expect(fixture.nativeElement.textContent).toContain('Client Portal');
  });

  it('keeps hosted business app-bar client navigation inside the active business portal', () => {
    localStorage.clear();
    const store = createStore({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      site: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.site,
        slug: 'steady-hand-contracting',
      },
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'Steady Hand Contracting',
      },
    });

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        {
          provide: BusinessAuthService,
          useValue: {
            isAuthenticated: jest.fn(() => false),
            isClientAuthenticated: jest.fn(() => true),
            clientUser: jest.fn(() => ({ userId: 'client-1' })),
            logout: jest.fn(),
            logoutClient: jest.fn(),
          },
        },
        {
          provide: ThemeService,
          useValue: createThemeService(),
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      currentUrl: { set: (url: string) => void };
    };

    component.currentUrl.set('/sites/steady-hand-contracting/client/dashboard');
    fixture.detectChanges();

    const portalLink = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink))
      .find(
        (link) =>
          link.href === '/sites/steady-hand-contracting/client/dashboard'
      );

    expect(portalLink).toBeTruthy();
  });

  it('returns to the landing page after owner sign out', () => {
    localStorage.clear();
    const logout = jest.fn();
    const navigate = jest.fn();
    const store = createStore();

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        {
          provide: BusinessAuthService,
          useValue: {
            isAuthenticated: jest.fn(() => true),
            isClientAuthenticated: jest.fn(() => false),
            clientUser: jest.fn(() => null),
            logout,
            logoutClient: jest.fn(),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            setTheme: jest.fn(),
            setPersonality: jest.fn(),
            setPrimaryColor: jest.fn(),
            getTheme: jest.fn(() => 'light' as const),
            toggleTheme: jest.fn(),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    (component as any).router.navigate = navigate;

    component.logout();

    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('keeps the active hosted site slug in the client portal link from generic workspace routes', () => {
    localStorage.clear();
    const store = createStore({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      site: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.site,
        slug: 'steady-hand-contracting',
      },
    });

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: BusinessSiteConfigStore, useValue: store },
        {
          provide: BusinessAuthService,
          useValue: {
            isAuthenticated: jest.fn(() => false),
            isClientAuthenticated: jest.fn(() => true),
            clientUser: jest.fn(() => ({ userId: 'client-1' })),
            logout: jest.fn(),
            logoutClient: jest.fn(),
          },
        },
        {
          provide: ThemeService,
          useValue: createThemeService(),
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      currentUrl: { set: (url: string) => void };
    };

    component.currentUrl.set('/owner/requests');
    fixture.detectChanges();

    const portalLink = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink))
      .find(
        (link) =>
          link.href === '/sites/steady-hand-contracting/client/dashboard'
      );

    expect(portalLink).toBeTruthy();
  });
});
