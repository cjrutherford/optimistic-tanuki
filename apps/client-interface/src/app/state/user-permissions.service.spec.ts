import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { UserPermissionsService } from './user-permissions.service';
import { AuthStateService } from './auth-state.service';

describe('UserPermissionsService', () => {
  let service: UserPermissionsService;
  let httpMock: HttpTestingController;
  let getDecodedTokenValue: jest.Mock;

  beforeEach(() => {
    getDecodedTokenValue = jest.fn().mockReturnValue({
      userId: 'u1',
      name: 'n',
      email: 'e',
      profileId: 'p1',
    });
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        UserPermissionsService,
        { provide: AuthStateService, useValue: { getDecodedTokenValue } },
      ],
    });
    service = TestBed.inject(UserPermissionsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getUserRoles', () => {
    it('requests roles for the profile id in the decoded token', (done) => {
      service.getUserRoles().subscribe((roles) => {
        expect(roles).toEqual(['admin']);
        done();
      });
      const req = httpMock.expectOne('api/permissions/user-roles/p1');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toEqual([]);
      req.flush(['admin']);
    });

    it('adds the appScope query param when one is given', (done) => {
      service.getUserRoles('client-interface').subscribe(() => done());
      const req = httpMock.expectOne(
        (r) =>
          r.url === 'api/permissions/user-roles/p1' &&
          r.params.get('appScope') === 'client-interface'
      );
      req.flush([]);
    });

    it('throws when the decoded token has no profile id', () => {
      getDecodedTokenValue.mockReturnValue({ userId: 'u1' });
      expect(() => service.getUserRoles()).toThrow('No profile id found');
    });

    it('throws when there is no decoded token at all', () => {
      getDecodedTokenValue.mockReturnValue(null);
      expect(() => service.getUserRoles()).toThrow('No profile id found');
    });
  });

  it('checks a permission', (done) => {
    const data = {
      permission: 'post:create',
      appScope: 'client-interface',
      targetId: 't1',
    };
    service.checkPermission(data).subscribe((allowed) => {
      expect(allowed).toBe(true);
      done();
    });
    const req = httpMock.expectOne('api/permissions/check-permission');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush(true);
  });

  it('searches permissions by prefix', async () => {
    const pending = service.searchPermissions('post:');
    const req = httpMock.expectOne(
      (r) =>
        r.url === 'api/permissions/permission-search' &&
        r.params.get('startsWith') === 'post:'
    );
    req.flush(['post:create', 'post:delete']);

    await expect(pending).resolves.toEqual(['post:create', 'post:delete']);
  });
});
