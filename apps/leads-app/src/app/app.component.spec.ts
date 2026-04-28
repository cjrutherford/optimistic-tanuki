import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { AppComponent } from './app.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { BehaviorSubject, of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { OnboardingPageComponent } from './onboarding-page.component';
import { LeadsService } from './leads.service';
import { OnboardingGateService } from './onboarding-gate.service';
import { AuthStateService } from './auth-state.service';
import { HomeRedirectComponent } from './home-redirect.component';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';

describe('AppComponent', () => {
  const themeServiceStub = {
    setPersonality: jest.fn(),
    getTheme: jest.fn().mockReturnValue('light'),
    theme$: jest.fn().mockReturnValue(of('light')),
    themeColors$: of({
      background: '#ffffff',
      foreground: '#111827',
      accent: '#0f766e',
      complementary: '#d1d5db',
      complementaryGradients: {
        light: 'linear-gradient(#fff, #f3f4f6)',
        dark: 'linear-gradient(#111827, #1f2937)',
      },
    }),
    toggleTheme: jest.fn(),
  };
  const leadsServiceStub = {
    analyzeOnboarding: jest.fn(),
    confirmOnboarding: jest.fn(),
  };
  const onboardingGateServiceStub = {
    markComplete: jest.fn(),
  };
  const authStateStub = {
    isAuthenticated$: new BehaviorSubject<boolean>(true),
    currentProfile$: new BehaviorSubject<any>({ profileName: 'Closer One' }),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    authStateStub.isAuthenticated$.next(true);
    authStateStub.currentProfile$.next({ profileName: 'Closer One' });
    await TestBed.configureTestingModule({
      imports: [AppComponent, NoopAnimationsModule],
      providers: [
        provideRouter([
          { path: '', component: HomeRedirectComponent },
          { path: 'dashboard', component: DashboardComponent },
          { path: 'leads', component: DashboardComponent },
          { path: 'settings', component: DashboardComponent },
          { path: 'onboarding', component: OnboardingPageComponent },
        ]),
        {
          provide: ThemeService,
          useValue: themeServiceStub,
        },
        {
          provide: LeadsService,
          useValue: leadsServiceStub,
        },
        {
          provide: OnboardingGateService,
          useValue: onboardingGateServiceStub,
        },
        {
          provide: AuthStateService,
          useValue: authStateStub,
        },
        {
          provide: HaiAppDirectoryService,
          useValue: { getResolvedApps: jest.fn().mockReturnValue(of([])) },
        },
      ],
    }).compileComponents();
  });

  it('renders workspace navigation for authenticated users', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.nav-brand')?.textContent).toContain(
      'Opportunity Compass'
    );
    expect(compiled.textContent).toContain('Dashboard');
    expect(compiled.textContent).toContain('Leads');
    expect(compiled.textContent).toContain('Topics');
    expect(compiled.textContent).toContain('Analytics');
    expect(compiled.textContent).toContain('Settings');
    expect(compiled.textContent).toContain('Account');
    expect(compiled.textContent).toContain('Closer One');
  });

  it('configures the HAI about tag for Opportunity Compass', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.haiAboutConfig).toMatchObject({
      appId: 'opportunity-compass',
      appName: 'Opportunity Compass',
      appUrl: '/opportunity-compass',
    });
    expect(fixture.nativeElement.textContent).toContain('Opportunity Compass');
  });

  it('hides the primary navigation while onboarding is active', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/onboarding');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.nav-links')).toBeNull();
    expect(
      compiled.querySelector('.nav-brand')?.getAttribute('href')
    ).toContain('/onboarding');
  });

  it('shows login and register links when signed out', () => {
    authStateStub.isAuthenticated$.next(false);
    authStateStub.currentProfile$.next(null);

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Login');
    expect(compiled.textContent).toContain('Register');
  });

  it('renders the parallax grid warp motion background shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.motion-background')).toBeTruthy();
    expect(compiled.querySelector('otui-parallax-grid-warp')).toBeTruthy();
    expect(compiled.querySelector('.app-shell')).toBeTruthy();
  });
});
