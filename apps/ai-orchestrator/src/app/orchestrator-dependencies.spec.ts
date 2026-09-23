import { ConfigService } from '@nestjs/config';
import {
  DisabledClientProxy,
  ServiceTokens,
  normalizeGatewayComposition,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import {
  ORCHESTRATOR_DEPENDENCY_DEFS,
  REQUIRED_ORCHESTRATOR_SERVICE_IDS,
  createOrchestratorProviders,
  isRequiredOrchestratorDependency,
  resolveOrchestratorDefinitions,
} from './app.module';

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

  it('marks only prompt-proxy optional (O22/R2)', () => {
    expect(REQUIRED_ORCHESTRATOR_SERVICE_IDS).toEqual(
      expect.arrayContaining([
        'profile',
        'chat-collector',
        'telos-docs-service',
      ])
    );
    expect(REQUIRED_ORCHESTRATOR_SERVICE_IDS).not.toContain('prompt-proxy');
    expect(isRequiredOrchestratorDependency('profile')).toBe(true);
    expect(isRequiredOrchestratorDependency('prompt-proxy')).toBe(false);
    expect(ORCHESTRATOR_DEPENDENCY_DEFS['prompt_proxy'].required).toBe(false);
  });

  it('reports unknown dependencies-map keys instead of ignoring them', () => {
    const { defs, unknownKeys } = resolveOrchestratorDefinitions({
      profile: { host: 'profile', port: 3002 },
      proflie: { host: 'profile', port: 3002 },
    });

    expect(unknownKeys).toEqual(['proflie']);
    expect(defs).toHaveLength(4);
  });

  it('accepts the shipped config.yaml dependencies map with no unknowns', () => {
    const { unknownKeys } = resolveOrchestratorDefinitions({
      profile: {},
      chat_collector: {},
      prompt_proxy: {},
      telos_docs_service: {},
    });

    expect(unknownKeys).toEqual([]);
  });
});
