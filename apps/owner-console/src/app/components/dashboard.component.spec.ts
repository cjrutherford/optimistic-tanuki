import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
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

  it('uses workspace-oriented navigation labels', () => {
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    Object.defineProperty(router, 'url', {
      configurable: true,
      get: () => '/dashboard/overview',
    });

    const fixture = TestBed.createComponent(DashboardComponent);

    fixture.componentInstance.ngOnInit();

    expect(
      fixture.componentInstance.navItems.map((item) => item.label)
    ).toEqual([
      'Overview',
      'Governance',
      'Experience',
      'Commerce',
      'CRM',
      'Community Ops',
      'Operations',
      'Control Center',
      'Logout',
    ]);
  });

  it('redirects the bare dashboard route to the overview workspace', () => {
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    Object.defineProperty(router, 'url', {
      configurable: true,
      get: () => '/dashboard',
    });

    const fixture = TestBed.createComponent(DashboardComponent);

    fixture.componentInstance.ngOnInit();

    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/overview']);
  });

  it('initializes the owner console with the control-center personality', () => {
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    Object.defineProperty(router, 'url', {
      configurable: true,
      get: () => '/dashboard/overview',
    });

    const fixture = TestBed.createComponent(DashboardComponent);

    fixture.componentInstance.ngOnInit();

    expect(themeService.setPersonality).toHaveBeenCalledWith('control-center');
    expect(themeService.setPrimaryColor).toHaveBeenCalledWith('#2dd4bf');
  });
});
