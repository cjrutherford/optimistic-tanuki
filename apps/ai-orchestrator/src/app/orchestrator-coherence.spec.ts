import {
  GATEWAY_SERVICE_IDS,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { ORCHESTRATOR_SERVICE_IDS } from './app.module';

/**
 * O23 coherence: every orchestrator downstream must resolve into the
 * canonical gateway service registry, and every token it wires must exist.
 * Fails CI on drift in either direction for covered services.
 *
 * `prompt-proxy` is the one documented exception: wired and optional, but
 * not a gateway service, so it never enters gateway composition.
 */
const NON_GATEWAY_EXCEPTION = ['prompt-proxy'] as const;

describe('orchestrator/gateway coherence (O23)', () => {
  it('resolves every orchestrator downstream into the gateway registry', () => {
    const registry = new Set<string>([...GATEWAY_SERVICE_IDS]);
    const allowed = new Set<string>([...registry, ...NON_GATEWAY_EXCEPTION]);

    for (const serviceId of ORCHESTRATOR_SERVICE_IDS) {
      expect(allowed.has(serviceId)).toBe(true);
    }
  });

  it('flags any registry removal that orphans an orchestrator downstream', () => {
    const registry = new Set<string>([...GATEWAY_SERVICE_IDS]);
    const required = ORCHESTRATOR_SERVICE_IDS.filter(
      (id) => !(NON_GATEWAY_EXCEPTION as readonly string[]).includes(id)
    );

    for (const serviceId of required) {
      expect(registry.has(serviceId)).toBe(true);
    }
  });

  it('wires only tokens that exist in ServiceTokens', () => {
    const tokens = new Set(Object.values(ServiceTokens));

    expect(tokens.has(ServiceTokens.PROMPT_PROXY)).toBe(true);
    expect(tokens.has(ServiceTokens.TELOS_DOCS_SERVICE)).toBe(true);
    expect(tokens.has(ServiceTokens.PROFILE_SERVICE)).toBe(true);
    expect(tokens.has(ServiceTokens.CHAT_COLLECTOR_SERVICE)).toBe(true);
  });

  it('keeps the non-gateway exception list minimal and accurate', () => {
    const registry = new Set<string>([...GATEWAY_SERVICE_IDS]);

    // The exception list must only contain services genuinely absent from
    // the gateway registry — otherwise it hides drift.
    for (const serviceId of NON_GATEWAY_EXCEPTION) {
      expect(registry.has(serviceId)).toBe(false);
    }
    expect(NON_GATEWAY_EXCEPTION).toEqual(['prompt-proxy']);
  });
});
