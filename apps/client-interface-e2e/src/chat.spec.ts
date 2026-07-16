import {
  APIRequestContext,
  expect,
  Page,
  TestInfo,
  test,
} from '@playwright/test';

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

type SeedUser = (typeof USERS)[keyof typeof USERS] & {
  firstName: string;
  lastName: string;
};

const SEEDED_USERS: SeedUser[] = [
  { ...USERS.alice, firstName: 'Alice', lastName: 'Johnson' },
  { ...USERS.bob, firstName: 'Bob', lastName: 'Smith' },
];

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

type BrowserDiagnostics = {
  attach: () => Promise<void>;
  webSockets: string[];
};

function collectBrowserDiagnostics(
  page: Page,
  label: string,
  testInfo: TestInfo
): BrowserDiagnostics {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const failedResponses: Array<Record<string, unknown>> = [];
  const webSockets: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) =>
    pageErrors.push(error.stack || error.message)
  );
  page.on('requestfailed', (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()} - ${
        request.failure()?.errorText ?? 'unknown failure'
      }`
    );
  });
  page.on('websocket', (socket) => webSockets.push(socket.url()));
  page.on('response', async (response) => {
    if (response.status() < 400) {
      return;
    }

    let body = '';
    try {
      body = (await response.text()).slice(0, 4_000);
    } catch {
      body = '<response body unavailable>';
    }
    failedResponses.push({
      method: response.request().method(),
      status: response.status(),
      url: response.url(),
      body,
    });
    console.error(
      `[${label}] HTTP ${response.status()} ${response
        .request()
        .method()} ${response.url()} ${body}`
    );
  });

  return {
    webSockets,
    attach: async () => {
      await testInfo.attach(`${label}-browser-diagnostics`, {
        contentType: 'application/json',
        body: Buffer.from(
          JSON.stringify(
            {
              consoleMessages,
              pageErrors,
              failedRequests,
              failedResponses,
              webSockets,
            },
            null,
            2
          )
        ),
      });
    },
  };
}

async function ensureSeededUser(request: APIRequestContext, user: SeedUser) {
  const response = await request.post('/api/authentication/register', {
    headers: { 'X-ot-appscope': 'client-interface' },
    data: {
      email: user.email,
      fn: user.firstName,
      ln: user.lastName,
      password: PASSWORD,
      confirm: PASSWORD,
      bio: 'Playwright chat test participant',
    },
  });

  const responseBody = await response.text();
  const alreadyExists =
    response.status() === 409 ||
    (response.status() === 500 && /user already exists/i.test(responseBody));

  expect(
    response.ok() || alreadyExists,
    `Unable to seed ${user.email}: ${response.status()} ${responseBody}`
  ).toBeTruthy();
}

async function bootstrapAuth(
  request: APIRequestContext,
  page: Page,
  email: string
): Promise<BootstrappedUser> {
  const loginResponse = await request.post('/api/authentication/login', {
    headers: { 'X-ot-appscope': 'client-interface' },
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
      'X-ot-appscope': 'client-interface',
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
        'X-ot-appscope': 'client-interface',
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
  const sendButton = page.locator('otui-button.send-button button');
  await expect(sendButton).toBeEnabled({ timeout: 5_000 });
  const hitTargetIsInsideButton = await sendButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hitTarget = document.elementFromPoint(x, y);
    return !!hitTarget && button.contains(hitTarget);
  });
  expect(hitTargetIsInsideButton).toBeTruthy();
  await sendButton.click({ timeout: 5_000 });
  await expect(page.locator('textarea.compose-textarea')).toHaveValue('');
}

async function expectMessageVisible(page: Page, text: string) {
  await expect(
    page.locator('.message-text').filter({ hasText: text }).first()
  ).toBeVisible({
    timeout: 20000,
  });
}

test.use({
  screenshot: 'only-on-failure',
  trace: 'on',
  video: 'on',
});

test.describe('Chat workflow', () => {
  test('@chat-debug seeded participants can load and exchange messages', async ({
    browser,
    request,
  }, testInfo) => {
    test.setTimeout(60_000);
    await Promise.all(
      SEEDED_USERS.map((user) => ensureSeededUser(request, user))
    );

    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();
    const aliceDiagnostics = collectBrowserDiagnostics(
      alicePage,
      'alice',
      testInfo
    );
    const bobDiagnostics = collectBrowserDiagnostics(bobPage, 'bob', testInfo);

    try {
      const alice = await bootstrapAuth(request, alicePage, USERS.alice.email);
      const bob = await bootstrapAuth(request, bobPage, USERS.bob.email);

      await getOrCreateConversation(request, alice.token, [
        alice.profile.id,
        bob.profile.id,
      ]);

      await openConversation(alicePage, USERS.bob.profileName);
      await openConversation(bobPage, USERS.alice.profileName);
      await expect
        .poll(() => aliceDiagnostics.webSockets.length)
        .toBeGreaterThan(0);
      await expect
        .poll(() => bobDiagnostics.webSockets.length)
        .toBeGreaterThan(0);

      const aliceMessage = `Alice to Bob ${Date.now()}`;
      await sendMessage(alicePage, aliceMessage);
      await expectMessageVisible(alicePage, aliceMessage);
      await expectMessageVisible(bobPage, aliceMessage);

      await bobPage.reload({ waitUntil: 'domcontentloaded' });
      await openConversation(bobPage, USERS.alice.profileName);
      await expectMessageVisible(bobPage, aliceMessage);

      const bobMessage = `Bob to Alice ${Date.now()}`;
      await sendMessage(bobPage, bobMessage);
      await expectMessageVisible(bobPage, bobMessage);
      await expectMessageVisible(alicePage, bobMessage);

      await alicePage.reload({ waitUntil: 'domcontentloaded' });
      await openConversation(alicePage, USERS.bob.profileName);
      await expectMessageVisible(alicePage, bobMessage);
    } finally {
      await Promise.all([aliceDiagnostics.attach(), bobDiagnostics.attach()]);
      await Promise.all([aliceContext.close(), bobContext.close()]);
    }
  });
});
