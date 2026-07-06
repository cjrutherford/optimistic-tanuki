import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Router } from '@angular/router';
import { DashboardComponent } from './components/dashboard.component';
import { OperatorOverviewComponent } from './components/operator-overview.component';
import { ThemeManagementComponent } from './components/theme-management.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';
import { AppScopesService } from './services/app-scopes.service';
import { AppConfigService } from './services/app-config.service';
import { CommunityService } from './services/community.service';
import { StoreService } from './services/store.service';
import { OperatorQueueService } from './services/operator-queue.service';
import { ThemeColors } from '@optimistic-tanuki/theme-lib';

const CONTROL_CENTER_PERSONALITY = {
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

describe('owner-console theme audit regressions', () => {
  it('declares theme-color and color-scheme metadata in index.html', () => {
    const indexHtml = readFileSync(
      join(process.cwd(), 'apps/owner-console/src/index.html'),
      'utf8'
    );

    expect(indexHtml).toContain('name="theme-color"');
    expect(indexHtml).toContain('name="color-scheme"');
  });

  it('renders a polished dashboard theme toggle label instead of emoji-only text', async () => {
    const themeSubject = new BehaviorSubject<'light' | 'dark' | undefined>(
      'light'
    );
    const themeColorsSubject = new BehaviorSubject<ThemeColors | undefined>({
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
    });
    const generatedThemeSubject = new BehaviorSubject<any>({
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
      personality: CONTROL_CENTER_PERSONALITY,
    });
    const personalitySubject = new BehaviorSubject<any>(
      CONTROL_CENTER_PERSONALITY
    );

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        {
          provide: ThemeService,
          useValue: {
            theme: themeSubject,
            themeColors$: themeColorsSubject,
            generatedTheme$: generatedThemeSubject,
            personality$: personalitySubject,
            getTheme: jest.fn(() => 'light'),
            getAccentColor: jest.fn(() => '#2dd4bf'),
            getCurrentPersonality: jest.fn(() => CONTROL_CENTER_PERSONALITY),
            setPersonality: jest.fn().mockResolvedValue(undefined),
            setPrimaryColor: jest.fn(),
            toggleTheme: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            logout: jest.fn(),
          },
        },
        {
          provide: Router,
          useValue: {
            url: '/dashboard/overview',
            navigate: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.themeToggleLabel).toBe('Dark Mode');
  });

  it('announces theme management feedback through a polite live region', async () => {
    await TestBed.configureTestingModule({
      imports: [ThemeManagementComponent],
      providers: [
        {
          provide: AppConfigService,
          useValue: {
            getConfigurations: jest.fn().mockReturnValue(
              of([
                {
                  id: 'cfg-1',
                  name: 'christopherrutherford-net',
                  domain: 'christopherrutherford.net',
                  active: true,
                  theme: {},
                  release: {},
                },
              ])
            ),
            updateConfiguration: jest.fn(),
            publishConfiguration: jest.fn(),
            rollbackConfiguration: jest.fn(),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            setPrimaryColor: jest.fn(),
            setTheme: jest.fn(),
            setPersonality: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ThemeManagementComponent);
    fixture.detectChanges();
    fixture.componentInstance.successMessage = 'Theme saved.';
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const successRegion = element.querySelector('.success');
    const fontInput = element.querySelector('input[type="text"]');

    expect(successRegion?.getAttribute('aria-live')).toBe('polite');
    expect(fontInput?.getAttribute('placeholder')).toBe(
      'e.g. “IBM Plex Sans”, sans-serif…'
    );
  });

  it('routes operator overview attention cards to live dashboard destinations', async () => {
    await TestBed.configureTestingModule({
      imports: [OperatorOverviewComponent],
      providers: [
        { provide: UsersService, useValue: { getProfiles: jest.fn() } },
        { provide: AppScopesService, useValue: { getAppScopes: jest.fn() } },
        {
          provide: AppConfigService,
          useValue: { getConfigurations: jest.fn() },
        },
        {
          provide: CommunityService,
          useValue: {
            getCommunities: jest.fn(),
            getCities: jest.fn(),
          },
        },
        {
          provide: StoreService,
          useValue: {
            getProducts: jest.fn(),
            getOrders: jest.fn(),
            getAppointments: jest.fn(),
          },
        },
        {
          provide: OperatorQueueService,
          useValue: {
            getOverviewQueue: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OperatorOverviewComponent);
    const attentionItems = (
      fixture.componentInstance as any
    ).buildAttentionItems([], [], [], [], []);

    expect(attentionItems.map((item: { route: string }) => item.route)).toEqual(
      [
        '/dashboard/app-config',
        '/dashboard/store/orders',
        '/dashboard/store/appointments',
        '/dashboard/communities',
      ]
    );
  });
});
