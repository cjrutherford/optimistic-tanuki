import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BootstrapStatus {
  configured: boolean;
  phase: string;
  checks: Array<{ name: string; status: string; message: string }>;
  wizardStep?: number;
}

export interface ScaffoldOptions {
  name: string;
  target: 'compose' | 'k8s';
  operatorName: string;
  operatorEmail: string;
  services: string[];
}

export interface BootstrapConfig {
  version: string;
  environment: {
    name: string;
    namespace: string;
    targets: string[];
    composeMode: string;
    provider: string;
    imageOwner: string;
    defaultTag: string;
    infra: string[];
    capabilities: string[];
    services: string[];
  };
  gateway?: {
    publicUrl: string;
    publicWsUrl: string;
    internalUrl: string;
    internalWsUrl: string;
  };
  services: Array<{ serviceId: string; enabled: boolean }>;
  apps: Array<{
    appId: string;
    domain: string;
    uiBaseUrl: string;
    apiBaseUrl: string;
    appType: string;
    visibility: string;
  }>;
  oauth: {
    enabled: boolean;
    bridgeAppId: string;
    providers: Record<
      string,
      {
        enabled: boolean;
        clientIdKey: string;
        clientSecretKey: string;
        redirectUri: string;
      }
    >;
  };
  wizard?: {
    currentStep: number;
    updatedAt: string;
  };
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

export interface OAuthValidationResult {
  valid: boolean;
  issues: Array<{ severity: string; provider: string; message: string }>;
}

export interface OAuthTestResult {
  provider: string;
  reachable: boolean;
  credentialValid: boolean;
  authorizationEndpointOk: boolean;
  tokenEndpointOk: boolean;
  userInfoEndpointOk: boolean;
  responseTimeMs: number;
  testedAt: string;
  errors: string[];
}

@Injectable({
  providedIn: 'root',
})
export class BootstrapService {
  private readonly apiUrl = '/admin-api/api';

  constructor(private readonly http: HttpClient) {}

  getStatus(): Observable<BootstrapStatus> {
    return this.http.get<BootstrapStatus>(`${this.apiUrl}/bootstrap/status`);
  }

  getConfig(): Observable<{ success: boolean; data: BootstrapConfig }> {
    return this.http.get<{ success: boolean; data: BootstrapConfig }>(
      `${this.apiUrl}/bootstrap/state`
    );
  }

  saveConfig(config: BootstrapConfig): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(
      `${this.apiUrl}/bootstrap/state`,
      config
    );
  }

  getSecrets(): Observable<{ success: boolean; data: Record<string, string> }> {
    return this.http.get<{ success: boolean; data: Record<string, string> }>(
      `${this.apiUrl}/bootstrap/secrets`
    );
  }

  saveSecrets(
    secrets: Record<string, string>
  ): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(
      `${this.apiUrl}/bootstrap/secrets`,
      secrets
    );
  }

  scaffoldConfig(
    options: ScaffoldOptions
  ): Observable<{ success: boolean; data: unknown }> {
    return this.http.post<{ success: boolean; data: unknown }>(
      `${this.apiUrl}/bootstrap/scaffold`,
      options
    );
  }

  validate(): Observable<{
    valid: boolean;
    issues: Array<{ severity: string; message: string }>;
  }> {
    return this.http.post<{
      valid: boolean;
      issues: Array<{ severity: string; message: string }>;
    }>(`${this.apiUrl}/bootstrap/validate`, {});
  }

  buildImages(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/bootstrap/build-images`,
      {}
    );
  }

  provisionInfraCompose(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/bootstrap/infra-compose`,
      {}
    );
  }

  provisionInfraK8s(
    kubeconfig?: string
  ): Observable<{ success: boolean; message: string }> {
    let url = `${this.apiUrl}/bootstrap/infra-k8s`;
    if (kubeconfig) {
      url += `?kubeconfig=${encodeURIComponent(kubeconfig)}`;
    }
    return this.http.post<{ success: boolean; message: string }>(url, {});
  }

  initDatabases(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/bootstrap/init-databases`,
      {}
    );
  }

  deployServices(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/bootstrap/deploy`,
      {}
    );
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

  getOAuthApps(): Observable<{
    apps: Array<{
      appId: string;
      domain: string;
      oauthEligible: boolean;
      allowedProviders: string[];
      returnToOrigin: string;
    }>;
  }> {
    return this.http.get<{
      apps: Array<{
        appId: string;
        domain: string;
        oauthEligible: boolean;
        allowedProviders: string[];
        returnToOrigin: string;
      }>;
    }>(`${this.apiUrl}/oauth/apps`);
  }

  validateOAuth(): Observable<OAuthValidationResult> {
    return this.http.post<OAuthValidationResult>(
      `${this.apiUrl}/oauth/validate`,
      {}
    );
  }

  testOAuthProvider(provider: string): Observable<OAuthTestResult> {
    return this.http.post<OAuthTestResult>(`${this.apiUrl}/oauth/test`, {
      provider,
    });
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
    }>(`${this.apiUrl}/bootstrap/deploy-all`, {});
  }

  createOwner(
    name: string,
    email: string,
    password: string
  ): Observable<{ userId: string; email: string; name: string }> {
    return this.http.post<{ userId: string; email: string; name: string }>(
      `${this.apiUrl}/bootstrap/owner`,
      { name, email, password }
    );
  }

  activateOwner(): Observable<{ activated: boolean; profile: unknown }> {
    return this.http.post<{ activated: boolean; profile: unknown }>(
      `${this.apiUrl}/bootstrap/owner/activate`,
      {}
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
      `${this.apiUrl}/bootstrap/oauth/configure`,
      { provider, ...config }
    );
  }
}
