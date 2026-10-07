import { APIRequestContext, expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { getBaseUrl } from './fixtures/helpers';
import { apiUrl, LOCAL_HUB_HEADERS } from './helpers/local-hub-api';

test.skip(
  process.env['RR08_LIVE_STACK'] !== 'true',
  'Requires the existing Local Hub and service stack'
);

const password = 'RR08-local-test-password!';
const unique = () => `${Date.now()}-${randomUUID().slice(0, 8)}`;
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkaPjPwMDAxMDAwMDAAAARHwGDXcgNqQAAAABJRU5ErkJggg==',
  'base64'
);

async function register(request: APIRequestContext, role: string) {
  const email = `rr08-${role}-${unique()}@example.test`;
  const registration = await request.post(
    `${getBaseUrl()}/api/authentication/register`,
    {
      headers: LOCAL_HUB_HEADERS,
      data: {
        fn: 'RR08',
        ln: role,
        email,
        password,
        confirm: password,
        bio: 'RR08 live acceptance fixture',
      },
    }
  );
  expect(registration.status(), await registration.text()).toBe(201);
  const login = await request.post(`${getBaseUrl()}/api/authentication/login`, {
    headers: { ...LOCAL_HUB_HEADERS, 'X-ot-session-mode': 'cookie' },
    data: { email, password },
  });
  expect(login.status(), await login.text()).toBe(201);
  const bearerLogin = await request.post(
    `${getBaseUrl()}/api/authentication/login`,
    { headers: LOCAL_HUB_HEADERS, data: { email, password } }
  );
  expect(bearerLogin.status(), await bearerLogin.text()).toBe(201);
  const data = (await bearerLogin.json()).data;
  expect(data.newToken).toEqual(expect.any(String));
  const session = await request.get(
    `${getBaseUrl()}/api/authentication/session`,
    { headers: LOCAL_HUB_HEADERS }
  );
  expect(session.status()).toBe(200);
  const sessionData = (await session.json()).data;
  return {
    email,
    token: data.newToken as string,
    profileId: sessionData.profileId as string,
  };
}

test('RR08 private community assets deny anonymous delivery during upload-in-progress', async ({
  browser,
  playwright,
}) => {
  test.setTimeout(120_000);
  const ownerContext = await browser.newContext({ baseURL: getBaseUrl() });
  const memberContext = await browser.newContext({ baseURL: getBaseUrl() });
  const outsiderContext = await browser.newContext({ baseURL: getBaseUrl() });
  const anonymous = await playwright.request.newContext();
  const marker = unique();
  let cityId: string | undefined;
  let communityId: string | undefined;
  let assetId: string | undefined;
  let publicAssetId: string | undefined;
  let listingId: string | undefined;
  let formerOwnerListingId: string | undefined;
  let formerOwnerEditAssetId: string | undefined;
  let ownerToken: string | undefined;
  let memberToken: string | undefined;
  let outsiderToken: string | undefined;
  try {
    const owner = await register(ownerContext.request, 'owner');
    const member = await register(memberContext.request, 'member');
    const outsider = await register(outsiderContext.request, 'outsider');
    ownerToken = owner.token;
    memberToken = member.token;
    outsiderToken = outsider.token;
    const auth = {
      ...LOCAL_HUB_HEADERS,
      Authorization: `Bearer ${ownerToken}`,
    };
    const cityResponse = await ownerContext.request.post(
      apiUrl('/api/social/community'),
      {
        headers: auth,
        data: {
          name: `RR08 city ${marker}`,
          slug: `rr08-city-${marker.toLowerCase()}`,
          description: 'Temporary RR08 city fixture',
          localityType: 'city',
          city: 'RR08 fixture',
          countryCode: 'USA',
          adminArea: 'RR08',
        },
      }
    );
    expect(cityResponse.status(), await cityResponse.text()).toBe(201);
    const city = await cityResponse.json();
    cityId = city.id;
    const communityResponse = await ownerContext.request.post(
      apiUrl('/api/social/community'),
      {
        headers: auth,
        data: {
          name: `RR08 private ${marker}`,
          description: 'Temporary RR08 private-media fixture',
          parentId: cityId,
          localityType: 'neighborhood',
          isPrivate: true,
        },
      }
    );
    expect(communityResponse.status(), await communityResponse.text()).toBe(
      201
    );
    const community = await communityResponse.json();
    communityId = community.id;
    expect(community.isPrivate).toBe(true);
    const memberJoin = await memberContext.request.post(
      apiUrl(`/api/social/community/${communityId}/join`),
      {
        headers: {
          ...LOCAL_HUB_HEADERS,
          Authorization: `Bearer ${memberToken}`,
        },
      }
    );
    expect(memberJoin.status(), await memberJoin.text()).toBe(201);
    const outsiderCityJoin = await outsiderContext.request.post(
      apiUrl(`/api/social/community/${cityId}/join`),
      {
        headers: {
          ...LOCAL_HUB_HEADERS,
          Authorization: `Bearer ${outsiderToken}`,
        },
      }
    );
    expect(outsiderCityJoin.status(), await outsiderCityJoin.text()).toBe(201);
    const formerOwnerListing = await memberContext.request.post(
      apiUrl('/api/classifieds'),
      {
        headers: {
          ...LOCAL_HUB_HEADERS,
          Authorization: `Bearer ${memberToken}`,
        },
        data: {
          title: `RR08 former owner listing ${marker}`,
          description: 'Owner edit after leaving',
          price: 4,
          communityId,
          imageUrls: [],
        },
      }
    );
    expect(formerOwnerListing.status(), await formerOwnerListing.text()).toBe(
      201
    );
    formerOwnerListingId = (await formerOwnerListing.json()).id;

    const uploadResponses: Array<{ status: number; id?: string }> = [];
    const page = await ownerContext.newPage();
    page.on('response', async (response) => {
      if (
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/asset')
      ) {
        const body = await response.json().catch(() => undefined);
        uploadResponses.push({ status: response.status(), id: body?.id });
      }
    });
    await page.goto(`/c/${community.slug}/classifieds/new`);
    await expect(
      page.getByRole('heading', { name: 'Post a New Listing' })
    ).toBeVisible();
    await page.locator('#title').fill(`RR08 private listing ${marker}`);
    await page.locator('#description').fill('Temporary private image fixture');
    await page.locator('#price').fill('3');
    await page.locator('input[type=file]').setInputFiles({
      name: `rr08-private-${marker}.png`,
      mimeType: 'image/png',
      buffer: png,
    });
    await expect(page.locator('.image-previews img')).toHaveCount(1);
    await expect.poll(() => uploadResponses.length).toBe(1);
    expect(uploadResponses[0].status).toBe(201);
    assetId = uploadResponses[0].id;
    // Private uploads must stay unreadable during the gap before the listing
    // row is persisted and can provide the legacy-reference fallback.
    const pendingImage = await anonymous.get(
      `${getBaseUrl()}/api/asset/${assetId}`
    );
    const pendingBytes = await pendingImage.body();
    expect.soft(pendingImage.headers()['cache-control']).toContain('no-store');
    expect.soft([401, 403, 404]).toContain(pendingImage.status());
    expect
      .soft(pendingBytes.subarray(0, 8))
      .not.toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
    await page.getByRole('button', { name: 'Post Listing' }).click();
    await expect(page).toHaveURL(`/c/${community.slug}/classifieds`);
    const listingResponse = await ownerContext.request.get(
      apiUrl(`/api/classifieds/community/${communityId}`),
      { headers: auth }
    );
    expect(listingResponse.status()).toBe(200);
    const listings = await listingResponse.json();
    const listing = (Array.isArray(listings) ? listings : listings.data).find(
      (item: { title: string }) =>
        item.title === `RR08 private listing ${marker}`
    );
    expect(listing).toBeTruthy();
    listingId = listing.id;
    expect(listing.imageUrls).toContain(`/api/asset/${assetId}`);

    if (process.env.RR08_LEGACY_PROBE === 'true') {
      // Simulate a pre-audience-migration asset only for this exact tagged
      // record. The normal live test never writes to the database directly.
      expect(assetId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(owner.profileId).toMatch(/^[0-9a-f-]{36}$/i);
      const legacyReset = execFileSync(
        'docker',
        [
          'exec',
          'db',
          'psql',
          '-U',
          'postgres',
          '-d',
          'ot_assets',
          '-v',
          'ON_ERROR_STOP=1',
          '-Atc',
          `UPDATE "asset_entity" SET "audienceCommunityIds" = '[]'::jsonb WHERE "id" = '${assetId}' AND "profileId" = '${owner.profileId}' AND "name" LIKE 'rr08-private-%'`,
        ],
        { encoding: 'utf8' }
      ).trim();
      expect(legacyReset).toBe('UPDATE 1');
    }
    const anonymousListing = await anonymous.get(
      apiUrl(`/api/classifieds/${listingId}`),
      { headers: LOCAL_HUB_HEADERS }
    );
    expect([403, 404]).toContain(anonymousListing.status());

    const assertNoPng = async (
      request: APIRequestContext,
      label: string,
      range = false
    ) => {
      const response = await request.get(
        `${getBaseUrl()}/api/asset/${assetId}`,
        {
          headers: range ? { Range: 'bytes=0-7' } : undefined,
        }
      );
      const body = await response.body();
      expect(response.headers()['cache-control']).toContain('no-store');
      expect
        .soft(
          [401, 403, 404],
          `${label} private asset response was ${response.status()} with ${
            body.length
          } bytes`
        )
        .toContain(response.status());
      expect
        .soft(body.subarray(0, 8))
        .not.toEqual(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        );
    };
    await assertNoPng(anonymous, 'anonymous', true);
    await assertNoPng(outsiderContext.request, 'nonmember');
    const approvedMemberImage = await memberContext.request.get(
      `${getBaseUrl()}/api/asset/${assetId}`
    );
    expect(approvedMemberImage.status()).toBe(200);
    expect((await approvedMemberImage.body()).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    const approvedRange = await memberContext.request.get(
      `${getBaseUrl()}/api/asset/${assetId}`,
      { headers: { Range: 'bytes=0-7' } }
    );
    expect(approvedRange.status()).toBe(206);
    expect(await approvedRange.body()).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    const memberPage = await memberContext.newPage();
    await memberPage.goto(`/c/${community.slug}/classifieds/${listingId}`);
    const memberGalleryImage = memberPage.locator('.image-gallery img').first();
    await expect(memberGalleryImage).toBeVisible();
    await expect
      .poll(() =>
        memberGalleryImage.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0
        )
      )
      .toBe(true);
    const leave = await memberContext.request.post(
      apiUrl(`/api/social/community/${communityId}/leave`),
      {
        headers: {
          ...LOCAL_HUB_HEADERS,
          Authorization: `Bearer ${memberToken}`,
        },
      }
    );
    expect(leave.status(), await leave.text()).toBe(201);
    await assertNoPng(memberContext.request, 'revoked member');
    const formerOwnerPage = await memberContext.newPage();
    await formerOwnerPage.goto(
      `/c/${community.slug}/classifieds/${formerOwnerListingId}`
    );
    await formerOwnerPage.getByRole('button', { name: 'Edit Listing' }).click();
    const editUploads: Array<{ status: number; id?: string }> = [];
    formerOwnerPage.on('response', async (response) => {
      if (
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/asset')
      ) {
        const body = await response.json().catch(() => undefined);
        editUploads.push({ status: response.status(), id: body?.id });
      }
    });
    await formerOwnerPage.locator('input[type=file]').setInputFiles({
      name: `rr08-former-owner-${marker}.png`,
      mimeType: 'image/png',
      buffer: png,
    });
    await expect.poll(() => editUploads.length).toBe(1);
    expect(editUploads[0].status).toBe(201);
    formerOwnerEditAssetId = editUploads[0].id;
    const pendingEditAsset = await anonymous.get(
      `${getBaseUrl()}/api/asset/${formerOwnerEditAssetId}`
    );
    const pendingEditBytes = await pendingEditAsset.body();
    expect(pendingEditAsset.status()).toBe(404);
    expect(pendingEditAsset.headers()['cache-control']).toContain('no-store');
    expect(pendingEditBytes.subarray(0, 8)).not.toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    const listingUpdates: Array<{
      status: number;
      payloadKeys: string[];
      body: unknown;
    }> = [];
    formerOwnerPage.on('response', async (response) => {
      if (
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname ===
          `/api/classifieds/${formerOwnerListingId}`
      ) {
        let body: unknown;
        try {
          const json = await response.json();
          body = {
            statusCode: json?.statusCode,
            message: json?.message,
            error: json?.error,
          };
        } catch {
          body = '<non-json response>';
        }
        const payload = response.request().postDataJSON() as
          | Record<string, unknown>
          | undefined;
        listingUpdates.push({
          status: response.status(),
          payloadKeys: payload ? Object.keys(payload).sort() : [],
          body,
        });
      }
    });
    await formerOwnerPage
      .getByRole('button', { name: 'Update Listing' })
      .click();
    await expect.poll(() => listingUpdates.length).toBe(1);
    expect(
      listingUpdates[0],
      `Classified edit response: ${JSON.stringify(listingUpdates[0])}`
    ).toMatchObject({ status: 200 });
    await expect(formerOwnerPage.locator('.owner-actions')).toBeVisible();
    const formerOwnerReadback = await memberContext.request.get(
      apiUrl(`/api/classifieds/${formerOwnerListingId}`),
      {
        headers: {
          ...LOCAL_HUB_HEADERS,
          Authorization: `Bearer ${memberToken}`,
        },
      }
    );
    expect(formerOwnerReadback.status()).toBe(200);
    expect((await formerOwnerReadback.json()).imageUrls).toContain(
      `/api/asset/${formerOwnerEditAssetId}`
    );
    const ownerImage = await ownerContext.request.get(
      `${getBaseUrl()}/api/asset/${assetId}`
    );
    expect(ownerImage.status()).toBe(200);
    expect((await ownerImage.body()).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );

    // Dropping an image reference must not clear its durable private audience.
    const dropImage = await ownerContext.request.put(
      apiUrl(`/api/classifieds/${listingId}`),
      {
        headers: auth,
        data: { imageUrls: [] },
      }
    );
    expect(dropImage.status(), await dropImage.text()).toBe(200);
    await assertNoPng(anonymous, 'after image reference removal');

    const publicUpload = await ownerContext.request.post(apiUrl('/api/asset'), {
      headers: auth,
      data: {
        name: `rr08-public-${marker}.png`,
        profileId: owner.profileId,
        type: 'image',
        content: `data:image/png;base64,${png.toString('base64')}`,
        fileExtension: 'png',
      },
    });
    expect(publicUpload.status(), await publicUpload.text()).toBe(201);
    publicAssetId = (await publicUpload.json()).id;
    const publicImage = await anonymous.get(
      `${getBaseUrl()}/api/asset/${publicAssetId}`
    );
    expect(publicImage.status()).toBe(200);
    expect((await publicImage.body()).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );

    const sourcePathImport = await ownerContext.request.post(
      apiUrl('/api/asset'),
      {
        headers: auth,
        data: {
          name: 'rr08-controlled-import.txt',
          profileId: owner.profileId,
          type: 'document',
          fileExtension: 'txt',
          sourcePath: '/tmp/rr08-a01-controlled-import.txt',
        },
      }
    );
    expect(sourcePathImport.status(), await sourcePathImport.text()).toBe(400);
  } finally {
    if (listingId && ownerToken) {
      await ownerContext.request
        .delete(apiUrl(`/api/classifieds/${listingId}`), {
          headers: {
            ...LOCAL_HUB_HEADERS,
            Authorization: `Bearer ${ownerToken}`,
          },
        })
        .catch(() => undefined);
    }
    if (formerOwnerListingId && memberToken) {
      await memberContext.request
        .delete(apiUrl(`/api/classifieds/${formerOwnerListingId}`), {
          headers: {
            ...LOCAL_HUB_HEADERS,
            Authorization: `Bearer ${memberToken}`,
          },
        })
        .catch(() => undefined);
    }
    if (formerOwnerEditAssetId && memberToken) {
      await memberContext.request
        .delete(apiUrl(`/api/asset/${formerOwnerEditAssetId}`), {
          headers: {
            ...LOCAL_HUB_HEADERS,
            Authorization: `Bearer ${memberToken}`,
          },
        })
        .catch(() => undefined);
    }
    if (assetId && ownerToken) {
      await ownerContext.request
        .delete(apiUrl(`/api/asset/${assetId}`), {
          headers: {
            ...LOCAL_HUB_HEADERS,
            Authorization: `Bearer ${ownerToken}`,
          },
        })
        .catch(() => undefined);
    }
    if (publicAssetId && ownerToken) {
      await ownerContext.request
        .delete(apiUrl(`/api/asset/${publicAssetId}`), {
          headers: {
            ...LOCAL_HUB_HEADERS,
            Authorization: `Bearer ${ownerToken}`,
          },
        })
        .catch(() => undefined);
    }
    if (communityId && ownerToken) {
      await ownerContext.request
        .delete(apiUrl(`/api/social/community/${communityId}`), {
          headers: {
            ...LOCAL_HUB_HEADERS,
            Authorization: `Bearer ${ownerToken}`,
          },
        })
        .catch(() => undefined);
    }
    if (cityId && ownerToken) {
      await ownerContext.request
        .delete(apiUrl(`/api/social/community/${cityId}`), {
          headers: {
            ...LOCAL_HUB_HEADERS,
            Authorization: `Bearer ${ownerToken}`,
          },
        })
        .catch(() => undefined);
    }
    await anonymous.dispose();
    await ownerContext.close();
    await memberContext.close();
    await outsiderContext.close();
  }
});
