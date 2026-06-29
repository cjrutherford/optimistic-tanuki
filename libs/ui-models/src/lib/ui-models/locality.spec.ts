import {
  buildFallbackLocalityHighlights,
  buildFallbackLocalityImageUrl,
  buildCoordinateFallbackLabel,
  buildResolvedLocalityLabel,
  getDefaultLocalityRadiusMeters,
} from './locality';

describe('locality helpers', () => {
  it('builds a formatted locality label from metadata', () => {
    expect(
      buildResolvedLocalityLabel({
        city: 'Savannah',
        adminArea: 'GA',
        countryCode: 'US',
        timezone: 'America/New_York',
      })
    ).toEqual({
      primary: 'Savannah',
      secondary: 'GA, US',
      formatted: 'Savannah, GA, US',
      city: 'Savannah',
      adminArea: 'GA',
      countryCode: 'US',
      timezone: 'America/New_York',
      source: 'community-metadata',
    });
  });

  it('falls back to anchor coordinates when no locality metadata is available', () => {
    expect(
      buildCoordinateFallbackLabel({
        lat: 32.0809,
        lng: -81.0912,
      })
    ).toEqual({
      primary: 'Near 32.081, -81.091',
      secondary: 'Anchor coordinates',
      formatted: 'Near 32.081, -81.091',
      source: 'coordinates',
    });
  });

  it('returns a larger default radius for regions than neighborhoods', () => {
    expect(getDefaultLocalityRadiusMeters('region')).toBeGreaterThan(
      getDefaultLocalityRadiusMeters('neighborhood')
    );
  });

  it('builds fallback locality presentation assets from the locality slug', () => {
    expect(buildFallbackLocalityImageUrl('savannah-ga')).toBe(
      'https://picsum.photos/seed/savannah-ga/1200/800'
    );

    expect(
      buildFallbackLocalityHighlights({
        slug: 'savannah-ga',
        localityName: 'Savannah',
      })
    ).toEqual([
      {
        headline: 'Savannah downtown favorites',
        link: 'https://example.com/savannah-ga/downtown',
        imageUrl: 'https://picsum.photos/seed/savannah-ga-downtown/800/600',
      },
      {
        headline: 'Savannah local dining',
        link: 'https://example.com/savannah-ga/food',
        imageUrl: 'https://picsum.photos/seed/savannah-ga-food/800/600',
      },
      {
        headline: 'Savannah parks and outdoors',
        link: 'https://example.com/savannah-ga/outdoors',
        imageUrl: 'https://picsum.photos/seed/savannah-ga-outdoors/800/600',
      },
    ]);
  });
});
