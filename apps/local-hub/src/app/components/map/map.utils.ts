export type MapMode = 'atlas-nearby' | 'single-location' | 'radius-focus';

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export interface MapCityCandidate {
  id: string;
  name: string;
  coordinates?: MapCoordinates | null;
}

export interface AtlasNearbyMarker extends MapCoordinates {
  id: string;
  name: string;
  distanceMiles: number;
}

export interface AtlasNearbySelection {
  markers: AtlasNearbyMarker[];
  fallbackToNearest: boolean;
}

const ATLAS_RADIUS_MILES = 250;
const ATLAS_MAX_MARKERS = 24;
const ATLAS_FALLBACK_MARKERS = 8;
const EARTH_RADIUS_MILES = 3958.8;

export function isRenderableCoordinate(
  coordinates: MapCoordinates | null | undefined
): coordinates is MapCoordinates {
  if (!coordinates) {
    return false;
  }

  if (!Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng)) {
    return false;
  }

  return !(coordinates.lat === 0 && coordinates.lng === 0);
}

export function haversineMiles(
  origin: MapCoordinates,
  target: MapCoordinates
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(target.lat - origin.lat);
  const dLng = toRadians(target.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const targetLat = toRadians(target.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(targetLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

export function buildAtlasNearbySelection(input: {
  cities: MapCityCandidate[];
  userLocation: MapCoordinates | null;
}): AtlasNearbySelection {
  const candidates = input.cities
    .filter(
      (
        city
      ): city is MapCityCandidate & {
        coordinates: MapCoordinates;
      } => isRenderableCoordinate(city.coordinates)
    )
    .map((city) => ({
      id: city.id,
      name: city.name,
      lat: city.coordinates.lat,
      lng: city.coordinates.lng,
      distanceMiles: input.userLocation
        ? haversineMiles(input.userLocation, city.coordinates)
        : 0,
    }))
    .sort((left, right) => left.distanceMiles - right.distanceMiles);

  if (!input.userLocation) {
    return {
      markers: candidates.slice(0, ATLAS_MAX_MARKERS),
      fallbackToNearest: false,
    };
  }

  const nearby = candidates
    .filter((city) => city.distanceMiles <= ATLAS_RADIUS_MILES)
    .slice(0, ATLAS_MAX_MARKERS);

  if (nearby.length > 0) {
    return {
      markers: nearby,
      fallbackToNearest: false,
    };
  }

  return {
    markers: candidates.slice(0, ATLAS_FALLBACK_MARKERS),
    fallbackToNearest: true,
  };
}
