import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  BootstrapConfig,
  SetupDeployProgressSnapshot,
  SetupHostPathListing,
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
  clientIdValue: string;
  clientSecretValue: string;
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

export interface SavedOperatorInfo {
  name: string;
  email: string;
  passwordSaved: boolean;
  source: 'saved' | 'existing' | 'saved-existing';
  existingUser: boolean;
  existingCount: number;
  userId?: string;
}

export interface OAuthAppsInfo {
  bridgeAppId: string;
  bridgeAppDomain: string;
  bridgeAppBaseUrl: string;
  apps: Array<{
    appId: string;
    domain: string;
    oauthEligible: boolean;
    allowedProviders: string[];
    returnToOrigin: string;
  }>;
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

  takeOverDeployment(input: {
    deploymentPath: string;
    secretsPath?: string;
    environmentName?: string;
  }): Observable<{
    success: boolean;
    data: BootstrapConfig;
    environment: string;
  }> {
    return this.http.post<{
      success: boolean;
      data: BootstrapConfig;
      environment: string;
    }>(`${this.apiUrl}/takeover`, input);
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

  browseHostPath(currentPath?: string): Observable<SetupHostPathListing> {
    const query = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
    return this.http.get<SetupHostPathListing>(
      `${this.apiUrl}/host-paths${query}`
    );
  }

  uploadManagedFile(input: {
    environment?: string;
    filename: string;
    contentBase64: string;
  }): Observable<{ success: boolean; path: string }> {
    return this.http.post<{ success: boolean; path: string }>(
      `${this.apiUrl}/managed-files`,
      input
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

  getDeployProgress(): Observable<SetupDeployProgressSnapshot> {
    return this.http.get<SetupDeployProgressSnapshot>(
      `${this.apiUrl}/deploy-progress`
    );
  }

  getOAuthProviders(environment?: string): Observable<{
    enabled: boolean;
    bridgeAppId: string;
    bridgeAppDomain: string;
    bridgeAppBaseUrl: string;
    providers: OAuthProviderInfo[];
  }> {
    const query = environment ? `?env=${encodeURIComponent(environment)}` : '';
    return this.http.get<{
      enabled: boolean;
      bridgeAppId: string;
      bridgeAppDomain: string;
      bridgeAppBaseUrl: string;
      providers: OAuthProviderInfo[];
    }>(`${this.apiUrl}/oauth/providers${query}`);
  }

  getOperatorSummary(): Observable<{
    saved: boolean;
    operator: SavedOperatorInfo | null;
  }> {
    return this.http.get<{
      saved: boolean;
      operator: SavedOperatorInfo | null;
    }>(`${this.apiUrl}/operator`);
  }

  getOAuthApps(environment?: string): Observable<OAuthAppsInfo> {
    const query = environment ? `?env=${encodeURIComponent(environment)}` : '';
    return this.http.get<OAuthAppsInfo>(`${this.apiUrl}/oauth/apps${query}`);
  }

  testOAuthProvider(
    provider: string,
    environment?: string
  ): Observable<{ provider: string; reachable: boolean }> {
    const query = environment ? `?env=${encodeURIComponent(environment)}` : '';
    return this.http.post<{ provider: string; reachable: boolean }>(
      `${this.apiUrl}/oauth/test${query}`,
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
    },
    environment?: string
  ): Observable<{ success: boolean }> {
    const query = environment ? `?env=${encodeURIComponent(environment)}` : '';
    return this.http.put<{ success: boolean }>(
      `${this.apiUrl}/oauth/configure${query}`,
      { provider, ...config }
    );
  }

  createOwner(
    name: string,
    email: string,
    password: string
  ): Observable<{
    userId: string;
    profileId: string;
    email: string;
    name: string;
  }> {
    return this.http.post<{
      userId: string;
      profileId: string;
      email: string;
      name: string;
    }>(`${this.apiUrl}/owner`, { name, email, password });
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
