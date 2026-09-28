import yaml from 'js-yaml';
import {
  compileClientDeploymentArtifacts,
  ClientDeploymentArtifactInput,
} from './client-deployment-artifacts';

const validInput = (): ClientDeploymentArtifactInput => ({
  acceptedQuote: {
    quoteId: 'Q-2026-0042',
    issuedAt: '2026-09-27T12:00:00.000Z',
    expiresAt: '2026-10-27T12:00:00.000Z',
    applianceTier: 'Tier 2',
    currency: 'USD',
    upfrontTotalCents: 542999,
    lease24MonthlyCents: 24850,
    lease36MonthlyCents: 17800,
    maintenanceMonthlyCents: 7200,
  },
  customer: {
    organization: 'Example Systems',
    contactName: 'Ada Lovelace',
  },
  deployment: {
    imageTag: 'sha-2850755da05286086a098d1dbdaf74f339af2a62',
    gatewayUrl: 'https://gateway.example.test',
    gatewayWsUrl: 'https://gateway.example.test',
    socketUrl: 'https://apps.example.test',
    applicationBundle: 'bto-appliance',
  },
});

describe('compileClientDeploymentArtifacts', () => {
  it('returns parseable Compose, a production env with 256-bit generated secrets, and a customer proposal', () => {
    let calls = 0;
    const artifacts = compileClientDeploymentArtifacts(validInput(), (size) => {
      calls += 1;
      return Buffer.alloc(size, calls);
    });

    const compose = yaml.load(artifacts['docker-compose.client.yml']) as {
      services: Record<
        string,
        {
          image: string;
          environment?: Record<string, string>;
          volumes?: string[];
          command?: string[];
          ports?: string[];
        }
      >;
    };
    expect(Object.keys(compose.services)).toEqual([
      'system-configurator',
      'system-configurator-api',
      'gateway',
      'authentication',
      'profile',
      'admin-api',
      'permissions',
      'lead-tracker',
      'postgres',
      'database-bootstrap',
      'redis',
    ]);
    expect(compose.services['system-configurator'].image).toBe(
      'cjrutherford/optimistic_tanuki_system-configurator:sha-2850755da05286086a098d1dbdaf74f339af2a62'
    );
    expect(compose.services['system-configurator'].environment).toMatchObject({
      NODE_ENV: 'production',
      PORT: '4000',
      GATEWAY_URL: '${GATEWAY_URL:?set GATEWAY_URL in .env}',
      GATEWAY_WS_URL: '${GATEWAY_WS_URL:?set GATEWAY_WS_URL in .env}',
      SOCKET_URL: '${SOCKET_URL:?set SOCKET_URL in .env}',
      SOCKET_PATH: '${SOCKET_PATH:-/socket.io}',
    });

    const envValues = Object.fromEntries(
      artifacts['.env']
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf('=');
          return [line.slice(0, separator), line.slice(separator + 2, -1)];
        })
    ) as Record<string, string>;
    expect(Buffer.from(envValues.POSTGRES_PASSWORD, 'base64url')).toHaveLength(
      32
    );
    expect(Buffer.from(envValues.JWT_SECRET, 'base64url')).toHaveLength(32);
    expect(Buffer.from(envValues.OAUTH_STATE_SECRET, 'base64url')).toHaveLength(
      32
    );
    expect(
      Buffer.from(envValues.ADMIN_API_BOOTSTRAP_TOKEN, 'base64url')
    ).toHaveLength(32);
    expect(compose.services.postgres.environment).toMatchObject({
      POSTGRES_PASSWORD: '${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}',
    });
    expect(
      compose.services['system-configurator-api'].environment
    ).toMatchObject({
      DB_PASSWORD: '${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}',
      SYSTEM_CONFIGURATOR_RUN_MIGRATIONS_ON_START: 'true',
    });
    expect(compose.services['system-configurator-api']).not.toHaveProperty(
      'ports'
    );
    expect(compose.services['admin-api'].ports).toEqual([
      '127.0.0.1:${ADMIN_API_PORT:-8098}:8098',
    ]);
    expect(compose.services['admin-api'].volumes).toEqual([
      'admin_api_bootstrap_state:/app/bootstrap-state',
    ]);
    expect(compose.services['admin-api'].environment).toMatchObject({
      ADMIN_API_BOOTSTRAP_TOKEN:
        '${ADMIN_API_BOOTSTRAP_TOKEN:?ADMIN_API_BOOTSTRAP_TOKEN is required}',
      AUTHENTICATION_HOST: 'authentication',
      PROFILE_HOST: 'profile',
      PERMISSIONS_HOST: 'permissions',
      ADMIN_API_WORKSPACE_ROOT: '/app/bootstrap-state',
    });
    expect(compose.services.gateway.environment).toMatchObject({
      JWT_SECRET: '${JWT_SECRET:?JWT_SECRET is required}',
      OAUTH_STATE_SECRET:
        '${OAUTH_STATE_SECRET:?OAUTH_STATE_SECRET is required}',
      GATEWAY_CONFIG_PATH: '/usr/src/app/hardware-client-config.yaml',
      GATEWAY_COMPOSITION_PATH: '/usr/src/app/hardware-client-composition.yaml',
    });
    expect(compose.services.gateway.environment).not.toHaveProperty(
      'POSTGRES_PASSWORD'
    );
    expect(compose.services.gateway).toMatchObject({
      volumes: [
        './gateway-config.yaml:/usr/src/app/hardware-client-config.yaml:ro',
        './gateway-composition.yaml:/usr/src/app/hardware-client-composition.yaml:ro',
      ],
    });
    expect(compose.services.profile.environment).toMatchObject({
      DATABASE_NAME: 'ot_profile',
      SERVICE_PERMISSIONS_HOST: 'permissions',
    });
    expect(compose.services.permissions.environment).toMatchObject({
      DATABASE_NAME: 'ot_permissions',
    });
    expect(compose.services['lead-tracker'].environment).toMatchObject({
      POSTGRES_DB: 'ot_lead_tracker',
    });
    expect(compose.services.authentication.environment).toMatchObject({
      AUTH_AUTO_VERIFY_EMAILS: 'false',
      POSTGRES_PASSWORD: '${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}',
      OT_RUN_MIGRATIONS_ON_START: 'true',
    });
    expect(compose.services.profile.environment).toMatchObject({
      OT_RUN_MIGRATIONS_ON_START: 'true',
    });
    expect(compose.services.permissions.environment).toMatchObject({
      OT_RUN_MIGRATIONS_ON_START: 'true',
    });
    expect(compose.services.permissions.command).toEqual([
      'sh',
      '-ec',
      'node seed-permissions.js && exec node main.js',
    ]);
    expect(compose.services['lead-tracker'].environment).toMatchObject({
      OT_RUN_MIGRATIONS_ON_START: 'true',
    });
    expect(compose.services.postgres.ports).toBeUndefined();
    expect(compose.services.redis.ports).toBeUndefined();
    expect(artifacts['gateway-composition.yaml']).toBe(
      [
        'enabledServices:',
        '  - authentication',
        '  - lead-tracker',
        '  - permissions',
        '  - profile',
        '  - system-configurator-api',
        '',
      ].join('\n')
    );
    expect(artifacts['gateway-config.yaml']).toContain('host: authentication');
    expect(artifacts['gateway-config.yaml']).toContain(
      'host: system-configurator-api'
    );
    expect(artifacts['bootstrap-owner.mjs']).toContain('/bootstrap/owner');
    expect(artifacts['bootstrap-owner.mjs']).toContain(
      'OWNER_BOOTSTRAP_PASSWORD'
    );
    expect(artifacts['bootstrap-owner.mjs']).not.toContain(
      'console.log(process.env'
    );
    expect(calls).toBe(4);

    expect(artifacts['proposal.md']).toContain('Q-2026-0042');
    expect(artifacts['proposal.md']).toContain(
      'October 27, 2026 at 12:00 PM UTC'
    );
    expect(artifacts['proposal.md']).not.toContain('(inclusive)');
    expect(artifacts['proposal.md']).toContain('$5,429.99');
    expect(artifacts['proposal.md']).toContain('$248.50');
    expect(artifacts['proposal.md']).toContain('$178.00');
    expect(artifacts['proposal.md']).toContain('$72.00');
    expect(artifacts['proposal.md']).not.toMatch(
      /wholesale|marginAmount|wholesaleCost/i
    );
    expect(artifacts['proposal.md']).toContain('PREVIEW — INCOMPLETE');
    expect(artifacts['proposal.md']).toContain(
      'has not yet been verified from a clean customer volume'
    );
    expect(artifacts['proposal.md']).toMatch(/owner sign-in/i);
  });

  it('creates independent secrets for each compilation', () => {
    let value = 0;
    const randomBytes = (size: number) => Buffer.alloc(size, ++value);

    const first = compileClientDeploymentArtifacts(validInput(), randomBytes);
    const second = compileClientDeploymentArtifacts(validInput(), randomBytes);

    expect(first['.env']).not.toBe(second['.env']);
  });

  it('accepts a secure WebSocket URL for the Gateway realtime endpoint', () => {
    const input = validInput();
    input.deployment.gatewayWsUrl = 'wss://gateway.example.test';
    expect(() => compileClientDeploymentArtifacts(input)).not.toThrow();
  });

  it('escapes customer supplied values in YAML and Markdown', () => {
    const input = validInput();
    input.customer.organization = 'Acme: [production]\n# injected';
    input.customer.contactName = '[Click](https://attacker.example)';
    input.deployment.gatewayUrl =
      'https://gateway.example.test/path?x=${UNTRUSTED}:there';

    const artifacts = compileClientDeploymentArtifacts(input, (size) =>
      Buffer.alloc(size, 8)
    );
    const compose = yaml.load(artifacts['docker-compose.client.yml']) as {
      services: Record<string, { environment?: Record<string, string> }>;
    };

    expect(Object.keys(compose.services)).toHaveLength(11);
    expect(
      compose.services['system-configurator'].environment?.GATEWAY_URL
    ).toBe('${GATEWAY_URL:?set GATEWAY_URL in .env}');
    expect(artifacts['.env']).toContain(
      "GATEWAY_URL='https://gateway.example.test/path?x=${UNTRUSTED}:there'"
    );
    expect(artifacts['proposal.md']).toContain(
      'Acme: \\[production\\] \\# injected'
    );
    expect(artifacts['proposal.md']).toContain('\\[Click\\]');
    expect(artifacts['docker-compose.client.yml']).not.toContain('UNTRUSTED');
    expect(artifacts['.env']).not.toContain('SYSTEM_CONFIGURATOR_API_PORT');
  });

  it.each([
    [
      'bad image tag',
      (input: ClientDeploymentArtifactInput) => {
        input.deployment.imageTag = 'latest\nservices:';
      },
    ],
    [
      'unsafe gateway URL',
      (input: ClientDeploymentArtifactInput) => {
        input.deployment.gatewayUrl = 'javascript:alert(1)';
      },
    ],
    [
      'invalid currency',
      (input: ClientDeploymentArtifactInput) => {
        input.acceptedQuote.currency = 'US$';
      },
    ],
    [
      'negative quote amount',
      (input: ClientDeploymentArtifactInput) => {
        input.acceptedQuote.upfrontTotalCents = -1;
      },
    ],
    [
      'expired quote',
      (input: ClientDeploymentArtifactInput) => {
        input.acceptedQuote.expiresAt = '2026-09-01T00:00:00.000Z';
      },
    ],
    [
      'unknown bundle',
      (input: ClientDeploymentArtifactInput) => {
        input.deployment.applicationBundle = 'general-purpose' as never;
      },
    ],
    [
      'missing customer',
      (input: ClientDeploymentArtifactInput) => {
        input.customer.organization = '  ';
      },
    ],
  ])('rejects %s', (_label, mutate) => {
    const input = validInput();
    mutate(input);
    expect(() => compileClientDeploymentArtifacts(input)).toThrow();
  });

  it('requires the secret generator to return exactly 32 bytes', () => {
    expect(() =>
      compileClientDeploymentArtifacts(validInput(), () => Buffer.alloc(31))
    ).toThrow('Secret generator must return exactly 32 bytes.');
  });
});
