import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { AuthStateService } from './auth-state.service';
import { ProfileService } from './profile/profile.service';
import { ProfileGuard } from './profile.guard';

describe('ProfileGuard', () => {
  let guard: ProfileGuard;
  let router: Router;
  const authStateMock = {
    isAuthenticated$: jest.fn(),
    waitForInitialSessionRestore: jest.fn(),
    restoreSessionAfterInitialFailure: jest.fn(),
    isInitialSessionRestoreComplete: false,
    isAuthenticated: false,
  };
  const profileServiceMock = {
    getAllProfiles: jest.fn(),
    selectProfile: jest.fn(),
  };

  beforeEach(() => {
    authStateMock.isAuthenticated$.mockReset();
    authStateMock.waitForInitialSessionRestore.mockReset();
    authStateMock.restoreSessionAfterInitialFailure.mockReset();
    authStateMock.waitForInitialSessionRestore.mockResolvedValue(false);
    authStateMock.restoreSessionAfterInitialFailure.mockResolvedValue(false);
    authStateMock.isInitialSessionRestoreComplete = false;
    authStateMock.isAuthenticated = false;
    profileServiceMock.getAllProfiles.mockReset();
    profileServiceMock.getAllProfiles.mockResolvedValue(undefined);
    profileServiceMock.selectProfile.mockReset();
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([])],
      providers: [
        ProfileGuard,
        { provide: AuthStateService, useValue: authStateMock },
        { provide: ProfileService, useValue: profileServiceMock },
      ],
    });
    guard = TestBed.inject(ProfileGuard);
    router = TestBed.inject(Router);
  });

  it('waits for a cold cookie-session restore then performs the profile membership check', async () => {
    let resolveRestore!: (restored: boolean) => void;
    const restore = new Promise<boolean>((resolve) => {
      resolveRestore = resolve;
    });
    authStateMock.waitForInitialSessionRestore.mockReturnValue(restore);
    const result = guard.canActivate();

    await Promise.resolve();
    expect(profileServiceMock.getAllProfiles).not.toHaveBeenCalled();

    authStateMock.isAuthenticated = true;
    resolveRestore(true);

    await expect(result).resolves.toBe(true);
    expect(profileServiceMock.getAllProfiles).toHaveBeenCalledTimes(1);
    expect(authStateMock.isAuthenticated$).not.toHaveBeenCalled();
  });

  it('uses the current authenticated state immediately after a successful session restore', async () => {
    authStateMock.isInitialSessionRestoreComplete = true;
    authStateMock.isAuthenticated = true;

    await expect(guard.canActivate()).resolves.toBe(true);
    expect(profileServiceMock.getAllProfiles).toHaveBeenCalledTimes(1);
    expect(authStateMock.waitForInitialSessionRestore).not.toHaveBeenCalled();
  });

  it('redirects an unauthenticated visitor to settings after cold restoration', async () => {
    const navigateSpy = jest.spyOn(router, 'navigate');

    await expect(guard.canActivate()).resolves.toBe(false);
    expect(profileServiceMock.getAllProfiles).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/settings']);
  });

  it('retries the cookie session once after completed readiness before the profile check', async () => {
    authStateMock.isInitialSessionRestoreComplete = true;
    authStateMock.restoreSessionAfterInitialFailure.mockResolvedValue(true);
    const navigateSpy = jest.spyOn(router, 'navigate');

    await expect(guard.canActivate()).resolves.toBe(true);

    expect(
      authStateMock.restoreSessionAfterInitialFailure
    ).toHaveBeenCalledTimes(1);
    expect(profileServiceMock.getAllProfiles).toHaveBeenCalledTimes(1);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
