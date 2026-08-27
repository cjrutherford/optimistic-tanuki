import { Component, Input, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { ProfileContext } from './profile.context';
import { TitleBarComponent } from './components/title-bar/title-bar.component';
import { TenantContextService } from './tenant-context.service';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';

@Component({
  selector: 'fc-title-bar',
  standalone: true,
  template: '',
})
class StubTitleBarComponent {}

@Component({
  selector: 'hai-about-tag',
  standalone: true,
  template: '',
})
class StubHaiAboutTagComponent {
  @Input() config: unknown;
}

@Component({
  standalone: true,
  template: '',
})
class StubOnboardingRouteComponent {}

describe('AppComponent', () => {
  beforeEach(async () => {
    TestBed.overrideComponent(AppComponent, {
      remove: {
        imports: [TitleBarComponent, HaiAboutTagComponent],
      },
      add: {
        imports: [StubTitleBarComponent, StubHaiAboutTagComponent],
      },
    });

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([
          { path: 'onboarding', component: StubOnboardingRouteComponent },
          { path: 'plans', component: StubOnboardingRouteComponent },
        ]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ThemeService,
          useValue: {
            setTheme: jest.fn(),
            setPersonality: jest.fn(),
            setPrimaryColor: jest.fn(),
            getTheme: jest.fn().mockReturnValue('light'),
            themeColors$: of({
              background: '#f8fafc',
              foreground: '#0f172a',
              accent: '#2563eb',
            }),
            personality$: of(undefined),
          },
        },
        {
          provide: ProfileContext,
          useValue: {
            isAuthenticated: () => false,
            loadProfile: jest.fn(),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            loadTenantContext: jest.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the application shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.app-content')).not.toBeNull();
  });

  it('hides the persistent title bar while onboarding is active', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    fixture.detectChanges();
    await router.navigateByUrl('/onboarding');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('fc-title-bar')).toBeNull();
  });

  it('restores the persistent title bar after leaving onboarding', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    fixture.detectChanges();
    await router.navigateByUrl('/onboarding');
    fixture.detectChanges();
    await router.navigateByUrl('/plans');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('fc-title-bar')).not.toBeNull();
  });

  it('defaults Fin Commander to the classic personality when no theme is stored', () => {
    const themeService = TestBed.inject(ThemeService);
    const fixture = TestBed.createComponent(AppComponent);

    fixture.detectChanges();

    expect(themeService.setPersonality).toHaveBeenCalledWith('professional');
    expect(themeService.setPrimaryColor).toHaveBeenCalledWith('#0d5f73');
  });
});
