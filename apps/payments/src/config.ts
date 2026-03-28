import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { TcpClientOptions, Transport } from '@nestjs/microservices';
import type {
  PaymentFlow,
  PaymentFlowProviders,
  PaymentProvider,
} from '@optimistic-tanuki/payments-domain';

const CONFIG_PATH_ENV_VARS = ['PAYMENTS_CONFIG_PATH', 'CONFIG_PATH'] as const;
const DEFAULT_CONFIG_FILE = 'config.yaml';

export type TcpServiceConfig = {
  name: 'profile' | 'payments';
  transport: Transport;
  options: TcpClientOptions;
  host: string;
  port: number;
};

export type LemonSqueezyStoreConfig = {
  apiKey: string;
  storeId: string;
  portalUrl?: string;
};

export type LemonSqueezyConfig = {
  default: LemonSqueezyStoreConfig;
  stores: Record<string, LemonSqueezyStoreConfig>;
};

export type HelcimConfig = {
  apiToken: string;
  baseUrl: string;
  webhookSecret?: string;
};

export type StripeConnectAppConfig = {
  secretKey: string;
  publishableKey: string;
  webhookSecret?: string;
  connectReturnUrl?: string;
  connectRefreshUrl?: string;
};

export type StripeConnectConfig = {
  default: StripeConnectAppConfig;
  apps: Record<string, StripeConnectAppConfig>;
};

export type PaymentsConfigType = {
  paymentProvider: PaymentProvider;
  paymentFlows: PaymentFlowProviders;
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  services?: {
    profile: TcpServiceConfig;
  };
  helcim: HelcimConfig;
  stripeConnect: StripeConnectConfig;
  lemonSqueezy: LemonSqueezyConfig;
};

const PAYMENT_FLOWS: PaymentFlow[] = [
  'donations',
  'classifieds',
  'business',
  'sponsorship',
];

export type PaymentsConfigLoadOptions = {
  configPath?: string;
  searchPaths?: string[];
  env?: NodeJS.ProcessEnv;
};

const uniquePaths = (paths: string[]): string[] => {
  return [...new Set(paths.filter(Boolean).map((candidate) => path.resolve(candidate)))];
};

const getDefaultConfigSearchPaths = (): string[] => {
  return uniquePaths([
    path.resolve(__dirname, './assets', DEFAULT_CONFIG_FILE),
    path.resolve(__dirname, '../assets', DEFAULT_CONFIG_FILE),
    path.resolve(process.cwd(), 'assets', DEFAULT_CONFIG_FILE),
    path.resolve(process.cwd(), 'apps/payments/src/assets', DEFAULT_CONFIG_FILE),
    path.resolve(process.cwd(), 'dist/apps/payments/assets', DEFAULT_CONFIG_FILE),
  ]);
};

const interpolateEnvPlaceholders = (
  rawContent: string,
  env: NodeJS.ProcessEnv
): string => {
  return rawContent.replace(
    /\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g,
    (_match: string, key: string, fallback?: string) => env[key] ?? fallback ?? ''
  );
};

const normalizeStoreConfig = (
  storeConfig?: Partial<LemonSqueezyStoreConfig>
): LemonSqueezyStoreConfig => {
  return {
    apiKey: storeConfig?.apiKey || '',
    storeId: storeConfig?.storeId || '',
    portalUrl: storeConfig?.portalUrl || '',
  };
};

const normalizeHelcimConfig = (
  helcimConfig?: Partial<HelcimConfig>,
  env: NodeJS.ProcessEnv = process.env
): HelcimConfig => {
  return {
    apiToken: env.HELCIM_API_TOKEN || helcimConfig?.apiToken || '',
    baseUrl: env.HELCIM_BASE_URL || helcimConfig?.baseUrl || 'https://api.helcim.com',
    webhookSecret:
      env.HELCIM_WEBHOOK_SECRET || helcimConfig?.webhookSecret || '',
  };
};

const normalizeStripeConnectAppConfig = (
  stripeConnectConfig?: Partial<StripeConnectAppConfig>
): StripeConnectAppConfig => {
  return {
    secretKey: stripeConnectConfig?.secretKey || '',
    publishableKey: stripeConnectConfig?.publishableKey || '',
    webhookSecret: stripeConnectConfig?.webhookSecret || '',
    connectReturnUrl: stripeConnectConfig?.connectReturnUrl || '',
    connectRefreshUrl: stripeConnectConfig?.connectRefreshUrl || '',
  };
};

const normalizeStripeConnectConfig = (
  stripeConnectConfig?: Partial<StripeConnectConfig> | Partial<StripeConnectAppConfig>
): StripeConnectConfig => {
  const hasScopedConfig = Boolean(
    stripeConnectConfig &&
      (Object.prototype.hasOwnProperty.call(stripeConnectConfig, 'default') ||
        Object.prototype.hasOwnProperty.call(stripeConnectConfig, 'apps'))
  );
  const scopedConfig = hasScopedConfig
    ? (stripeConnectConfig as Partial<StripeConnectConfig>)
    : undefined;
  const legacyDefaultConfig = hasScopedConfig
    ? undefined
    : (stripeConnectConfig as Partial<StripeConnectAppConfig> | undefined);

  return {
    default: normalizeStripeConnectAppConfig(
      scopedConfig?.default || legacyDefaultConfig
    ),
    apps: Object.fromEntries(
      Object.entries(scopedConfig?.apps || {}).map(([scope, appConfig]) => [
        scope,
        normalizeStripeConnectAppConfig(appConfig),
      ])
    ),
  };
};

const normalizePaymentFlowProviders = (
  paymentFlows: Partial<PaymentFlowProviders> | undefined,
  defaultProvider: PaymentProvider,
  env: NodeJS.ProcessEnv
): PaymentFlowProviders => {
  return Object.fromEntries(
    PAYMENT_FLOWS.map((flow) => {
      const envKey = `PAYMENTS_PROVIDER_${flow.toUpperCase()}`;
      const envOverride = env[envKey] as PaymentProvider | undefined;
      return [flow, envOverride || paymentFlows?.[flow] || defaultProvider];
    })
  ) as PaymentFlowProviders;
};

const validateLemonSqueezyConfig = (config: LemonSqueezyConfig) => {
  const scopedStoreIds = new Map<string, string[]>();
  const allConfigs: Array<[string, LemonSqueezyStoreConfig]> = [
    ['default', config.default],
    ...Object.entries(config.stores),
  ];

  for (const [scope, storeConfig] of allConfigs) {
    if (!storeConfig.storeId) {
      continue;
    }

    const scopes = scopedStoreIds.get(storeConfig.storeId) || [];
    scopes.push(scope);
    scopedStoreIds.set(storeConfig.storeId, scopes);
  }

  const duplicateStoreIds = [...scopedStoreIds.entries()].filter(
    ([, scopes]) => scopes.length > 1
  );

  if (duplicateStoreIds.length > 0) {
    const details = duplicateStoreIds
      .map(([storeId, scopes]) => `${storeId} => ${scopes.join(', ')}`)
      .join('; ');
    throw new Error(`Duplicate Lemon Squeezy storeId values found: ${details}`);
  }
};

const normalizePaymentsConfig = (
  yamlConfig: PaymentsConfigType,
  env: NodeJS.ProcessEnv
): PaymentsConfigType => {
  const helcimConfig = normalizeHelcimConfig(yamlConfig.helcim, env);
  const stripeConnectConfig = normalizeStripeConnectConfig(yamlConfig.stripeConnect);
  const defaultConfig = normalizeStoreConfig(yamlConfig.lemonSqueezy?.default);
  const storesConfig = Object.fromEntries(
    Object.entries(yamlConfig.lemonSqueezy?.stores || {}).map(([scope, storeConfig]) => [
      scope,
      normalizeStoreConfig(storeConfig),
    ])
  );

  const finalConfig: PaymentsConfigType = {
    ...yamlConfig,
    paymentProvider:
      (env.PAYMENTS_PROVIDER as PaymentProvider | undefined) ||
      yamlConfig.paymentProvider ||
      'lemon-squeezy',
    paymentFlows: normalizePaymentFlowProviders(
      yamlConfig.paymentFlows,
      ((env.PAYMENTS_PROVIDER as PaymentProvider | undefined) ||
        yamlConfig.paymentProvider ||
        'lemon-squeezy') as PaymentProvider,
      env
    ),
    helcim: helcimConfig,
    stripeConnect: stripeConnectConfig,
    lemonSqueezy: {
      default: {
        ...defaultConfig,
        apiKey: env.LEMON_SQUEEZY_API_KEY || defaultConfig.apiKey,
        storeId: env.LEMON_SQUEEZY_STORE_ID || defaultConfig.storeId,
      },
      stores: storesConfig,
    },
  };

  validateLemonSqueezyConfig(finalConfig.lemonSqueezy);

  return finalConfig;
};

export const resolvePaymentsConfigPath = (
  options: PaymentsConfigLoadOptions = {}
): string => {
  const env = options.env || process.env;
  const envConfigPath =
    options.configPath || CONFIG_PATH_ENV_VARS.map((key) => env[key]).find(Boolean);
  const candidatePaths = uniquePaths([
    ...(envConfigPath ? [envConfigPath] : []),
    ...(options.searchPaths || getDefaultConfigSearchPaths()),
  ]);

  for (const candidatePath of candidatePaths) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(
    `Could not find payments config.yaml. Checked: ${candidatePaths.join(', ')}`
  );
};

export const readPaymentsConfig = (
  options: PaymentsConfigLoadOptions = {}
): { config: PaymentsConfigType; configPath: string } => {
  const env = options.env || process.env;
  const configPath = resolvePaymentsConfigPath(options);
  const rawConfig = fs.readFileSync(configPath, 'utf8');
  const interpolatedConfig = interpolateEnvPlaceholders(rawConfig, env);
  const yamlConfig = yaml.load(interpolatedConfig) as PaymentsConfigType;

  return {
    config: normalizePaymentsConfig(yamlConfig, env),
    configPath,
  };
};

const loadConfig = () => {
  return readPaymentsConfig().config;
};

export default loadConfig;
