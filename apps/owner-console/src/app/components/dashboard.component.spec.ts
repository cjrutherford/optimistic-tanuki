import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../services/auth.service';

describe('DashboardComponent', () => {
  let router: Router;
  let authService: { logout: jest.Mock };
  let themeService: any;

  const controlCenterPersonality = {
    id: 'control-center',
    name: 'Control Center',
    animations: {
      easing: 'ease',
      duration: {
        fast: '150ms',
        normal: '300ms',
        slow: '450ms',
      },
    },
  };

  beforeEach(async () => {
    authService = {
      logout: jest.fn(),
    };
    themeService = {
      theme: new BehaviorSubject<'light' | 'dark' | undefined>('light'),
      themeColors$: of({
        background: '#ffffff',
        foreground: '#0f172a',
        accent: '#2dd4bf',
        accentShades: [],
        accentGradients: {},
        complementary: '#0f766e',
        complementaryShades: [],
        complementaryGradients: {},
        tertiary: '#38bdf8',
        tertiaryShades: [],
        tertiaryGradients: {},
        success: '#22c55e',
        successShades: [],
        successGradients: {},
        danger: '#ef4444',
        dangerShades: [],
        dangerGradients: {},
        warning: '#f59e0b',
        warningShades: [],
        warningGradients: {},
      }),
      generatedTheme$: of({
        colors: {
          background: '#ffffff',
          foreground: '#0f172a',
          primary: '#2dd4bf',
          secondary: '#0f766e',
          border: '#cbd5e1',
        },
        fonts: {
          heading: { family: 'IBM Plex Sans' },
          body: { family: 'IBM Plex Sans' },
          mono: { family: 'IBM Plex Mono' },
        },
        personality: controlCenterPersonality,
      }),
      personality$: of(controlCenterPersonality),
      getTheme: jest.fn(() => 'light'),
      getAccentColor: jest.fn(() => '#2dd4bf'),
      getCurrentPersonality: jest.fn(() => controlCenterPersonality),
      toggleTheme: jest.fn(),
      setPersonality: jest.fn(),
      setPrimaryColor: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: ThemeService, useValue: themeService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  const setUrl = (url: string): void => {
    Object.defineProperty(router, 'url', {
      configurable: true,
      get: () => url,
    });
  };

  const setViewport = (desktop: boolean): void => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: desktop,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  };

  const activeLabels = (
    component: DashboardComponent
  ): (string | undefined)[] =>
    component.navItems.filter((item) => item.isActive).map((i) => i.label);

  it('builds the sidebar from the shared nav model plus logout', () => {
    setUrl('/dashboard/overview');
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance.ngOnInit();

    const labels = fixture.componentInstance.navItems.map((i) => i.label);
    expect(labels.slice(0, 6)).toEqual([
      'Overview',
      'Governance',
      'Experience',
      'Commerce',
      'CRM',
      'Community Ops',
    ]);
    expect(labels).toEqual(
      expect.arrayContaining(['Tenant Management', 'Directory Exports'])
    );
    expect(labels[labels.length - 1]).toBe('Logout');
  });

  it('opens the sidebar by default at desktop width', () => {
    setViewport(true);
    setUrl('/dashboard/overview');
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.sidebarOpen).toBe(true);
  });

  it('keeps the sidebar closed by default on narrow screens', () => {
    setViewport(false);
    setUrl('/dashboard/overview');
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.sidebarOpen).toBe(false);
  });

  it('derives the active nav item from router navigation, not just init', async () => {
    setUrl('/dashboard/overview');
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance.ngOnInit();
    expect(activeLabels(fixture.componentInstance)).toEqual(['Overview']);

    setUrl('/dashboard/security');
    (router.events as Subject<unknown>).next(
      new NavigationEnd(1, '/dashboard/security', '/dashboard/security')
    );
    expect(activeLabels(fixture.componentInstance)).toEqual(['Security']);

    setUrl('/dashboard/app-config/designer');
    (router.events as Subject<unknown>).next(
      new NavigationEnd(
        2,
        '/dashboard/app-config/designer',
        '/dashboard/app-config/designer'
      )
    );
    expect(activeLabels(fixture.componentInstance)).toEqual([
      'Design New Configuration',
    ]);
  });

  it('leaves the personality to the app theme defaults', () => {
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    Object.defineProperty(router, 'url', {
      configurable: true,
      get: () => '/dashboard/overview',
    });

    const fixture = TestBed.createComponent(DashboardComponent);

    fixture.componentInstance.ngOnInit();

    expect(themeService.setPersonality).not.toHaveBeenCalled();
    expect(themeService.setPrimaryColor).not.toHaveBeenCalled();
  });
});
