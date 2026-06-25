import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { load } from 'js-yaml';

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

export interface OAuthAppsInfo {
  apps: Array<{
    appId: string;
    domain: string;
    oauthEligible: boolean;
    allowedProviders: string[];
    returnToOrigin: string;
  }>;
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

@Injectable()
export class OAuthService {
  private readonly workspaceRoot: string;
  private readonly deploymentPath: string;
  private readonly secretsPath: string;

  constructor(private readonly configService: ConfigService) {
    this.workspaceRoot =
      this.configService.get<string>('admin-api.workspaceRoot') || '.';
    this.deploymentPath =
      this.configService.get<string>('admin-api.deploymentPath') ||
      './ops/deployments/production.yaml';
    this.secretsPath =
      this.configService.get<string>('admin-api.secretsPath') || './.secrets';
  }

  async getProviders(): Promise<{
    enabled: boolean;
    bridgeAppId: string;
    bridgeAppDomain: string;
    providers: OAuthProviderInfo[];
  }> {
    const config = this.loadDeploymentConfig();
    const secrets = this.loadSecrets();
    const providers: OAuthProviderInfo[] = [];

    for (const [name, provider] of Object.entries(config.oauth.providers)) {
      const clientId = secrets[provider.clientIdKey] || '';
      const clientSecret = secrets[provider.clientSecretKey] || '';
      const status = this.getProviderStatus(provider, clientId, clientSecret);

      providers.push({
        name,
        enabled: provider.enabled,
        status,
        clientIdPresent: clientId.length > 0,
        clientSecretPresent: clientSecret.length > 0,
        clientIdKey: provider.clientIdKey,
        clientSecretKey: provider.clientSecretKey,
        redirectUri: provider.redirectUri,
        authorizationEndpoint: this.getAuthEndpoint(name),
        tokenEndpoint: this.getTokenEndpoint(name),
        userInfoEndpoint: this.getUserInfoEndpoint(name),
        scopes: this.getDefaultScopes(name),
        validationErrors: this.getValidationErrors(
          provider,
          clientId,
          clientSecret
        ),
        lastTested: null,
      });
    }

    const bridgeApp = config.apps.find(
      (a) => a.appId === config.oauth.bridgeAppId
    );
    return {
      enabled: config.oauth.enabled,
      bridgeAppId: config.oauth.bridgeAppId,
      bridgeAppDomain: bridgeApp?.domain || '',
      providers,
    };
  }

  async getApps(): Promise<OAuthAppsInfo> {
    const config = this.loadDeploymentConfig();
    const enabledProviders = Object.entries(config.oauth.providers)
      .filter(([, p]) => p.enabled)
      .map(([name]) => name);

    const apps = config.apps.map((app) => ({
      appId: app.appId,
      domain: app.domain,
      oauthEligible: app.appType === 'client' || app.appType === 'admin',
      allowedProviders: enabledProviders,
      returnToOrigin: app.uiBaseUrl,
    }));

    return { apps };
  }

  async validate(): Promise<OAuthValidationResult> {
    const config = this.loadDeploymentConfig();
    const secrets = this.loadSecrets();
    const issues: OAuthValidationResult['issues'] = [];

    if (!config.oauth.enabled) {
      return { valid: true, issues: [] };
    }

    const bridgeApp = config.apps.find(
      (a) => a.appId === config.oauth.bridgeAppId
    );
    if (!bridgeApp) {
      issues.push({
        severity: 'error',
        provider: 'config',
        message: `Bridge app ${config.oauth.bridgeAppId} not found in apps list`,
      });
    }

    for (const [name, provider] of Object.entries(config.oauth.providers)) {
      if (!provider.enabled) continue;

      const clientId = secrets[provider.clientIdKey] || '';
      const clientSecret = secrets[provider.clientSecretKey] || '';

      for (const err of this.getValidationErrors(
        provider,
        clientId,
        clientSecret
      )) {
        issues.push({ severity: 'error', provider: name, message: err });
      }
    }

    return {
      valid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  async testProvider(providerName: string): Promise<OAuthTestResult> {
    const start = Date.now();
    const errors: string[] = [];
    let reachable = true;
    let credentialValid = true;
    let authorizationEndpointOk = true;
    let tokenEndpointOk = true;
    let userInfoEndpointOk = true;

    try {
      const authEndpoint = new URL(this.getAuthEndpoint(providerName));
      await fetch(authEndpoint.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      reachable = false;
      authorizationEndpointOk = false;
      errors.push('Authorization endpoint unreachable');
    }

    try {
      const tokenEndpoint = new URL(this.getTokenEndpoint(providerName));
      const res = await fetch(tokenEndpoint.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=authorization_code&code=invalid&redirect_uri=http://localhost',
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        errors.push('Token endpoint accepted invalid credentials');
        credentialValid = false;
        tokenEndpointOk = false;
      } else if (res.status === 400 || res.status === 401) {
        tokenEndpointOk = true;
      } else {
        tokenEndpointOk = false;
        errors.push(`Token endpoint returned unexpected status ${res.status}`);
      }
    } catch {
      reachable = false;
      tokenEndpointOk = false;
      errors.push('Token endpoint unreachable');
    }

    try {
      const userInfoEndpoint = new URL(this.getUserInfoEndpoint(providerName));
      await fetch(userInfoEndpoint.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      reachable = false;
      userInfoEndpointOk = false;
      errors.push('User info endpoint unreachable');
    }

    return {
      provider: providerName,
      reachable,
      credentialValid,
      authorizationEndpointOk,
      tokenEndpointOk,
      userInfoEndpointOk,
      responseTimeMs: Date.now() - start,
      testedAt: new Date().toISOString(),
      errors,
    };
  }

  private loadDeploymentConfig() {
    const deploymentPath = this.resolveDeploymentPath();
    const content = fs.readFileSync(deploymentPath, 'utf-8');
    return this.parseYaml(content) as {
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
      apps: Array<{
        appId: string;
        domain: string;
        appType: string;
        uiBaseUrl: string;
      }>;
    };
  }

  private loadSecrets(): Record<string, string> {
    const secretsPath = this.resolveSecretsPath();
    if (!fs.existsSync(secretsPath)) {
      return {};
    }
    const content = fs.readFileSync(secretsPath, 'utf-8');
    const secrets: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        secrets[key] = value;
      }
    }
    return secrets;
  }

  private resolveDeploymentPath(): string {
    return path.isAbsolute(this.deploymentPath)
      ? this.deploymentPath
      : path.join(this.workspaceRoot, this.deploymentPath);
  }

  private resolveSecretsPath(): string {
    return path.isAbsolute(this.secretsPath)
      ? this.secretsPath
      : path.join(this.workspaceRoot, this.secretsPath);
  }

  private getProviderStatus(
    provider: {
      enabled: boolean;
      clientIdKey: string;
      clientSecretKey: string;
    },
    clientId: string,
    clientSecret: string
  ): 'configured' | 'pending' | 'error' {
    if (!provider.enabled) return 'pending';
    if (clientId && clientSecret) return 'configured';
    return 'pending';
  }

  private getValidationErrors(
    provider: {
      enabled: boolean;
      clientIdKey: string;
      clientSecretKey: string;
      redirectUri: string;
    },
    clientId: string,
    clientSecret: string
  ): string[] {
    if (!provider.enabled) return [];
    const errors: string[] = [];
    if (!clientId) errors.push('clientId is missing');
    if (!clientSecret) errors.push('clientSecret is missing');
    if (!provider.redirectUri) errors.push('redirectUri is missing');
    return errors;
  }

  private getAuthEndpoint(provider: string): string {
    const endpoints: Record<string, string> = {
      google: 'https://accounts.google.com/o/oauth2/v2/auth',
      github: 'https://github.com/login/oauth/authorize',
      microsoft:
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
    };
    return endpoints[provider] || '';
  }

  private getTokenEndpoint(provider: string): string {
    const endpoints: Record<string, string> = {
      google: 'https://oauth2.googleapis.com/token',
      github: 'https://github.com/login/oauth/access_token',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      facebook: 'https://graph.facebook.com/v18.0/oauth/access_token',
    };
    return endpoints[provider] || '';
  }

  private getUserInfoEndpoint(provider: string): string {
    const endpoints: Record<string, string> = {
      google: 'https://www.googleapis.com/oauth2/v3/userinfo',
      github: 'https://api.github.com/user',
      microsoft: 'https://graph.microsoft.com/oidc/userinfo',
      facebook: 'https://graph.facebook.com/me',
    };
    return endpoints[provider] || '';
  }

  private getDefaultScopes(provider: string): string[] {
    const scopes: Record<string, string[]> = {
      google: ['openid', 'profile', 'email'],
      github: ['read:user', 'user:email'],
      microsoft: ['openid', 'profile', 'email'],
      facebook: ['email', 'public_profile'],
    };
    return scopes[provider] || [];
  }

  private parseYaml(content: string): unknown {
    return load(content);
  }
}
