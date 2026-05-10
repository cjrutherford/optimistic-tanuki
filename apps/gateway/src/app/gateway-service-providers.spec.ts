import { ConfigService } from '@nestjs/config';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { normalizeGatewayComposition } from './gateway-composition';
import {
  createMcpToolImports,
  createGatewayServiceProviders,
  DisabledClientProxy,
} from './gateway-service-providers';

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

  it('registers only project-planning MCP tools when only project-planning is enabled', () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['project-planning'],
      },
      ['project-planning', 'telos-docs-service']
    );
    const imports = createMcpToolImports(composition);

    expect(imports).toHaveLength(2);
    expect(imports.some((entry) => entry === undefined)).toBe(false);
    expect(imports.some((entry) => entry === Object)).toBe(false);
  });

  it('registers only telos-docs MCP tools when only telos-docs-service is enabled', () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['telos-docs-service'],
      },
      ['project-planning', 'telos-docs-service']
    );
    const imports = createMcpToolImports(composition);

    expect(imports).toHaveLength(2);
  });

  it('does not register MCP tools when no backing service is enabled', () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['authentication'],
      },
      ['authentication', 'project-planning', 'telos-docs-service']
    );

    expect(createMcpToolImports(composition)).toEqual([]);
  });
});
