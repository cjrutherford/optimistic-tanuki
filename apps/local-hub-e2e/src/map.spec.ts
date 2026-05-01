import { expect, test } from '@playwright/test';
import {
  LocalHubCommunity,
  expectPageLoads,
  findCity,
  findCommunity,
  getCommunities,
} from './helpers/local-hub-api';

type CommunityWithCoordinates = LocalHubCommunity & {
  coordinates?: { lat: number; lng: number };
};

function isRenderableCoordinate(
  coordinates: { lat: number; lng: number } | undefined
): coordinates is { lat: number; lng: number } {
  return (
    !!coordinates &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng) &&
    !(coordinates.lat === 0 && coordinates.lng === 0)
  );
}

function haversineMiles(
  origin: { lat: number; lng: number },
  target: { lat: number; lng: number }
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(target.lat - origin.lat);
  const dLng = toRadians(target.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const targetLat = toRadians(target.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(targetLat) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearbyCluster(
  communities: CommunityWithCoordinates[]
): { latitude: number; longitude: number } | null {
  const cities = communities.filter(
    (community) =>
      community.localityType === 'city' &&
      isRenderableCoordinate(community.coordinates)
  );

  for (const city of cities) {
    const nearby = cities.filter(
      (candidate) =>
        candidate.id !== city.id &&
        haversineMiles(city.coordinates!, candidate.coordinates!) <= 250
    );

    if (nearby.length > 0) {
      return {
        latitude: city.coordinates!.lat,
        longitude: city.coordinates!.lng,
      };
    }
  }

  return null;
}

async function expectInsideMap(
  page: Parameters<typeof test>[0]['page'],
  selector: string
): Promise<void> {
  const mapBounds = await page.locator('.leaflet-container').boundingBox();
  const markerBounds = await page.locator(selector).first().boundingBox();

  expect(mapBounds).not.toBeNull();
  expect(markerBounds).not.toBeNull();

  if (!mapBounds || !markerBounds) {
    return;
  }

  const centerX = markerBounds.x + markerBounds.width / 2;
  const centerY = markerBounds.y + markerBounds.height / 2;

  expect(centerX).toBeGreaterThanOrEqual(mapBounds.x);
  expect(centerX).toBeLessThanOrEqual(mapBounds.x + mapBounds.width);
  expect(centerY).toBeGreaterThanOrEqual(mapBounds.y);
  expect(centerY).toBeLessThanOrEqual(mapBounds.y + mapBounds.height);
}

test.describe('Map rendering', () => {
  test('shows the user marker and nearby locality markers inside the cities map viewport', async ({
    page,
    request,
    baseURL,
  }) => {
    const communities = (await getCommunities(
      request
    )) as CommunityWithCoordinates[];
    const cluster = findNearbyCluster(communities);
    test.skip(!cluster, 'Seeded localities do not include a nearby city cluster');

    if (baseURL) {
      await page
        .context()
        .grantPermissions(['geolocation'], { origin: new URL(baseURL).origin });
    } else {
      await page.context().grantPermissions(['geolocation']);
    }

    await page.context().setGeolocation(cluster);
    await expectPageLoads(page, '/cities');
    await expect(page.locator('.leaflet-container')).toBeVisible();

    await expect(page.locator('.map-marker--user')).toHaveCount(1);
    expect(await page.locator('.map-marker--locality').count()).toBeGreaterThanOrEqual(2);
    await expectInsideMap(page, '.map-marker--user');
    await expectInsideMap(page, '.map-marker--locality');
  });

  test('shows a single focus marker on city detail pages', async ({
    page,
    request,
  }) => {
    const city = findCity(await getCommunities(request));
    test.skip(!city?.slug, 'No seeded city is available');

    await expectPageLoads(page, `/city/${city.slug}`);
    await expect(page.locator('.map-marker--focus')).toHaveCount(1);
    await expectInsideMap(page, '.map-marker--focus');
  });

  test('shows a single focus marker on community detail pages', async ({
    page,
    request,
  }) => {
    const community = findCommunity(await getCommunities(request));
    test.skip(!community?.slug, 'No seeded community is available');

    await expectPageLoads(page, `/c/${community.slug}`);
    await expect(page.locator('.map-marker--focus')).toHaveCount(1);
    await expectInsideMap(page, '.map-marker--focus');
  });
});
