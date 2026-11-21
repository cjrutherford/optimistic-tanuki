import { DirectoryNearbyTown } from './models';

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface PlacedTown {
  name: string;
  slug: string;
  adminArea?: string;
  coordinates?: GeoPoint | null;
}

/**
 * The closest towns to `from`, nearest first, excluding the town named by `excludeSlug`. Towns without
 * usable coordinates are skipped: this only ranks what the data supports.
 */
export function nearestTowns(
  from: GeoPoint | null | undefined,
  towns: readonly PlacedTown[],
  options: { excludeSlug?: string; limit?: number } = {}
): DirectoryNearbyTown[] {
  if (!from || !Number.isFinite(from.lat) || !Number.isFinite(from.lng))
    return [];
  const limit = options.limit ?? 6;
  return towns
    .filter(
      (town) =>
        town.slug !== options.excludeSlug &&
        !!town.coordinates &&
        Number.isFinite(town.coordinates.lat) &&
        Number.isFinite(town.coordinates.lng)
    )
    .map((town) => ({
      name: town.name,
      slug: town.slug,
      ...(town.adminArea ? { adminArea: town.adminArea } : {}),
      distanceMiles: haversineMiles(from, town.coordinates as GeoPoint),
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit);
}
