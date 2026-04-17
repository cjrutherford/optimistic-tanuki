import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../services/auth.service';

describe('DashboardComponent', () => {
  let router: Router;
  let authService: { logout: jest.Mock };
  let themeService: {
    theme: Observable<string>;
    toggleTheme: jest.Mock;
    setPersonality: jest.Mock;
    setPrimaryColor: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      logout: jest.fn(),
    };
    themeService = {
      theme: of('light'),
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
      'Community Ops',
      'Operations',
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
