import {
  filterEnabledEntries,
  isServiceEnabled,
  normalizeGatewayComposition,
} from './gateway-composition';

describe('gateway composition helpers', () => {
  it('defaults to all services when no composition file is provided', () => {
    const composition = normalizeGatewayComposition(undefined, [
      'authentication',
      'profile',
      'store',
    ]);

    expect(composition.enabledServices).toEqual([
      'authentication',
      'profile',
      'store',
    ]);
  });

  it('filters entries whose required services are disabled', () => {
    const composition = normalizeGatewayComposition(
      {
        enabledServices: ['authentication', 'profile'],
      },
      ['authentication', 'profile', 'store']
    );

    const entries = filterEnabledEntries(
      [
        { id: 'auth', requiredServices: ['authentication'] },
        { id: 'profile', requiredServices: ['profile'] },
        { id: 'store', requiredServices: ['store'] },
      ],
      composition
    );

    expect(entries.map((entry) => entry.id)).toEqual(['auth', 'profile']);
    expect(isServiceEnabled(composition, 'store')).toBe(false);
  });
});
