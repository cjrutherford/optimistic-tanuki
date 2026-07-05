import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  RoleDto,
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
  BulkRoleMutationDto,
  BulkRoleMutationPreviewDto,
  BulkRoleMutationResultDto,
  UserRoleDto,
} from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class RolesService {
  private readonly API_URL = '/api/permissions';

  constructor(private http: HttpClient) {}

  getRoles(): Observable<RoleDto[]> {
    return this.http.get<RoleDto[]>(`${this.API_URL}/role`);
  }

  getRole(id: string): Observable<RoleDto> {
    return this.http.get<RoleDto>(`${this.API_URL}/role/${id}`);
  }

  createRole(role: CreateRoleDto): Observable<RoleDto> {
    return this.http.post<RoleDto>(`${this.API_URL}/role`, role);
  }

  updateRole(id: string, role: UpdateRoleDto): Observable<RoleDto> {
    return this.http.put<RoleDto>(`${this.API_URL}/role/${id}`, role);
  }

  deleteRole(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/role/${id}`);
  }

  addPermissionToRole(roleId: string, permissionId: string): Observable<any> {
    return this.http.post(
      `${this.API_URL}/role/${roleId}/permission/${permissionId}`,
      {}
    );
  }

  removePermissionFromRole(
    roleId: string,
    permissionId: string
  ): Observable<any> {
    return this.http.delete(
      `${this.API_URL}/role/${roleId}/permission/${permissionId}`
    );
  }

  assignRole(assignment: AssignRoleDto): Observable<any> {
    return this.http.post(`${this.API_URL}/assignment`, assignment);
  }

  unassignRole(assignmentId: string): Observable<any> {
    return this.http.delete(`${this.API_URL}/assignment/${assignmentId}`);
  }

  previewBulkRoleMutation(
    mutation: BulkRoleMutationDto
  ): Observable<BulkRoleMutationPreviewDto> {
    return this.http.post<BulkRoleMutationPreviewDto>(
      `${this.API_URL}/assignment/bulk/preview`,
      mutation
    );
  }

  executeBulkRoleMutation(
    mutation: BulkRoleMutationDto
  ): Observable<BulkRoleMutationResultDto> {
    return this.http.post<BulkRoleMutationResultDto>(
      `${this.API_URL}/assignment/bulk`,
      mutation
    );
  }

  getUserRoles(profileId: string): Observable<UserRoleDto[]> {
    return this.http.get<UserRoleDto[]>(
      `${this.API_URL}/user-roles/${profileId}`
    );
  }
}
