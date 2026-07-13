import {
  buildCoordinateFallbackLabel,
  getDefaultLocalityRadiusMeters,
  RadiusScope,
} from '@optimistic-tanuki/ui-models';

export const DEFAULT_VIDEO_RADIUS_SCOPE: RadiusScope = {
  anchor: { lat: 32.0809, lng: -81.0912 },
  radiusMeters: getDefaultLocalityRadiusMeters('city'),
};

export async function resolveVideoRadiusScope(): Promise<RadiusScope> {
  const geolocation = globalThis.navigator?.geolocation;
  if (!geolocation) {
    return DEFAULT_VIDEO_RADIUS_SCOPE;
  }

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) =>
        resolve({
          anchor: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          radiusMeters: DEFAULT_VIDEO_RADIUS_SCOPE.radiusMeters,
        }),
      () => resolve(DEFAULT_VIDEO_RADIUS_SCOPE),
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 3000,
      }
    );
  });
}

export function buildVideoLocalityLabel(
  locality:
    | {
        formatted?: string | null;
      }
    | null
    | undefined,
  anchor: RadiusScope['anchor']
): string {
  return locality?.formatted || buildCoordinateFallbackLabel(anchor).formatted;
}

export function formatVideoDistance(distanceMeters: number): string {
  const miles = distanceMeters / 1609.34;
  if (miles >= 10) {
    return `${Math.round(miles)} mi`;
  }

  return `${miles.toFixed(1)} mi`;
}
