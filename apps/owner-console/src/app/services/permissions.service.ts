import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PermissionDto, CreatePermissionDto, UpdatePermissionDto } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class PermissionsService {
  private readonly API_URL = '/api/permissions';

  constructor(private http: HttpClient) {}

  getPermissions(): Observable<PermissionDto[]> {
    return this.http.get<PermissionDto[]>(`${this.API_URL}/permission`);
  }

  getPermission(id: string): Observable<PermissionDto> {
    return this.http.get<PermissionDto>(`${this.API_URL}/permission/${id}`);
  }

  createPermission(permission: CreatePermissionDto): Observable<PermissionDto> {
    return this.http.post<PermissionDto>(`${this.API_URL}/permission`, permission);
  }

  updatePermission(id: string, permission: UpdatePermissionDto): Observable<PermissionDto> {
    return this.http.put<PermissionDto>(`${this.API_URL}/permission/${id}`, permission);
  }

  deletePermission(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/permission/${id}`);
  }
}
