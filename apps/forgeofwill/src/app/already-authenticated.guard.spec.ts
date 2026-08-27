import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { firstValueFrom, of } from 'rxjs';

import { AuthStateService } from './auth-state.service';
import { AlreadyAuthenticatedGuard } from './already-authenticated.guard';

describe('AlreadyAuthenticatedGuard', () => {
  let guard: AlreadyAuthenticatedGuard;
  let router: Router;
  const authStateMock: {
    isAuthenticated$: jest.Mock;
    waitForInitialSessionRestore: jest.Mock;
    isInitialSessionRestoreComplete: boolean;
    isAuthenticated: boolean;
  } = {
    isAuthenticated$: jest.fn(),
    waitForInitialSessionRestore: jest.fn(),
    isInitialSessionRestoreComplete: false,
    isAuthenticated: false,
  };

  beforeEach(() => {
    authStateMock.isAuthenticated$.mockReset();
    authStateMock.waitForInitialSessionRestore.mockReset();
    authStateMock.waitForInitialSessionRestore.mockResolvedValue(false);
    authStateMock.isAuthenticated$.mockReturnValue(of(false));
    authStateMock.isInitialSessionRestoreComplete = false;
    authStateMock.isAuthenticated = false;
    TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([])],
      providers: [
        AlreadyAuthenticatedGuard,
        { provide: AuthStateService, useValue: authStateMock },
      ],
    });
    guard = TestBed.inject(AlreadyAuthenticatedGuard);
    router = TestBed.inject(Router);
  });

  it('waits for a cold cookie-session restore and redirects an authenticated visitor from login to projects', async () => {
    let resolveRestore!: (restored: boolean) => void;
    const sessionRestore = new Promise<boolean>((resolve) => {
      resolveRestore = resolve;
    });
    authStateMock.isAuthenticated$.mockReturnValue(of(false));
    authStateMock.waitForInitialSessionRestore.mockReturnValue(sessionRestore);
    const navigateSpy = jest.spyOn(router, 'navigate');
    const result = firstValueFrom(guard.canActivate());
    let settled = false;
    void result.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    authStateMock.isAuthenticated = true;
    resolveRestore(true);

    await expect(result).resolves.toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/projects']);
  });

  it('admits a visitor when the completed cold restore is unauthenticated', async () => {
    authStateMock.isAuthenticated = false;

    await expect(firstValueFrom(guard.canActivate())).resolves.toBe(true);
    expect(router.url).toBe('/');
  });

  it('admits a logged-out visitor without consulting the completed cold restore again', async () => {
    authStateMock.isInitialSessionRestoreComplete = true;
    authStateMock.isAuthenticated = false;

    await expect(firstValueFrom(guard.canActivate())).resolves.toBe(true);
    expect(authStateMock.waitForInitialSessionRestore).not.toHaveBeenCalled();
  });
});
