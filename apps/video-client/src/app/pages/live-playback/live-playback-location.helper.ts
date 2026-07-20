export interface LivePlaybackLocation {
  viewerLat: number;
  viewerLng: number;
  viewerSessionId: string;
  viewerAccuracyMeters?: number;
  observedAt: string;
}

type LivePlaybackLocationResult =
  | (LivePlaybackLocation & { status: 'available' })
  | { status: 'denied' | 'unavailable'; reason: 'denied' | 'unavailable' };

const VIEWER_SESSION_STORAGE_KEY = 'video-client.viewer-session-id';

function createViewerSessionId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  return `viewer-${Math.random().toString(36).slice(2)}-${Date.now().toString(
    36
  )}`;
}

export function getBrowserViewerSessionId(): string {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return createViewerSessionId();
    }
    const existing = globalThis.localStorage.getItem(
      VIEWER_SESSION_STORAGE_KEY
    );
    if (existing) return existing;
    const created = createViewerSessionId();
    globalThis.localStorage.setItem(VIEWER_SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return createViewerSessionId();
  }
}

export function requestLivePlaybackLocation(): Promise<LivePlaybackLocationResult> {
  const geolocation = globalThis.navigator?.geolocation;
  if (!geolocation) {
    return Promise.resolve({ status: 'unavailable', reason: 'unavailable' });
  }

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) => {
        const accuracy = position.coords.accuracy;
        resolve({
          status: 'available',
          viewerLat: position.coords.latitude,
          viewerLng: position.coords.longitude,
          viewerSessionId: getBrowserViewerSessionId(),
          viewerAccuracyMeters: Number.isFinite(accuracy)
            ? accuracy
            : undefined,
          observedAt: new Date(
            Number.isFinite(position.timestamp)
              ? position.timestamp
              : Date.now()
          ).toISOString(),
        });
      },
      () => resolve({ status: 'denied', reason: 'denied' }),
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 3000,
      }
    );
  });
}
