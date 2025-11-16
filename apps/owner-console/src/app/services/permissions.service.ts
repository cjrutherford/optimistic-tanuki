import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  targetId?: string;
  appScope?: any;
  created_at?: Date;
}

export interface CreatePermissionDto {
  name: string;
  description: string;
  resource: string;
  action: string;
  targetId?: string;
}

export interface UpdatePermissionDto {
  name?: string;
  description?: string;
  resource?: string;
  action?: string;
  targetId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PermissionsService {
  private readonly API_URL = 'http://localhost:3000/permissions';

  constructor(private http: HttpClient) {}

  getPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.API_URL}/permission`);
  }

  getPermission(id: string): Observable<Permission> {
    return this.http.get<Permission>(`${this.API_URL}/permission/${id}`);
  }

  createPermission(permission: CreatePermissionDto): Observable<Permission> {
    return this.http.post<Permission>(`${this.API_URL}/permission`, permission);
  }

  updatePermission(id: string, permission: UpdatePermissionDto): Observable<Permission> {
    return this.http.put<Permission>(`${this.API_URL}/permission/${id}`, permission);
  }

  deletePermission(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/permission/${id}`);
  }
}
