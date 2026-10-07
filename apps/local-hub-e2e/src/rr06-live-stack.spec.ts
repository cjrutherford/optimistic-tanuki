import { APIRequestContext, expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { getBaseUrl } from './fixtures/helpers';
import { apiUrl, LOCAL_HUB_HEADERS } from './helpers/local-hub-api';

test.skip(
  process.env['RR06_LIVE_STACK'] !== 'true',
  'Requires the existing Local Hub and service stack'
);

const password = 'RR06-local-test-password!';
const unique = () => `${Date.now()}-${randomUUID().slice(0, 8)}`;

async function registeredBrowserSession(
  request: APIRequestContext,
  role: string
) {
  const email = `rr06-${role}-${unique()}@example.test`;
  const registration = await request.post(
    `${getBaseUrl()}/api/authentication/register`,
    {
      headers: LOCAL_HUB_HEADERS,
      data: {
        fn: 'RR06',
        ln: role,
        email,
        password,
        confirm: password,
        bio: 'RR06 live acceptance fixture',
      },
    }
  );
  expect(registration.status(), await registration.text()).toBe(201);
  const login = await request.post(`${getBaseUrl()}/api/authentication/login`, {
    headers: { ...LOCAL_HUB_HEADERS, 'X-ot-session-mode': 'cookie' },
    data: { email, password },
  });
  expect(login.status(), await login.text()).toBe(201);
  const session = await request.get(
    `${getBaseUrl()}/api/authentication/session`,
    { headers: LOCAL_HUB_HEADERS }
  );
  expect(session.status()).toBe(200);
  const data = (await session.json()).data;
  expect(data.profileId).toEqual(expect.any(String));
  return { email, ...data } as {
    email: string;
    userId: string;
    profileId: string;
  };
}

test('RR06 live locality, classified authorization, and buyer/seller flow', async ({
  browser,
  playwright,
}) => {
  test.setTimeout(180_000);
  const sellerContext = await browser.newContext({ baseURL: getBaseUrl() });
  const buyerContext = await browser.newContext({ baseURL: getBaseUrl() });
  const outsiderContext = await browser.newContext({ baseURL: getBaseUrl() });
  const anonymous = await playwright.request.newContext();
  let cityId: string | undefined;
  let communityId: string | undefined;
  let listingId: string | undefined;
  const unexpectedListingIds: Array<{ id: string; token: string }> = [];
  let sellerToken: string | undefined;
  const marker = unique();

  try {
    const seller = await registeredBrowserSession(
      sellerContext.request,
      'seller'
    );
    const buyer = await registeredBrowserSession(buyerContext.request, 'buyer');
    const outsider = await registeredBrowserSession(
      outsiderContext.request,
      'nonmember'
    );

    // The authenticated gateway creates a uniquely tagged root locality;
    // the following child is a second ordinary community under that root.
    const loginToken = async (context: typeof sellerContext, email: string) => {
      const response = await context.request.post(
        apiUrl('/api/authentication/login'),
        { headers: LOCAL_HUB_HEADERS, data: { email, password } }
      );
      expect(response.status()).toBe(201);
      return (await response.json()).data.newToken as string;
    };
    sellerToken = await loginToken(sellerContext, seller.email);
    const buyerToken = await loginToken(buyerContext, buyer.email);
    const outsiderToken = await loginToken(outsiderContext, outsider.email);
    const auth = (token: string) => ({
      ...LOCAL_HUB_HEADERS,
      Authorization: `Bearer ${token}`,
    });

    const cityResponse = await sellerContext.request.post(
      apiUrl('/api/social/community'),
      {
        headers: auth(sellerToken),
        data: {
          name: `RR06 city ${marker}`,
          slug: `rr06-city-${marker.toLowerCase()}`,
          description: 'Temporary RR06 locality fixture',
          localityType: 'city',
          city: 'RR06 fixture',
          countryCode: 'USA',
          adminArea: 'RR06',
        },
      }
    );
    expect(cityResponse.status(), await cityResponse.text()).toBe(201);
    const city = await cityResponse.json();
    cityId = city.id;
    expect(city.localityType).toBe('city');
    expect(city.slug).toContain('rr06-city-');

    const createCommunity = await sellerContext.request.post(
      apiUrl('/api/social/community'),
      {
        headers: auth(sellerToken),
        data: {
          name: `RR06 community ${marker}`,
          description: 'Temporary RR06 child locality fixture',
          parentId: cityId,
          localityType: 'neighborhood',
        },
      }
    );
    expect(createCommunity.status(), await createCommunity.text()).toBe(201);
    const community = await createCommunity.json();
    communityId = community.id;
    expect(community.slug).toBeTruthy();

    // Anonymous routes must render both levels and keep the route parameter
    // stable when moving from city to child community.
    const anonymousPage = await browser.newPage({ baseURL: getBaseUrl() });
    for (const path of [
      `/city/${city.slug}`,
      `/city/${city.slug}/classifieds`,
      `/c/${community.slug}`,
      `/c/${community.slug}/classifieds`,
    ]) {
      const response = await anonymousPage.goto(path);
      expect(response?.status(), `GET ${path}`).toBeLessThan(400);
      await expect(anonymousPage.locator('body')).toBeVisible();
      expect(new URL(anonymousPage.url()).pathname).toBe(path);
    }

    // Join both real browser-cookie users, then check a member-only listing
    // write is denied without auth and accepted for the seller.
    for (const [token, session] of [
      [sellerToken, seller],
      [buyerToken, buyer],
    ] as const) {
      const joined = await sellerContext.request.post(
        apiUrl(`/api/social/community/${communityId}/join`),
        { headers: auth(token) }
      );
      expect(joined.status(), await joined.text()).toBe(201);
      expect(session.profileId).toBeTruthy();
    }
    const outsiderCityJoin = await outsiderContext.request.post(
      apiUrl(`/api/social/community/${cityId}/join`),
      { headers: auth(outsiderToken) }
    );
    expect(outsiderCityJoin.status(), await outsiderCityJoin.text()).toBe(201);
    const outsiderCityMembership = await outsiderCityJoin.json();
    expect(outsiderCityMembership.status).toBe('approved');
    const outsiderMemberships = await outsiderContext.request.get(
      apiUrl('/api/social/community/user/communities'),
      { headers: auth(outsiderToken) }
    );
    expect(outsiderMemberships.status()).toBe(200);
    const memberships = await outsiderMemberships.json();
    expect(JSON.stringify(memberships)).toContain(cityId);
    expect(JSON.stringify(memberships)).not.toContain(communityId);

    const payload = {
      title: `RR06 listing ${marker}`,
      description: 'Listing created through the live seller UI',
      price: 47,
      category: 'for-sale',
      communityId,
    };
    const cityControl = await outsiderContext.request.post(
      apiUrl('/api/classifieds'),
      {
        headers: auth(outsiderToken),
        data: {
          ...payload,
          title: `RR06 city membership control ${marker}`,
          communityId: cityId,
        },
      }
    );
    expect(cityControl.status(), await cityControl.text()).toBe(201);
    const cityControlListing = await cityControl.json();
    unexpectedListingIds.push({
      id: cityControlListing.id,
      token: outsiderToken,
    });
    const unauthCreate = await anonymous.post(apiUrl('/api/classifieds'), {
      headers: LOCAL_HUB_HEADERS,
      data: payload,
    });
    expect(
      [401, 403],
      `anonymous create: ${await unauthCreate.text()}`
    ).toContain(unauthCreate.status());
    const nonmemberCreate = await outsiderContext.request.post(
      apiUrl('/api/classifieds'),
      { headers: auth(outsiderToken), data: payload }
    );
    expect
      .soft([401, 403], `nonmember create: ${await nonmemberCreate.text()}`)
      .toContain(nonmemberCreate.status());
    if (nonmemberCreate.status() === 201) {
      const unexpected = await nonmemberCreate.json();
      if (unexpected.id)
        unexpectedListingIds.push({ id: unexpected.id, token: outsiderToken });
    }

    const page = await sellerContext.newPage();
    await page.goto(`/c/${community.slug}/classifieds/new`);
    await expect(
      page.getByRole('heading', { name: 'Post a New Listing' })
    ).toBeVisible();
    await page.locator('#title').fill(payload.title);
    await page.locator('#description').fill(payload.description);
    await page.locator('#price').fill(String(payload.price));
    await page.locator('input[type=file]').setInputFiles({
      name: 'rr06-fixture.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p3sAAAAASUVORK5CYII=',
        'base64'
      ),
    });
    await expect(page.locator('.image-previews img')).toHaveCount(1);
    await page.getByRole('button', { name: 'Post Listing' }).click();
    await expect(page).toHaveURL(`/c/${community.slug}/classifieds`);
    const card = page
      .locator('.classified-card')
      .filter({ hasText: payload.title })
      .filter({ hasText: 'RR06 seller' });
    await expect(card).toBeVisible();
    const listingResponse = await sellerContext.request.get(
      apiUrl(`/api/classifieds/community/${communityId}`),
      { headers: auth(sellerToken) }
    );
    expect(listingResponse.status()).toBe(200);
    const listings = await listingResponse.json();
    const listing = (Array.isArray(listings) ? listings : listings.data).find(
      (item: { title: string; profileId: string }) =>
        item.title === payload.title && item.profileId === seller.profileId
    );
    expect(
      listing,
      'UI-created listing should persist through the API'
    ).toBeTruthy();
    expect
      .soft(listing.imageUrls, 'uploaded image should persist on the listing')
      .toHaveLength(1);
    listingId = listing.id;

    const deniedUpdate = await buyerContext.request.put(
      apiUrl(`/api/classifieds/${listingId}`),
      {
        headers: auth(buyerToken),
        data: { title: 'RR06 unauthorized mutation' },
      }
    );
    expect
      .soft(
        [401, 403, 404],
        `unauthorized update response: ${await deniedUpdate.text()}`
      )
      .toContain(deniedUpdate.status());
    const deniedDelete = await buyerContext.request.delete(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: auth(buyerToken) }
    );
    expect
      .soft(
        [401, 403, 404],
        `unauthorized delete response: ${await deniedDelete.text()}`
      )
      .toContain(deniedDelete.status());
    const ownerRowAfterDeniedMutations = await anonymous.get(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: LOCAL_HUB_HEADERS }
    );
    expect(ownerRowAfterDeniedMutations.status()).toBe(200);
    expect(await ownerRowAfterDeniedMutations.json()).toMatchObject({
      id: listingId,
      title: payload.title,
      profileId: seller.profileId,
      status: 'active',
    });

    // A second registered browser user contacts the seller. The listing title,
    // price and route must be present in the initial real conversation.
    const buyerPage = await buyerContext.newPage();
    await buyerPage.goto(`/c/${community.slug}/classifieds/${listingId}`);
    const chatResponsePromise = buyerPage
      .waitForResponse(
        (response) =>
          response.url().includes('/chat/conversations/direct/get-or-create'),
        { timeout: 10000 }
      )
      .catch(() => undefined);
    await buyerPage.getByRole('button', { name: 'Contact Seller' }).click();
    const chatResponse = await chatResponsePromise;
    expect
      .soft(
        chatResponse?.status(),
        `Contact Seller chat bootstrap response: ${await chatResponse
          ?.text()
          .catch(() => 'request did not occur')}`
      )
      .toBe(201);
    if (chatResponse?.status() === 201) {
      await expect(
        buyerPage.getByRole('heading', { name: 'Conversation' })
      ).toBeVisible();
      const conversation = buyerPage
        .locator('.message-content')
        .filter({ hasText: payload.title });
      await expect(conversation).toContainText('$47');
      await expect(conversation).toContainText(
        `/c/${community.slug}/classifieds/${listingId}`
      );
      await buyerPage.getByLabel('Message').fill(`RR06 buyer reply ${marker}`);
      await buyerPage.getByRole('button', { name: 'Send' }).click();
      await expect(
        buyerPage
          .locator('.message-content')
          .filter({ hasText: `RR06 buyer reply ${marker}` })
      ).toBeVisible();
    }

    // Owner actions exercise edit, sold status and removal through real APIs;
    // unauthorized attempts above must leave the owned listing intact.
    const edit = await sellerContext.request.put(
      apiUrl(`/api/classifieds/${listingId}`),
      {
        headers: auth(sellerToken),
        data: { description: `RR06 edited ${marker}` },
      }
    );
    expect.soft(edit.status(), `owner edit: ${await edit.text()}`).toBe(200);
    const sold = await sellerContext.request.post(
      apiUrl(`/api/classifieds/${listingId}/sold`),
      { headers: auth(sellerToken) }
    );
    expect
      .soft([200, 201], `owner sold: ${await sold.text()}`)
      .toContain(sold.status());
    const removed = await sellerContext.request.delete(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: auth(sellerToken) }
    );
    expect
      .soft([200, 204], `owner remove: ${await removed.text()}`)
      .toContain(removed.status());
    const removalReadback = await anonymous.get(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: LOCAL_HUB_HEADERS }
    );
    expect(removalReadback.status()).toBe(200);
    expect(await removalReadback.json()).toMatchObject({
      id: listingId,
      status: 'removed',
    });
    listingId = undefined;
  } finally {
    // Clean only this run's exact listing and locality IDs. Never reset shared data.
    if (listingId && sellerToken) {
      await sellerContext.request
        .delete(apiUrl(`/api/classifieds/${listingId}`), {
          headers: {
            ...LOCAL_HUB_HEADERS,
            Authorization: `Bearer ${sellerToken}`,
          },
        })
        .catch(() => undefined);
    }
    if (sellerToken) {
      await Promise.all(
        unexpectedListingIds.map(({ id, token }) =>
          outsiderContext.request
            .delete(apiUrl(`/api/classifieds/${id}`), {
              headers: {
                ...LOCAL_HUB_HEADERS,
                Authorization: `Bearer ${token}`,
              },
            })
            .then(async (response) => {
              expect
                .soft(
                  [200, 204],
                  `test fixture cleanup for ${id}: ${response.status()} ${await response.text()}`
                )
                .toContain(response.status());
              return response.status();
            })
            .then(async (status) => {
              if (![200, 204].includes(status)) {
                const cookieCleanup = await outsiderContext.request.delete(
                  `${getBaseUrl()}/api/classifieds/${id}`,
                  { headers: LOCAL_HUB_HEADERS }
                );
                expect
                  .soft(
                    [200, 204],
                    `cookie cleanup for ${id}: ${cookieCleanup.status()} ${await cookieCleanup.text()}`
                  )
                  .toContain(cookieCleanup.status());
              }
              const readback = await anonymous.get(
                apiUrl(`/api/classifieds/${id}`),
                {
                  headers: LOCAL_HUB_HEADERS,
                }
              );
              expect
                .soft(readback.status(), `cleanup readback for ${id}`)
                .toBe(200);
              expect
                .soft(await readback.json(), `cleanup state for ${id}`)
                .toMatchObject({
                  id,
                  status: 'removed',
                });
            })
            .catch(() => undefined)
        )
      );
    }
    if (communityId && sellerToken) {
      await sellerContext.request
        .delete(apiUrl(`/api/social/community/${communityId}`), {
          headers: {
            ...LOCAL_HUB_HEADERS,
            Authorization: `Bearer ${sellerToken}`,
          },
        })
        .catch(() => undefined);
    }
    if (cityId && sellerToken) {
      await sellerContext.request
        .delete(apiUrl(`/api/social/community/${cityId}`), {
          headers: {
            ...LOCAL_HUB_HEADERS,
            Authorization: `Bearer ${sellerToken}`,
          },
        })
        .catch(() => undefined);
    }
    await Promise.all([
      sellerContext.close(),
      buyerContext.close(),
      outsiderContext.close(),
      anonymous.dispose(),
    ]);
  }
});
