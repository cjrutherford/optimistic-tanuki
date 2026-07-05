import { APIRequestContext, expect, Page, test } from '@playwright/test';

const PASSWORD = 'TestPassword123!';

const USERS = {
  alice: {
    email: 'social.alice@example.com',
    profileName: 'Alice Johnson',
  },
  bob: {
    email: 'social.bob@example.com',
    profileName: 'Bob Smith',
  },
} as const;

type BootstrappedUser = {
  token: string;
  profile: {
    id: string;
    profileName: string;
    appScope?: string;
  };
  profiles: Array<{
    id: string;
    profileName: string;
    appScope?: string;
  }>;
};

async function bootstrapAuth(
  request: APIRequestContext,
  page: Page,
  email: string
): Promise<BootstrappedUser> {
  const loginResponse = await request.post('/api/authentication/login', {
    data: {
      email,
      password: PASSWORD,
    },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const loginData = await loginResponse.json();
  const token = loginData.data?.newToken as string;
  expect(token).toBeTruthy();

  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64').toString()
  );
  const profilesResponse = await request.get('/api/profile', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  expect(profilesResponse.ok()).toBeTruthy();
  const allProfiles =
    (await profilesResponse.json()) as BootstrappedUser['profiles'];
  const profiles = allProfiles.filter(
    (profile) =>
      profile &&
      payload.userId &&
      (profile as any).userId === payload.userId &&
      (profile.appScope === 'client-interface' ||
        profile.appScope === 'global' ||
        !profile.appScope)
  );
  const selectedProfile =
    profiles.find((profile) => profile.appScope === 'client-interface') ||
    profiles[0];

  expect(selectedProfile?.id).toBeTruthy();

  await page.addInitScript(
    ({ authToken, persistedProfiles, persistedSelectedProfile }) => {
      localStorage.setItem('ot-client-authToken', authToken);
      localStorage.setItem(
        'ot-client-profiles',
        JSON.stringify(persistedProfiles)
      );
      localStorage.setItem(
        'ot-client-selectedProfile',
        JSON.stringify(persistedSelectedProfile)
      );
    },
    {
      authToken: token,
      persistedProfiles: profiles,
      persistedSelectedProfile: selectedProfile,
    }
  );

  return {
    token,
    profile: selectedProfile,
    profiles,
  };
}

async function getOrCreateConversation(
  request: APIRequestContext,
  token: string,
  participantIds: string[]
) {
  const response = await request.post(
    '/api/chat/conversations/direct/get-or-create',
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        participantIds,
      },
    }
  );
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function openConversation(page: Page, expectedContactName: string) {
  await page.goto('/messages', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.messages-page')).toBeVisible();
  await expect(
    page
      .locator('.contact-name')
      .filter({ hasText: expectedContactName })
      .first()
  ).toBeVisible();
  await page
    .locator('.contact-item')
    .filter({ hasText: expectedContactName })
    .first()
    .click();
}

async function sendMessage(page: Page, text: string) {
  await page.locator('textarea.compose-textarea').click();
  await page.locator('textarea.compose-textarea').fill(text);
  await page.locator('button.send-button').click();
}

async function expectMessageVisible(page: Page, text: string) {
  await expect(
    page.locator('.message-text').filter({ hasText: text }).first()
  ).toBeVisible({
    timeout: 20000,
  });
}

test.describe('Chat workflow', () => {
  test('seeded participants can load and exchange messages', async ({
    browser,
    request,
  }) => {
    test.skip(
      test.info().project.name !== 'chromium-desktop',
      'Desktop-only chat validation'
    );

    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    const alice = await bootstrapAuth(request, alicePage, USERS.alice.email);
    const bob = await bootstrapAuth(request, bobPage, USERS.bob.email);

    await getOrCreateConversation(request, alice.token, [
      alice.profile.id,
      bob.profile.id,
    ]);

    await openConversation(alicePage, USERS.bob.profileName);
    await openConversation(bobPage, USERS.alice.profileName);

    const aliceMessage = `Alice to Bob ${Date.now()}`;
    await sendMessage(alicePage, aliceMessage);
    await expectMessageVisible(alicePage, aliceMessage);

    await bobPage.reload({ waitUntil: 'domcontentloaded' });
    await openConversation(bobPage, USERS.alice.profileName);
    await expectMessageVisible(bobPage, aliceMessage);

    const bobMessage = `Bob to Alice ${Date.now()}`;
    await sendMessage(bobPage, bobMessage);
    await expectMessageVisible(bobPage, bobMessage);

    await alicePage.reload({ waitUntil: 'domcontentloaded' });
    await openConversation(alicePage, USERS.bob.profileName);
    await expectMessageVisible(alicePage, bobMessage);

    await aliceContext.close();
    await bobContext.close();
  });
});
