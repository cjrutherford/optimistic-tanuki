import type { LocalityConfig } from '../src/types.js';
import {
  type GeographyDecision,
  type RuleVersion,
  type SourceCoverage,
  isEditionIncluded,
} from '../src/foundation-types.js';

describe('foundation types', () => {
  it('exposes the decision and coverage values at runtime', () => {
    const decisions: GeographyDecision[] = ['include', 'withhold', 'uncertain'];
    const coverage: SourceCoverage[] = ['all', 'mentions'];
    const version: RuleVersion = 'inclusion.v1:0123456789ab';
    expect(decisions).toStrictEqual(['include', 'withhold', 'uncertain']);
    expect(coverage).toStrictEqual(['all', 'mentions']);
    expect(version).toMatch(/^inclusion\.v1:/);
  });

  it('allows uncertain as stored data but never as edition inclusion', () => {
    const stored: GeographyDecision = 'uncertain';
    expect(isEditionIncluded(stored)).toBe(false);
    expect(isEditionIncluded('withhold')).toBe(false);
    expect(isEditionIncluded('include')).toBe(true);
  });

  it('describes places with a free-form kind and any number of parents', () => {
    const village: LocalityConfig = {
      slug: 'mystic-ct',
      name: 'Mystic',
      state: 'CT',
      timezone: 'America/New_York',
      lat: 41.35,
      lon: -71.97,
      kind: 'village',
      parents: ['groton-ct', 'stonington-ct'],
      edition: false,
      topics: [],
      cadence: [],
      sources: [],
    };
    expect(village.parents).toStrictEqual(['groton-ct', 'stonington-ct']);
  });
});
