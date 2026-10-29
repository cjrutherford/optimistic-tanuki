import { APIRequestContext, expect, Page, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  createLocalChatCleanupPool,
  readDeletedDirectMessageRetention,
  softDeleteExactDirectConversation,
  timedAwaitedStage,
} from '../../../tools/testing/rr10-direct-chat-cleanup';
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
  return timedAwaitedStage(`RR06 register/login/session ${role}`, async () => {
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
    const login = await request.post(
      `${getBaseUrl()}/api/authentication/login`,
      {
        headers: { ...LOCAL_HUB_HEADERS, 'X-ot-session-mode': 'cookie' },
        data: { email, password },
      }
    );
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
  });
}

type SocketFrameEvidence = {
  direction: 'sent' | 'received';
  namespace: string;
  event: string;
  elapsedMs: number;
  matchedConversation: boolean;
  matchedParticipant: boolean;
};

function observeChatSocketFrames(
  page: import('@playwright/test').Page,
  startedAt: number,
  getConversationId: () => string | undefined,
  participantIds: string[]
): SocketFrameEvidence[] {
  const evidence: SocketFrameEvidence[] = [];
  page.on('websocket', (socket) => {
    const namespace = new URL(socket.url()).pathname;
    const record = (direction: 'sent' | 'received', raw: string | Buffer) => {
      const frame = typeof raw === 'string' ? raw : raw.toString('utf8');
      let event = frame.slice(0, 2) === '40' ? 'connect' : 'control';
      let fields: unknown;
      const jsonStart = frame.indexOf('[');
      if (jsonStart >= 0) {
        try {
          fields = JSON.parse(frame.slice(jsonStart));
          if (Array.isArray(fields) && typeof fields[0] === 'string')
            event = fields[0];
        } catch {
          event = 'unparsed-event';
        }
      }
      const safeJson = JSON.stringify(fields ?? '');
      evidence.push({
        direction,
        namespace,
        event,
        elapsedMs: Math.round(performance.now() - startedAt),
        matchedConversation: Boolean(
          getConversationId() && safeJson.includes(getConversationId()!)
        ),
        matchedParticipant: participantIds.some((id) => safeJson.includes(id)),
      });
    };
    socket.on('framesent', (frame) => record('sent', frame.payload));
    socket.on('framereceived', (frame) => record('received', frame.payload));
  });
  return evidence;
}

test('RR06 asset diagnostic captures upload response and persisted listing URL', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ baseURL: getBaseUrl() });
  const marker = unique();
  let communityId: string | undefined;
  let listingId: string | undefined;
  let assetId: string | undefined;
  let sellerToken: string | undefined;
  try {
    const seller = await registeredBrowserSession(context.request, 'asset');
    const login = await context.request.post(
      apiUrl('/api/authentication/login'),
      { headers: LOCAL_HUB_HEADERS, data: { email: seller.email, password } }
    );
    expect(login.status(), await login.text()).toBe(201);
    sellerToken = (await login.json()).data.newToken as string;
    const auth = {
      ...LOCAL_HUB_HEADERS,
      Authorization: `Bearer ${sellerToken}`,
    };
    const communityResponse = await context.request.post(
      apiUrl('/api/social/community'),
      {
        headers: auth,
        data: {
          name: `RR06 asset ${marker}`,
          slug: `rr06-asset-${marker.toLowerCase()}`,
          description: 'Temporary RR06 image upload diagnostic',
          localityType: 'city',
          city: 'RR06 fixture',
          countryCode: 'USA',
          adminArea: 'RR06',
        },
      }
    );
    expect(communityResponse.status(), await communityResponse.text()).toBe(
      201
    );
    const community = await communityResponse.json();
    communityId = community.id;

    const uploadResponses: Array<{
      status: number;
      body?: { id?: string };
    }> = [];
    const page = await context.newPage();
    page.on('response', async (response) => {
      const request = response.request();
      if (
        request.method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/asset')
      ) {
        const body = await response.json().catch(() => undefined);
        uploadResponses.push({ status: response.status(), body });
      }
    });
    await page.goto(`/c/${community.slug}/classifieds/new`);
    await expect(
      page.getByRole('heading', { name: 'Post a New Listing' })
    ).toBeVisible();
    await page.locator('#title').fill(`RR06 image ${marker}`);
    await page.locator('#description').fill('Image persistence diagnostic');
    await page.locator('#price').fill('2');
    await page.locator('input[type=file]').setInputFiles({
      name: 'rr06-valid-fixture.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkaPjPwMDAxMDAwMDAAAARHwGDXcgNqQAAAABJRU5ErkJggg==',
        'base64'
      ),
    });
    await expect(page.locator('.image-previews img')).toHaveCount(1);
    await expect.poll(() => uploadResponses.length).toBe(1);
    expect(
      uploadResponses[0].status,
      `asset upload response body: ${JSON.stringify(uploadResponses[0].body)}`
    ).toBe(201);
    assetId = uploadResponses[0].body?.id;
    expect(assetId, 'asset create response should include an id').toBeTruthy();
    await page.getByRole('button', { name: 'Post Listing' }).click();
    await expect(page).toHaveURL(`/c/${community.slug}/classifieds`);
    const listingCard = page
      .locator('.classified-card')
      .filter({ hasText: `RR06 image ${marker}` });
    const renderedImage = listingCard.locator(
      `img[src="/api/asset/${assetId}"]`
    );
    await expect(renderedImage).toBeVisible();
    await expect
      .poll(() =>
        renderedImage.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
        )
      )
      .toBe(true);

    const listingsResponse = await context.request.get(
      apiUrl(`/api/classifieds/community/${communityId}`),
      { headers: auth }
    );
    expect(listingsResponse.status()).toBe(200);
    const listings = await listingsResponse.json();
    const listing = (Array.isArray(listings) ? listings : listings.data).find(
      (item: { title: string; profileId: string }) =>
        item.title === `RR06 image ${marker}` &&
        item.profileId === seller.profileId
    );
    expect(listing).toBeTruthy();
    listingId = listing.id;
    expect(listing.imageUrls).toEqual([`/api/asset/${assetId}`]);
    const imageResponse = await context.request.get(
      `${getBaseUrl()}/api/asset/${assetId}`
    );
    expect(imageResponse.status()).toBe(200);
    expect(imageResponse.headers()['content-type']).toContain('image/png');
    const fullImage = await imageResponse.body();
    expect(fullImage.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    const imageRange = await context.request.get(
      `${getBaseUrl()}/api/asset/${assetId}`,
      { headers: { Range: 'bytes=0-7' } }
    );
    expect(imageRange.status()).toBe(206);
    expect(imageRange.headers()['content-range']).toBe(
      `bytes 0-7/${fullImage.length}`
    );
    expect(Number(imageRange.headers()['content-length'])).toBe(8);
    expect(await imageRange.body()).toEqual(fullImage.subarray(0, 8));
    const invalidImageRange = await context.request.get(
      `${getBaseUrl()}/api/asset/${assetId}`,
      { headers: { Range: `bytes=${fullImage.length}-` } }
    );
    expect(invalidImageRange.status()).toBe(416);
    expect(invalidImageRange.headers()['content-range']).toBe(
      `bytes */${fullImage.length}`
    );
  } finally {
    const cleanupHeaders = sellerToken
      ? { ...LOCAL_HUB_HEADERS, Authorization: `Bearer ${sellerToken}` }
      : LOCAL_HUB_HEADERS;
    if (listingId && sellerToken) {
      const deleted = await context.request.delete(
        apiUrl(`/api/classifieds/${listingId}`),
        { headers: cleanupHeaders }
      );
      expect([200, 204]).toContain(deleted.status());
    }
    if (assetId && sellerToken) {
      const deleted = await context.request.delete(
        apiUrl(`/api/asset/${assetId}`),
        { headers: cleanupHeaders }
      );
      expect([200, 204]).toContain(deleted.status());
      const readback = await context.request.get(
        apiUrl(`/api/asset/${assetId}`),
        { headers: cleanupHeaders }
      );
      expect(readback.status()).toBe(404);
    }
    if (communityId && sellerToken) {
      const deleted = await context.request.delete(
        apiUrl(`/api/social/community/${communityId}`),
        { headers: cleanupHeaders }
      );
      expect([200, 204]).toContain(deleted.status());
    }
    await context.close();
  }
});

test('RR06 live locality, classified authorization, and buyer/seller flow', async ({
  browser,
  playwright,
}) => {
  test.skip(
    process.env['RR10_I03_LIVE_STACK'] !== 'true',
    'Requires reviewed exact direct-chat cleanup before rerun'
  );
  test.setTimeout(180_000);
  const sellerContext = await browser.newContext({ baseURL: getBaseUrl() });
  const buyerContext = await browser.newContext({ baseURL: getBaseUrl() });
  const outsiderContext = await browser.newContext({ baseURL: getBaseUrl() });
  const communityOwnerContext = await browser.newContext({
    baseURL: getBaseUrl(),
  });
  const anonymous = await playwright.request.newContext();
  let cityId: string | undefined;
  let communityId: string | undefined;
  let listingId: string | undefined;
  const unexpectedListingIds: Array<{ id: string; token: string }> = [];
  const uploadedAssetIds: string[] = [];
  let sellerToken: string | undefined;
  let buyerToken: string | undefined;
  let communityOwnerToken: string | undefined;
  const directChatStartedAt = new Date();
  const directChatMonotonicStart = performance.now();
  let directConversationId: string | undefined;
  let buyerProfileId: string | undefined;
  let sellerProfileId: string | undefined;
  const socketFrameBuffers: SocketFrameEvidence[][] = [];
  let sellerSocketEvidence: SocketFrameEvidence[] = [];
  const chatPages: Page[] = [];
  const chatCleanupErrors: string[] = [];
  const marker = unique();
  const auth = (token: string | undefined) => {
    if (!token) throw new Error('The scoped test session is unavailable');
    return {
      ...LOCAL_HUB_HEADERS,
      Authorization: `Bearer ${token}`,
    };
  };

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
    const communityOwner = await registeredBrowserSession(
      communityOwnerContext.request,
      'community-owner'
    );
    buyerProfileId = buyer.profileId;
    sellerProfileId = seller.profileId;

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
    buyerToken = await loginToken(buyerContext, buyer.email);
    const outsiderToken = await loginToken(outsiderContext, outsider.email);
    communityOwnerToken = await loginToken(
      communityOwnerContext,
      communityOwner.email
    );
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

    const createCommunity = await communityOwnerContext.request.post(
      apiUrl('/api/social/community'),
      {
        headers: auth(communityOwnerToken),
        data: {
          name: `RR06 community ${marker}`,
          description: 'Temporary RR06 child locality fixture',
          parentId: cityId,
          localityType: 'neighborhood',
          isPrivate: true,
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
    expect(
      nonmemberCreate.status(),
      `nonmember create: ${await nonmemberCreate.text()}`
    ).toBe(403);

    const page = await sellerContext.newPage();
    const assetUploads: Array<{ status: number; id?: string }> = [];
    page.on('response', async (response) => {
      if (
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/asset')
      ) {
        const body = await response.json().catch(() => undefined);
        assetUploads.push({ status: response.status(), id: body?.id });
      }
    });
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
        'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkaPjPwMDAxMDAwMDAAAARHwGDXcgNqQAAAABJRU5ErkJggg==',
        'base64'
      ),
    });
    await expect(page.locator('.image-previews img')).toHaveCount(1);
    await expect.poll(() => assetUploads.length).toBe(1);
    expect(assetUploads[0].status).toBe(201);
    expect(assetUploads[0].id).toEqual(expect.any(String));
    uploadedAssetIds.push(assetUploads[0].id!);
    await page.getByRole('button', { name: 'Post Listing' }).click();
    await expect(page).toHaveURL(`/c/${community.slug}/classifieds`);
    const card = page
      .locator('.classified-card')
      .filter({ hasText: payload.title })
      .filter({ hasText: 'RR06 seller' });
    await expect(card).toBeVisible();
    expect(assetUploads[0].id).toEqual(expect.any(String));
    const persistedImageResponse = await sellerContext.request.get(
      `${getBaseUrl()}/api/asset/${assetUploads[0].id}`
    );
    expect(persistedImageResponse.status()).toBe(200);
    expect(persistedImageResponse.headers()['content-type']).toContain(
      'image/png'
    );
    expect((await persistedImageResponse.body()).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
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
    expect(
      listing.imageUrls,
      'uploaded image should persist on the listing'
    ).toHaveLength(1);
    listingId = listing.id;

    const buyerListingResponse = await buyerContext.request.post(
      apiUrl('/api/classifieds'),
      {
        headers: auth(buyerToken),
        data: {
          title: `RR06 buyer private listing ${marker}`,
          description: 'Second private-community listing for owner isolation',
          price: 9,
          category: 'for-sale',
          communityId,
        },
      }
    );
    expect(
      buyerListingResponse.status(),
      await buyerListingResponse.text()
    ).toBe(201);
    const buyerListing = await buyerListingResponse.json();
    unexpectedListingIds.push({ id: buyerListing.id, token: buyerToken });

    const deniedUpdate = await buyerContext.request.put(
      apiUrl(`/api/classifieds/${listingId}`),
      {
        headers: auth(buyerToken),
        data: { title: 'RR06 unauthorized mutation' },
      }
    );
    expect(
      [403, 404],
      `unauthorized update response: ${await deniedUpdate.text()}`
    ).toContain(deniedUpdate.status());
    const deniedDelete = await buyerContext.request.delete(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: auth(buyerToken) }
    );
    expect(
      [403, 404],
      `unauthorized delete response: ${await deniedDelete.text()}`
    ).toContain(deniedDelete.status());
    const ownerRowAfterDeniedMutations = await sellerContext.request.get(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: auth(sellerToken) }
    );
    expect(ownerRowAfterDeniedMutations.status()).toBe(200);
    expect(await ownerRowAfterDeniedMutations.json()).toMatchObject({
      id: listingId,
      title: payload.title,
      profileId: seller.profileId,
      status: 'active',
    });

    const privateCommunityListings = await outsiderContext.request.get(
      apiUrl(`/api/classifieds/community/${communityId}`),
      { headers: auth(outsiderToken) }
    );
    expect(privateCommunityListings.status()).toBe(200);
    expect(JSON.stringify(await privateCommunityListings.json())).not.toContain(
      listingId
    );
    const memberPrivateList = await buyerContext.request.get(
      apiUrl(`/api/classifieds/community/${communityId}`),
      { headers: auth(buyerToken) }
    );
    expect(memberPrivateList.status()).toBe(200);
    expect(JSON.stringify(await memberPrivateList.json())).toContain(listingId);
    const memberPrivateIdRead = await buyerContext.request.get(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: auth(buyerToken) }
    );
    expect(memberPrivateIdRead.status()).toBe(200);
    expect((await memberPrivateIdRead.json()).id).toBe(listingId);
    const privateSearch = await outsiderContext.request.post(
      apiUrl('/api/classifieds/search'),
      {
        headers: auth(outsiderToken),
        data: { communityId, query: payload.title },
      }
    );
    // Nest's POST route uses its standard 201 success status.
    expect(privateSearch.status()).toBe(201);
    expect(JSON.stringify(await privateSearch.json())).not.toContain(listingId);
    const privateIdRead = await anonymous.get(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: LOCAL_HUB_HEADERS }
    );
    expect([403, 404], await privateIdRead.text()).toContain(
      privateIdRead.status()
    );
    const publicCityControlRead = await anonymous.get(
      apiUrl(`/api/classifieds/${cityControlListing.id}`),
      { headers: LOCAL_HUB_HEADERS }
    );
    expect(publicCityControlRead.status()).toBe(200);
    expect((await publicCityControlRead.json()).id).toBe(cityControlListing.id);

    const missingScopeRead = await anonymous.get(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: { Authorization: '' } }
    );
    expect([400, 403, 404], await missingScopeRead.text()).toContain(
      missingScopeRead.status()
    );
    const foreignScopeRead = await anonymous.get(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: { ...LOCAL_HUB_HEADERS, 'X-ot-appscope': 'client-interface' } }
    );
    expect([403, 404], await foreignScopeRead.text()).toContain(
      foreignScopeRead.status()
    );
    const foreignScopeMutation = await sellerContext.request.put(
      apiUrl(`/api/classifieds/${listingId}`),
      {
        headers: { ...auth(sellerToken), 'X-ot-appscope': 'client-interface' },
        data: { title: 'RR06 wrong scope mutation' },
      }
    );
    expect([403, 404], await foreignScopeMutation.text()).toContain(
      foreignScopeMutation.status()
    );
    const scopedRowAfterForeignMutation = await sellerContext.request.get(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: auth(sellerToken) }
    );
    expect(scopedRowAfterForeignMutation.status()).toBe(200);
    expect(await scopedRowAfterForeignMutation.json()).toMatchObject({
      id: listingId,
      title: payload.title,
      profileId: seller.profileId,
      status: 'active',
    });

    // A second registered browser user contacts the seller. The listing title,
    // price and route must be present in the initial real conversation.
    const buyerPage = await buyerContext.newPage();
    chatPages.push(buyerPage);
    socketFrameBuffers.push(
      observeChatSocketFrames(
        buyerPage,
        directChatMonotonicStart,
        () => directConversationId,
        [buyer.profileId, seller.profileId]
      )
    );
    await buyerPage.goto(`/c/${community.slug}/classifieds/${listingId}`);
    buyerPage.on('request', (request) => {
      const url = new URL(request.url());
      if (!url.pathname.includes('/api/chat/')) return;
      let bodyFields: string[] = [];
      try {
        const body = request.postDataJSON();
        if (body && typeof body === 'object') bodyFields = Object.keys(body);
      } catch {
        // This diagnostic records field names only; it never prints message text.
      }
      console.info(
        '[RR06 chat request]',
        JSON.stringify({
          method: request.method(),
          path: url.pathname,
          bodyFields,
        })
      );
    });
    buyerPage.on('response', async (response) => {
      const url = new URL(response.url());
      if (!url.pathname.includes('/api/chat/')) return;
      const rawBody = await response.text().catch(() => '');
      let bodySummary: Record<string, unknown> = {
        bodyLength: rawBody.length,
      };
      try {
        const body = JSON.parse(rawBody);
        if (body && typeof body === 'object' && !Array.isArray(body)) {
          bodySummary = {
            bodyFields: Object.keys(body),
            ...(typeof body.statusCode === 'number'
              ? { statusCode: body.statusCode }
              : {}),
          };
        }
      } catch {
        // Never include response content that could contain private messages.
      }
      console.info(
        '[RR06 chat response]',
        JSON.stringify({
          method: response.request().method(),
          path: url.pathname,
          status: response.status(),
          ...bodySummary,
        })
      );
    });
    const listingImage = buyerPage.locator('.image-gallery img').first();
    await expect(listingImage).toBeVisible();
    await expect
      .poll(() =>
        listingImage.evaluate(
          (image) => (image as HTMLImageElement).naturalWidth
        )
      )
      .toBeGreaterThan(0);
    const chatResponsePromise = buyerPage
      .waitForResponse(
        (response) =>
          response.url().includes('/chat/conversations/direct/get-or-create'),
        { timeout: 10000 }
      )
      .catch(() => undefined);
    await timedAwaitedStage('RR06 buyer contact seller UI action', async () => {
      await buyerPage.getByRole('button', { name: 'Contact Seller' }).click();
    });
    const chatResponse = await timedAwaitedStage(
      'RR06 direct conversation bootstrap HTTP response',
      () => chatResponsePromise
    );
    expect(
      chatResponse?.status(),
      `Contact Seller chat bootstrap response: ${await chatResponse
        ?.text()
        .catch(() => 'request did not occur')}`
    ).toBe(201);
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
      const conversationData = await chatResponse.json();
      const conversationId = conversationData.id;
      directConversationId = conversationId;
      expect(conversationId).toEqual(expect.any(String));

      // Keep the seller inbox connected before the buyer's first send. This
      // exercises the live first-message event that adds a new direct room to
      // the seller's already-open conversation list.
      const sellerMessagesPage = await sellerContext.newPage();
      chatPages.push(sellerMessagesPage);
      sellerSocketEvidence = observeChatSocketFrames(
        sellerMessagesPage,
        directChatMonotonicStart,
        () => directConversationId,
        [buyer.profileId, seller.profileId]
      );
      socketFrameBuffers.push(sellerSocketEvidence);
      const sellerHistoryReads: Array<{
        status: number;
        isTargetConversation: boolean;
        messageCount: number;
        containsBuyerMarker: boolean;
      }> = [];
      sellerMessagesPage.on('response', async (response) => {
        const url = new URL(response.url());
        if (
          response.request().method() !== 'GET' ||
          !/^\/api\/chat\/messages\/[^/]+$/.test(url.pathname)
        ) {
          return;
        }
        const body = await response.json().catch(() => undefined);
        const messages = Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
          ? body.data
          : [];
        sellerHistoryReads.push({
          status: response.status(),
          isTargetConversation:
            url.pathname === `/api/chat/messages/${conversationId}`,
          messageCount: messages.length,
          containsBuyerMarker: messages.some(
            (message: { content?: string }) =>
              typeof message.content === 'string' &&
              message.content.includes('RR06 buyer opening')
          ),
        });
      });
      await sellerMessagesPage.goto('/messages');
      await expect(
        sellerMessagesPage.getByRole('heading', { name: 'Messages' })
      ).toBeVisible();

      const buyerMessage = `RR06 buyer opening ${marker}`;
      await buyerPage.getByLabel('Message').fill(buyerMessage);
      await timedAwaitedStage('RR06 buyer send message UI action', async () => {
        await buyerPage.getByRole('button', { name: 'Send' }).click();
      });
      await timedAwaitedStage('RR06 buyer message visible after send', () =>
        expect(
          buyerPage
            .locator('.message-content')
            .filter({ hasText: buyerMessage })
        ).toBeVisible()
      );

      const sellerMessagesResponse = await timedAwaitedStage(
        'RR06 persisted buyer message readback',
        () =>
          sellerContext.request.get(
            apiUrl(`/api/chat/messages/${conversationId}`),
            { headers: auth(sellerToken) }
          )
      );
      expect(
        sellerMessagesResponse.status(),
        await sellerMessagesResponse.text()
      ).toBe(200);
      expect(JSON.stringify(await sellerMessagesResponse.json())).toContain(
        buyerMessage
      );
      const sellerReply = `RR06 seller reply ${marker}`;
      const sendSellerReply = await timedAwaitedStage(
        'RR06 seller API reply persist',
        () =>
          sellerContext.request.post(apiUrl('/api/chat/messages'), {
            headers: auth(sellerToken),
            data: {
              conversationId,
              content: sellerReply,
              recipientIds: [buyer.profileId],
            },
          })
      );
      expect(sendSellerReply.status(), await sendSellerReply.text()).toBe(201);
      const buyerMessagesAfterApiReply = await buyerContext.request.get(
        apiUrl(`/api/chat/messages/${conversationId}`),
        { headers: auth(buyerToken) }
      );
      expect(buyerMessagesAfterApiReply.status()).toBe(200);
      expect(JSON.stringify(await buyerMessagesAfterApiReply.json())).toContain(
        sellerReply
      );

      // The seller also has community threads created by the listing journey.
      // Select the direct buyer thread by participant identity, not list size.
      const sellerConversation = sellerMessagesPage
        .locator('.contact-item')
        .filter({ hasText: /RR06 buyer/i });
      await expect(sellerConversation)
        .toHaveCount(1, { timeout: 15000 })
        .catch(() => undefined);
      const sellerConversationList = await sellerContext.request.get(
        apiUrl('/api/chat/conversations/find'),
        { headers: auth(sellerToken) }
      );
      const sellerConversationListBody = await sellerConversationList
        .json()
        .catch(() => undefined);
      const sellerConversationRows = Array.isArray(sellerConversationListBody)
        ? sellerConversationListBody
        : Array.isArray(sellerConversationListBody?.data)
        ? sellerConversationListBody.data
        : [];
      const targetSocketFrames = sellerSocketEvidence.filter(
        (frame) => frame.matchedConversation
      );
      console.info(
        '[RR06 seller inbox diagnostic]',
        JSON.stringify({
          inboxHttpStatus: sellerConversationList.status(),
          apiListContainsTarget: sellerConversationRows.some(
            (conversation: { id?: string }) =>
              conversation.id === conversationId
          ),
          uiContactCount: await sellerConversation.count(),
          socketConnectFrames: sellerSocketEvidence.filter(
            (frame) => frame.event === 'connect'
          ).length,
          socketEvents: sellerSocketEvidence.map(
            ({ direction, namespace, event }) => ({
              direction,
              namespace,
              event,
            })
          ),
          targetConversationFrameEvents: targetSocketFrames.map(
            ({ direction, event, elapsedMs }) => ({
              direction,
              event,
              elapsedMs,
            })
          ),
          historyReads: sellerHistoryReads,
        })
      );
      await expect(sellerConversation).toHaveCount(1);
      await sellerConversation.click();
      await timedAwaitedStage(
        'RR06 seller browser receives buyer message',
        async () => {
          try {
            await expect(
              sellerMessagesPage
                .locator('.message-text')
                .filter({ hasText: buyerMessage })
            ).toBeVisible({ timeout: 15000 });
          } catch (error) {
            const bodyText = await sellerMessagesPage
              .locator('body')
              .innerText();
            console.info(
              '[RR06 seller message render diagnostic]',
              JSON.stringify({
                historyReads: sellerHistoryReads,
                selectedContactCount: await sellerMessagesPage
                  .locator('.contact-item')
                  .filter({ hasText: /RR06 buyer/i })
                  .count(),
                renderedMessageCount: await sellerMessagesPage
                  .locator('.message-text')
                  .count(),
                buyerTextRendered: bodyText.includes(buyerMessage),
                emptyThreadVisible: bodyText.includes('No messages yet'),
                browserSocketFrames: sellerSocketEvidence.length,
              })
            );
            throw error;
          }
        }
      );
      const uiSellerReply = `RR06 seller UI reply ${marker}`;
      await sellerMessagesPage
        .locator('lib-compose-chat textarea')
        .fill(uiSellerReply);
      await sellerMessagesPage.locator('lib-compose-chat .send-button').click();
      await expect(
        sellerMessagesPage
          .locator('.message-text')
          .filter({ hasText: uiSellerReply })
      ).toBeVisible({ timeout: 15000 });

      const buyerMessagesPage = await buyerContext.newPage();
      chatPages.push(buyerMessagesPage);
      socketFrameBuffers.push(
        observeChatSocketFrames(
          buyerMessagesPage,
          directChatMonotonicStart,
          () => directConversationId,
          [buyer.profileId, seller.profileId]
        )
      );
      await buyerMessagesPage.goto('/messages');
      const buyerConversation = buyerMessagesPage
        .locator('.contact-item')
        .filter({ hasText: /RR06 seller/i });
      await expect(buyerConversation).toHaveCount(1, { timeout: 15000 });
      await buyerConversation.click();
      await expect(
        buyerMessagesPage
          .locator('.message-text')
          .filter({ hasText: uiSellerReply })
      ).toBeVisible({ timeout: 15000 });
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
    expect(edit.status(), `owner edit: ${await edit.text()}`).toBe(200);
    const sold = await sellerContext.request.post(
      apiUrl(`/api/classifieds/${listingId}/sold`),
      { headers: auth(sellerToken) }
    );
    expect(sold.status(), `owner sold: ${await sold.text()}`).toBe(201);
    await buyerPage.reload();
    await expect(buyerPage.locator('.status-badge.status-sold')).toBeVisible();
    await expect(
      buyerPage.getByRole('button', { name: 'Contact Seller' })
    ).toHaveCount(0);
    const removed = await sellerContext.request.delete(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: auth(sellerToken) }
    );
    expect([200, 204], `owner remove: ${await removed.text()}`).toContain(
      removed.status()
    );
    const removalReadback = await sellerContext.request.get(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: auth(sellerToken) }
    );
    expect(removalReadback.status()).toBe(200);
    expect(await removalReadback.json()).toMatchObject({
      id: listingId,
      status: 'removed',
    });
    await buyerPage.reload();
    await expect(
      buyerPage.locator('.status-badge.status-removed')
    ).toBeVisible();
    await expect(
      buyerPage.getByRole('button', { name: 'Contact Seller' })
    ).toHaveCount(0);
    const sellerLeave = await sellerContext.request.post(
      apiUrl(`/api/social/community/${communityId}/leave`),
      { headers: auth(sellerToken) }
    );
    expect(sellerLeave.status(), await sellerLeave.text()).toBe(201);
    const formerMemberEdit = await sellerContext.request.put(
      apiUrl(`/api/classifieds/${listingId}`),
      {
        headers: auth(sellerToken),
        data: { description: `RR06 owner edit after leaving ${marker}` },
      }
    );
    expect(
      formerMemberEdit.status(),
      `former member owner edit: ${await formerMemberEdit.text()}`
    ).toBe(200);
    const ownerMyAds = await sellerContext.request.get(
      apiUrl('/api/classifieds/profile/my-ads'),
      { headers: auth(sellerToken) }
    );
    expect(ownerMyAds.status()).toBe(200);
    const ownerAdsBody = await ownerMyAds.json();
    expect(JSON.stringify(ownerAdsBody)).toContain(listingId);
    expect(JSON.stringify(ownerAdsBody)).not.toContain(buyerListing.id);
    const formerMemberOwnAd = await sellerContext.request.get(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: auth(sellerToken) }
    );
    expect(formerMemberOwnAd.status()).toBe(200);
    expect(await formerMemberOwnAd.json()).toMatchObject({
      id: listingId,
      status: 'removed',
      description: `RR06 owner edit after leaving ${marker}`,
    });
    const formerMemberOtherAd = await sellerContext.request.get(
      apiUrl(`/api/classifieds/${buyerListing.id}`),
      { headers: auth(sellerToken) }
    );
    expect([403, 404], await formerMemberOtherAd.text()).toContain(
      formerMemberOtherAd.status()
    );
    const socketFrames = socketFrameBuffers.flat();
    console.info(
      '[RR06 browser chat transport evidence]',
      JSON.stringify({
        transport:
          'observed browser websocket frames; HTTP chat calls separately timed',
        frameCount: socketFrames.length,
        targetConversationMatchedFrameCount: socketFrames.filter(
          (frame) => frame.matchedConversation
        ).length,
        controlledProfileMatchedFrameCount: socketFrames.filter(
          (frame) => frame.matchedParticipant
        ).length,
        frames: socketFrames.map(
          ({
            direction,
            namespace,
            event,
            elapsedMs,
            matchedConversation,
            matchedParticipant,
          }) => ({
            direction,
            namespace,
            event,
            elapsedMs,
            matchedConversation,
            matchedParticipant,
          })
        ),
      })
    );
    listingId = undefined;
  } finally {
    await Promise.allSettled(chatPages.map((page) => page.close()));
    if (
      directConversationId &&
      buyerProfileId &&
      sellerProfileId &&
      buyerToken &&
      sellerToken
    ) {
      try {
        const pool = createLocalChatCleanupPool();
        try {
          const receipt = await timedAwaitedStage(
            'RR06 exact direct-conversation soft-delete and integrity check',
            () =>
              softDeleteExactDirectConversation(pool, {
                conversationId: directConversationId!,
                controlledProfileIds: [buyerProfileId!, sellerProfileId!],
                startedAt: directChatStartedAt,
                finishedAt: new Date(),
              })
          );
          const retained = await readDeletedDirectMessageRetention(
            pool,
            directConversationId
          );
          expect.soft(retained).toEqual({
            retainedMessageCount: receipt.retainedMessageCount,
            retainedMessageSha256: receipt.retainedMessageSha256,
          });
          for (const [context, token] of [
            [buyerContext, buyerToken],
            [sellerContext, sellerToken],
          ] as const) {
            const list = await context.request.get(
              apiUrl('/api/chat/conversations/find'),
              { headers: auth(token) }
            );
            expect.soft(list.status()).toBe(200);
            expect.soft(await list.text()).not.toContain(directConversationId);
            const history = await context.request.get(
              apiUrl(`/api/chat/messages/${directConversationId}`),
              { headers: auth(token) }
            );
            expect.soft([403, 404]).toContain(history.status());
          }
        } finally {
          await pool.end();
        }
      } catch {
        chatCleanupErrors.push('exact RR06 direct-chat cleanup failed');
      }
    }
    expect
      .soft(chatCleanupErrors, 'RR06 direct-chat fixture cleanup')
      .toEqual([]);
    console.info(
      '[RR06 exact-fixture cleanup]',
      JSON.stringify({
        exactChatCleanupCompleted: chatCleanupErrors.length === 0,
        controlledAccountsRetained: 4,
      })
    );
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
        uploadedAssetIds.map((id) =>
          sellerContext.request
            .delete(apiUrl(`/api/asset/${id}`), {
              headers: auth(sellerToken!),
            })
            .catch(() => undefined)
        )
      );
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
              const readback = await outsiderContext.request.get(
                apiUrl(`/api/classifieds/${id}`),
                {
                  headers: auth(token),
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
    if (communityId && communityOwnerToken) {
      await communityOwnerContext.request
        .delete(apiUrl(`/api/social/community/${communityId}`), {
          headers: auth(communityOwnerToken),
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
      communityOwnerContext.close(),
      anonymous.dispose(),
    ]);
  }
});
