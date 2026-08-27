import { requestLivePlaybackLocation } from './live-playback-location.helper';

describe('requestLivePlaybackLocation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the browser coordinates without a locality fallback', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: 32.0809, longitude: -81.0912 },
          } as GeolocationPosition),
      },
    });

    await expect(requestLivePlaybackLocation()).resolves.toEqual({
      status: 'available',
      viewerLat: 32.0809,
      viewerLng: -81.0912,
    });
  });

  it('returns unavailable when the browser denies geolocation', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (
          _success: PositionCallback,
          error: PositionErrorCallback
        ) =>
          error({
            code: 1,
            message: 'Permission denied',
          } as GeolocationPositionError),
      },
    });

    await expect(requestLivePlaybackLocation()).resolves.toEqual({
      status: 'unavailable',
      reason: 'denied',
    });
  });

  it('returns unavailable when the browser has no geolocation API', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });

    await expect(requestLivePlaybackLocation()).resolves.toEqual({
      status: 'unavailable',
      reason: 'unavailable',
    });
  });
});
