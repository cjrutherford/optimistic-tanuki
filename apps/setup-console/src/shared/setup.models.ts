export type SetupSettingScope = 'global' | 'group' | 'target';

export type SetupSettingValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'url'
  | 'port'
  | 'select'
  | 'secret';

export type SetupInfraKind = 'postgres' | 'redis' | 'seaweedfs';

export interface SetupEnvironmentConfig {
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
}

export interface SetupGatewayConfig {
  publicUrl: string;
  publicWsUrl: string;
  internalUrl: string;
  internalWsUrl: string;
}

export interface SetupServiceDatabaseBinding {
  slotId?: string;
  databaseName?: string;
  username?: string;
  passwordKey?: string;
}

export interface SetupServiceSelection {
  serviceId: string;
  enabled: boolean;
  database?: SetupServiceDatabaseBinding;
}

export interface SetupAppSelection {
  appId: string;
  domain: string;
  uiBaseUrl: string;
  apiBaseUrl: string;
  appType: string;
  visibility: string;
}

export interface SetupOAuthProviderConfig {
  enabled: boolean;
  clientIdKey: string;
  clientSecretKey: string;
  redirectUri: string;
}

export interface SetupDatabaseSlot {
  id: string;
  infra: SetupInfraKind;
  provisionMode: 'managed' | 'external';
  host: string;
  port: number;
  databaseName: string;
  username: string;
  passwordKey: string;
  create?: boolean;
  migrate?: boolean;
  seed?: boolean;
}

export interface SetupSettingsDocument {
  global: Record<string, string>;
  groups: Record<string, Record<string, string>>;
  targets: Record<string, Record<string, string>>;
}

export interface BootstrapConfig {
  version: string;
  environment: SetupEnvironmentConfig;
  gateway?: SetupGatewayConfig;
  services: SetupServiceSelection[];
  apps: SetupAppSelection[];
  oauth: {
    enabled: boolean;
    bridgeAppId: string;
    providers: Record<string, SetupOAuthProviderConfig>;
  };
  databases?: SetupDatabaseSlot[];
  settings?: SetupSettingsDocument;
  wizard?: { currentStep: number; updatedAt: string };
}

export interface SetupSettingsGroup {
  id: string;
  label: string;
  description: string;
}

export interface SetupSettingFieldDescriptor {
  id: string;
  key: string;
  label: string;
  description?: string;
  configPath?: string;
  envKey?: string;
  valueType: SetupSettingValueType;
  scopes: SetupSettingScope[];
  secret: boolean;
  placeholder?: string;
}

export interface SetupSecretFieldDescriptor {
  id: string;
  key: string;
  label: string;
  envKey: string;
  description?: string;
  targetId?: string;
  targetLabel?: string;
}

export interface SetupConnectionRequirement {
  infra: SetupInfraKind;
  fieldId: string;
  label: string;
}

export interface SetupSettingsTarget {
  id: string;
  label: string;
  targetKind: 'app' | 'service';
  groupId: string;
  sourcePath?: string;
  fields: SetupSettingFieldDescriptor[];
  secrets: SetupSecretFieldDescriptor[];
  connections: SetupConnectionRequirement[];
}

export interface SetupSettingsCatalog {
  groups: SetupSettingsGroup[];
  targets: SetupSettingsTarget[];
}
