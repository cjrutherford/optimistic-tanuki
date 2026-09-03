import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LandingComponent } from './landing.component';
import { AuthStateService } from '../state/auth-state.service';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;
  const authStateService = {
    restoreSession: jest.fn().mockResolvedValue(false),
  };
  const router = { navigate: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        { provide: AuthStateService, useValue: authStateService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('silently checks for an existing session when the landing route loads', async () => {
    await Promise.resolve();

    expect(authStateService.restoreSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('continues an existing session into the feed', async () => {
    authStateService.restoreSession.mockResolvedValue(true);

    component.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(router.navigate).toHaveBeenCalledWith(['/feed']);
  });

  it('brands the landing page as Optimistic Tanuki with the current community message', () => {
    expect(fixture.nativeElement.textContent).toContain('Optimistic Tanuki');
    expect(fixture.nativeElement.textContent).toContain(
      'Your space. Your people.'
    );
  });

  it('navigates to the login page', () => {
    component.navigateToLogin();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('navigates to the register page', () => {
    component.navigateToRegister();
    expect(router.navigate).toHaveBeenCalledWith(['/register']);
  });

  it('scrolls to the how-it-works section when it is present', () => {
    const scrollIntoView = jest.fn();
    const getElementById = jest
      .spyOn(document, 'getElementById')
      .mockReturnValue({ scrollIntoView } as unknown as HTMLElement);

    component.scrollToHowItWorks();

    expect(getElementById).toHaveBeenCalledWith('how-it-works');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    getElementById.mockRestore();
  });

  it('does nothing when the how-it-works section is missing', () => {
    const getElementById = jest
      .spyOn(document, 'getElementById')
      .mockReturnValue(null);

    expect(() => component.scrollToHowItWorks()).not.toThrow();
    getElementById.mockRestore();
  });

  it('stays on the landing page when the session check throws', async () => {
    authStateService.restoreSession.mockRejectedValue(new Error('offline'));
    router.navigate.mockClear();

    component.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(router.navigate).not.toHaveBeenCalled();
  });
});
