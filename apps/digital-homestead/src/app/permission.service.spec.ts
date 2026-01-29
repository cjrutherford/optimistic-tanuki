import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PermissionService } from './permission.service';
import { AuthStateService } from './auth-state.service';
import { of, BehaviorSubject } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';

describe('PermissionService', () => {
  let service: PermissionService;
  let httpMock: HttpTestingController;
  let authStateService: jest.Mocked<Partial<AuthStateService>>;
  let isAuthenticated$: BehaviorSubject<boolean>;

  const mockProfileId = 'profile-123';
  const mockUserRoles = [
    {
      role: {
        name: 'owner',
        permissions: [
          { name: 'blog.post.create' },
          { name: 'blog.post.update' },
        ],
      },
    },
  ];

  beforeEach(() => {
    isAuthenticated$ = new BehaviorSubject<boolean>(false);
    authStateService = {
      isAuthenticated$: jest.fn(() => isAuthenticated$.asObservable()),
      getProfileId: jest.fn(() => mockProfileId),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        PermissionService,
        { provide: AuthStateService, useValue: authStateService },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(PermissionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Authentication changes', () => {
    it('should load permissions when authenticated', fakeAsync(() => {
      isAuthenticated$.next(true);
      
      const req = httpMock.expectOne(`/api/permissions/user-roles/${mockProfileId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUserRoles);
      tick();

      expect(service.hasFullAccess).toBe(true);
      expect(service.permissionsLoaded).toBe(true);
    }));

    it('should clear permissions when logged out', fakeAsync(() => {
      isAuthenticated$.next(true);
      let req = httpMock.expectOne(`/api/permissions/user-roles/${mockProfileId}`);
      req.flush(mockUserRoles);
      tick();
      expect(service.hasFullAccess).toBe(true);

      isAuthenticated$.next(false);
      tick();
      expect(service.hasFullAccess).toBe(false);
      expect(service.permissionsLoaded).toBe(false);
    }));
  });

  describe('Permission checks', () => {
    beforeEach(fakeAsync(() => {
      isAuthenticated$.next(true);
      const req = httpMock.expectOne(`/api/permissions/user-roles/${mockProfileId}`);
      req.flush(mockUserRoles);
      tick();
    }));

    it('hasPermission should return true for valid permission', () => {
      expect(service.hasPermission('blog.post.create')).toBe(true);
    });

    it('hasPermission should return false for invalid permission', () => {
      expect(service.hasPermission('admin.access')).toBe(false);
    });

    it('hasRole should return true for valid role', () => {
      expect(service.hasRole('owner')).toBe(true);
    });

    it('hasRole should return false for invalid role', () => {
      expect(service.hasRole('visitor')).toBe(false);
    });
  });

  describe('checkFullAccess', () => {
      it('should grant access based on write permissions even if role is not in OWNER_ROLES', fakeAsync(() => {
          const rolesWithWritePerm = [
              {
                  role: {
                      name: 'custom_role',
                      permissions: [{ name: 'blog.post.create' }]
                  }
              }
          ];
          isAuthenticated$.next(true);
          const req = httpMock.expectOne(`/api/permissions/user-roles/${mockProfileId}`);
          req.flush(rolesWithWritePerm);
          tick();
          
          expect(service.hasFullAccess).toBe(true);
      }));
  });

  describe('refreshPermissions', () => {
      it('should reload permissions', fakeAsync(() => {
          isAuthenticated$.next(true);
          let req = httpMock.expectOne(`/api/permissions/user-roles/${mockProfileId}`);
          req.flush([]);
          tick();
          expect(service.hasFullAccess).toBe(false);
          
          service.refreshPermissions();
          req = httpMock.expectOne(`/api/permissions/user-roles/${mockProfileId}`);
          req.flush(mockUserRoles);
          tick();
          
          expect(service.hasFullAccess).toBe(true);
      }));
  });
});
