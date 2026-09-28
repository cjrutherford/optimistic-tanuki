import { randomBytes } from 'node:crypto';

export const CLIENT_DEPLOYMENT_ARTIFACT_NAMES = [
  'docker-compose.client.yml',
  '.env',
  'gateway-config.yaml',
  'gateway-composition.yaml',
  'bootstrap-owner.mjs',
  'proposal.md',
] as const;

export type ClientApplicationBundle = 'bto-appliance';

export interface ClientDeploymentArtifactInput {
  acceptedQuote: {
    quoteId: string;
    issuedAt: string;
    expiresAt: string;
    applianceTier: string;
    currency: string;
    upfrontTotalCents: number;
    lease24MonthlyCents: number;
    lease36MonthlyCents: number;
    maintenanceMonthlyCents: number;
  };
  customer: {
    organization: string;
    contactName: string;
  };
  deployment: {
    imageTag: string;
    gatewayUrl: string;
    gatewayWsUrl: string;
    socketUrl: string;
    applicationBundle: ClientApplicationBundle;
  };
}

export type ClientDeploymentArtifacts = Record<
  (typeof CLIENT_DEPLOYMENT_ARTIFACT_NAMES)[number],
  string
>;

const gatewayConfiguration = [
  'listenPort: 3000',
  'services:',
  '  authentication:',
  '    name: authentication',
  '    transport: TCP',
  '    host: authentication',
  '    port: 3001',
  '  profile:',
  '    name: profile',
  '    transport: TCP',
  '    host: profile',
  '    port: 3002',
  '  permissions:',
  '    name: permissions',
  '    transport: TCP',
  '    host: permissions',
  '    port: 3012',
  '  lead_tracker:',
  '    name: lead_tracker',
  '    transport: TCP',
  '    host: lead-tracker',
  '    port: 3020',
  '  system_configurator:',
  '    name: system_configurator',
  '    transport: TCP',
  '    host: system-configurator-api',
  '    port: 3021',
  '',
].join('\n');

const gatewayComposition = [
  'enabledServices:',
  '  - authentication',
  '  - lead-tracker',
  '  - permissions',
  '  - profile',
  '  - system-configurator-api',
  '',
].join('\n');

const ownerBootstrapScript = [
  '#!/usr/bin/env node',
  'import { readFileSync } from "node:fs";',
  'import { resolve } from "node:path";',
  '',
  'const required = ["OWNER_BOOTSTRAP_NAME", "OWNER_BOOTSTRAP_EMAIL", "OWNER_BOOTSTRAP_PASSWORD"];',
  'for (const key of required) {',
  '  if (!process.env[key]) {',
  '    console.error(`Missing required environment variable: ${key}`);',
  '    process.exit(2);',
  '  }',
  '}',
  '',
  'const envFile = readFileSync(resolve(process.cwd(), ".env"), "utf8");',
  "const token = /^ADMIN_API_BOOTSTRAP_TOKEN='([A-Za-z0-9_-]+)'$/m.exec(envFile)?.[1];",
  'if (!token) {',
  '  console.error("ADMIN_API_BOOTSTRAP_TOKEN is missing from the adjacent .env file.");',
  '  process.exit(2);',
  '}',
  'const base = (process.env.ADMIN_API_BASE_URL || `http://127.0.0.1:${process.env.ADMIN_API_PORT || "8098"}/api`).replace(/\\/+$/, "");',
  'const headers = { "Content-Type": "application/json", "x-admin-bootstrap-token": token };',
  '',
  'const create = await fetch(`${base}/bootstrap/owner`, {',
  '  method: "POST",',
  '  headers,',
  '  body: JSON.stringify({',
  '    name: process.env.OWNER_BOOTSTRAP_NAME,',
  '    email: process.env.OWNER_BOOTSTRAP_EMAIL,',
  '    password: process.env.OWNER_BOOTSTRAP_PASSWORD,',
  '  }),',
  '});',
  'if (!create.ok) {',
  '  console.error(`Owner creation failed with HTTP ${create.status}.`);',
  '  process.exit(1);',
  '}',
  '',
  'const activate = await fetch(`${base}/bootstrap/owner/activate`, {',
  '  method: "POST",',
  '  headers,',
  '  body: JSON.stringify({}),',
  '});',
  'if (!activate.ok) {',
  '  console.error(`Owner activation failed with HTTP ${activate.status}; rerun this script after resolving the issue.`);',
  '  process.exit(1);',
  '}',
  'console.log("The platform owner account is provisioned and setup is marked complete.");',
  '',
].join('\n');

type RandomBytes = (size: number) => Buffer;

const escapeYaml = (value: string): string => JSON.stringify(value);

const escapeEnv = (value: string): string =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const escapeMarkdown = (value: string): string =>
  value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/([`*_{}[\]()#+.!|>])/g, '\\$1');

const formatMoney = (cents: number, currency: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);

const formatTimestamp = (isoDate: string): string =>
  new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: 'UTC',
  }).format(new Date(isoDate));

function requireText(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
}

const requireDate = (value: string, label: string): number => {
  const date = Date.parse(value);
  if (!Number.isFinite(date) || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    throw new Error(`${label} must be a valid ISO timestamp.`);
  }
  return date;
};

function requireAbsoluteUrl(
  value: unknown,
  label: string,
  protocols: string[] = ['http:', 'https:']
): asserts value is string {
  requireText(value, label);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) URL.`);
  }
  if (
    !protocols.includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    /[\r\n\0]/.test(value)
  ) {
    throw new Error(
      `${label} must be an absolute HTTP(S) URL without credentials.`
    );
  }
}

const validate = (input: ClientDeploymentArtifactInput): void => {
  if (!input || typeof input !== 'object')
    throw new Error('Input is required.');
  const quote = input.acceptedQuote;
  const customer = input.customer;
  const deployment = input.deployment;
  if (!quote || !customer || !deployment)
    throw new Error('Quote, customer, and deployment are required.');

  requireText(quote.quoteId, 'Quote ID');
  requireText(quote.applianceTier, 'Appliance tier');
  if (!/^[A-Z]{3}$/.test(quote.currency))
    throw new Error('Currency must be an ISO 4217 code.');
  const issuedAt = requireDate(quote.issuedAt, 'Quote issue date');
  const expiresAt = requireDate(quote.expiresAt, 'Quote expiry date');
  if (expiresAt <= issuedAt || expiresAt <= Date.now()) {
    throw new Error(
      'Accepted quote must expire after its issue date and the current time.'
    );
  }
  for (const [label, amount] of [
    ['Upfront total', quote.upfrontTotalCents],
    ['24-month lease', quote.lease24MonthlyCents],
    ['36-month lease', quote.lease36MonthlyCents],
    ['Monthly maintenance', quote.maintenanceMonthlyCents],
  ] as const) {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new Error(
        `${label} must be a non-negative integer number of cents.`
      );
    }
  }

  requireText(customer.organization, 'Customer organization');
  requireText(customer.contactName, 'Customer contact');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(deployment.imageTag)) {
    throw new Error('Image tag contains unsupported characters.');
  }
  requireAbsoluteUrl(deployment.gatewayUrl, 'Gateway URL');
  requireAbsoluteUrl(deployment.gatewayWsUrl, 'Gateway WebSocket URL', [
    'http:',
    'https:',
    'ws:',
    'wss:',
  ]);
  requireAbsoluteUrl(deployment.socketUrl, 'Socket URL');
  if (deployment.applicationBundle !== 'bto-appliance') {
    throw new Error('Unsupported client application bundle.');
  }
};

export function compileClientDeploymentArtifacts(
  input: ClientDeploymentArtifactInput,
  generateRandomBytes: RandomBytes = randomBytes
): ClientDeploymentArtifacts {
  validate(input);

  const secrets = [
    generateRandomBytes(32),
    generateRandomBytes(32),
    generateRandomBytes(32),
    generateRandomBytes(32),
  ];
  if (
    secrets.some((secret) => !Buffer.isBuffer(secret) || secret.length !== 32)
  ) {
    throw new Error('Secret generator must return exactly 32 bytes.');
  }
  const [
    postgresPassword,
    jwtSecret,
    oauthStateSecret,
    adminApiBootstrapToken,
  ] = secrets.map((secret) => secret.toString('base64url'));
  const socketOrigin = new URL(input.deployment.socketUrl).origin;
  const quote = input.acceptedQuote;
  const envEntries: Array<[string, string]> = [
    ['NODE_ENV', 'production'],
    ['PRODUCTION_IMAGE_TAG', input.deployment.imageTag],
    ['GATEWAY_URL', input.deployment.gatewayUrl],
    ['GATEWAY_WS_URL', input.deployment.gatewayWsUrl],
    ['SOCKET_URL', input.deployment.socketUrl],
    ['SOCKET_PATH', '/socket.io'],
    ['SYSTEM_CONFIGURATOR_PORT', '8091'],
    ['POSTGRES_USER', 'postgres'],
    ['POSTGRES_DB', 'ot_system_configurator'],
    ['POSTGRES_PASSWORD', postgresPassword],
    ['JWT_SECRET', jwtSecret],
    ['OAUTH_STATE_SECRET', oauthStateSecret],
    ['GATEWAY_PORT', '3000'],
    ['ADMIN_API_PORT', '8098'],
    ['ADMIN_API_BOOTSTRAP_TOKEN', adminApiBootstrapToken],
    ['GATEWAY_CHAT_SOCKET_PORT', '3300'],
    ['GATEWAY_SOCIAL_SOCKET_PORT', '3301'],
    ['CORS_ALLOWED_ORIGINS', socketOrigin],
  ];

  const composeServices = [
    [
      '  system-configurator:',
      `    image: ${escapeYaml(
        `cjrutherford/optimistic_tanuki_system-configurator:${input.deployment.imageTag}`
      )}`,
      '    restart: unless-stopped',
      '    ports:',
      '      - "${SYSTEM_CONFIGURATOR_PORT:-8091}:4000"',
      '    environment:',
      '      NODE_ENV: "production"',
      '      PORT: "4000"',
      '      GATEWAY_URL: "${GATEWAY_URL:?set GATEWAY_URL in .env}"',
      '      GATEWAY_WS_URL: "${GATEWAY_WS_URL:?set GATEWAY_WS_URL in .env}"',
      '      SOCKET_URL: "${SOCKET_URL:?set SOCKET_URL in .env}"',
      '      SOCKET_PATH: "${SOCKET_PATH:-/socket.io}"',
      '    depends_on:',
      '      gateway:',
      '        condition: service_healthy',
      '      system-configurator-api:',
      '        condition: service_started',
    ].join('\n'),
    [
      '  system-configurator-api:',
      `    image: ${escapeYaml(
        `cjrutherford/optimistic_tanuki_system-configurator-api:${input.deployment.imageTag}`
      )}`,
      '    restart: unless-stopped',
      '    depends_on:',
      '      database-bootstrap:',
      '        condition: service_completed_successfully',
      '    environment:',
      '      NODE_ENV: "production"',
      '      PORT: "3021"',
      '      DB_HOST: "postgres"',
      '      DB_PORT: "5432"',
      '      DB_USER: "${POSTGRES_USER:-postgres}"',
      '      DB_PASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"',
      '      DB_NAME: "${POSTGRES_DB:-ot_system_configurator}"',
      '      POSTGRES_HOST: "postgres"',
      '      POSTGRES_PORT: "5432"',
      '      POSTGRES_USER: "${POSTGRES_USER:-postgres}"',
      '      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"',
      '      POSTGRES_DB: "${POSTGRES_DB:-ot_system_configurator}"',
      '      PCPARTPICKER_SYNC_ON_START: "false"',
      '      SYSTEM_CONFIGURATOR_RUN_MIGRATIONS_ON_START: "true"',
    ].join('\n'),
    [
      '  gateway:',
      `    image: ${escapeYaml(
        `cjrutherford/optimistic_tanuki_gateway:${input.deployment.imageTag}`
      )}`,
      '    restart: unless-stopped',
      '    depends_on:',
      '      postgres:',
      '        condition: service_healthy',
      '      redis:',
      '        condition: service_healthy',
      '      authentication:',
      '        condition: service_started',
      '      profile:',
      '        condition: service_started',
      '      permissions:',
      '        condition: service_started',
      '      lead-tracker:',
      '        condition: service_started',
      '      system-configurator-api:',
      '        condition: service_started',
      '    ports:',
      '      - "${GATEWAY_PORT:-3000}:3000"',
      '      - "${GATEWAY_CHAT_SOCKET_PORT:-3300}:3300"',
      '      - "${GATEWAY_SOCIAL_SOCKET_PORT:-3301}:3301"',
      '    environment:',
      '      NODE_ENV: "production"',
      '      PORT: "3000"',
      '      LISTEN_PORT: "${GATEWAY_PORT:-3000}"',
      '      SOCKET_PORT: "${GATEWAY_CHAT_SOCKET_PORT:-3300}"',
      '      SOCIAL_SOCKET_PORT: "${GATEWAY_SOCIAL_SOCKET_PORT:-3301}"',
      '      JWT_SECRET: "${JWT_SECRET:?JWT_SECRET is required}"',
      '      OAUTH_STATE_SECRET: "${OAUTH_STATE_SECRET:?OAUTH_STATE_SECRET is required}"',
      '      REDIS_HOST: "redis"',
      '      REDIS_PORT: "6379"',
      '      CORS_ALLOWED_ORIGINS: "${CORS_ALLOWED_ORIGINS:?CORS_ALLOWED_ORIGINS is required}"',
      '      GATEWAY_CONFIG_PATH: "/usr/src/app/hardware-client-config.yaml"',
      '      GATEWAY_COMPOSITION_PATH: "/usr/src/app/hardware-client-composition.yaml"',
      '    volumes:',
      '      - "./gateway-config.yaml:/usr/src/app/hardware-client-config.yaml:ro"',
      '      - "./gateway-composition.yaml:/usr/src/app/hardware-client-composition.yaml:ro"',
      '    healthcheck:',
      '      test: ["CMD", "node", "-e", "fetch(\'http://localhost:3000/api-docs\').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]',
      '      interval: 10s',
      '      timeout: 5s',
      '      retries: 5',
    ].join('\n'),
    [
      '  authentication:',
      `    image: ${escapeYaml(
        `cjrutherford/optimistic_tanuki_authentication:${input.deployment.imageTag}`
      )}`,
      '    restart: unless-stopped',
      '    depends_on:',
      '      database-bootstrap:',
      '        condition: service_completed_successfully',
      '    environment:',
      '      NODE_ENV: "production"',
      '      PORT: "3001"',
      '      POSTGRES_HOST: "db"',
      '      POSTGRES_PORT: "5432"',
      '      POSTGRES_USER: "${POSTGRES_USER:-postgres}"',
      '      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"',
      '      JWT_SECRET: "${JWT_SECRET:?JWT_SECRET is required}"',
      '      AUTH_AUTO_VERIFY_EMAILS: "false"',
      '      OT_RUN_MIGRATIONS_ON_START: "true"',
      '      SMTP_HOST: "${SMTP_HOST:-}"',
      '      SMTP_PORT: "${SMTP_PORT:-465}"',
      '      SMTP_SECURE: "${SMTP_SECURE:-true}"',
      '      SMTP_USER: "${SMTP_USER:-}"',
      '      SMTP_PASS: "${SMTP_PASS:-}"',
      '      SMTP_FROM: "${SMTP_FROM:-}"',
    ].join('\n'),
    [
      '  profile:',
      `    image: ${escapeYaml(
        `cjrutherford/optimistic_tanuki_profile:${input.deployment.imageTag}`
      )}`,
      '    restart: unless-stopped',
      '    depends_on:',
      '      database-bootstrap:',
      '        condition: service_completed_successfully',
      '      permissions:',
      '        condition: service_started',
      '    environment:',
      '      NODE_ENV: "production"',
      '      LISTEN_PORT: "3002"',
      '      DATABASE_HOST: "postgres"',
      '      DATABASE_PORT: "5432"',
      '      DATABASE_USER: "${POSTGRES_USER:-postgres}"',
      '      DATABASE_PASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"',
      '      DATABASE_NAME: "ot_profile"',
      '      SERVICE_PERMISSIONS_HOST: "permissions"',
      '      SERVICE_PERMISSIONS_PORT: "3012"',
      '      OT_RUN_MIGRATIONS_ON_START: "true"',
    ].join('\n'),
    [
      '  admin-api:',
      `    image: ${escapeYaml(
        `cjrutherford/optimistic_tanuki_admin-api:${input.deployment.imageTag}`
      )}`,
      '    restart: unless-stopped',
      '    depends_on:',
      '      authentication:',
      '        condition: service_started',
      '      profile:',
      '        condition: service_started',
      '      permissions:',
      '        condition: service_started',
      '    ports:',
      '      - "127.0.0.1:${ADMIN_API_PORT:-8098}:8098"',
      '    environment:',
      '      NODE_ENV: "production"',
      '      ADMIN_API_PORT: "8098"',
      '      ADMIN_API_BOOTSTRAP_TOKEN: "${ADMIN_API_BOOTSTRAP_TOKEN:?ADMIN_API_BOOTSTRAP_TOKEN is required}"',
      '      ADMIN_API_JWT_SECRET: "${JWT_SECRET:?JWT_SECRET is required}"',
      '      AUTHENTICATION_HOST: "authentication"',
      '      AUTHENTICATION_PORT: "3001"',
      '      PROFILE_HOST: "profile"',
      '      PROFILE_PORT: "3002"',
      '      PERMISSIONS_HOST: "permissions"',
      '      PERMISSIONS_PORT: "3012"',
      '      ADMIN_API_WORKSPACE_ROOT: "/app/bootstrap-state"',
      '      ADMIN_API_DEPLOYMENT_PATH: "/tmp/on-prem-owner-bootstrap/not-configured.yaml"',
      '      ADMIN_API_SECRETS_PATH: "/tmp/on-prem-owner-bootstrap/not-configured.secrets"',
      '    volumes:',
      '      - admin_api_bootstrap_state:/app/bootstrap-state',
    ].join('\n'),
    [
      '  permissions:',
      `    image: ${escapeYaml(
        `cjrutherford/optimistic_tanuki_permissions:${input.deployment.imageTag}`
      )}`,
      '    restart: unless-stopped',
      '    depends_on:',
      '      database-bootstrap:',
      '        condition: service_completed_successfully',
      '    environment:',
      '      NODE_ENV: "production"',
      '      LISTEN_PORT: "3012"',
      '      DATABASE_HOST: "postgres"',
      '      DATABASE_PORT: "5432"',
      '      DATABASE_USER: "${POSTGRES_USER:-postgres}"',
      '      DATABASE_PASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"',
      '      DATABASE_NAME: "ot_permissions"',
      '      OT_RUN_MIGRATIONS_ON_START: "true"',
      '    entrypoint: ["dumb-init", "--"]',
      '    command: ["sh", "-ec", "node seed-permissions.js && exec node main.js"]',
    ].join('\n'),
    [
      '  lead-tracker:',
      `    image: ${escapeYaml(
        `cjrutherford/optimistic_tanuki_lead-tracker:${input.deployment.imageTag}`
      )}`,
      '    restart: unless-stopped',
      '    depends_on:',
      '      database-bootstrap:',
      '        condition: service_completed_successfully',
      '    environment:',
      '      NODE_ENV: "production"',
      '      PORT: "3020"',
      '      POSTGRES_HOST: "postgres"',
      '      POSTGRES_PORT: "5432"',
      '      POSTGRES_USER: "${POSTGRES_USER:-postgres}"',
      '      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"',
      '      POSTGRES_DB: "ot_lead_tracker"',
      '      OT_RUN_MIGRATIONS_ON_START: "true"',
      '      SMTP_HOST: "${SMTP_HOST:-}"',
      '      SMTP_PORT: "${SMTP_PORT:-465}"',
      '      SMTP_SECURE: "${SMTP_SECURE:-true}"',
      '      SMTP_USER: "${SMTP_USER:-}"',
      '      SMTP_PASS: "${SMTP_PASS:-}"',
      '      SMTP_FROM: "${SMTP_FROM:-}"',
    ].join('\n'),
    [
      '  postgres:',
      '    image: "postgres:17"',
      '    restart: unless-stopped',
      '    environment:',
      '      POSTGRES_USER: "${POSTGRES_USER:-postgres}"',
      '      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"',
      '      POSTGRES_DB: "${POSTGRES_DB:-ot_system_configurator}"',
      '    volumes:',
      '      - system_configurator_data:/var/lib/postgresql/data',
      '    networks:',
      '      default:',
      '        aliases:',
      '          - db',
      '    healthcheck:',
      '      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-ot_system_configurator}"]',
      '      interval: 5s',
      '      timeout: 5s',
      '      retries: 5',
    ].join('\n'),
    [
      '  database-bootstrap:',
      '    image: "postgres:17"',
      '    restart: "no"',
      '    depends_on:',
      '      postgres:',
      '        condition: service_healthy',
      '    environment:',
      '      PGHOST: "postgres"',
      '      PGPORT: "5432"',
      '      PGUSER: "${POSTGRES_USER:-postgres}"',
      '      PGPASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"',
      '    entrypoint: ["/bin/sh", "-ec"]',
      `    command: ${escapeYaml(
        'for db in ot_authentication ot_profile ot_permissions ot_lead_tracker ot_system_configurator; do psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = \'$${db}\'" | grep -q 1 || createdb "$${db}"; done'
      )}`,
    ].join('\n'),
    [
      '  redis:',
      '    image: "redis:latest"',
      '    restart: unless-stopped',
      '    healthcheck:',
      '      test: ["CMD", "redis-cli", "ping"]',
      '      interval: 5s',
      '      timeout: 5s',
      '      retries: 5',
    ].join('\n'),
  ].join('\n');

  const proposal = [
    `# Build-to-order appliance proposal`,
    ``,
    `> **PREVIEW — INCOMPLETE. Do not deploy this bundle as a production appliance.**`,
    ``,
    `**Quote:** ${escapeMarkdown(quote.quoteId)}  `,
    `**Prepared for:** ${escapeMarkdown(input.customer.organization)}  `,
    `**Contact:** ${escapeMarkdown(input.customer.contactName)}  `,
    `**Appliance:** ${escapeMarkdown(quote.applianceTier)}  `,
    `**Quote issued:** ${formatTimestamp(quote.issuedAt)}  `,
    `**Quote expires:** ${formatTimestamp(quote.expiresAt)}`,
    ``,
    `## Commercial terms`,
    ``,
    `| Option | Amount |`,
    `| --- | ---: |`,
    `| Outright purchase | ${formatMoney(
      quote.upfrontTotalCents,
      quote.currency
    )} |`,
    `| 24-month lease | ${formatMoney(
      quote.lease24MonthlyCents,
      quote.currency
    )} / month |`,
    `| 36-month lease | ${formatMoney(
      quote.lease36MonthlyCents,
      quote.currency
    )} / month |`,
    `| Monthly maintenance | ${formatMoney(
      quote.maintenanceMonthlyCents,
      quote.currency
    )} / month |`,
    ``,
    `This proposal reflects the accepted quote snapshot identified above. Pricing expires at the stated timestamp.`,
    ``,
    `## Deployment prerequisites`,
    ``,
    `This deployment draft includes only the HAI Computer portal web app, with its API, Gateway, authentication, profile, permissions, Lead Tracker, PostgreSQL, and Redis services. Configure DNS/TLS or an on-premises reverse proxy for the supplied Gateway and socket URLs, and allow the listed service ports on the appliance network.`,
    ``,
    `The generated Compose opts the System Configurator API and the authentication, profile, permissions, and Lead Tracker services into their version-matched database migrations at startup. Permissions are seeded before the permissions service starts. The Admin API is included as a host-only bootstrap backend on 127.0.0.1:8098; it is not an extra web app and has no Docker socket or source workspace mount. A dedicated named volume retains its setup-complete marker. From this directory, set OWNER_BOOTSTRAP_NAME, OWNER_BOOTSTRAP_EMAIL, and OWNER_BOOTSTRAP_PASSWORD in your protected environment, then run node bootstrap-owner.mjs. The script reads its bootstrap token from .env and does not print or persist the owner password.`,
    `After the owner is created, rotate ADMIN_API_BOOTSTRAP_TOKEN in .env to a fresh random value and recreate only the host-only Admin API container (docker compose --env-file .env -f docker-compose.client.yml up -d --force-recreate admin-api). The bootstrap helper should not be run again unless an administrator intentionally provisions another owner.`,
    ``,
    `This path has not yet been verified from a clean customer volume. Until clean-volume migrations, permissions seeding, first-owner provisioning, and owner sign-in are tested together, this bundle remains a preview and owner operations may be unavailable.`,
    ``,
    `Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM before relying on owner notification email. The placeholder values in .env are intentionally empty.`,
    ``,
    `Keep this .env file paired with the named PostgreSQL volume. Generating the bundle again creates new 256-bit secrets; replacing .env on an existing data volume will not rotate the database password and may invalidate existing sessions.`,
    ``,
  ].join('\n');

  return {
    'docker-compose.client.yml': `services:\n${composeServices}\nvolumes:\n  system_configurator_data:\n  admin_api_bootstrap_state:\n`,
    '.env': `${envEntries
      .map(([key, value]) => `${key}=${escapeEnv(value)}`)
      .join('\n')}\n`,
    'gateway-config.yaml': gatewayConfiguration,
    'gateway-composition.yaml': gatewayComposition,
    'bootstrap-owner.mjs': ownerBootstrapScript,
    'proposal.md': proposal,
  };
}
