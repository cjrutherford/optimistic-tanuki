import { ConfigService } from '@nestjs/config';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom, of } from 'rxjs';
import { ClientProxyFactory } from '@nestjs/microservices';
import { RoleCommands } from '@optimistic-tanuki/constants';
import { normalizeGatewayComposition } from '@optimistic-tanuki/constants';
import {
  createMcpToolImports,
  createGatewayServiceProviders,
  DisabledClientProxy,
} from './gateway-service-providers';
import { McpServerModule } from './mcp/mcp-tools.module';
import { ProjectPlanningMcpToolsModule } from './mcp/mcp-tools.module';
import { TelosDocsMcpToolsModule } from './mcp/mcp-tools.module';
import { VaultMcpToolsModule } from './mcp/vault-mcp-tools.module';

describe('gateway service providers', () => {
  it('returns disabled proxies for services outside the composition', async () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['authentication', 'profile'],
      },
      ['authentication', 'profile', 'store']
    );
    const providers = createGatewayServiceProviders(composition);
    const storeProvider = providers.find(
      (provider) => provider.provide === ServiceTokens.STORE_SERVICE
    );

    const proxy = storeProvider!.useFactory!(
      {} as ConfigService
    ) as DisabledClientProxy;

    expect(proxy).toBeInstanceOf(DisabledClientProxy);
    await expect(proxy.connect()).resolves.toBeUndefined();
    await expect(
      firstValueFrom(proxy.send({ cmd: 'noop' }, {}))
    ).rejects.toThrow('Gateway service "store" is disabled');
  });

  it('creates real proxies for enabled services', () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['authentication'],
      },
      ['authentication', 'store']
    );
    const providers = createGatewayServiceProviders(composition);
    const authProvider = providers.find(
      (provider) => provider.provide === ServiceTokens.AUTHENTICATION_SERVICE
    );
    const configService = {
      get: jest.fn().mockReturnValue({
        host: 'authentication',
        port: 3001,
      }),
    } as unknown as ConfigService;

    const proxy = authProvider!.useFactory!(configService);

    expect(proxy).not.toBeInstanceOf(DisabledClientProxy);
  });

  it('creates TCP proxies pointed at the configured host and port', () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['authentication'],
      },
      ['authentication', 'store']
    );
    const providers = createGatewayServiceProviders(composition);
    const authProvider = providers.find(
      (provider) => provider.provide === ServiceTokens.AUTHENTICATION_SERVICE
    );
    const configService = {
      get: jest.fn().mockReturnValue({
        host: 'authentication',
        port: 3001,
      }),
    } as unknown as ConfigService;

    const proxy = authProvider!.useFactory!(configService) as unknown as {
      host: string;
      port: number;
    };

    // The TCP client is lazy (no socket opened until connect()), so we can
    // safely assert it was pointed at the configured host/port.
    expect(proxy.host).toBe('authentication');
    expect(proxy.port).toBe(3001);
  });

  it('wraps only the configured permissions client with awaited cache invalidation', async () => {
    const composition = normalizeGatewayComposition(
      { enabledServices: ['permissions', 'authentication'] },
      ['permissions', 'authentication']
    );
    const providers = createGatewayServiceProviders(composition);
    const permissionsProvider = providers.find(
      (provider) => provider.provide === ServiceTokens.PERMISSIONS_SERVICE
    );
    const authProvider = providers.find(
      (provider) => provider.provide === ServiceTokens.AUTHENTICATION_SERVICE
    );
    const fakeClient = {
      send: jest.fn().mockReturnValue(of({ profileId: 'p-1' })),
      connect: jest.fn(),
    };
    const create = jest
      .spyOn(ClientProxyFactory, 'create')
      .mockReturnValue(fakeClient as any);
    const config = {
      get: jest.fn().mockReturnValue({ host: 'permissions', port: 3000 }),
    } as unknown as ConfigService;
    const cache = {
      invalidateProfile: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    try {
      const permissionsClient = permissionsProvider!.useFactory!(
        config,
        cache as any
      );
      await firstValueFrom(
        permissionsClient.send(
          { cmd: RoleCommands.Assign },
          { profileId: 'p-1' }
        )
      );
      expect(cache.invalidateProfile).toHaveBeenCalledWith('p-1');

      authProvider!.useFactory!(config);
      expect(create).toHaveBeenCalledTimes(2);
    } finally {
      create.mockRestore();
    }
  });

  it('creates a billing TCP proxy pointed at the configured host and port', () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['billing'],
      },
      ['billing', 'store']
    );
    const providers = createGatewayServiceProviders(composition);
    const billingProvider = providers.find(
      (provider) => provider.provide === ServiceTokens.BILLING_SERVICE
    );
    const configService = {
      get: jest.fn().mockReturnValue({
        host: 'billing',
        port: 3019,
      }),
    } as unknown as ConfigService;

    const proxy = billingProvider!.useFactory!(configService) as unknown as {
      host: string;
      port: number;
    };

    // The TCP client is lazy (no socket opened until connect()), so we can
    // safely assert it was pointed at the configured host/port.
    expect(proxy).not.toBeInstanceOf(DisabledClientProxy);
    expect(proxy.host).toBe('billing');
    expect(proxy.port).toBe(3019);
  });

  it('returns a disabled billing proxy when billing is outside the composition', async () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['authentication'],
      },
      ['authentication', 'billing']
    );
    const providers = createGatewayServiceProviders(composition);
    const billingProvider = providers.find(
      (provider) => provider.provide === ServiceTokens.BILLING_SERVICE
    );

    const proxy = billingProvider!.useFactory!(
      {} as ConfigService
    ) as DisabledClientProxy;

    expect(proxy).toBeInstanceOf(DisabledClientProxy);
    await expect(
      firstValueFrom(proxy.send({ cmd: 'noop' }, {}))
    ).rejects.toThrow('Gateway service "billing" is disabled');
  });

  it('creates a payments TCP proxy pointed at the configured host and port', () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['payments'],
      },
      ['payments', 'store']
    );
    const providers = createGatewayServiceProviders(composition);
    const paymentsProvider = providers.find(
      (provider) => provider.provide === ServiceTokens.PAYMENTS_SERVICE
    );
    const configService = {
      get: jest.fn().mockReturnValue({
        host: 'payments',
        port: 3004,
      }),
    } as unknown as ConfigService;

    const proxy = paymentsProvider!.useFactory!(configService) as unknown as {
      host: string;
      port: number;
    };

    expect(proxy).not.toBeInstanceOf(DisabledClientProxy);
    expect(proxy.host).toBe('payments');
    expect(proxy.port).toBe(3004);
  });

  it('returns a disabled payments proxy when payments is outside the composition', async () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['authentication'],
      },
      ['authentication', 'payments']
    );
    const providers = createGatewayServiceProviders(composition);
    const paymentsProvider = providers.find(
      (provider) => provider.provide === ServiceTokens.PAYMENTS_SERVICE
    );

    const proxy = paymentsProvider!.useFactory!(
      {} as ConfigService
    ) as DisabledClientProxy;

    expect(proxy).toBeInstanceOf(DisabledClientProxy);
    await expect(
      firstValueFrom(proxy.send({ cmd: 'noop' }, {}))
    ).rejects.toThrow('Gateway service "payments" is disabled');
  });

  it('registers the project-planning and vault MCP tools when only project-planning is enabled', () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['project-planning'],
      },
      ['project-planning', 'telos-docs-service']
    );
    const imports = createMcpToolImports(composition);

    expect(imports).toEqual([
      McpServerModule,
      ProjectPlanningMcpToolsModule,
      VaultMcpToolsModule,
    ]);
    expect(imports.some((entry) => entry === undefined)).toBe(false);
    expect(imports.some((entry) => entry === Object)).toBe(false);
  });

  it('registers the telos-docs and vault MCP tools when only telos-docs-service is enabled', () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['telos-docs-service'],
      },
      ['project-planning', 'telos-docs-service']
    );
    const imports = createMcpToolImports(composition);

    expect(imports).toEqual([
      McpServerModule,
      TelosDocsMcpToolsModule,
      VaultMcpToolsModule,
    ]);
  });

  it('keeps the vault tools registered when no other backing service is enabled', () => {
    // The vault tools are the confidential copilot's only route to document
    // text and to the local model, and the tenant binding they enforce is
    // exactly the control that has to survive an unrelated service being
    // degraded. Gating them here would turn a partial outage into a silent
    // loss of the vault's enforcement.
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['authentication'],
      },
      ['authentication', 'project-planning', 'telos-docs-service']
    );

    expect(createMcpToolImports(composition)).toEqual([
      McpServerModule,
      VaultMcpToolsModule,
    ]);
  });
});
