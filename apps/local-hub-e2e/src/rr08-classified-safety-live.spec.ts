import { APIRequestContext, expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { getBaseUrl } from './fixtures/helpers';
import { apiUrl, LOCAL_HUB_HEADERS } from './helpers/local-hub-api';

test.skip(
  process.env['RR08_SAFETY_LIVE'] !== 'true',
  'Requires the existing Local Hub and service stack'
);

const password = 'RR08-local-test-password!';
const unique = () => `${Date.now()}-${randomUUID().slice(0, 8)}`;

async function createAccount(request: APIRequestContext, label: string) {
  const email = `rr08-safety-${label}-${unique()}@example.test`;
  const registration = await request.post(
    `${getBaseUrl()}/api/authentication/register`,
    {
      headers: LOCAL_HUB_HEADERS,
      data: {
        fn: 'RR08',
        ln: label,
        email,
        password,
        confirm: password,
        bio: 'RR08 Local Hub safety fixture',
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
  expect(session.status(), await session.text()).toBe(200);
  return { email, ...(await session.json()).data } as {
    email: string;
    userId: string;
    profileId: string;
  };
}

test('RR08 B03: Local Hub classifieds UI reports listings and sellers and blocks seller contact', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const ownerContext = await browser.newContext({ baseURL: getBaseUrl() });
  const reporterContext = await browser.newContext({ baseURL: getBaseUrl() });
  try {
    const owner = await createAccount(ownerContext.request, 'classified-owner');
    const reporter = await createAccount(
      reporterContext.request,
      'classified-reporter'
    );
    const marker = `RR08 listing ${unique()}`;

    const cityResponse = await ownerContext.request.post(
      apiUrl('/api/social/community'),
      {
        headers: LOCAL_HUB_HEADERS,
        data: {
          name: `RR08 city ${marker}`,
          slug: `rr08-city-${unique().toLowerCase()}`,
          description: 'Temporary no-asset classifieds test city',
          localityType: 'city',
          city: 'RR08 fixture',
          countryCode: 'USA',
          adminArea: 'RR08',
        },
      }
    );
    expect(cityResponse.status(), await cityResponse.text()).toBe(201);
    const city = await cityResponse.json();

    const joinResponse = await reporterContext.request.post(
      apiUrl(`/api/social/community/${city.id}/join`),
      { headers: LOCAL_HUB_HEADERS }
    );
    expect(joinResponse.status(), await joinResponse.text()).toBe(201);

    const listingResponse = await ownerContext.request.post(
      apiUrl('/api/classifieds'),
      {
        headers: LOCAL_HUB_HEADERS,
        data: {
          title: marker,
          description: 'RR08 asset-free live UI safety fixture',
          price: 5,
          communityId: city.id,
          imageUrls: [],
        },
      }
    );
    expect(listingResponse.status(), await listingResponse.text()).toBe(201);
    const listing = await listingResponse.json();

    const directConversationResponse = await reporterContext.request.post(
      apiUrl('/api/chat/conversations/direct/get-or-create'),
      {
        headers: LOCAL_HUB_HEADERS,
        data: { recipientProfileId: owner.profileId },
      }
    );
    expect(
      directConversationResponse.status(),
      await directConversationResponse.text()
    ).toBe(201);
    const directConversation = await directConversationResponse.json();
    const beforeBlockMessage = await reporterContext.request.post(
      apiUrl('/api/chat/messages'),
      {
        headers: LOCAL_HUB_HEADERS,
        data: {
          conversationId: directConversation.id,
          content: 'RR08 Local Hub pre-block message positive',
          recipientIds: [owner.profileId],
        },
      }
    );
    expect(beforeBlockMessage.status(), await beforeBlockMessage.text()).toBe(
      201
    );

    const page = await reporterContext.newPage();
    await page.goto(`/c/${city.slug}/classifieds`);
    const card = page
      .locator('lib-classified-card')
      .filter({ hasText: marker });
    await expect(card).toBeVisible({ timeout: 20_000 });

    await card.getByRole('button', { name: 'Report listing' }).click();
    await expect(
      page.getByRole('heading', { name: 'Report listing' })
    ).toBeVisible();
    await page.locator('#safety-report-reason').selectOption('spam');
    await page
      .locator('#safety-report-description')
      .fill('RR08 Local Hub listing report');
    await page.getByRole('button', { name: 'Send for review' }).click();
    await expect(
      page.getByRole('heading', { name: 'Report listing' })
    ).toBeHidden();

    await card.getByRole('button', { name: 'Report seller' }).click();
    await expect(
      page.getByRole('heading', { name: 'Report seller' })
    ).toBeVisible();
    await page.locator('#safety-report-reason').selectOption('other');
    await page
      .locator('#safety-report-description')
      .fill('RR08 Local Hub seller report');
    await page.getByRole('button', { name: 'Send for review' }).click();
    await expect(
      page.getByRole('heading', { name: 'Report seller' })
    ).toBeHidden();

    const ownReports = await reporterContext.request.get(
      apiUrl('/api/privacy/reports'),
      { headers: LOCAL_HUB_HEADERS }
    );
    expect(ownReports.status(), await ownReports.text()).toBe(200);
    expect(await ownReports.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: 'classified',
          contentId: listing.id,
        }),
        expect.objectContaining({
          contentType: 'seller',
          contentId: owner.profileId,
        }),
      ])
    );

    await card.getByRole('button', { name: 'Block seller' }).click();
    await expect(page.getByText('Seller blocked.')).toBeVisible();
    const blocked = await reporterContext.request.get(
      apiUrl('/api/privacy/blocked'),
      { headers: LOCAL_HUB_HEADERS }
    );
    expect(blocked.status(), await blocked.text()).toBe(200);
    expect(await blocked.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blockedId: owner.profileId }),
      ])
    );

    const blockedCreateFromReporter = await reporterContext.request.post(
      apiUrl('/api/chat/conversations/direct/get-or-create'),
      {
        headers: LOCAL_HUB_HEADERS,
        data: { recipientProfileId: owner.profileId },
      }
    );
    expect(blockedCreateFromReporter.status()).toBe(403);
    const blockedCreateFromSeller = await ownerContext.request.post(
      apiUrl('/api/chat/conversations/direct/get-or-create'),
      {
        headers: LOCAL_HUB_HEADERS,
        data: { recipientProfileId: reporter.profileId },
      }
    );
    expect(blockedCreateFromSeller.status()).toBe(403);
    for (const [context, recipientProfileId] of [
      [reporterContext, owner.profileId],
      [ownerContext, reporter.profileId],
    ] as const) {
      const blockedSend = await context.request.post(
        apiUrl('/api/chat/messages'),
        {
          headers: LOCAL_HUB_HEADERS,
          data: {
            conversationId: directConversation.id,
            content: 'RR08 blocked Local Hub message must not persist',
            recipientIds: [recipientProfileId],
          },
        }
      );
      expect(blockedSend.status()).toBe(403);
    }
    const messagesAfterBlock = await reporterContext.request.get(
      apiUrl(`/api/chat/messages/${directConversation.id}`),
      { headers: LOCAL_HUB_HEADERS }
    );
    expect(messagesAfterBlock.status(), await messagesAfterBlock.text()).toBe(
      200
    );
    expect(await messagesAfterBlock.text()).not.toContain(
      'RR08 blocked Local Hub message must not persist'
    );

    console.info(
      `[RR08 B03 Local Hub fixture] cityId=${city.id} listingId=${listing.id} sellerProfileId=${owner.profileId} reporterProfileId=${reporter.profileId}`
    );
  } finally {
    await Promise.all([ownerContext.close(), reporterContext.close()]);
  }
});
