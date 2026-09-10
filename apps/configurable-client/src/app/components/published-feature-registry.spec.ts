import { PUBLISHED_FEATURE_REGISTRY } from './published-feature-registry';

describe('PUBLISHED_FEATURE_REGISTRY', () => {
  it('contains only the explicit public Blogging capability adapter', () => {
    expect(
      PUBLISHED_FEATURE_REGISTRY.map((entry) => entry.capabilityId)
    ).toEqual(['blogging.posts']);
    expect(PUBLISHED_FEATURE_REGISTRY[0].featureName).toBe('blogging');
    expect(PUBLISHED_FEATURE_REGISTRY[0].inputs).toBeUndefined();
  });

  it('does not turn a route component string into executable code', () => {
    expect(
      PUBLISHED_FEATURE_REGISTRY.some((entry) => 'component' in entry)
    ).toBe(false);
  });
});
