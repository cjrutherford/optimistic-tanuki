import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AppComponent } from './app.component';
import { AuthStateService } from './state/auth-state.service';
import { NavigationService } from '@optimistic-tanuki/app-registry';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';
import { of } from 'rxjs';

const PERSONALITY_STORAGE_KEY = 'optimistic-tanuki-personality-theme';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let authenticated$: BehaviorSubject<boolean>;
  let authStateMock: {
    isAuthenticated$: () => BehaviorSubject<boolean>;
    logout: jest.Mock;
  };

  beforeEach(async () => {
    authenticated$ = new BehaviorSubject<boolean>(false);
    authStateMock = {
      isAuthenticated$: () => authenticated$,
      logout: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStateService, useValue: authStateMock },
        {
          provide: NavigationService,
          useValue: {
            generateUrl: jest.fn().mockReturnValue('https://haidev.com'),
            navigate: jest.fn(),
          },
        },
        {
          provide: HaiAppDirectoryService,
          useValue: { getResolvedApps: jest.fn().mockReturnValue(of([])) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the HAI Computer brand shell', () => {
    expect(component.brandName).toBe('HAI Computer');
    expect(fixture.nativeElement.textContent).toContain(
      'Hovering Alien Invaders Computers'
    );
  });

  it('renders the signal mesh motion background shell', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.motion-background')).toBeTruthy();
    expect(compiled.querySelector('otui-signal-mesh')).toBeTruthy();
    expect(compiled.querySelector('.app-shell')).toBeTruthy();
  });

  it('bootstraps the control-center personality on first load', () => {
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation((key) =>
        key === PERSONALITY_STORAGE_KEY ? null : null
      );
    const themeService = TestBed.inject(ThemeService);
    const setPersonalitySpy = jest.spyOn(themeService, 'setPersonality');

    const localFixture = TestBed.createComponent(AppComponent);
    localFixture.detectChanges();

    expect(setPersonalitySpy).toHaveBeenCalledWith('control-center');
    getItemSpy.mockRestore();
    setPersonalitySpy.mockRestore();
  });

  it('reflects auth state changes and updates the action label', () => {
    expect(component.actionLabel()).toBe('Log in');
    authenticated$.next(true);
    expect(component.isAuthenticated()).toBe(true);
    expect(component.actionLabel()).toBe('Sign out');
  });

  it('reducedMotion is false when matchMedia is unavailable in the browser', () => {
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      configurable: true,
    });
    expect(component.reducedMotion).toBe(false);
    Object.defineProperty(window, 'matchMedia', {
      value: original,
      configurable: true,
    });
  });

  it('reducedMotion reflects the prefers-reduced-motion media query', () => {
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      value: jest.fn().mockReturnValue({ matches: true }),
      configurable: true,
    });
    expect(component.reducedMotion).toBe(true);
    Object.defineProperty(window, 'matchMedia', {
      value: original,
      configurable: true,
    });
  });

  it('navigateHome navigates to the root route', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate');
    component.navigateHome();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('handleAuthAction logs out and navigates home when authenticated', () => {
    authenticated$.next(true);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate');

    component.handleAuthAction();

    expect(authStateMock.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('handleAuthAction navigates to login when not authenticated', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate');

    component.handleAuthAction();

    expect(authStateMock.logout).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
