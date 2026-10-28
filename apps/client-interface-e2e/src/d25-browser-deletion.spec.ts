import { test, expect } from '@playwright/test';

// Actual rebuilt Angular apps; HTTP responses control the session boundary.
// Gateway/Auth transport and account deletion are independently qualified by D27.
test.skip(
  process.env['OT_N06_PRIVATE_FIXTURE'] !== '1',
  'Private OT/TS session-boundary fixture only'
);
for (const [appId, baseURL] of [
  ['client-interface', 'http://127.0.0.1:19080'],
  ['local-hub', 'http://127.0.0.1:19081'],
] as const) {
  test(`${appId} clears a deleted current account across tabs and ignores an older account event`, async ({
    page,
  }) => {
    const a = {
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      profileId: '11111111-1111-4111-8111-111111111111',
      name: 'Private A',
      email: 'a@example.test',
    };
    const b = {
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      profileId: '22222222-2222-4222-8222-222222222222',
      name: 'Private B',
      email: 'b@example.test',
    };
    let current = a;
    let rejected = false;
    let logoutCalls = 0;
    await page.context().route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/authentication/session')) {
        await route.fulfill(
          rejected
            ? { status: 401, json: { message: 'Deleted session' } }
            : { json: { data: current, code: 0 } }
        );
      } else if (url.pathname.endsWith('/authentication/login'))
        await route.fulfill({ json: { data: {}, code: 0 } });
      else if (url.pathname.endsWith('/authentication/logout')) {
        logoutCalls++;
        await route.fulfill({ json: {} });
      } else if (url.pathname === '/api/profile')
        await route.fulfill({
          json: [
            {
              id: current.profileId,
              userId: current.userId,
              appScope: appId,
              profileName: current.name,
            },
          ],
        });
      else if (/\/profile\/[0-9a-f-]+$/.test(url.pathname))
        await route.fulfill({
          json: {
            id: current.profileId,
            userId: current.userId,
            appScope: appId,
            profileName: current.name,
          },
        });
      else await route.fulfill({ json: [] });
    });
    const identity = (tab: typeof page) =>
      tab.evaluate(() => {
        const auth = (window as any).ng?.getComponent(
          document.querySelector('app-root')
        )?.authState;
        return (
          (auth?.getDecodedTokenValue?.() ?? auth?.getUserData?.())?.userId ??
          null
        );
      });
    await page.goto(baseURL + '/login/', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => identity(page)).toBe(a.userId);
    current = b;
    await page.evaluate(async () => {
      await (window as any).ng
        .getComponent(document.querySelector('app-root'))
        .authState.login({
          email: 'b@example.test',
          password: 'synthetic-fixture',
        });
    });
    await expect.poll(() => identity(page)).toBe(b.userId);
    await page.evaluate(
      (accountId) =>
        window.dispatchEvent(
          new CustomEvent('ot:account-deleted', { detail: accountId })
        ),
      a.userId
    );
    await expect.poll(() => identity(page)).toBe(b.userId);
    const second = await page.context().newPage();
    await second.goto(baseURL + '/login/', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => identity(second)).toBe(b.userId);
    await page.evaluate(() => {
      localStorage.setItem('theme-preference', 'keep');
      localStorage.setItem('auth_token', 'PRIVATE_RETIRED_BEARER');
      const root = (window as any).ng.getComponent(
        document.querySelector('app-root')
      );
      if (Array.isArray(root.chatContacts)) {
        root.chatContacts = [{ id: 'private', name: 'private' }];
        root.chatConversations = [
          { id: 'private', messages: [{ content: 'private' }] },
        ];
      }
    });
    rejected = true;
    await page.evaluate(
      (accountId) =>
        window.dispatchEvent(
          new CustomEvent('ot:account-deleted', { detail: accountId })
        ),
      b.userId
    );
    await expect.poll(() => identity(page)).toBeNull();
    await expect.poll(() => identity(second)).toBeNull();
    expect(logoutCalls).toBe(0);
    const storage = await page.evaluate(() => ({
      retired: localStorage.getItem('auth_token'),
      theme: localStorage.getItem('theme-preference'),
      otToken: localStorage.getItem('ot-client-authToken'),
      otProfiles: localStorage.getItem('ot-client-profiles'),
      otSelected: localStorage.getItem('ot-client-selectedProfile'),
      tsToken: localStorage.getItem('ot-local-hub-authToken'),
    }));
    expect(storage).toEqual({
      retired: null,
      theme: 'keep',
      otToken: null,
      otProfiles: null,
      otSelected: null,
      tsToken: null,
    });
    if (appId === 'client-interface')
      expect(
        await page.evaluate(() => {
          const root = (window as any).ng.getComponent(
            document.querySelector('app-root')
          );
          return {
            contacts: root.chatContacts,
            conversations: root.chatConversations,
            selected: root.selectedProfile(),
          };
        })
      ).toEqual({ contacts: [], conversations: [], selected: null });
    await page.evaluate(async () => {
      await (window as any).ng
        .getComponent(document.querySelector('app-root'))
        .authState.restoreSession();
    });
    await expect.poll(() => identity(page)).toBeNull();
    await second.close();
  });
}
