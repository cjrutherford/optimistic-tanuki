import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { AuthenticationGuard } from './authentication.guard';

describe('AuthenticationGuard', () => {
  let guard: AuthenticationGuard;
  let router: Router;
  let authStateService: AuthStateService;

  const authStateServiceMock: {
    isAuthenticated$: jest.Mock;
    waitForInitialSessionRestore: jest.Mock;
    restoreSessionAfterInitialFailure: jest.Mock;
    isInitialSessionRestoreComplete?: boolean;
    isAuthenticated?: boolean;
  } = {
    isAuthenticated$: jest.fn(),
    waitForInitialSessionRestore: jest.fn(),
    restoreSessionAfterInitialFailure: jest.fn(),
  };

  beforeEach(() => {
    authStateServiceMock.isAuthenticated$.mockReset();
    authStateServiceMock.waitForInitialSessionRestore.mockReset();
    authStateServiceMock.restoreSessionAfterInitialFailure.mockReset();
    authStateServiceMock.waitForInitialSessionRestore.mockResolvedValue(false);
    authStateServiceMock.restoreSessionAfterInitialFailure.mockResolvedValue(
      false
    );
    authStateServiceMock.isInitialSessionRestoreComplete = false;
    authStateServiceMock.isAuthenticated = false;
    TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([])],
      providers: [
        AuthenticationGuard,
        { provide: AuthStateService, useValue: authStateServiceMock },
      ],
    });
    guard = TestBed.inject(AuthenticationGuard);
    router = TestBed.inject(Router);
    authStateService = TestBed.inject(AuthStateService);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should return true and not navigate for an authenticated user', (done) => {
    authStateServiceMock.isAuthenticated$.mockReturnValue(of(true));
    authStateServiceMock.waitForInitialSessionRestore.mockResolvedValue(true);
    authStateServiceMock.isAuthenticated = true;
    const navigateSpy = jest.spyOn(router, 'navigate');

    guard.canActivate().subscribe((result) => {
      expect(result).toBe(true);
      expect(
        authStateServiceMock.waitForInitialSessionRestore
      ).toHaveBeenCalled();
      expect(navigateSpy).not.toHaveBeenCalled();
      done();
    });
  });

  it('should return false and navigate to /login for an unauthenticated user', (done) => {
    authStateServiceMock.isAuthenticated$.mockReturnValue(of(false));
    authStateServiceMock.isAuthenticated = false;
    const navigateSpy = jest.spyOn(router, 'navigate');

    guard.canActivate().subscribe((result) => {
      expect(result).toBe(false);
      expect(
        authStateServiceMock.waitForInitialSessionRestore
      ).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/login']);
      done();
    });
  });

  it('waits for a valid cookie-session restoration before deciding a cold protected navigation', async () => {
    let resolveSessionRestore!: (restored: boolean) => void;
    const sessionRestore = new Promise<boolean>((resolve) => {
      resolveSessionRestore = resolve;
    });

    authStateServiceMock.isAuthenticated$.mockReturnValue(of(false));
    authStateServiceMock.waitForInitialSessionRestore = jest
      .fn()
      .mockReturnValue(sessionRestore);
    authStateServiceMock.isAuthenticated = true;
    const navigateSpy = jest.spyOn(router, 'navigate');

    const result = firstValueFrom(guard.canActivate());
    resolveSessionRestore(true);

    await expect(result).resolves.toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('uses the current authenticated state after an initial unauthenticated restore and login', async () => {
    let resolveInitialRestore!: (restored: boolean) => void;
    const initialRestore = new Promise<boolean>((resolve) => {
      resolveInitialRestore = resolve;
    });
    authStateServiceMock.waitForInitialSessionRestore.mockReturnValue(
      initialRestore
    );
    const navigateSpy = jest.spyOn(router, 'navigate');

    const coldNavigation = firstValueFrom(guard.canActivate());
    resolveInitialRestore(false);
    await expect(coldNavigation).resolves.toBe(false);

    authStateServiceMock.isInitialSessionRestoreComplete = true;
    authStateServiceMock.isAuthenticated = true;

    await expect(firstValueFrom(guard.canActivate())).resolves.toBe(true);
    expect(
      authStateServiceMock.waitForInitialSessionRestore
    ).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledTimes(1);
  });

  it('retries the cookie session once after completed readiness before redirecting', async () => {
    authStateServiceMock.isInitialSessionRestoreComplete = true;
    authStateServiceMock.isAuthenticated = false;
    authStateServiceMock.restoreSessionAfterInitialFailure.mockResolvedValue(
      true
    );
    const navigateSpy = jest.spyOn(router, 'navigate');

    await expect(firstValueFrom(guard.canActivate())).resolves.toBe(true);

    expect(
      authStateServiceMock.restoreSessionAfterInitialFailure
    ).toHaveBeenCalledTimes(1);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
