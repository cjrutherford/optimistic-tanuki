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
    configId: string | null = null
  ) {
    const site = signal(config);
    const configIdSignal = signal<string | null>(configId);

    return {
      site: site.asReadonly(),
      configId: configIdSignal.asReadonly(),
      loaded: signal(true).asReadonly(),
      fetch: jest.fn(() => of(config)),
      setSite: jest.fn((nextConfig: typeof DEFAULT_BUSINESS_SITE_CONFIG) => {
        site.set(nextConfig);
      }),
      __site: site,
      __configId: configIdSignal,
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
        personalityId: 'bold-minimal',
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
    expect(themeService.setPersonality).toHaveBeenCalledWith('bold-minimal');
    expect(themeService.setPrimaryColor).toHaveBeenCalledWith('#123456');
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

  it('uses router fragment navigation for landing-page section links', () => {
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

    const contactLink = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink))
      .find((link) => link.fragment === 'contact');

    expect(contactLink?.href).toBe('/#contact');
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
});
