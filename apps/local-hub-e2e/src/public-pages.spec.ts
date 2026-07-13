import { expect, test } from '@playwright/test';
import {
  expectPageLoads,
  findCity,
  findCommunity,
  getCommunities,
} from './helpers/local-hub-api';

test.describe('Public pages', () => {
  for (const path of ['/', '/cities', '/communities', '/login', '/register']) {
    test(`loads ${path}`, async ({ page }) => {
      await expectPageLoads(page, path);
    });
  }
});

test.describe('City and community detail pages', () => {
  test('loads city detail pages for seeded city', async ({ page, request }) => {
    const city = findCity(await getCommunities(request));
    test.skip(!city?.slug, 'No seeded city is available');

    await expectPageLoads(page, `/city/${city.slug}`);
    await expectPageLoads(page, `/city/${city.slug}/classifieds`);
  });

  test('shows the cross-app local network hub for a seeded city', async ({
    page,
    request,
  }) => {
    const city = findCity(await getCommunities(request));
    test.skip(!city?.slug, 'No seeded city is available');

    await expectPageLoads(page, `/city/${city.slug}`);
    await expect(
      page.getByRole('heading', { name: 'Local Network' })
    ).toBeVisible();
    await expect(
      page.getByText('Local conversations', { exact: true })
    ).toBeVisible();
    await expect(page.getByText('Sponsored', { exact: true })).toBeVisible();
  });

  test('loads community detail pages for seeded community', async ({
    page,
    request,
  }) => {
    const community = findCommunity(await getCommunities(request));
    test.skip(!community?.slug, 'No seeded non-city community is available');

    await expectPageLoads(page, `/c/${community.slug}`);
    await expectPageLoads(page, `/c/${community.slug}/classifieds`);
  });
});
