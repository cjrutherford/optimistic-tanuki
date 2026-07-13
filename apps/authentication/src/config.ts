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

const defaultOAuthProviders: Record<
  OAuthProviderName,
  Omit<OAuthProviderConfig, 'clientId' | 'clientSecret' | 'redirectUri'>
> = {
  google: {
    enabled: false,
    scopes: ['openid', 'email', 'profile'],
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
  },
  github: {
    enabled: false,
    scopes: ['read:user', 'user:email'],
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    userInfoEndpoint: 'https://api.github.com/user',
  },
  microsoft: {
    enabled: false,
    scopes: ['openid', 'email', 'profile', 'User.Read'],
    authorizationEndpoint:
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoEndpoint: 'https://graph.microsoft.com/v1.0/me',
  },
  facebook: {
    enabled: false,
    scopes: ['email', 'public_profile'],
    authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoEndpoint: 'https://graph.facebook.com/v18.0/me',
  },
};

const isPlaceholderValue = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('${') && value.endsWith('}');

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
  const baseConfig = {
    ...defaultOAuthProviders[provider],
    ...(config ?? {}),
  };

  const prefix = oauthEnvPrefixes[provider];
  const clientId =
    envValue(`${prefix}_CLIENT_ID`) ?? configValue(baseConfig.clientId);
  const clientSecret =
    envValue(`${prefix}_CLIENT_SECRET`) ?? configValue(baseConfig.clientSecret);
  const redirectUri =
    envValue(`${prefix}_REDIRECT_URI`) ?? configValue(baseConfig.redirectUri);

  return {
    ...baseConfig,
    clientId: clientId ?? '',
    clientSecret: clientSecret ?? '',
    redirectUri: redirectUri ?? '',
    enabled: Boolean(config && config.enabled !== false),
  };
};

const mergeOAuthConfig = (
  oauth: AuthConfigType['oauth']
): AuthConfigType['oauth'] => {
  const merged: AuthConfigType['oauth'] = {};

  for (const provider of oauthProviders) {
    const providerConfig = mergeOAuthProviderConfig(
      provider,
      oauth?.[provider]
    );
    if (providerConfig) {
      merged[provider] = providerConfig;
    }
  }

  return merged;
};

const resolveConfigPath = () => {
  const configDir = path.resolve(__dirname, './assets');
  const configuredPath = process.env.AUTHENTICATION_CONFIG_PATH?.trim();
  const candidates = configuredPath
    ? [path.resolve(configuredPath)]
    : [
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
