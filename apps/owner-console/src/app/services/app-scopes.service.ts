import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppScopeDto, CreateAppScopeDto, UpdateAppScopeDto } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class AppScopesService {
  private readonly API_URL = '/api/permissions';

  constructor(private http: HttpClient) {}

  getAppScopes(): Observable<AppScopeDto[]> {
    return this.http.get<AppScopeDto[]>(`${this.API_URL}/app-scope`);
  }

  getAppScope(id: string): Observable<AppScopeDto> {
    return this.http.get<AppScopeDto>(`${this.API_URL}/app-scope/${id}`);
  }

  getAppScopeByName(name: string): Observable<AppScopeDto> {
    return this.http.get<AppScopeDto>(`${this.API_URL}/app-scope/by-name/${name}`);
  }

  createAppScope(appScope: CreateAppScopeDto): Observable<AppScopeDto> {
    return this.http.post<AppScopeDto>(`${this.API_URL}/app-scope`, appScope);
  }

  updateAppScope(id: string, appScope: UpdateAppScopeDto): Observable<AppScopeDto> {
    return this.http.put<AppScopeDto>(`${this.API_URL}/app-scope/${id}`, appScope);
  }

  deleteAppScope(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/app-scope/${id}`);
  }
}
