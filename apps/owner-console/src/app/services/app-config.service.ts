import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AppConfiguration,
  CreateAppConfigDto,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';

@Injectable({
  providedIn: 'root',
})
export class AppConfigService {
  private http = inject(HttpClient);

  private readonly API_URL = '/api/app-config';



  getConfigurations(): Observable<AppConfiguration[]> {
    return this.http.get<AppConfiguration[]>(this.API_URL);
  }

  getConfiguration(id: string): Observable<AppConfiguration> {
    return this.http.get<AppConfiguration>(`${this.API_URL}/${id}`);
  }

  getConfigurationByName(name: string): Observable<AppConfiguration> {
    return this.http.get<AppConfiguration>(`${this.API_URL}/by-name/${name}`);
  }

  getConfigurationByDomain(domain: string): Observable<AppConfiguration> {
    return this.http.get<AppConfiguration>(
      `${this.API_URL}/by-domain/${domain}`
    );
  }

  createConfiguration(dto: CreateAppConfigDto): Observable<AppConfiguration> {
    return this.http.post<AppConfiguration>(this.API_URL, dto);
  }

  updateConfiguration(
    id: string,
    dto: UpdateAppConfigDto
  ): Observable<AppConfiguration> {
    return this.http.put<AppConfiguration>(`${this.API_URL}/${id}`, dto);
  }

  deleteConfiguration(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }
}
