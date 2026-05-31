import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { AppComponent } from './app.component';
import {
  BusinessApiService,
  BusinessAuthService,
  DEFAULT_BUSINESS_SITE_CONFIG,
} from '@optimistic-tanuki/business-data-access';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { RouterLink } from '@angular/router';

describe('AppComponent', () => {
  it('shows owner login and never renders trainer login copy', () => {
    localStorage.clear();

    const trainerApiService = {
      getSiteConfig: jest.fn(() =>
        new Subject<{
          configId: string | null;
          config: typeof DEFAULT_BUSINESS_SITE_CONFIG | null;
        }>().asObservable()
      ),
    };
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
        { provide: BusinessApiService, useValue: trainerApiService },
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
    const siteConfig$ = new Subject<{
      configId: string | null;
      config: typeof DEFAULT_BUSINESS_SITE_CONFIG | null;
    }>();

    const siteConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      theme: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.theme,
        mode: 'dark' as const,
        personalityId: 'bold-minimal',
        primaryColor: '#123456',
      },
    };

    const trainerApiService = {
      getSiteConfig: jest.fn(() => siteConfig$.asObservable()),
    };
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
        { provide: BusinessApiService, useValue: trainerApiService },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: themeService },
      ],
    });

    TestBed.createComponent(AppComponent);

    expect(themeService.setTheme).toHaveBeenCalledWith('light');

    siteConfig$.next({
      configId: 'cfg-1',
      config: siteConfig,
    });

    expect(themeService.setTheme).toHaveBeenCalledWith('dark');
    expect(themeService.setPersonality).toHaveBeenCalledWith('bold-minimal');
    expect(themeService.setPrimaryColor).toHaveBeenCalledWith('#123456');
  });

  it('uses router fragment navigation for landing-page section links', () => {
    localStorage.clear();

    const trainerApiService = {
      getSiteConfig: jest.fn(() =>
        new Subject<{
          configId: string | null;
          config: typeof DEFAULT_BUSINESS_SITE_CONFIG | null;
        }>().asObservable()
      ),
    };
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
        { provide: BusinessApiService, useValue: trainerApiService },
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
    const siteConfig$ = new Subject<{
      configId: string | null;
      config: typeof DEFAULT_BUSINESS_SITE_CONFIG | null;
    }>();

    const trainerApiService = {
      getSiteConfig: jest.fn(() => siteConfig$.asObservable()),
    };
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
        { provide: BusinessApiService, useValue: trainerApiService },
        { provide: BusinessAuthService, useValue: trainerAuthService },
        { provide: ThemeService, useValue: themeService },
        { provide: Title, useValue: titleService },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    siteConfig$.next({
      configId: 'cfg-1',
      config: {
        ...DEFAULT_BUSINESS_SITE_CONFIG,
        brand: {
          ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
          businessName: 'North Star Advisory',
          tagline: 'Operational guidance for growing service businesses.',
        },
      },
    });
    fixture.detectChanges();

    expect(titleService.setTitle).toHaveBeenCalledWith(
      'North Star Advisory | Operational guidance for growing service businesses.'
    );
  });

  it('derives route-aware titles from the loaded business config', () => {
    localStorage.clear();

    const trainerApiService = {
      getSiteConfig: jest.fn(() => new Subject().asObservable()),
    };
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
        { provide: BusinessApiService, useValue: trainerApiService },
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

    expect(component.pageTitleForUrl('/book')).toBe(
      'Book strategy session | North Star Advisory'
    );
    expect(component.pageTitleForUrl('/client/login')).toBe(
      'Client Login | North Star Advisory'
    );
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

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfig: jest.fn(() => new Subject().asObservable()),
          },
        },
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

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfig: jest.fn(() => new Subject().asObservable()),
          },
        },
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

  it('returns to the landing page after owner sign out', () => {
    localStorage.clear();
    const logout = jest.fn();
    const navigate = jest.fn();

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfig: jest.fn(() => new Subject().asObservable()),
          },
        },
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
