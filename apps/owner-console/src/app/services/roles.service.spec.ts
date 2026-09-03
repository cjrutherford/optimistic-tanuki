import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RolesService],
    });

    service = TestBed.inject(RolesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists roles', () => {
    let result: unknown;
    service.getRoles().subscribe((r) => (result = r));
    const req = httpMock.expectOne('/api/permissions/role');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'r1' }]);
    expect(result).toEqual([{ id: 'r1' }]);
  });

  it('reads a single role', () => {
    service.getRole('r1').subscribe();
    const req = httpMock.expectOne('/api/permissions/role/r1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'r1' });
  });

  it('creates a role', () => {
    const dto = { name: 'admin' } as never;
    service.createRole(dto).subscribe();
    const req = httpMock.expectOne('/api/permissions/role');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({ id: 'r2' });
  });

  it('updates a role', () => {
    const dto = { name: 'editor' } as never;
    service.updateRole('r1', dto).subscribe();
    const req = httpMock.expectOne('/api/permissions/role/r1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(dto);
    req.flush({ id: 'r1' });
  });

  it('deletes a role', () => {
    service.deleteRole('r1').subscribe();
    const req = httpMock.expectOne('/api/permissions/role/r1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('adds a permission to a role with an empty body', () => {
    service.addPermissionToRole('r1', 'p1').subscribe();
    const req = httpMock.expectOne('/api/permissions/role/r1/permission/p1');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('removes a permission from a role', () => {
    service.removePermissionFromRole('r1', 'p1').subscribe();
    const req = httpMock.expectOne('/api/permissions/role/r1/permission/p1');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('assigns a role', () => {
    const dto = { roleId: 'r1', profileId: 'p1' } as never;
    service.assignRole(dto).subscribe();
    const req = httpMock.expectOne('/api/permissions/assignment');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({});
  });

  it('unassigns a role', () => {
    service.unassignRole('a1').subscribe();
    const req = httpMock.expectOne('/api/permissions/assignment/a1');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('previews a bulk role mutation', () => {
    const dto = { operation: 'assign', roleId: 'r1' } as never;
    service.previewBulkRoleMutation(dto).subscribe();
    const req = httpMock.expectOne('/api/permissions/assignment/bulk/preview');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({});
  });

  it('executes a bulk role mutation', () => {
    const dto = { operation: 'assign', roleId: 'r1' } as never;
    service.executeBulkRoleMutation(dto).subscribe();
    const req = httpMock.expectOne('/api/permissions/assignment/bulk');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({});
  });

  it('reads the roles held by a profile', () => {
    service.getUserRoles('profile-1').subscribe();
    const req = httpMock.expectOne('/api/permissions/user-roles/profile-1');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
