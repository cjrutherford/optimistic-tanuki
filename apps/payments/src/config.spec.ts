import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { readPaymentsConfig } from './config';

describe('payments config loader', () => {
    const createdDirs: string[] = [];

    afterEach(() => {
        while (createdDirs.length > 0) {
            const dir = createdDirs.pop();
            if (dir) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        }
    });

    const writeConfig = (content: string) => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'payments-config-'));
        createdDirs.push(tempDir);
        const configPath = path.join(tempDir, 'config.yaml');
        fs.writeFileSync(configPath, content, 'utf8');
        return configPath;
    };

    it('loads YAML config with env interpolation and preserves scoped stores', () => {
        const configPath = writeConfig(`
listenPort: 3018
paymentProvider: helcim
paymentFlows:
  donations: helcim
  classifieds: stripe-connect
  business: helcim
  sponsorship: helcim
database:
  host: db
  port: 5432
  username: postgres
  password: postgres
  database: ot_payments
helcim:
  apiToken: "\${HELCIM_API_TOKEN:-yaml-helcim-token}"
  baseUrl: "\${HELCIM_BASE_URL:-https://api.helcim.com}"
  webhookSecret: "\${HELCIM_WEBHOOK_SECRET:-default-webhook-secret}"
stripeConnect:
  default:
    secretKey: yaml-stripe-secret
    publishableKey: yaml-stripe-publishable
    webhookSecret: default-stripe-webhook
  apps:
    local-hub:
      secretKey: local-hub-stripe-secret
      publishableKey: local-hub-stripe-publishable
      webhookSecret: local-hub-stripe-webhook
      connectReturnUrl: http://localhost:8087/account
      connectRefreshUrl: http://localhost:8087/account
lemonSqueezy:
  default:
    apiKey: "\${DEFAULT_API_KEY:-default-api}"
    storeId: "\${DEFAULT_STORE_ID:-default-store}"
    portalUrl: "\${DEFAULT_PORTAL_URL:-https://default.example/billing}"
  stores:
    local-hub:
      apiKey: "\${LOCAL_HUB_API_KEY:-local-hub-api}"
      storeId: local-hub-store
      portalUrl: https://local-hub.example/billing
`);

        const { config, configPath: resolvedPath } = readPaymentsConfig({
            configPath,
            env: {
                DEFAULT_API_KEY: 'resolved-default-api',
                LOCAL_HUB_API_KEY: 'resolved-local-hub-api',
            },
        });

        expect(resolvedPath).toBe(configPath);
        expect(config.paymentProvider).toBe('helcim');
        expect(config.paymentFlows).toEqual({
          donations: 'helcim',
          classifieds: 'stripe-connect',
          business: 'helcim',
          sponsorship: 'helcim',
        });
        expect(config.helcim).toEqual({
            apiToken: 'yaml-helcim-token',
            baseUrl: 'https://api.helcim.com',
            webhookSecret: 'default-webhook-secret',
        });
        expect(config.stripeConnect).toEqual({
          default: {
            secretKey: 'yaml-stripe-secret',
            publishableKey: 'yaml-stripe-publishable',
            webhookSecret: 'default-stripe-webhook',
            connectReturnUrl: '',
            connectRefreshUrl: '',
          },
          apps: {
            'local-hub': {
              secretKey: 'local-hub-stripe-secret',
              publishableKey: 'local-hub-stripe-publishable',
              webhookSecret: 'local-hub-stripe-webhook',
              connectReturnUrl: 'http://localhost:8087/account',
              connectRefreshUrl: 'http://localhost:8087/account',
            },
          },
        });
        expect(config.lemonSqueezy.default).toEqual({
            apiKey: 'resolved-default-api',
            storeId: 'default-store',
            portalUrl: 'https://default.example/billing',
        });
        expect(config.lemonSqueezy.stores['local-hub']).toEqual({
            apiKey: 'resolved-local-hub-api',
            storeId: 'local-hub-store',
            portalUrl: 'https://local-hub.example/billing',
        });
    });

    it('allows legacy default store env overrides without rewriting scoped stores', () => {
        const configPath = writeConfig(`
listenPort: 3018
database:
  host: db
  port: 5432
  username: postgres
  password: postgres
  database: ot_payments
helcim:
  apiToken: yaml-helcim-api-token
  baseUrl: https://api.helcim.com
stripeConnect:
  default:
    secretKey: yaml-stripe-secret
    publishableKey: yaml-stripe-publishable
lemonSqueezy:
  default:
    apiKey: yaml-default-api
    storeId: yaml-default-store
  stores:
    local-hub:
      apiKey: yaml-local-api
      storeId: yaml-local-store
`);

        const { config } = readPaymentsConfig({
            configPath,
            env: {
                LEMON_SQUEEZY_API_KEY: 'env-default-api',
                LEMON_SQUEEZY_STORE_ID: 'env-default-store',
                HELCIM_API_TOKEN: 'env-helcim-token',
            },
        });

        expect(config.helcim.apiToken).toBe('env-helcim-token');
            expect(config.stripeConnect.default.secretKey).toBe('yaml-stripe-secret');
        expect(config.lemonSqueezy.default.apiKey).toBe('env-default-api');
        expect(config.lemonSqueezy.default.storeId).toBe('env-default-store');
        expect(config.lemonSqueezy.stores['local-hub']).toEqual({
            apiKey: 'yaml-local-api',
            storeId: 'yaml-local-store',
            portalUrl: '',
        });
    });

    it('rejects duplicate non-empty store ids across scopes', () => {
        const configPath = writeConfig(`
listenPort: 3018
database:
  host: db
  port: 5432
  username: postgres
  password: postgres
  database: ot_payments
helcim:
  apiToken: default-api-token
  baseUrl: https://api.helcim.com
lemonSqueezy:
  default:
    apiKey: default-api
    storeId: shared-store
  stores:
    local-hub:
      apiKey: local-api
      storeId: shared-store
`);

        expect(() => readPaymentsConfig({ configPath })).toThrow(
            'Duplicate Lemon Squeezy storeId values found'
        );
    });

    it('applies env overrides to flow-specific payment providers', () => {
        const configPath = writeConfig(`
listenPort: 3018
paymentProvider: helcim
paymentFlows:
  donations: helcim
  classifieds: stripe-connect
  business: helcim
  sponsorship: helcim
database:
  host: db
  port: 5432
  username: postgres
  password: postgres
  database: ot_payments
helcim:
  apiToken: yaml-helcim-api-token
  baseUrl: https://api.helcim.com
stripeConnect:
  default:
    secretKey: yaml-stripe-secret
    publishableKey: yaml-stripe-publishable
lemonSqueezy:
  default:
    apiKey: yaml-default-api
    storeId: yaml-default-store
`);

        const { config } = readPaymentsConfig({
            configPath,
            env: {
                PAYMENTS_PROVIDER_CLASSIFIEDS: 'helcim',
                PAYMENTS_PROVIDER_SPONSORSHIP: 'stripe-connect',
            },
        });

        expect(config.paymentFlows.classifieds).toBe('helcim');
        expect(config.paymentFlows.sponsorship).toBe('stripe-connect');
    });

    it('supports scoped Stripe config selection without a default secret', () => {
        const configPath = writeConfig(`
listenPort: 3018
database:
  host: db
  port: 5432
  username: postgres
  password: postgres
  database: ot_payments
helcim:
  apiToken: yaml-helcim-api-token
  baseUrl: https://api.helcim.com
stripeConnect:
  default:
    secretKey: ''
    publishableKey: ''
  apps:
    local-hub:
      secretKey: scoped-secret
      publishableKey: scoped-publishable
lemonSqueezy:
  default:
    apiKey: yaml-default-api
    storeId: yaml-default-store
`);

        const { config } = readPaymentsConfig({ configPath });

        expect(config.stripeConnect.default.secretKey).toBe('');
        expect(config.stripeConnect.apps['local-hub']).toEqual({
            secretKey: 'scoped-secret',
            publishableKey: 'scoped-publishable',
            webhookSecret: '',
            connectReturnUrl: '',
            connectRefreshUrl: '',
        });
    });
});