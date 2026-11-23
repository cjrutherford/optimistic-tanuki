import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { OwnerAccess, OwnerAccessService } from './owner-access.service';

interface AuthStub {
  getSessionUser: jest.Mock;
}

describe('OwnerAccessService', () => {
  let service: OwnerAccessService;
  let http: HttpTestingController;
  const auth: AuthStub = {
    getSessionUser: jest.fn(() => ({ userId: 'u1', profileId: 'p1' })),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(OwnerAccessService);
    http = TestBed.inject(HttpTestingController);
  });

  const load = (): { result: () => OwnerAccess | undefined } => {
    let value: OwnerAccess | undefined;
    service.load().subscribe((v) => (value = v));
    return { result: () => value };
  };

  const request = () =>
    http.expectOne((req) => req.url === '/api/permissions/user-roles/p1');

  it('treats an owner role as full access', () => {
    const { result } = load();
    const req = request();
    expect(req.request.params.get('appScope')).toBe('owner-console');
    req.flush([{ role: { name: 'owner_console_owner' } }]);

    expect(result()?.status).toBe('owner');
    expect(service.can('anything.at.all')).toBe(true);
  });

  it('denies an account with no owner role', () => {
    const { result } = load();
    request().flush([{ role: { name: 'member' } }]);
    expect(result()?.status).toBe('denied');
    expect(service.can('users.manage')).toBe(false);
    expect(service.can(undefined)).toBe(true);
  });

  it('denies on a 403 from the gateway', () => {
    const { result } = load();
    request().flush({}, { status: 403, statusText: 'Forbidden' });
    expect(result()?.status).toBe('denied');
  });

  it('leaves the decision to the server when roles cannot be read', () => {
    const { result } = load();
    request().flush({}, { status: 500, statusText: 'Server Error' });
    expect(result()?.status).toBe('unverified');
    expect(service.can('users.manage')).toBe(true);
  });

  it('denies without a profile and does not call the gateway', () => {
    auth.getSessionUser.mockReturnValueOnce(null);
    const { result } = load();
    http.expectNone(() => true);
    expect(result()?.status).toBe('denied');
  });

  it('caches the answer until reset', () => {
    load();
    request().flush([{ role: { name: 'owner' } }]);
    load();
    http.expectNone(() => true);
    service.reset();
    load();
    request().flush([]);
  });
});
