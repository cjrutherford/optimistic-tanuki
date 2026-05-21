import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import 'pg';

export declare type OAuthProviderConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  enabled: boolean;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
};

export declare type AuthConfigType = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  auth: {
    jwt_secret: string;
  };
  oauth: {
    google?: OAuthProviderConfig;
    github?: OAuthProviderConfig;
    microsoft?: OAuthProviderConfig;
    facebook?: OAuthProviderConfig;
  };
};

const oauthProviders = ['google', 'github', 'microsoft', 'facebook'] as const;
type OAuthProviderName = (typeof oauthProviders)[number];

const oauthEnvPrefixes: Record<OAuthProviderName, string> = {
  google: 'GOOGLE',
  github: 'GITHUB',
  microsoft: 'MICROSOFT',
  facebook: 'FACEBOOK',
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
  config?: OAuthProviderConfig
): OAuthProviderConfig | undefined => {
  if (!config) {
    return undefined;
  }

  const prefix = oauthEnvPrefixes[provider];
  const clientId = envValue(`${prefix}_CLIENT_ID`) ?? configValue(config.clientId);
  const clientSecret =
    envValue(`${prefix}_CLIENT_SECRET`) ?? configValue(config.clientSecret);
  const redirectUri =
    envValue(`${prefix}_REDIRECT_URI`) ?? configValue(config.redirectUri);

  return {
    ...config,
    clientId: clientId ?? '',
    clientSecret: clientSecret ?? '',
    redirectUri: redirectUri ?? '',
    enabled:
      config.enabled !== false && Boolean(clientId && clientSecret && redirectUri),
  };
};

const mergeOAuthConfig = (
  oauth: AuthConfigType['oauth']
): AuthConfigType['oauth'] => {
  const merged: AuthConfigType['oauth'] = {};

  for (const provider of oauthProviders) {
    const providerConfig = mergeOAuthProviderConfig(provider, oauth?.[provider]);
    if (providerConfig) {
      merged[provider] = providerConfig;
    }
  }

  return merged;
};

const resolveConfigPath = () => {
  const configDir = path.resolve(__dirname, './assets');
  const candidates = [
    path.join(configDir, 'config.yaml'),
    path.join(configDir, 'config.yaml.sample'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Authentication config not found. Expected one of: ${candidates.join(', ')}`
  );
};

const loadConfig = () => {
  const configPath = resolveConfigPath();
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as AuthConfigType;

  return {
    ...configData,
    database: {
      ...configData.database,
      password: process.env.POSTGRES_PASSWORD || configData.database.password,
      username: process.env.POSTGRES_USER || configData.database.username,
    },
    auth: {
      jwt_secret: process.env.JWT_SECRET || configData.auth.jwt_secret,
    },
    oauth: mergeOAuthConfig(configData.oauth),
  };
};

export default loadConfig;
