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
    /** Per-domain app overrides. Each entry matches requests by hostname. */
    apps?: Array<{ domain: string } & Partial<Record<string, Partial<OAuthProviderConfig>>>>;
  };
};

const loadConfig = () => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
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
  };
};

export default loadConfig;
