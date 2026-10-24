import { test, expect, Route } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

test.skip(
  process.env['OT_N06_PRIVATE_FIXTURE'] !== '1',
  'Private rebuilt-app session-boundary fixture only'
);
for (const [appId, baseURL] of [
  ['client-interface', 'http://127.0.0.1:19080'],
  ['local-hub', 'http://127.0.0.1:19081'],
] as const) {
  test(`${appId} fences late sessions, clears owned state and contains browser diagnostics`, async ({
    page,
  }, testInfo) => {
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
    let rejectSession = false;
    let holdNext = false;
    let held = false;
    let release: () => void = () => undefined;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const diagnostics: string[] = [];
    page.on('console', (message) => diagnostics.push(message.text()));
    const apiRoute = async (route: Route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/authentication/session')) {
        if (rejectSession) {
          await route.fulfill({
            status: 401,
            json: { message: 'Session no longer exists' },
          });
          return;
        }
        const response = current;
        if (holdNext) {
          holdNext = false;
          held = true;
          await barrier;
        }
        await route.fulfill({ json: { data: response, code: 0 } });
      } else if (url.pathname.endsWith('/authentication/logout')) {
        await route.fulfill({
          status: 503,
          json: { message: 'Private fixture transport fault' },
        });
      } else if (url.pathname.endsWith('/authentication/login')) {
        await route.fulfill({ json: { data: {}, code: 0 } });
      } else if (url.pathname === '/api/profile') {
        await route.fulfill({
          json: [
            {
              id: current.profileId,
              userId: current.userId,
              appScope: appId,
              profileName: current.name,
              name: current.name,
              bio: '',
              description: '',
            },
          ],
        });
      } else if (/\/profile\/[0-9a-f-]+$/.test(url.pathname)) {
        await route.fulfill({
          json: {
            id: current.profileId,
            userId: current.userId,
            appScope: appId,
            profileName: current.name,
          },
        });
      } else {
        await route.fulfill({ json: [] });
      }
    };
    await page.route('**/api/**', apiRoute);
    await page.goto(baseURL + '/login/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () =>
        !!(window as any).ng?.getComponent(document.querySelector('app-root'))
          ?.authState
    );
    const identity = () =>
      page.evaluate(() => {
        const auth = (window as any).ng.getComponent(
          document.querySelector('app-root')
        ).authState;
        return (
          (auth.getDecodedTokenValue?.() ?? auth.getUserData?.())?.userId ??
          null
        );
      });
    await expect.poll(identity).toBe(a.userId);
    holdNext = true;
    await page.evaluate(() => {
      void (window as any).ng
        .getComponent(document.querySelector('app-root'))
        .authState.restoreSession();
    });
    await expect.poll(() => held).toBe(true);
    current = b;
    await page.evaluate(async () => {
      await (window as any).ng
        .getComponent(document.querySelector('app-root'))
        .authState.login({
          email: 'b@example.test',
          password: 'private-fixture',
        });
    });
    await expect.poll(identity).toBe(b.userId);
    release();
    await page.waitForLoadState('domcontentloaded');
    await expect.poll(identity).toBe(b.userId);
    const second = await page.context().newPage();
    await second.route('**/api/**', apiRoute);
    await second.goto(baseURL + '/login/', { waitUntil: 'domcontentloaded' });
    const secondIdentity = () =>
      second.evaluate(() => {
        const auth = (window as any).ng?.getComponent(
          document.querySelector('app-root')
        )?.authState;
        return (
          (auth?.getDecodedTokenValue?.() ?? auth?.getUserData?.())?.userId ??
          null
        );
      });
    await expect.poll(secondIdentity).toBe(b.userId);
    rejectSession = true;
    await page.evaluate(async () => {
      await (window as any).ng
        .getComponent(document.querySelector('app-root'))
        .authState.restoreSession();
    });
    await expect.poll(identity).toBeNull();
    await expect.poll(secondIdentity).toBeNull();
    rejectSession = false;
    await page.evaluate(async () => {
      await (window as any).ng
        .getComponent(document.querySelector('app-root'))
        .authState.login({
          email: 'b@example.test',
          password: 'private-fixture',
        });
    });
    await second.evaluate(async () => {
      await (window as any).ng
        .getComponent(document.querySelector('app-root'))
        .authState.restoreSession();
    });
    await expect.poll(identity).toBe(b.userId);
    await expect.poll(secondIdentity).toBe(b.userId);
    await page.evaluate(() => {
      localStorage.setItem('theme-preference', 'keep');
      localStorage.setItem('auth_token', 'N06_RETIRED_BEARER_CACHE');
      localStorage.setItem('unrelated-preference', 'keep');
      console.log('N06_PRIVATE_CONSOLE_SENTINEL', {
        token: 'N06_PRIVATE_CONSOLE_SENTINEL',
      });
      console.error(new Error('N06_PRIVATE_CONSOLE_SENTINEL'));
      (window as any).ng
        .getComponent(document.querySelector('app-root'))
        .authState.logout();
    });
    await expect.poll(identity).toBeNull();
    await expect.poll(secondIdentity).toBeNull();
    await second.close();
    const state = await page.evaluate(() => ({
      token: localStorage.getItem('ot-client-authToken'),
      retiredBearer: localStorage.getItem('auth_token'),
      profiles: localStorage.getItem('ot-client-profiles'),
      selected: localStorage.getItem('ot-client-selectedProfile'),
      theme: localStorage.getItem('theme-preference'),
      unrelated: localStorage.getItem('unrelated-preference'),
    }));
    if (appId === 'client-interface')
      expect([state.token, state.profiles, state.selected]).toEqual([
        null,
        null,
        null,
      ]);
    expect(state.retiredBearer).toBeNull();
    expect(state.theme).toBe('keep');
    expect(state.unrelated).toBe('keep');
    expect(diagnostics.join('\n')).not.toContain(
      'N06_PRIVATE_CONSOLE_SENTINEL'
    );
    const artifact = resolve(
      '.runtime-artifacts/account-rights/finish-sequence/browser-state/runtime'
    );
    mkdirSync(artifact, { recursive: true });
    await page.screenshot({
      path: resolve(
        artifact,
        `${appId}-${testInfo.project.name}-signed-out.png`
      ),
      fullPage: true,
    });
    writeFileSync(
      resolve(artifact, `${appId}-${testInfo.project.name}-report.json`),
      JSON.stringify(
        {
          status: 'PASS',
          actualRebuiltApp: true,
          actualChrome: true,
          lateResponseFenced: true,
          accountSwitchPassed: true,
          logoutDespite503: true,
          crossTabInvalidation: true,
          rejectedSessionClearsAcrossTabs: true,
          preferencePreservation: true,
          browserPayloadSentinelAbsent: true,
          limits: [
            'Session/profile HTTP replies are explicitly scripted to control races, not real Auth proof',
            'Direct app auth service login/logout API is exercised through the real Angular instance',
            'No public account-deletion UI or server revocation claim for the scripted 503',
          ],
        },
        null,
        2
      )
    );
  });
}
