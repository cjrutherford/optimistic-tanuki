export interface LivePlaybackLocation {
  viewerLat: number;
  viewerLng: number;
}

export type LivePlaybackLocationResult =
  | ({ status: 'available' } & LivePlaybackLocation)
  | { status: 'unavailable'; reason: 'denied' | 'unavailable' };

export function requestLivePlaybackLocation(): Promise<LivePlaybackLocationResult> {
  const geolocation = globalThis.navigator?.geolocation;
  if (!geolocation) {
    return Promise.resolve({ status: 'unavailable', reason: 'unavailable' });
  }

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) =>
        resolve({
          status: 'available',
          viewerLat: position.coords.latitude,
          viewerLng: position.coords.longitude,
        }),
      (error) =>
        resolve({
          status: 'unavailable',
          reason: error.code === 1 ? 'denied' : 'unavailable',
        }),
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 5000,
      }
    );
  });
}
