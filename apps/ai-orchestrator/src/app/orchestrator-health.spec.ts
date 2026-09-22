import { normalizeGatewayComposition } from '@optimistic-tanuki/constants';
import {
  ORCHESTRATOR_SERVICE_IDS,
  resolveOrchestratorDependencyStates,
} from './app.module';

const ALL = [...ORCHESTRATOR_SERVICE_IDS];

/**
 * O27a: HealthCheck dependency-state matrix (R5). Every combination resolves
 * per-service enabled/disabled; the reply shape is pinned in
 * app.controller.spec.ts.
 */
describe('orchestrator dependency states (O27a)', () => {
  it('reports all enabled when the composition enables everything', () => {
    expect(
      resolveOrchestratorDependencyStates(
        normalizeGatewayComposition({ enabledServices: ALL }, ALL)
      )
    ).toEqual({
      profile: 'enabled',
      'chat-collector': 'enabled',
      'telos-docs-service': 'enabled',
      'prompt-proxy': 'enabled',
    });
  });

  it('reports a single disabled dependency', () => {
    const states = resolveOrchestratorDependencyStates(
      normalizeGatewayComposition(
        {
          enabledServices: ['profile', 'chat-collector', 'telos-docs-service'],
        },
        ALL
      )
    );

    expect(states['prompt-proxy']).toBe('disabled');
    expect(states.profile).toBe('enabled');
  });

  it('reports all disabled when the composition enables nothing known', () => {
    const states = resolveOrchestratorDependencyStates(
      normalizeGatewayComposition({ enabledServices: ['unrelated'] }, ALL)
    );

    expect(Object.values(states)).toEqual([
      'disabled',
      'disabled',
      'disabled',
      'disabled',
    ]);
  });

  it('covers exactly the orchestrator service ids', () => {
    const states = resolveOrchestratorDependencyStates(
      normalizeGatewayComposition({ enabledServices: ALL }, ALL)
    );

    expect(Object.keys(states).sort()).toEqual([...ALL].sort());
  });
});
