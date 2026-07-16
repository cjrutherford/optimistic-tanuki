import { expect, test } from '@playwright/test';

const feed = {
  id: 'feed-1',
  channelId: 'channel-1',
  communityId: 'community-1',
  timezone: 'America/New_York',
  currentMode: 'live',
  activeLiveSessionId: 'session-1',
  activeVideoId: null,
  activeLiveSession: { id: 'session-1', title: 'Savannah Signal Live' },
  liveHandoff: { status: 'ready' },
  lastTransitionAt: new Date().toISOString(),
};
const viewerLocation = { latitude: 32.0809, longitude: -81.0912 };

test.describe('Live playback handoff', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(viewerLocation);
  });

  test('renders live playback only after capability validation', async ({
    page,
  }) => {
    await page.route('**/api/videos/channels/ot-live/feed', (route) =>
      route.fulfill({ json: feed })
    );
    await page.route('**/api/videos/channels/ot-live/live/token', (route) => {
      expect(route.request().postDataJSON()).toEqual({
        viewerLat: viewerLocation.latitude,
        viewerLng: viewerLocation.longitude,
      });
      return route.fulfill({
        json: {
          status: 'ready',
          token: 'signed-token',
          sessionId: 'session-1',
          playbackUrl: null,
          expiresAt: '2026-07-12T16:00:00.000Z',
        },
      });
    });
    await page.route(
      '**/api/videos/channels/ot-live/live/token/validate',
      (route) => {
        expect(route.request().postDataJSON()).toEqual({
          token: 'signed-token',
          viewerLat: viewerLocation.latitude,
          viewerLng: viewerLocation.longitude,
        });
        return route.fulfill({
          json: {
            valid: true,
            sessionId: 'session-1',
            playbackUrl: 'https://media.example/live.m3u8',
            expiresAt: '2026-07-12T16:00:00.000Z',
          },
        });
      }
    );

    await page.goto('/watch/live/ot-live');

    await expect(page.getByText('Live now')).toBeVisible();
    await expect(page.getByTestId('hls-player')).toHaveAttribute(
      'src',
      'https://media.example/live.m3u8'
    );
  });

  test('renders the ended state when signed-token validation fails', async ({
    page,
  }) => {
    await page.route('**/api/videos/channels/ot-live/feed', (route) =>
      route.fulfill({ json: feed })
    );
    await page.route('**/api/videos/channels/ot-live/live/token', (route) => {
      expect(route.request().postDataJSON()).toEqual({
        viewerLat: viewerLocation.latitude,
        viewerLng: viewerLocation.longitude,
      });
      return route.fulfill({
        json: {
          status: 'ready',
          token: 'expired-token',
          sessionId: 'session-1',
          playbackUrl: null,
          expiresAt: '2026-07-12T16:00:00.000Z',
        },
      });
    });
    await page.route(
      '**/api/videos/channels/ot-live/live/token/validate',
      (route) => {
        expect(route.request().postDataJSON()).toEqual({
          token: 'expired-token',
          viewerLat: viewerLocation.latitude,
          viewerLng: viewerLocation.longitude,
        });
        return route.fulfill({ json: { valid: false } });
      }
    );

    await page.goto('/watch/live/ot-live');

    await expect(page.getByText('This live session has ended.')).toBeVisible();
  });
});
