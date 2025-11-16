import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AppScope {
  id: string;
  name: string;
  description: string;
  active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateAppScopeDto {
  name: string;
  description: string;
  active: boolean;
}

export interface UpdateAppScopeDto {
  name?: string;
  description?: string;
  active?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AppScopesService {
  private readonly API_URL = 'http://localhost:3000/permissions';

  constructor(private http: HttpClient) {}

  getAppScopes(): Observable<AppScope[]> {
    return this.http.get<AppScope[]>(`${this.API_URL}/app-scope`);
  }

  getAppScope(id: string): Observable<AppScope> {
    return this.http.get<AppScope>(`${this.API_URL}/app-scope/${id}`);
  }

  getAppScopeByName(name: string): Observable<AppScope> {
    return this.http.get<AppScope>(`${this.API_URL}/app-scope/by-name/${name}`);
  }

  createAppScope(appScope: CreateAppScopeDto): Observable<AppScope> {
    return this.http.post<AppScope>(`${this.API_URL}/app-scope`, appScope);
  }

  updateAppScope(id: string, appScope: UpdateAppScopeDto): Observable<AppScope> {
    return this.http.put<AppScope>(`${this.API_URL}/app-scope/${id}`, appScope);
  }

  deleteAppScope(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/app-scope/${id}`);
  }
}
