/** R6 public copy, first-session links and authentic rebuilt screenshots. No successful response mocks. */
import {
  chromium,
  expect as uiExpect,
  BrowserContext,
  Page,
} from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { checkR4Accessibility } from './r4-recovery';
import {
  ACCOUNT_DELETION_OWNERS,
  AccountDeletionOwner,
} from '@optimistic-tanuki/models';

export async function runR6Release(o: {
  settings: { root: string };
  dbs: Map<AccountDeletionOwner, DataSource>;
  account: string;
  other: string;
  tokens: Record<string, string>;
}) {
  if (
    process.env['R6_RELEASE'] !== '1' ||
    process.env['D27_LIVE_FIXTURE'] !== 'private-d27-otts-v1'
  )
    throw Error('R6_PRIVATE_REQUIRED');
  // Synthetic verified accounts are inputs; this does not qualify signup or provider email.
  await o.dbs
    .get('authentication')!
    .query(
      'UPDATE user_entity SET "emailVerifiedAt"=clock_timestamp() WHERE id=ANY($1::uuid[])',
      [[o.account, o.other]]
    );
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const settleTheme = async (page: Page, mode: string) => {
    await uiExpect(page.locator('html')).toHaveAttribute('data-theme', mode);
    await page.evaluate(() => {
      getComputedStyle(document.documentElement).color;
      return Promise.all(
        document
          .getAnimations()
          .filter(
            (a) =>
              a.playState === 'running' &&
              Number.isFinite(Number(a.effect?.getComputedTiming().endTime))
          )
          .map((a) => a.finished.catch(() => undefined))
      );
    });
  };
  const apps = [];
  const diagnostics: Array<Record<string, unknown>> = [];
  const watch = (context: BrowserContext, app: string, mode: string) =>
    context.on('page', (page) => {
      page.on('pageerror', (error) =>
        diagnostics.push({
          app,
          mode,
          kind: 'pageerror',
          message: error.message,
        })
      );
      page.on('console', (message) => {
        if (message.type() === 'error')
          diagnostics.push({
            app,
            mode,
            kind: 'console',
            message: message.text().slice(0, 300),
          });
      });
      page.on('requestfailed', (request) => {
        const url = new URL(request.url());
        diagnostics.push({
          app,
          mode,
          kind: 'requestfailed',
          origin: url.origin,
          path: url.pathname,
          error: request.failure()?.errorText,
        });
      });
      page.on('response', (response) => {
        if (response.status() >= 400) {
          const url = new URL(response.url());
          diagnostics.push({
            app,
            mode,
            kind: 'http',
            origin: url.origin,
            path: url.pathname,
            status: response.status(),
          });
        }
      });
    });
  const preferences = (context: BrowserContext, mode: string) =>
    context.addInitScript((mode) => {
      if (location.origin === 'null') return;
      localStorage.setItem(
        'optimistic-tanuki-personality-theme',
        JSON.stringify({
          personalityId: 'soft-touch',
          primaryColor: '#6366f1',
          mode,
          version: '1.0.0',
        })
      );
    }, mode);
  try {
    for (const a of [
      {
        app: 'client-interface',
        name: 'Optimistic Tanuki',
        port: 19080,
        account: '/settings',
        token: o.tokens['ownOt'],
      },
      {
        app: 'local-hub',
        name: 'Towne Square',
        port: 19081,
        account: '/account',
        token: o.tokens['ownTs'],
      },
    ]) {
      const origin = 'http://127.0.0.1:' + a.port;
      const anonymous = await browser.newContext();
      watch(anonymous, a.app, 'light');
      await preferences(anonymous, 'light');
      try {
        const page = await anonymous.newPage();
        await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
        await uiExpect(
          page
            .getByRole('navigation', { name: 'Getting started and privacy' })
            .getByRole('link', { name: 'Getting started', exact: true })
        ).toBeVisible();
        const landingText = await page.locator('body').innerText();
        expect(landingText).not.toMatch(
          /free forever|join thousands|yours forever|end-to-end encrypted|guaranteed delivery/i
        );
        await page
          .getByRole('navigation', { name: 'Getting started and privacy' })
          .getByRole('link', { name: 'Getting started', exact: true })
          .click();
        await uiExpect(
          page.getByRole('heading', {
            level: 1,
            name: 'Getting started',
            exact: true,
          })
        ).toBeVisible();
        await uiExpect(page.locator('lib-release-information')).toContainText(
          a.name
        );
        await settleTheme(page, 'light');
        const scoped = page.locator('lib-release-information');
        expect(
          await scoped.locator('a[href="' + a.account + '"]').count()
        ).toBeGreaterThan(0);
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await checkR4Accessibility(
            page,
            'lib-release-information',
            join(o.settings.root, `r6-${a.app}-help-${width}.json`)
          );
          await scoped.screenshot({
            path: join(o.settings.root, `r6-${a.app}-help-${width}.png`),
          });
        }
        await scoped
          .getByRole('link', { name: 'Privacy and account data', exact: true })
          .click();
        await uiExpect(
          page.getByRole('heading', {
            name: 'Privacy and account data',
            level: 1,
            exact: true,
          })
        ).toBeVisible();
        await uiExpect(scoped).toContainText('seven days of inactivity');
        await uiExpect(scoped).toContainText('90-day');
        await uiExpect(scoped).toContainText('stays blocked');
        await uiExpect(scoped).toContainText('provider-held');
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await checkR4Accessibility(
            page,
            'lib-release-information',
            join(o.settings.root, `r6-${a.app}-privacy-${width}.json`)
          );
          await scoped.screenshot({
            path: join(o.settings.root, `r6-${a.app}-privacy-${width}.png`),
          });
        }
        await scoped
          .getByRole('link', { name: 'Contact HAI support', exact: true })
          .click();
        await uiExpect(
          page.getByRole('heading', {
            name: 'Contact Hopeful Aspirations Industries',
            exact: true,
          })
        ).toBeVisible();
        await uiExpect(
          page.locator(
            'a[href="mailto:support@hopefulaspirationsindustries.com"]'
          )
        ).toBeVisible();
        await page.goto(origin + '/help', { waitUntil: 'domcontentloaded' });
        await page
          .locator('lib-release-information')
          .getByRole('link', { name: 'Sign in', exact: true })
          .click();
        await uiExpect(page).toHaveURL(/\/login/);
      } finally {
        await anonymous.close();
      }
      const dark = await browser.newContext();
      watch(dark, a.app, 'dark');
      await preferences(dark, 'dark');
      try {
        const page = await dark.newPage();
        for (const route of ['help', 'privacy']) {
          await page.goto(origin + '/' + route, {
            waitUntil: 'domcontentloaded',
          });
          await uiExpect(
            page.locator('lib-release-information h1')
          ).toBeVisible();
          await settleTheme(page, 'dark');
          for (const width of [390, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            await checkR4Accessibility(
              page,
              'lib-release-information',
              join(o.settings.root, `r6-${a.app}-${route}-dark-${width}.json`)
            );
            await page.locator('lib-release-information').screenshot({
              path: join(
                o.settings.root,
                `r6-${a.app}-${route}-dark-${width}.png`
              ),
            });
          }
        }
      } finally {
        await dark.close();
      }
      const signed = await browser.newContext();
      watch(signed, a.app, 'signed-light');
      await preferences(signed, 'light');
      try {
        await signed.addCookies([
          {
            name: 'ot_session',
            value: a.token,
            url: origin,
            httpOnly: true,
            sameSite: 'Lax',
          },
        ]);
        const session = await signed.request.get(
          origin + '/api/authentication/session',
          { headers: { 'x-ot-appscope': a.app } }
        );
        expect(session.status()).toBe(200);
        expect((await session.json()).data.userId).toBe(o.account);
        const page = await signed.newPage();
        await page.goto(origin + '/help', { waitUntil: 'domcontentloaded' });
        await page
          .locator('lib-release-information a[href="' + a.account + '"]')
          .first()
          .click();
        await uiExpect(page.locator('lib-account-rights')).toBeVisible({
          timeout: 20000,
        });
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await page.locator('lib-account-rights').screenshot({
            path: join(o.settings.root, `r6-${a.app}-account-${width}.png`),
          });
        }

        await uiExpect(
          page.getByRole('navigation', { name: 'Getting started and privacy' })
        ).toBeVisible();
        await page
          .getByRole('navigation', { name: 'Getting started and privacy' })
          .getByRole('link', { name: 'Getting started', exact: true })
          .click();
        await uiExpect(
          page.getByRole('heading', {
            level: 1,
            name: 'Getting started',
            exact: true,
          })
        ).toBeVisible();
        const start = a.app === 'client-interface' ? '/feed' : '/cities';
        await page
          .locator('lib-release-information a[href="' + start + '"]')
          .click();
        await uiExpect(page).toHaveURL(new RegExp(start + '$'));
        if (a.app === 'client-interface')
          await uiExpect(page.locator('app-feed')).toBeVisible();
        else
          await uiExpect(
            page.getByRole('heading', {
              name: 'Explore Local Hubs',
              exact: true,
            })
          ).toBeVisible();
        await page.goto(origin + '/help', { waitUntil: 'domcontentloaded' });
        await page.reload();
        await uiExpect(
          page.getByRole('heading', {
            level: 1,
            name: 'Getting started',
            exact: true,
          })
        ).toBeVisible();
        apps.push({
          app: a.app,
          anonymousHelp: true,
          privacy: true,
          supportRoute: true,
          loginRoute: true,
          sameAccount: true,
          accountControls: true,
          startingWorkflow: true,
          reload: true,
        });
      } finally {
        await signed.close();
      }
    }
    await writeFile(
      join(o.settings.root, 'r6-diagnostics.json'),
      JSON.stringify(diagnostics, null, 2)
    );
    expect(diagnostics.filter((d) => d['kind'] === 'pageerror')).toEqual([]);
    await writeFile(
      join(o.settings.root, 'r6-browser.json'),
      JSON.stringify(
        {
          passed: true,
          apps,
          screenshots: 20,
          axeReports: 16,
          successfulResponseMocks: false,
          fixtureVerifiedSessions: true,
        },
        null,
        2
      )
    );
    await writeFile(
      join(o.settings.root, 'result.json'),
      JSON.stringify(
        {
          acceptedReleaseGuidance: true,
          acceptedJourneys: false,
          acceptedLocalProtocol: false,
          owners: [...ACCOUNT_DELETION_OWNERS],
          scope: ['client-interface', 'local-hub'],
          externalProvidersQualified: false,
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
}
