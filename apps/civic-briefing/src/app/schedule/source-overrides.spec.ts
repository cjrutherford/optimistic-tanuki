import type { SourcingDecision } from '@optimistic-tanuki/civic-core';
import { applyOverrides } from './source-overrides';
import type { SourceOverrideKind } from './source-override.schema';

function decision(sourceKey: string, adopted: boolean): SourcingDecision {
  return {
    source: { sourceKey, url: `civic-core:${sourceKey}` },
    official: true,
    ownerSlug: 'groton-ny',
    via: 'civic-core tenant match',
    adopted,
    reasons: ['matched'],
    evidence: [],
  } as unknown as SourcingDecision;
}

describe('applyOverrides', () => {
  it('refuses an adoption of a blocked source and says why', () => {
    const [result] = applyOverrides(
      [decision('civic-core-1', true)],
      new Map<string, SourceOverrideKind>([['civic-core-1', 'block']])
    );
    expect(result.adopted).toBe(false);
    expect(result.reasons).toEqual(['blocked by an operator', 'matched']);
  });

  it('adopts a pinned source discovery refused', () => {
    const [result] = applyOverrides(
      [decision('civic-core-2', false)],
      new Map<string, SourceOverrideKind>([['civic-core-2', 'pin']])
    );
    expect(result.adopted).toBe(true);
    expect(result.reasons[0]).toBe('pinned by an operator');
  });

  it('leaves other sources and agreeing overrides alone', () => {
    const decisions = [
      decision('a', true),
      decision('b', false),
      decision('c', true),
    ];
    const result = applyOverrides(
      decisions,
      new Map<string, SourceOverrideKind>([
        ['c', 'pin'],
        ['b', 'block'],
      ])
    );
    expect(result).toEqual(decisions);
  });
});
