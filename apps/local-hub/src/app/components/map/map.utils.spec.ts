import {
  MapCoordinates,
  buildAtlasNearbySelection,
  isRenderableCoordinate,
} from './map.utils';

describe('map utils', () => {
  const userLocation: MapCoordinates = { lat: 32.0809, lng: -81.0912 };

  it('keeps only nearby localities when the user has a location', () => {
    const result = buildAtlasNearbySelection({
      cities: [
        {
          id: 'savannah',
          name: 'Savannah',
          coordinates: { lat: 32.0809, lng: -81.0912 },
        },
        {
          id: 'charleston',
          name: 'Charleston',
          coordinates: { lat: 32.7765, lng: -79.9311 },
        },
        {
          id: 'seattle',
          name: 'Seattle',
          coordinates: { lat: 47.6062, lng: -122.3321 },
        },
      ],
      userLocation,
    });

    expect(result.markers.map((marker: { id: string }) => marker.id)).toEqual([
      'savannah',
      'charleston',
    ]);
    expect(result.fallbackToNearest).toBe(false);
  });

  it('falls back to the nearest localities when none are inside the radius', () => {
    const result = buildAtlasNearbySelection({
      cities: [
        {
          id: 'seattle',
          name: 'Seattle',
          coordinates: { lat: 47.6062, lng: -122.3321 },
        },
        {
          id: 'portland',
          name: 'Portland',
          coordinates: { lat: 45.5152, lng: -122.6784 },
        },
        {
          id: 'los-angeles',
          name: 'Los Angeles',
          coordinates: { lat: 34.0549, lng: -118.2426 },
        },
      ],
      userLocation,
    });

    expect(result.markers.map((marker: { id: string }) => marker.id)).toEqual([
      'los-angeles',
      'portland',
      'seattle',
    ]);
    expect(result.fallbackToNearest).toBe(true);
  });

  it('drops non-renderable coordinates from the atlas selection', () => {
    const result = buildAtlasNearbySelection({
      cities: [
        {
          id: 'missing',
          name: 'Missing',
          coordinates: { lat: 0, lng: 0 },
        },
        {
          id: 'savannah',
          name: 'Savannah',
          coordinates: { lat: 32.0809, lng: -81.0912 },
        },
      ],
      userLocation,
    });

    expect(
      result.markers.map((marker: { id: string }) => marker.id)
    ).toEqual(['savannah']);
  });

  it('treats nullish and zero-zero coordinates as non-renderable', () => {
    expect(isRenderableCoordinate(undefined)).toBe(false);
    expect(isRenderableCoordinate({ lat: 0, lng: 0 })).toBe(false);
    expect(isRenderableCoordinate({ lat: 32.0809, lng: -81.0912 })).toBe(true);
  });
});
