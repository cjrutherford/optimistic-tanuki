import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Role {
  id: string;
  name: string;
  description: string;
  appScope?: any;
  permissions?: any[];
  created_at?: Date;
}

export interface CreateRoleDto {
  name: string;
  description: string;
  appScopeId: string;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  appScopeId?: string;
}

export interface AssignRoleDto {
  roleId: string;
  profileId: string;
  appScopeId: string;
}

@Injectable({
  providedIn: 'root',
})
export class RolesService {
  private readonly API_URL = 'http://localhost:3000/permissions';

  constructor(private http: HttpClient) {}

  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.API_URL}/role`);
  }

  getRole(id: string): Observable<Role> {
    return this.http.get<Role>(`${this.API_URL}/role/${id}`);
  }

  createRole(role: CreateRoleDto): Observable<Role> {
    return this.http.post<Role>(`${this.API_URL}/role`, role);
  }

  updateRole(id: string, role: UpdateRoleDto): Observable<Role> {
    return this.http.put<Role>(`${this.API_URL}/role/${id}`, role);
  }

  deleteRole(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/role/${id}`);
  }

  addPermissionToRole(roleId: string, permissionId: string): Observable<any> {
    return this.http.post(`${this.API_URL}/role/${roleId}/permission/${permissionId}`, {});
  }

  removePermissionFromRole(roleId: string, permissionId: string): Observable<any> {
    return this.http.delete(`${this.API_URL}/role/${roleId}/permission/${permissionId}`);
  }

  assignRole(assignment: AssignRoleDto): Observable<any> {
    return this.http.post(`${this.API_URL}/assignment`, assignment);
  }

  unassignRole(assignmentId: string): Observable<any> {
    return this.http.delete(`${this.API_URL}/assignment/${assignmentId}`);
  }

  getUserRoles(profileId: string): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.API_URL}/user-roles/${profileId}`);
  }
}
