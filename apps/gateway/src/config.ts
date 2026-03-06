import * as fs from 'fs';
import * as yaml from 'js-yaml';

import { TcpClientOptions, Transport } from '@nestjs/microservices';

import path from 'path';

const oauthProviders = ['google', 'github', 'microsoft', 'facebook'] as const;
type OAuthProviderName = (typeof oauthProviders)[number];

type GatewayOAuthProviderConfig = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  enabled?: boolean;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userInfoEndpoint?: string;
};

type GatewayOAuthAppOverride = {
  domain?: string;
} & Partial<Record<OAuthProviderName, GatewayOAuthProviderConfig>>;

type GatewayOAuthConfig = Partial<
  Record<OAuthProviderName, GatewayOAuthProviderConfig>
> & {
  apps?: GatewayOAuthAppOverride[];
};

const oauthEnvPrefixes: Record<OAuthProviderName, string> = {
  google: 'GOOGLE',
  github: 'GITHUB',
  microsoft: 'MICROSOFT',
  facebook: 'FACEBOOK',
};

const clientInterfaceOauthEnvPrefixes: Record<OAuthProviderName, string> = {
  google: 'CI_GOOGLE',
  github: 'CI_GITHUB',
  microsoft: 'CI_MICROSOFT',
  facebook: 'CI_FACEBOOK',
};

const isPlaceholderValue = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.startsWith('${') &&
  value.endsWith('}');

const envValue = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

const configValue = (value: string | undefined): string | undefined => {
  if (!value?.trim() || isPlaceholderValue(value.trim())) {
    return undefined;
  }
  return value;
};

const mergeOAuthProviderConfig = (
  provider: OAuthProviderName,
  config?: GatewayOAuthProviderConfig,
  prefixOverrides?: Record<OAuthProviderName, string>
): GatewayOAuthProviderConfig | undefined => {
  if (!config) {
    return undefined;
  }

  const prefix = (prefixOverrides || oauthEnvPrefixes)[provider];
  const clientId = envValue(`${prefix}_CLIENT_ID`) ?? configValue(config.clientId);
  const clientSecret =
    envValue(`${prefix}_CLIENT_SECRET`) ?? configValue(config.clientSecret);
  const redirectUri =
    envValue(`${prefix}_REDIRECT_URI`) ?? configValue(config.redirectUri);

  return {
    ...config,
    clientId,
    clientSecret,
    redirectUri,
    enabled:
      config.enabled !== false && Boolean(clientId && clientSecret && redirectUri),
  };
};

const mergeOAuthAppOverride = (
  appOverride: GatewayOAuthAppOverride
): GatewayOAuthAppOverride => {
  const merged: GatewayOAuthAppOverride = {
    domain: envValue('CLIENT_INTERFACE_DOMAIN') ?? configValue(appOverride.domain),
  };

  for (const provider of oauthProviders) {
    const providerConfig = mergeOAuthProviderConfig(
      provider,
      appOverride[provider],
      clientInterfaceOauthEnvPrefixes
    );
    if (providerConfig) {
      merged[provider] = providerConfig;
    }
  }

  return merged;
};

const mergeOAuthConfig = (
  oauth?: GatewayOAuthConfig
): GatewayOAuthConfig | undefined => {
  if (!oauth) {
    return undefined;
  }

  const merged: GatewayOAuthConfig = {};

  for (const provider of oauthProviders) {
    const providerConfig = mergeOAuthProviderConfig(provider, oauth[provider]);
    if (providerConfig) {
      merged[provider] = providerConfig;
    }
  }

  const appOverrides = (oauth.apps || [])
    .map((entry) => mergeOAuthAppOverride(entry))
    .filter((entry) => {
      if (entry.domain) {
        return true;
      }

      return oauthProviders.some((provider) => {
        const providerConfig = entry[provider];
        return Boolean(
          providerConfig?.clientId ||
            providerConfig?.clientSecret ||
            providerConfig?.redirectUri
        );
      });
    });

  if (appOverrides.length > 0) {
    merged.apps = appOverrides;
  }

  return merged;
};

export type TcpServiceConfig = {
  name:
    | 'authentication'
    | 'profile'
    | 'social'
    | 'tasks'
    | 'project_planning'
    | 'asset'
    | 'chat_collector'
    | 'telos_docs_service'
    | 'ai_orchestration'
    | 'blogging'
    | 'permissions'
    | 'app_configurator'
    | 'store'
    | 'forum'
    | 'finance'
    | 'wellness'
    | 'classifieds'
    | 'payments'
    | 'lead_tracker'
    | 'system_configurator'
    | 'videos';
  transport: Transport;
  options: TcpClientOptions;
  host: string;
  port: number;
};

export type PermissionsCacheConfig = {
  provider: 'memory' | 'file' | 'redis';
  ttl?: number;
  maxSize?: number;
  cacheDir?: string;
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
};

export type Config = {
  listenPort: number;
  auth?: {
    jwtSecret?: string;
  };
  oauth?: GatewayOAuthConfig;
  permissions?: {
    cache?: PermissionsCacheConfig;
  };
  services: {
    asset: TcpServiceConfig;
    authentication: TcpServiceConfig;
    profile: TcpServiceConfig;
    social: TcpServiceConfig;
    tasks: TcpServiceConfig;
    project_planning: TcpServiceConfig;
    chat_collector: TcpServiceConfig;
    telos_docs_service: TcpServiceConfig;
    ai_orchestration: TcpServiceConfig;
    blogging: TcpServiceConfig;
    permissions: TcpServiceConfig;
    app_configurator: TcpServiceConfig;
    store: TcpServiceConfig;
    forum: TcpServiceConfig;
    finance: TcpServiceConfig;
    wellness: TcpServiceConfig;
    classifieds: TcpServiceConfig;
    payments: TcpServiceConfig;
    lead_tracker: TcpServiceConfig;
    system_configurator: TcpServiceConfig;
    videos: TcpServiceConfig;
  };
};

export const loadConfig = (): Config => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const fileContents = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(fileContents) as Config;

  if (process.env.LISTEN_PORT) {
    config.listenPort = parseInt(process.env.LISTEN_PORT, 10);
  }

  if (process.env.JWT_SECRET) {
    config.auth = {
      ...config.auth,
      jwtSecret: process.env.JWT_SECRET,
    };
  }

  config.oauth = mergeOAuthConfig(config.oauth);

  const serviceKeys = Object.keys(config.services) as Array<
    keyof Config['services']
  >;
  serviceKeys.forEach((key) => {
    const envHostKey = `${key.toUpperCase()}_HOST`;
    const envPortKey = `${key.toUpperCase()}_PORT`;

    if (process.env[envHostKey]) {
      config.services[key].host = process.env[envHostKey] as string;
    }

    if (process.env[envPortKey]) {
      const port = parseInt(process.env[envPortKey] as string, 10);
      config.services[key].port = port;
    }
  });

  return config;
};
