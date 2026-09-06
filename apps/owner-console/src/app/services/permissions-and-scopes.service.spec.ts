import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { PermissionsService } from './permissions.service';
import { AppScopesService } from './app-scopes.service';
import { UsersService } from './users.service';
import { BusinessSiteAdminService } from './business-site-admin.service';

describe('permissions, scopes, users and business site services', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('PermissionsService', () => {
    let service: PermissionsService;

    beforeEach(() => {
      service = TestBed.inject(PermissionsService);
    });

    it('lists permissions', () => {
      let result: unknown;
      service.getPermissions().subscribe((r) => (result = r));
      const req = httpMock.expectOne('/api/permissions/permission');
      expect(req.request.method).toBe('GET');
      req.flush([{ id: 'p1' }]);
      expect(result).toEqual([{ id: 'p1' }]);
    });

    it('reads a single permission', () => {
      service.getPermission('p1').subscribe();
      const req = httpMock.expectOne('/api/permissions/permission/p1');
      expect(req.request.method).toBe('GET');
      req.flush({ id: 'p1' });
    });

    it('creates a permission', () => {
      const dto = { name: 'read' } as never;
      service.createPermission(dto).subscribe();
      const req = httpMock.expectOne('/api/permissions/permission');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({ id: 'p2' });
    });

    it('updates a permission', () => {
      const dto = { name: 'write' } as never;
      service.updatePermission('p1', dto).subscribe();
      const req = httpMock.expectOne('/api/permissions/permission/p1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);
      req.flush({ id: 'p1' });
    });

    it('deletes a permission', () => {
      service.deletePermission('p1').subscribe();
      const req = httpMock.expectOne('/api/permissions/permission/p1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('AppScopesService', () => {
    let service: AppScopesService;

    beforeEach(() => {
      service = TestBed.inject(AppScopesService);
    });

    it('lists app scopes', () => {
      service.getAppScopes().subscribe();
      const req = httpMock.expectOne('/api/permissions/app-scope');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('reads a single app scope', () => {
      service.getAppScope('s1').subscribe();
      const req = httpMock.expectOne('/api/permissions/app-scope/s1');
      expect(req.request.method).toBe('GET');
      req.flush({ id: 's1' });
    });

    it('reads an app scope by name', () => {
      service.getAppScopeByName('owner-console').subscribe();
      const req = httpMock.expectOne(
        '/api/permissions/app-scope/by-name/owner-console'
      );
      expect(req.request.method).toBe('GET');
      req.flush({ id: 's1' });
    });

    it('creates an app scope', () => {
      const dto = { name: 'store' } as never;
      service.createAppScope(dto).subscribe();
      const req = httpMock.expectOne('/api/permissions/app-scope');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({ id: 's2' });
    });

    it('updates an app scope', () => {
      const dto = { name: 'store-v2' } as never;
      service.updateAppScope('s1', dto).subscribe();
      const req = httpMock.expectOne('/api/permissions/app-scope/s1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);
      req.flush({ id: 's1' });
    });

    it('deletes an app scope', () => {
      service.deleteAppScope('s1').subscribe();
      const req = httpMock.expectOne('/api/permissions/app-scope/s1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('UsersService', () => {
    let service: UsersService;

    beforeEach(() => {
      service = TestBed.inject(UsersService);
    });

    it('lists profiles', () => {
      service.getProfiles().subscribe();
      const req = httpMock.expectOne('/api/profile');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('reads a single profile', () => {
      service.getProfile('u1').subscribe();
      const req = httpMock.expectOne('/api/profile/u1');
      expect(req.request.method).toBe('GET');
      req.flush({ id: 'u1' });
    });

    it('updates a profile', () => {
      service.updateProfile('u1', { profileName: 'owner' }).subscribe();
      const req = httpMock.expectOne('/api/profile/u1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ profileName: 'owner' });
      req.flush({ id: 'u1' });
    });
  });

  describe('BusinessSiteAdminService', () => {
    let service: BusinessSiteAdminService;

    beforeEach(() => {
      service = TestBed.inject(BusinessSiteAdminService);
    });

    it('reads the site config', () => {
      service.getSiteConfig().subscribe();
      const req = httpMock.expectOne('/api/business/site-config');
      expect(req.request.method).toBe('GET');
      req.flush({});
    });

    it('flattens the commerce settings payload alongside the config id', () => {
      service
        .updateCommerceSettings('cfg-1', {
          source: 'store',
          storeEnabled: true,
        })
        .subscribe();
      const req = httpMock.expectOne(
        '/api/business/site-config/catalog-source'
      );
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        configId: 'cfg-1',
        source: 'store',
        storeEnabled: true,
      });
      req.flush({});
    });

    it('sends a null config id when no config exists yet', () => {
      service
        .updateCommerceSettings(null, {
          source: 'manual',
          storeEnabled: false,
        })
        .subscribe();
      const req = httpMock.expectOne(
        '/api/business/site-config/catalog-source'
      );
      expect(req.request.body).toEqual({
        configId: null,
        source: 'manual',
        storeEnabled: false,
      });
      req.flush({});
    });
  });
});
