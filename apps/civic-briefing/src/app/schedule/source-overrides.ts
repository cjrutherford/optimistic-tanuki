import type { SourcingDecision } from '@optimistic-tanuki/civic-core';
import type { SourceOverrideKind } from './source-override.schema';

/**
 * Applies the operator's overrides to what discovery decided (SD.6). A blocked
 * source is refused, whoever proposed it; a pinned one is adopted even where
 * discovery refused. Decisions on other sources pass through unchanged.
 */
export function applyOverrides(
  decisions: readonly SourcingDecision[],
  overrides: ReadonlyMap<string, SourceOverrideKind>
): SourcingDecision[] {
  return decisions.map((decision) => {
    const kind = overrides.get(decision.source.sourceKey);
    if (kind === 'block' && decision.adopted)
      return {
        ...decision,
        adopted: false,
        reasons: ['blocked by an operator', ...decision.reasons],
      };
    if (kind === 'pin' && !decision.adopted)
      return {
        ...decision,
        adopted: true,
        reasons: ['pinned by an operator', ...decision.reasons],
      };
    return decision;
  });
}
