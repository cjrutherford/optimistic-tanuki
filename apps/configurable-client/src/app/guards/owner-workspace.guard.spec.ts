import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthSessionService } from '../services/auth-session.service';
import { ownerWorkspaceGuard } from './owner-workspace.guard';

describe('ownerWorkspaceGuard', () => {
  const auth = {
    isSignedIn: false,
    restoreSession: jest.fn<Promise<boolean>, []>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: AuthSessionService, useValue: auth }],
    });
  });

  it('redirects signed-out visitors to login with a safe owner returnTo', async () => {
    auth.isSignedIn = false;
    auth.restoreSession.mockResolvedValue(false);

    const result = await TestBed.runInInjectionContext(() =>
      ownerWorkspaceGuard(
        {} as ActivatedRouteSnapshot,
        {
          url: '/owner/workspace/north-star?tab=release#publish',
        } as RouterStateSnapshot
      )
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/login?returnTo=%2Fowner%2Fworkspace%2Fnorth-star%3Ftab%3Drelease%23publish'
    );
  });

  it('allows an already signed-in session without trusting URL role data', async () => {
    auth.isSignedIn = true;

    await expect(
      TestBed.runInInjectionContext(() =>
        ownerWorkspaceGuard(
          {} as ActivatedRouteSnapshot,
          { url: '/owner' } as RouterStateSnapshot
        )
      )
    ).resolves.toBe(true);
    expect(auth.restoreSession).not.toHaveBeenCalled();
  });
});
