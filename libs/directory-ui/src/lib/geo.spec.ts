import { haversineMiles, nearestTowns } from './geo';

describe('geo', () => {
  it('measures great-circle distance', () => {
    const miles = haversineMiles({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(miles).toBeGreaterThan(68);
    expect(miles).toBeLessThan(70);
  });

  it('ranks the nearest towns, excluding the current one and towns without coordinates', () => {
    const towns = [
      { name: 'Here', slug: 'here', coordinates: { lat: 0, lng: 0 } },
      { name: 'Far', slug: 'far', coordinates: { lat: 0, lng: 5 } },
      {
        name: 'Near',
        slug: 'near',
        adminArea: 'XX',
        coordinates: { lat: 0, lng: 1 },
      },
      { name: 'Nowhere', slug: 'nowhere' },
    ];
    const result = nearestTowns({ lat: 0, lng: 0 }, towns, {
      excludeSlug: 'here',
      limit: 5,
    });
    expect(result.map((t) => t.slug)).toEqual(['near', 'far']);
    expect(result[0].adminArea).toBe('XX');
  });

  it('returns nothing without an origin', () => {
    expect(nearestTowns(null, [])).toEqual([]);
  });
});
