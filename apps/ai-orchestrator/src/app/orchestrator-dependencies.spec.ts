import { ConfigService } from '@nestjs/config';
import {
  DisabledClientProxy,
  ServiceTokens,
  normalizeGatewayComposition,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { createOrchestratorProviders } from './app.module';

const ALL = ['profile', 'chat-collector', 'telos-docs-service', 'prompt-proxy'];

describe('orchestrator downstream providers (O24b)', () => {
  it('returns disabled proxies for services outside the composition', async () => {
    const composition = normalizeGatewayComposition(
      { enabledServices: ['profile'] },
      ALL
    );
    const providers = createOrchestratorProviders(composition);
    const telosProvider = providers.find(
      (provider) => provider.provide === ServiceTokens.TELOS_DOCS_SERVICE
    );

    const proxy = telosProvider!.useFactory!(
      {} as ConfigService
    ) as DisabledClientProxy;

    expect(proxy).toBeInstanceOf(DisabledClientProxy);
    await expect(
      firstValueFrom(proxy.send({ cmd: 'noop' }, {}))
    ).rejects.toThrow('Gateway service "telos-docs-service" is disabled');
  });

  it('returns a disabled proxy instead of throwing when config is missing', () => {
    const composition = normalizeGatewayComposition(
      { enabledServices: ALL },
      ALL
    );
    const providers = createOrchestratorProviders(composition);
    const profileProvider = providers.find(
      (provider) => provider.provide === ServiceTokens.PROFILE_SERVICE
    );
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    const proxy = profileProvider!.useFactory!(configService);

    expect(proxy).toBeInstanceOf(DisabledClientProxy);
  });

  it('creates real TCP proxies for enabled, configured services', () => {
    const composition = normalizeGatewayComposition(
      { enabledServices: ALL },
      ALL
    );
    const providers = createOrchestratorProviders(composition);
    const chatProvider = providers.find(
      (provider) => provider.provide === ServiceTokens.CHAT_COLLECTOR_SERVICE
    );
    const configService = {
      get: jest.fn().mockReturnValue({ host: 'chat-collector', port: 3007 }),
    } as unknown as ConfigService;

    const proxy = chatProvider!.useFactory!(configService);

    expect(proxy).not.toBeInstanceOf(DisabledClientProxy);
  });

  it('declares all four downstream dependencies', () => {
    const composition = normalizeGatewayComposition(
      { enabledServices: ALL },
      ALL
    );
    const tokens = createOrchestratorProviders(composition).map(
      (p) => p.provide
    );

    expect(tokens).toEqual(
      expect.arrayContaining([
        ServiceTokens.PROMPT_PROXY,
        ServiceTokens.TELOS_DOCS_SERVICE,
        ServiceTokens.PROFILE_SERVICE,
        ServiceTokens.CHAT_COLLECTOR_SERVICE,
      ])
    );
  });
});
