import AxeBuilder from '@axe-core/playwright';
import {
  APIRequestContext,
  Browser,
  BrowserContext,
  expect,
  Locator,
  Page,
  test,
} from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const app = process.env['RR09_APP'] ?? 'ot';
const isTs = app === 'ts';
const origin =
  process.env['BASE_URL'] ??
  (isTs ? 'http://127.0.0.1:8087' : 'http://127.0.0.1:8080');
const scope = isTs ? 'local-hub' : 'client-interface';
const headers = { 'X-ot-appscope': scope, 'X-ot-app-id': scope };
// Per-run credentials belong only to these newly registered synthetic accounts;
// they are never written to evidence or retained for later authentication.
const password = `RR09-controlled-${randomUUID()}!`;
const evidenceDir = join(
  process.cwd(),
  '.runtime-artifacts',
  'rr09',
  'authenticated'
);
const dimensions = [
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 633 },
] as const;

type Session = {
  email: string;
  userId: string;
  profileId: string;
  token?: string;
};
type Fixture = {
  type: string;
  id?: string;
  userId?: string;
  profileId?: string;
  owner: 'owner' | 'member' | 'seller' | 'buyer';
  label: string;
  retained?: boolean;
};

function record(value: Record<string, unknown>): void {
  mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  appendFileSync(
    join(evidenceDir, `${app}-journeys.jsonl`),
    `${JSON.stringify({
      observedAt: new Date().toISOString(),
      app,
      ...value,
    })}\n`,
    { mode: 0o600 }
  );
}

async function register(
  request: APIRequestContext,
  role: string
): Promise<string> {
  const email = `rr09-${app}-${role}-${Date.now()}-${randomUUID().slice(
    0,
    8
  )}@example.test`;
  const response = await request.post(`${origin}/api/authentication/register`, {
    headers,
    data: {
      fn: 'RR09',
      ln: role,
      email,
      password,
      confirm: password,
      bio: 'Temporary RR09 accessibility audit account',
    },
  });
  expect(
    response.status(),
    `registration ${role}: ${await response.text()}`
  ).toBe(201);
  return email;
}

async function tabTo(
  page: Page,
  target: Locator,
  maxTabs = 40
): Promise<number> {
  const visited: string[] = [];
  for (let index = 1; index <= maxTabs; index += 1) {
    await page.keyboard.press('Tab');
    visited.push(
      await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        return element
          ? `${element.tagName.toLowerCase()}[role=${
              element.getAttribute('role') ?? ''
            }][aria-label=${element.getAttribute('aria-label') ?? ''}][text=${
              element.innerText?.trim().slice(0, 48) ?? ''
            }]`
          : 'none';
      })
    );
    if (
      await target
        .evaluateAll((elements) => elements.includes(document.activeElement))
        .catch(() => false)
    ) {
      return index;
    }
  }
  throw new Error(
    `Tab did not reach target within ${maxTabs} keypresses; active sequence: ${visited
      .slice(-10)
      .join(' -> ')}`
  );
}

async function typeByKeyboard(
  page: Page,
  target: Locator,
  value: string
): Promise<void> {
  await tabTo(page, target);
  await page.keyboard.type(value);
}

async function loginByKeyboard(page: Page, email: string): Promise<Session> {
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  const emailInput = page.getByLabel('Email', { exact: true });
  const passwordInput = page.getByLabel('Password', { exact: true });
  await tabTo(page, emailInput);
  await page.keyboard.type(email);
  await tabTo(page, passwordInput);
  await page.keyboard.type(password);
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
  const response = await page.request.get(
    `${origin}/api/authentication/session`,
    { headers }
  );
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()).data;
  const session: Session = {
    email,
    userId: body.userId,
    profileId: body.profileId,
  };
  record({
    type: 'account',
    userId: session.userId,
    profileId: session.profileId,
    label: 'controlled-account',
  });
  return session;
}

async function diagnostics(
  page: Page,
  label: string,
  viewport: (typeof dimensions)[number],
  theme: 'light' | 'dark'
) {
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });
  const axe = await new AxeBuilder({ page }).analyze();
  const result = await page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href],button,input,select,textarea,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    });
    return {
      url: location.pathname,
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyClass: document.body.className,
      foreground: getComputedStyle(document.body).color,
      background: getComputedStyle(document.body).backgroundColor,
      forms: Array.from(document.forms).map((form) => ({
        valid: form.checkValidity(),
        controls: Array.from(form.elements).map((control) => {
          const element = control as HTMLInputElement;
          return {
            tag: element.tagName,
            type: element.type,
            required: element.required,
            valid: element.checkValidity(),
            disabled: element.disabled,
          };
        }),
        submitButtons: Array.from(
          form.querySelectorAll<HTMLButtonElement>('button[type="submit"]')
        ).map((button) => ({
          text: button.innerText.trim(),
          disabled: button.disabled,
        })),
      })),
      controls: controls.map((element) => {
        const id = element.getAttribute('id');
        const label = id
          ? document
              .querySelector(`label[for="${CSS.escape(id)}"]`)
              ?.textContent?.trim()
          : '';
        const imageAlt = Array.from(element.querySelectorAll('img[alt]'))
          .map((image) => image.getAttribute('alt'))
          .filter(Boolean)
          .join(' ');
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          role: element.getAttribute('role'),
          nameEvidence:
            element.getAttribute('aria-label') ||
            element.getAttribute('title') ||
            label ||
            element.innerText?.trim() ||
            imageAlt ||
            element.getAttribute('placeholder') ||
            '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      animationCount: document
        .getAnimations()
        .filter((animation) => animation.playState === 'running').length,
    };
  });
  record({
    type: 'route-audit',
    label,
    theme,
    ...result,
    axe: {
      violations: axe.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
      incomplete: axe.incomplete.map((item) => item.id),
      passes: axe.passes.length,
    },
  });
  if (viewport.width === 375 || viewport.width === 1280) {
    await page.screenshot({
      path: join(evidenceDir, `${app}-${label}-${viewport.name}-${theme}.png`),
      fullPage: true,
    });
  }
}

async function scanRoute(page: Page, label: string, path: string) {
  await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main, [role="main"], body').first()).toBeVisible();
  await setThemeByKeyboard(page, 'light');
  for (const theme of ['light', 'dark'] as const) {
    for (const viewport of dimensions) {
      await diagnostics(page, label, viewport, theme);
    }
    if (theme === 'light') {
      await setThemeByKeyboard(page, 'dark');
    }
  }
  await setThemeByKeyboard(page, 'light');
}

async function setThemeByKeyboard(page: Page, targetTheme: 'light' | 'dark') {
  const trigger = page.getByRole('button', { name: 'Appearance', exact: true });
  await tabTo(page, trigger);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Appearance controls' });
  await expect(dialog).toBeVisible();
  const themeSwitch = dialog.locator('input[type="checkbox"]');
  const checked = await themeSwitch.isChecked();
  if (checked !== (targetTheme === 'dark')) {
    await tabTo(page, themeSwitch);
    await page.keyboard.press('Space');
  }
  await expect(themeSwitch).toHaveJSProperty('checked', targetTheme === 'dark');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

async function enterByKeyboard(page: Page, locator: Locator) {
  await tabTo(page, locator);
  await page.keyboard.press('Enter');
}

async function auditState(page: Page, label: string, viewport = dimensions[0]) {
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });
  const axe = await new AxeBuilder({ page }).analyze();
  const active = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return null;
    const style = getComputedStyle(element);
    return {
      tag: element.tagName,
      role: element.getAttribute('role'),
      label:
        element.getAttribute('aria-label') || element.innerText?.trim() || '',
      outline: style.outline,
      boxShadow: style.boxShadow,
    };
  });
  record({
    type: 'journey-state',
    label,
    url: new URL(page.url()).pathname,
    viewport: { width: viewport.width, height: viewport.height },
    active,
    axe: {
      violations: axe.violations.map((item) => ({
        id: item.id,
        impact: item.impact,
        targets: item.nodes.map((node) => node.target),
      })),
      incomplete: axe.incomplete.map((item) => item.id),
      passes: axe.passes.length,
    },
  });
}

test(`RR09 ${app.toUpperCase()} authenticated keyboard journeys and accessibility evidence`, async ({
  browser,
}, testInfo) => {
  test.skip(
    process.env['RR09_LIVE_STACK'] !== 'true',
    'Requires the existing development stack and controlled-account authorization'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Use one system Chrome project; this audit sets its own viewports'
  );
  test.setTimeout(240_000);
  const fixtures: Fixture[] = [];
  const contexts: BrowserContext[] = [];
  const journeyErrors: string[] = [];
  let primaryError: unknown;
  try {
    if (!isTs) {
      const ownerContext = await browser.newContext({ baseURL: origin });
      const memberContext = await browser.newContext({ baseURL: origin });
      contexts.push(ownerContext, memberContext);
      const ownerEmail = await register(ownerContext.request, 'owner');
      const memberEmail = await register(memberContext.request, 'member');
      const ownerPage = await ownerContext.newPage();
      const memberPage = await memberContext.newPage();
      const owner = await loginByKeyboard(ownerPage, ownerEmail);
      const member = await loginByKeyboard(memberPage, memberEmail);
      fixtures.push({
        type: 'account',
        id: owner.userId,
        userId: owner.userId,
        profileId: owner.profileId,
        owner: 'owner',
        label: 'controlled account retained',
        retained: true,
      });
      fixtures.push({
        type: 'account',
        id: member.userId,
        userId: member.userId,
        profileId: member.profileId,
        owner: 'member',
        label: 'controlled account retained',
        retained: true,
      });

      try {
        const communityName = `RR09 keyboard ${Date.now()}`;
        await ownerPage.goto(`${origin}/communities/create`);
        const communityForm = ownerPage.locator('lib-create-community');
        await typeByKeyboard(
          ownerPage,
          communityForm.getByLabel('Community Name', { exact: true }),
          communityName
        );
        await typeByKeyboard(
          ownerPage,
          communityForm.getByLabel('Description', { exact: true }),
          'Temporary controlled RR09 journey community'
        );
        const joinPolicy = communityForm.locator('select');
        await tabTo(ownerPage, joinPolicy);
        await ownerPage.keyboard.press('Home');
        await ownerPage.keyboard.press('ArrowDown');
        expect(await joinPolicy.inputValue()).toBe('approval_required');
        await auditState(ownerPage, 'community-create-form');
        const formState = await communityForm
          .locator('form')
          .evaluate((form: HTMLFormElement) => ({
            valid: form.checkValidity(),
            controls: Array.from(form.elements).map((control) => {
              const element = control as HTMLInputElement;
              return {
                tag: element.tagName,
                type: element.type,
                required: element.required,
                valid: element.checkValidity(),
                disabled: element.disabled,
              };
            }),
            submitButtons: Array.from(
              form.querySelectorAll<HTMLButtonElement>('button[type="submit"]')
            ).map((button) => ({
              disabled: button.disabled,
              text: button.innerText.trim(),
            })),
          }));
        record({ type: 'community-submit-ready', ...formState });
        const createdCommunity = ownerPage.waitForResponse(
          (response) =>
            response.url().endsWith('/api/social/community') &&
            response.request().method() === 'POST',
          { timeout: 15_000 }
        );
        await enterByKeyboard(
          ownerPage,
          communityForm.getByRole('button', {
            name: 'Create Community',
            exact: true,
          })
        );
        const createdCommunityResult = await createdCommunity;
        const community = await createdCommunityResult.json();
        fixtures.push({
          type: 'community',
          id: community.id,
          userId: owner.userId,
          profileId: owner.profileId,
          owner: 'owner',
          label: communityName,
        });
        record({
          type: 'fixture-created',
          fixtureType: 'community',
          id: community.id,
          owner: 'owner',
          label: communityName,
          responseStatus: createdCommunityResult.status(),
        });
        expect(
          createdCommunityResult.status(),
          await createdCommunityResult.text()
        ).toBe(201);

        await memberPage.goto(`${origin}/communities`);
        const search = memberPage.getByPlaceholder(
          'Search by name or description...'
        );
        await typeByKeyboard(memberPage, search, communityName);
        const card = memberPage
          .locator('.communities-grid .community-card')
          .filter({ hasText: communityName })
          .first();
        await expect(card).toBeVisible();
        const join = card.getByRole('button', { name: 'Join', exact: true });
        await auditState(memberPage, 'community-join-card');
        await enterByKeyboard(memberPage, join);
        await expect(
          card.getByRole('button', { name: 'Pending', exact: true })
        ).toBeVisible();
        await ownerPage.reload();
        const pending = ownerPage.getByRole('button', {
          name: /Pending Requests/,
        });
        await auditState(ownerPage, 'community-pending-requests');
        await enterByKeyboard(ownerPage, pending);
        const approve = ownerPage.getByRole('button', {
          name: 'Approve',
          exact: true,
        });
        await auditState(ownerPage, 'community-approval-dialog');
        await enterByKeyboard(ownerPage, approve);
        await expect(
          card.getByRole('button', { name: 'View Posts', exact: true })
        ).toBeVisible();
        record({
          type: 'journey-result',
          label: 'community-create-and-approval',
          status: 'complete',
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        journeyErrors.push(`community-create-and-approval: ${detail}`);
        record({
          type: 'journey-result',
          label: 'community-create-and-approval',
          status: 'failed',
          message: detail,
        });
      }

      try {
        const marker = `RR09 keyboard post ${Date.now()}`;
        await ownerPage.goto(`${origin}/feed`);
        const visibility = ownerPage.getByLabel('Who can see this post?');
        await tabTo(ownerPage, visibility);
        await ownerPage.keyboard.press('Home');
        await ownerPage.keyboard.press('Enter');
        await typeByKeyboard(
          ownerPage,
          ownerPage.getByRole('textbox', {
            name: 'Name your Masterpiece',
            exact: true,
          }),
          marker
        );
        await typeByKeyboard(
          ownerPage,
          ownerPage.locator('tiptap-editor [contenteditable="true"]'),
          'Temporary RR09 keyboard authoring fixture.'
        );
        await auditState(ownerPage, 'feed-composer');
        const postResponsePromise = ownerPage.waitForResponse(
          (response) =>
            response.url().endsWith('/api/social/post') &&
            response.request().method() === 'POST'
        );
        await enterByKeyboard(
          ownerPage,
          ownerPage.getByRole('button', { name: 'Post', exact: true })
        );
        const postResponse = await postResponsePromise;
        const post = await postResponse.json();
        fixtures.push({
          type: 'post',
          id: post.id,
          userId: owner.userId,
          profileId: owner.profileId,
          owner: 'owner',
          label: marker,
        });
        record({
          type: 'fixture-created',
          fixtureType: 'post',
          id: post.id,
          owner: 'owner',
          label: marker,
          responseStatus: postResponse.status(),
        });
        expect(postResponse.status(), await postResponse.text()).toBe(201);

        await memberPage.goto(`${origin}/feed`);
        const postCard = memberPage
          .locator('.post-container')
          .filter({ hasText: marker });
        await expect(postCard).toBeVisible({ timeout: 20_000 });
        const commentTrigger = postCard.getByRole('button', {
          name: 'Leave a Comment',
          exact: true,
        });
        await auditState(memberPage, 'feed-post-card');
        await enterByKeyboard(memberPage, commentTrigger);
        const commentEditor = postCard.locator(
          'tiptap-editor.comment-editor [contenteditable="true"]'
        );
        await expect(commentEditor).toBeVisible();
        await tabTo(memberPage, commentEditor);
        const commentText = `RR09 keyboard comment ${Date.now()}`;
        await memberPage.keyboard.type(commentText);
        const commentSubmit = postCard.getByRole('button', {
          name: 'Submit',
          exact: true,
        });
        await auditState(memberPage, 'comment-form');
        const commentResponsePromise = memberPage.waitForResponse(
          (response) =>
            response.url().endsWith('/api/social/comment') &&
            response.request().method() === 'POST'
        );
        await enterByKeyboard(memberPage, commentSubmit);
        const commentResponse = await commentResponsePromise;
        expect(commentResponse.status(), await commentResponse.text()).toBe(
          201
        );
        await expect(postCard).toContainText(commentText);

        const postMenuTrigger = postCard.getByRole('button', {
          name: '...',
          exact: true,
        });
        await postMenuTrigger.press('Enter');
        const reportButton = postCard.getByRole('button', {
          name: 'Report post',
          exact: true,
        });
        await enterByKeyboard(memberPage, reportButton);
        const reportDialog = memberPage
          .getByRole('alertdialog')
          .or(memberPage.getByRole('dialog'));
        await expect(reportDialog).toBeVisible();
        await auditState(memberPage, 'report-dialog');
        const spam = reportDialog.getByText('Spam', { exact: true });
        await enterByKeyboard(memberPage, spam);
        const reportDetails = reportDialog.locator('textarea.text-area');
        await tabTo(memberPage, reportDetails);
        await memberPage.keyboard.type(
          'Temporary RR09 accessible report-flow fixture.'
        );
        await memberPage.keyboard.press('Tab');
        expect(
          await reportDialog.evaluate((dialog) =>
            dialog.contains(document.activeElement)
          )
        ).toBe(true);
        await memberPage.keyboard.press('Escape');
        await expect(reportDialog).toBeHidden();
        await expect(postMenuTrigger).toBeFocused();
        record({
          type: 'journey-result',
          label: 'feed-comment-report',
          status: 'complete',
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        journeyErrors.push(`feed-comment-report: ${detail}`);
        record({
          type: 'journey-result',
          label: 'feed-comment-report',
          status: 'failed',
          message: detail,
        });
      }

      try {
        await ownerPage.goto(`${origin}/settings`);
        const profileEditorTrigger = ownerPage.getByRole('button', {
          name: 'Edit profile',
          exact: true,
        });
        await auditState(ownerPage, 'profile-settings');
        await enterByKeyboard(ownerPage, profileEditorTrigger);
        const profileDialog = ownerPage.getByRole('alertdialog').last();
        await expect(profileDialog).toBeVisible();
        await auditState(ownerPage, 'profile-editor-dialog');
        await ownerPage.keyboard.press('Escape');
        await expect(profileDialog).toBeHidden();
        await expect(profileEditorTrigger).toBeFocused();
        await ownerPage.goto(`${origin}/messages`);
        await auditState(ownerPage, 'messages');
        await scanRoute(ownerPage, 'feed', '/feed');
        await scanRoute(ownerPage, 'settings', '/settings');
        await scanRoute(memberPage, 'messages', '/messages');
        await expect(ownerPage).toHaveURL(/\/settings$/);
        record({
          type: 'journey-result',
          label: 'profile-settings-and-route-audit',
          status: 'complete',
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        journeyErrors.push(`profile-settings-and-route-audit: ${detail}`);
        record({
          type: 'journey-result',
          label: 'profile-settings-and-route-audit',
          status: 'failed',
          message: detail,
        });
      }
      if (journeyErrors.length)
        throw new Error(
          `Authenticated journey groups failed: ${journeyErrors.join(' | ')}`
        );
    } else {
      await runTsJourney(browser, contexts, fixtures);
    }
  } catch (error) {
    primaryError = error;
    record({
      type: 'journey-error',
      message: error instanceof Error ? error.message : String(error),
      collectorStatus: 'incomplete',
    });
    throw error;
  } finally {
    const cleanupErrors: string[] = [];
    const owners = isTs ? ['seller'] : ['owner', 'member'];
    for (const owner of owners) {
      try {
        const contextIndex = owner === 'owner' ? 0 : owner === 'member' ? 1 : 0;
        const request = contexts[contextIndex]?.request;
        if (!request) continue;
        for (const fixture of [...fixtures].reverse()) {
          if (!fixture.id || fixture.owner !== owner) continue;
          const path =
            fixture.type === 'post'
              ? `/api/social/post/${fixture.id}`
              : fixture.type === 'community'
              ? `/api/social/community/${fixture.id}`
              : fixture.type === 'listing'
              ? `/api/classifieds/${fixture.id}`
              : '';
          if (!path) continue;
          const ownerHeaders = isTs
            ? headers
            : { 'X-ot-appscope': 'social', 'X-ot-app-id': 'social' };
          const response = await request
            .delete(`${origin}${path}`, { headers: ownerHeaders })
            .catch(() => undefined);
          if (response && ![200, 204].includes(response.status()))
            cleanupErrors.push(
              `${fixture.type} ${fixture.id}: ${response.status()}`
            );
        }
      } catch (error) {
        cleanupErrors.push(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
    record({
      type: 'fixture-cleanup',
      fixtures: fixtures.map(
        ({ type, id, userId, profileId, owner, label, retained }) => ({
          type,
          id,
          userId,
          profileId,
          owner,
          label,
          retained,
        })
      ),
      cleanupErrors,
      primaryError: primaryError ? 'preserved in test result' : undefined,
    });
    if (!primaryError)
      expect(
        cleanupErrors,
        'Owned fixture cleanup must complete; controlled accounts are explicitly retained'
      ).toEqual([]);
    await Promise.all(
      contexts.map((context) => context.close().catch(() => undefined))
    );
  }
});

async function runTsJourney(
  browser: Browser,
  contexts: BrowserContext[],
  fixtures: Fixture[]
): Promise<void> {
  const sellerContext = await browser.newContext({ baseURL: origin });
  const buyerContext = await browser.newContext({ baseURL: origin });
  contexts.push(sellerContext, buyerContext);
  const sellerEmail = await register(sellerContext.request, 'seller');
  const buyerEmail = await register(buyerContext.request, 'buyer');
  const sellerPage = await sellerContext.newPage();
  const buyerPage = await buyerContext.newPage();
  const seller = await loginByKeyboard(sellerPage, sellerEmail);
  const buyer = await loginByKeyboard(buyerPage, buyerEmail);
  fixtures.push({
    type: 'account',
    id: seller.userId,
    userId: seller.userId,
    profileId: seller.profileId,
    owner: 'seller',
    label: 'controlled account retained',
    retained: true,
  });
  fixtures.push({
    type: 'account',
    id: buyer.userId,
    userId: buyer.userId,
    profileId: buyer.profileId,
    owner: 'buyer',
    label: 'controlled account retained',
    retained: true,
  });

  const locality = `RR09 town ${Date.now()}`;
  const cityResponse = await sellerContext.request.post(
    `${origin}/api/social/community`,
    {
      headers,
      data: {
        name: locality,
        slug: `rr09-town-${randomUUID().slice(0, 8)}`,
        description: 'Temporary RR09 locality',
        localityType: 'city',
        city: 'RR09 fixture',
        countryCode: 'USA',
        adminArea: 'RR09',
      },
    }
  );
  const city = await cityResponse.json();
  fixtures.push({
    type: 'community',
    id: city.id,
    userId: seller.userId,
    profileId: seller.profileId,
    owner: 'seller',
    label: locality,
  });
  record({
    type: 'fixture-created',
    fixtureType: 'city',
    id: city.id,
    owner: 'seller',
    label: locality,
    responseStatus: cityResponse.status(),
  });
  expect(cityResponse.status(), await cityResponse.text()).toBe(201);
  const communityResponse = await sellerContext.request.post(
    `${origin}/api/social/community`,
    {
      headers,
      data: {
        name: `${locality} neighborhood`,
        description: 'Temporary RR09 neighborhood',
        parentId: city.id,
        localityType: 'neighborhood',
        isPrivate: false,
        joinPolicy: 'public',
      },
    }
  );
  const community = await communityResponse.json();
  fixtures.push({
    type: 'community',
    id: community.id,
    userId: seller.userId,
    profileId: seller.profileId,
    owner: 'seller',
    label: community.name,
  });
  record({
    type: 'fixture-created',
    fixtureType: 'community',
    id: community.id,
    owner: 'seller',
    label: community.name,
    responseStatus: communityResponse.status(),
  });
  expect(communityResponse.status(), await communityResponse.text()).toBe(201);

  await buyerPage.goto(`${origin}/c/${community.slug}`);
  const joinResponsePromise = buyerPage.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/social/community/${community.id}/join`) &&
      response.request().method() === 'POST'
  );
  const joinButton = buyerPage.getByRole('button', { name: /join/i }).first();
  await auditState(buyerPage, 'locality-community');
  await enterByKeyboard(buyerPage, joinButton);
  const joined = await joinResponsePromise;
  expect(joined.status(), await joined.text()).toBe(201);
  record({
    type: 'membership',
    communityId: community.id,
    memberProfileId: (await joined.json()).profileId ?? undefined,
    label: community.name,
  });

  await sellerPage.setViewportSize({ width: 375, height: 812 });
  await sellerPage.goto(`${origin}/c/${community.slug}/classifieds/new`);
  await expect(
    sellerPage.getByRole('heading', { name: 'Post a New Listing' })
  ).toBeVisible();
  await auditState(sellerPage, 'listing-create-form');
  const title = `RR09 listing ${Date.now()}`;
  await typeByKeyboard(sellerPage, sellerPage.locator('#title'), title);
  await typeByKeyboard(
    sellerPage,
    sellerPage.locator('#description'),
    'Temporary RR09 keyboard contact-flow listing.'
  );
  await typeByKeyboard(sellerPage, sellerPage.locator('#price'), '7');
  await enterByKeyboard(
    sellerPage,
    sellerPage.getByRole('button', { name: 'Post Listing', exact: true })
  );
  await expect(sellerPage).toHaveURL(`/c/${community.slug}/classifieds`);
  const listed = await sellerContext.request.get(
    `${origin}/api/classifieds/community/${community.id}`,
    { headers }
  );
  const rows = await listed.json();
  const listing = (Array.isArray(rows) ? rows : rows.data).find(
    (item: { title: string; profileId: string }) =>
      item.title === title && item.profileId === seller.profileId
  );
  if (listing?.id) {
    fixtures.push({
      type: 'listing',
      id: listing.id,
      userId: seller.userId,
      profileId: seller.profileId,
      owner: 'seller',
      label: title,
    });
    record({
      type: 'fixture-created',
      fixtureType: 'listing',
      id: listing.id,
      owner: 'seller',
      label: title,
      responseStatus: listed.status(),
    });
  }
  expect(listed.status()).toBe(200);
  expect(listing).toBeTruthy();

  await buyerPage.goto(`${origin}/c/${community.slug}/classifieds`);
  const card = buyerPage.locator('.classified-card').filter({ hasText: title });
  await expect(card).toBeVisible();
  await auditState(buyerPage, 'listing-card');
  await enterByKeyboard(
    buyerPage,
    card.getByRole('button', { name: 'Contact Seller', exact: true })
  );
  await expect(
    buyerPage.getByRole('heading', { name: 'Conversation' })
  ).toBeVisible();
  await auditState(buyerPage, 'seller-conversation');
  const message = buyerPage.getByLabel('Message', { exact: true });
  await tabTo(buyerPage, message);
  const messageText = `RR09 keyboard buyer ${Date.now()}`;
  await buyerPage.keyboard.type(messageText);
  const sendMessagePromise = buyerPage.waitForResponse(
    (response) =>
      /\/api\/.*message/i.test(new URL(response.url()).pathname) &&
      response.request().method() === 'POST'
  );
  await enterByKeyboard(
    buyerPage,
    buyerPage.getByRole('button', { name: 'Send', exact: true })
  );
  const sendMessageResponse = await sendMessagePromise;
  expect(
    sendMessageResponse.status(),
    await sendMessageResponse.text()
  ).toBeLessThan(400);
  await expect(buyerPage.locator('body')).toContainText(messageText);
  const sentMessage = await sendMessageResponse.json();
  record({
    type: 'durable-chat-message',
    messageId: sentMessage.id,
    conversationId: sentMessage.conversationId,
    status: sendMessageResponse.status(),
    cleanup: 'preserved as bounded seller-contact evidence',
  });
  await scanRoute(sellerPage, 'locality-community', `/c/${community.slug}`);
  await scanRoute(
    sellerPage,
    'classifieds',
    `/c/${community.slug}/classifieds`
  );
  await scanRoute(
    sellerPage,
    'listing-create',
    `/c/${community.slug}/classifieds/new`
  );
  await scanRoute(buyerPage, 'messages', '/messages');
}
