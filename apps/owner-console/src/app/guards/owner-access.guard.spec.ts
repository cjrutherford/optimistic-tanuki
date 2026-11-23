import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService, AuthSessionStatus } from '../services/auth.service';
import {
  OwnerAccess,
  OwnerAccessService,
} from '../services/owner-access.service';
import { OwnerNavLeaf, flattenNav } from '../owner-nav';
import { authGuard } from './auth.guard';
import { noAccessGuard, ownerAccessGuard } from './owner-access.guard';

interface AccessStub {
  load: jest.Mock;
  can: jest.Mock;
}
interface AuthStub {
  status: AuthSessionStatus;
  isAuthenticated: jest.Mock;
}

describe('owner access guards', () => {
  let access: AccessStub;
  let auth: AuthStub;

  const owner: OwnerAccess = {
    status: 'owner',
    all: true,
    permissions: new Set(),
  };

  beforeEach(() => {
    access = { load: jest.fn(() => of(owner)), can: jest.fn(() => true) };
    auth = { status: 'signed-in', isAuthenticated: jest.fn(() => true) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: OwnerAccessService, useValue: access },
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  const serialize = (result: unknown): string =>
    TestBed.inject(Router).serializeUrl(result as UrlTree);

  const run = (url: string): Promise<unknown> =>
    new Promise((resolve) => {
      const result = TestBed.runInInjectionContext(() =>
        ownerAccessGuard(
          {} as ActivatedRouteSnapshot,
          { url } as RouterStateSnapshot
        )
      );
      (result as Observable<unknown>).subscribe(resolve);
    });

  it('lets an owner through', async () => {
    expect(await run('/dashboard/users')).toBe(true);
  });

  it('shows the no-access page to a signed-in non-owner', async () => {
    access.load.mockReturnValue(
      of({ status: 'denied', all: false, permissions: new Set() })
    );
    expect(serialize(await run('/dashboard/users'))).toBe('/no-access');
  });

  it('allows the page when roles could not be verified (server decides)', async () => {
    access.load.mockReturnValue(
      of({ status: 'unverified', all: true, permissions: new Set() })
    );
    expect(await run('/dashboard/users')).toBe(true);
  });

  describe('a leaf that requires a permission', () => {
    const users = flattenNav().find(
      (entry) => entry.leaf.path === '/dashboard/users'
    )?.leaf as OwnerNavLeaf;

    beforeEach(() => {
      users.requiredPermission = 'users.manage';
    });
    afterEach(() => {
      delete users.requiredPermission;
    });

    it('sends an owner without it Home', async () => {
      access.can.mockReturnValue(false);
      expect(serialize(await run('/dashboard/users'))).toBe('/dashboard/home');
      expect(access.can).toHaveBeenCalledWith('users.manage');
    });

    it('lets an owner with it through', async () => {
      access.can.mockReturnValue(true);
      expect(await run('/dashboard/users')).toBe(true);
    });

    it('does not block other pages', async () => {
      access.can.mockReturnValue(false);
      expect(await run('/dashboard/roles')).toBe(true);
    });
  });

  it('redirects a forbidden session to the no-access page from the auth guard', () => {
    auth.status = 'forbidden';
    auth.isAuthenticated.mockReturnValue(false);
    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/dashboard/home' } as RouterStateSnapshot
      )
    );
    expect(serialize(result)).toBe('/no-access');
  });

  it('only shows no-access to signed-in accounts', () => {
    const check = (): unknown =>
      TestBed.runInInjectionContext(() =>
        noAccessGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
      );
    auth.status = 'forbidden';
    expect(check()).toBe(true);
    auth.status = 'signed-in';
    expect(check()).toBe(true);
    auth.status = 'signed-out';
    expect(serialize(check())).toBe('/login');
  });
});
