import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  BootstrapConfig,
  SetupSettingsCatalog,
} from '../../shared/setup.models';

export interface BootstrapStatus {
  configured: boolean;
  phase: string;
  checks: Array<{ name: string; status: string; message: string }>;
  wizardStep?: number;
}

export interface SetupEnvironmentState {
  activeEnvironment: string;
  environments: string[];
}

export interface OAuthProviderInfo {
  name: string;
  enabled: boolean;
  status: 'configured' | 'pending' | 'error';
  clientIdPresent: boolean;
  clientSecretPresent: boolean;
  clientIdKey: string;
  clientSecretKey: string;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  scopes: string[];
  validationErrors: string[];
  lastTested: string | null;
}

@Injectable({ providedIn: 'root' })
export class SetupClientService {
  private readonly apiUrl = '/api/setup';

  constructor(private readonly http: HttpClient) {}

  getStatus(): Observable<BootstrapStatus> {
    return this.http.get<BootstrapStatus>(`${this.apiUrl}/status`);
  }

  getEnvironments(): Observable<SetupEnvironmentState> {
    return this.http.get<SetupEnvironmentState>(`${this.apiUrl}/environments`);
  }

  createEnvironment(
    name: string
  ): Observable<{ success: boolean; data: BootstrapConfig }> {
    return this.http.post<{ success: boolean; data: BootstrapConfig }>(
      `${this.apiUrl}/environments`,
      { name }
    );
  }

  getConfig(
    environment?: string
  ): Observable<{ success: boolean; data: BootstrapConfig }> {
    const query = environment ? `?env=${encodeURIComponent(environment)}` : '';
    return this.http.get<{ success: boolean; data: BootstrapConfig }>(
      `${this.apiUrl}/state${query}`
    );
  }

  saveConfig(
    config: BootstrapConfig,
    environment?: string
  ): Observable<{ success: boolean }> {
    const query = environment ? `?env=${encodeURIComponent(environment)}` : '';
    return this.http.put<{ success: boolean }>(
      `${this.apiUrl}/state${query}`,
      config
    );
  }

  getSettingsCatalog(environment?: string): Observable<SetupSettingsCatalog> {
    const query = environment ? `?env=${encodeURIComponent(environment)}` : '';
    return this.http.get<SetupSettingsCatalog>(
      `${this.apiUrl}/settings/catalog${query}`
    );
  }

  getSecrets(
    environment?: string
  ): Observable<{ success: boolean; data: Record<string, string> }> {
    const query = environment ? `?env=${encodeURIComponent(environment)}` : '';
    return this.http.get<{ success: boolean; data: Record<string, string> }>(
      `${this.apiUrl}/secrets${query}`
    );
  }

  saveSecrets(
    secrets: Record<string, string>,
    environment?: string
  ): Observable<{ success: boolean }> {
    const query = environment ? `?env=${encodeURIComponent(environment)}` : '';
    return this.http.put<{ success: boolean }>(
      `${this.apiUrl}/secrets${query}`,
      secrets
    );
  }

  validate(): Observable<{
    valid: boolean;
    issues: Array<{ severity: string; message: string }>;
  }> {
    return this.http.post<{
      valid: boolean;
      issues: Array<{ severity: string; message: string }>;
    }>(`${this.apiUrl}/validate`, {});
  }

  buildImages(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/build`,
      {}
    );
  }

  provisionInfraCompose(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/infra`,
      {}
    );
  }

  initDatabases(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/db`,
      {}
    );
  }

  deployServices(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/deploy`,
      {}
    );
  }

  deployAll(): Observable<{
    phase?: string;
    success: boolean;
    message: string;
  }> {
    return this.http.post<{
      phase?: string;
      success: boolean;
      message: string;
    }>(`${this.apiUrl}/deploy-all`, {});
  }

  getOAuthProviders(): Observable<{
    enabled: boolean;
    bridgeAppId: string;
    bridgeAppDomain: string;
    providers: OAuthProviderInfo[];
  }> {
    return this.http.get<{
      enabled: boolean;
      bridgeAppId: string;
      bridgeAppDomain: string;
      providers: OAuthProviderInfo[];
    }>(`${this.apiUrl}/oauth/providers`);
  }

  testOAuthProvider(
    provider: string
  ): Observable<{ provider: string; reachable: boolean }> {
    return this.http.post<{ provider: string; reachable: boolean }>(
      `${this.apiUrl}/oauth/test`,
      { provider }
    );
  }

  configureOAuthProvider(
    provider: string,
    config: {
      enabled: boolean;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }
  ): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(
      `${this.apiUrl}/oauth/configure`,
      { provider, ...config }
    );
  }

  createOwner(
    name: string,
    email: string,
    password: string
  ): Observable<{ userId: string; email: string; name: string }> {
    return this.http.post<{ userId: string; email: string; name: string }>(
      `${this.apiUrl}/owner`,
      { name, email, password }
    );
  }

  saveOperator(
    name: string,
    email: string,
    password: string
  ): Observable<{ saved: boolean }> {
    return this.http.post<{ saved: boolean }>(`${this.apiUrl}/save-operator`, {
      name,
      email,
      password,
    });
  }

  activateOwner(): Observable<{ activated: boolean }> {
    return this.http.post<{ activated: boolean }>(
      `${this.apiUrl}/activate`,
      {}
    );
  }
}
