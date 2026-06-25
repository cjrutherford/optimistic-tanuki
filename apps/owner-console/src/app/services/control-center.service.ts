import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ControlCenterStatus {
  deploymentName: string;
  namespace: string;
  provider: string;
  defaultTag: string;
  serviceCount: number;
  appCount: number;
  publicHosts: string[];
  oauthEnabled: boolean;
  oauthProviders: number;
}

export interface RolloutPreview {
  deploymentName: string;
  currentTag: string;
  targetTag: string;
  strategy: string;
  batchSize: number;
  services: string[];
  waves: string[][];
}

export interface RolloutState {
  deploymentName: string;
  targetTag: string;
  rollbackTag?: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  batchSize: number;
  services: string[];
  waves: string[][];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface OAuthProviderInspection {
  name: string;
  enabled: boolean;
  clientIdKey: string;
  clientIdPresent: boolean;
  clientSecretKey: string;
  clientSecretPresent: boolean;
  clientSecretPreview: string;
  redirectUri: string;
}

export interface OAuthInspection {
  enabled: boolean;
  bridgeApp: string;
  providers: OAuthProviderInspection[];
}

export interface DeploymentHealth {
  configStatus: 'current' | 'pending-changes';
  infrastructure: 'compose-up' | 'k8s-synced' | 'not-provisioned';
  databaseReadiness: 'all-slots-ready' | 'missing-secrets' | 'slot-mismatch';
  secretsHealth: 'all-keys-present' | 'missing-keys' | 'pending-keys';
  lastDeployed?: {
    timestamp: string;
    tag: string;
    result: 'succeeded' | 'failed';
  };
}

export interface ImageInfo {
  serviceId: string;
  currentTag: string;
  latestTag: string;
  updateAvailable: boolean;
  registry: string;
  image: string;
  pattern: string;
}

export interface RolloutHistoryEntry {
  deploymentName: string;
  targetTag: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  services: string[];
}

export interface OAuthProviderDetail {
  name: string;
  enabled: boolean;
  status: 'configured' | 'pending' | 'error';
  clientIdPresent: boolean;
  clientSecretPresent: boolean;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  scopes: string[];
  validationErrors: string[];
  lastTested: string | null;
}

export interface OAuthAppsInfo {
  apps: Array<{
    appId: string;
    domain: string;
    oauthEligible: boolean;
    allowedProviders: string[];
    returnToOrigin: string;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class ControlCenterService {
  private readonly apiUrl = '/admin-api/api';

  constructor(private readonly http: HttpClient) {}

  getPublicStatus(): Observable<ControlCenterStatus> {
    return this.http.get<ControlCenterStatus>(`${this.apiUrl}/status/public`);
  }

  getRolloutPreview(tag: string): Observable<RolloutPreview> {
    return this.http.get<RolloutPreview>(
      `${this.apiUrl}/rollouts/preview?tag=${encodeURIComponent(tag)}`
    );
  }

  getLatestRollout(): Observable<RolloutState> {
    return this.http.get<RolloutState>(`${this.apiUrl}/rollouts/latest`);
  }

  startRollout(tag: string): Observable<RolloutState> {
    return this.http.post<RolloutState>(`${this.apiUrl}/rollouts/start`, {
      tag,
    });
  }

  getOAuthInspection(): Observable<OAuthInspection> {
    return this.http.get<OAuthInspection>(`${this.apiUrl}/oauth/inspect`);
  }

  getDeploymentHealth(): Observable<DeploymentHealth> {
    return this.http.get<DeploymentHealth>(`${this.apiUrl}/deployment/health`);
  }

  getRolloutHistory(limit = 20): Observable<RolloutHistoryEntry[]> {
    return this.http.get<RolloutHistoryEntry[]>(
      `${this.apiUrl}/rollouts/history?limit=${limit}`
    );
  }

  getImages(): Observable<ImageInfo[]> {
    return this.http.get<ImageInfo[]>(`${this.apiUrl}/deployment/images`);
  }

  getOAuthProviders(): Observable<{
    enabled: boolean;
    bridgeAppId: string;
    bridgeAppDomain: string;
    providers: OAuthProviderDetail[];
  }> {
    return this.http.get<{
      enabled: boolean;
      bridgeAppId: string;
      bridgeAppDomain: string;
      providers: OAuthProviderDetail[];
    }>(`${this.apiUrl}/oauth/providers`);
  }

  getOAuthApps(): Observable<OAuthAppsInfo> {
    return this.http.get<OAuthAppsInfo>(`${this.apiUrl}/oauth/apps`);
  }
}
