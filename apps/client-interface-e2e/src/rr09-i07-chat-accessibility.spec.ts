import { expect, test, type Page } from '@playwright/test';
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const origin = process.env['BASE_URL'] ?? 'http://127.0.0.1:8080';
const workspaceRoot = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const evidenceDirectory = join(
  workspaceRoot,
  '.runtime-artifacts',
  'rr09',
  'i07'
);
const evidencePath = join(evidenceDirectory, 'chat-accessibility.jsonl');
const screenshotDirectory = join(evidenceDirectory, 'screenshots');
const credentialsPath =
  process.env['RR09_I03_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i03-credentials.json';
const viewports = [
  { label: 'phone-320x740', width: 320, height: 740 },
  { label: 'phone-375x812', width: 375, height: 812 },
  { label: 'tablet-768x1024', width: 768, height: 1024 },
  { label: 'desktop-1280x633', width: 1280, height: 633 },
  { label: 'desktop-1440x900', width: 1440, height: 900 },
];

function record(value: Record<string, unknown>): void {
  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  appendFileSync(
    evidencePath,
    `${JSON.stringify({ observedAt: new Date().toISOString(), ...value })}\n`,
    { mode: 0o600 }
  );
  chmodSync(evidencePath, 0o600);
}

function saveScreenshot(path: string, data: Buffer): void {
  writeFileSync(path, data, { mode: 0o600 });
  chmodSync(path, 0o600);
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const state = () => {
      const body = getComputedStyle(document.body);
      return [
        document.documentElement.getAttribute('data-theme'),
        body.color,
        body.backgroundColor,
      ].join('|');
    };
    let previous = state();
    let stable = 0;
    const deadline = Date.now() + 5_000;
    while (stable < 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const current = state();
      stable = current === previous ? stable + 1 : 0;
      previous = current;
      if (Date.now() > deadline) throw new Error('Theme did not settle');
    }
  });
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const appearance = page.getByRole('button', {
    name: 'Appearance',
    exact: true,
  });
  await appearance.focus();
  await page.keyboard.press('Enter');
  const controls = page.getByRole('dialog', { name: 'Appearance controls' });
  const toggle = controls.locator('input[type="checkbox"]');
  if ((await toggle.isChecked()) !== (theme === 'dark')) {
    await toggle.focus();
    await page.keyboard.press('Space');
  }
  await expect(toggle).toHaveJSProperty('checked', theme === 'dark');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await settle(page);
}

async function login(page: Page): Promise<void> {
  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8')) as {
    email: string;
    password: string;
  };
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
}

async function tabToLauncher(page: Page): Promise<number> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
  });
  for (let index = 1; index <= 120; index += 1) {
    await page.keyboard.press('Tab');
    if (
      await page.evaluate(
        () =>
          document.activeElement?.matches('button.chat-floating-button') ??
          false
      )
    ) {
      await page.evaluate(() => document.body.removeAttribute('tabindex'));
      return index;
    }
  }
  await page.evaluate(() => document.body.removeAttribute('tabindex'));
  return 0;
}

async function measureAction(page: Page, targetIndex: number) {
  const targets = page.locator(
    'lib-create-community form button, lib-create-community form [role="button"]'
  );
  const target = targets.nth(targetIndex);
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  );
  return page.evaluate((index) => {
    const launcher = document.querySelector<HTMLElement>(
      'button.chat-floating-button'
    );
    const target = document.querySelectorAll<HTMLElement>(
      'lib-create-community form button, lib-create-community form [role="button"]'
    )[index];
    if (!launcher || !target)
      return { launcherPresent: Boolean(launcher), targetPresent: false };
    const rect = target.getBoundingClientRect();
    const chat = launcher.getBoundingClientRect();
    const style = getComputedStyle(target);
    const visible =
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none';
    const clipped = {
      left: Math.max(0, rect.left),
      top: Math.max(0, rect.top),
      right: Math.min(innerWidth, rect.right),
      bottom: Math.min(innerHeight, rect.bottom),
    };
    const sampleGrid = (box: {
      left: number;
      top: number;
      right: number;
      bottom: number;
    }) =>
      box.right > box.left && box.bottom > box.top
        ? [0.1, 0.3, 0.5, 0.7, 0.9].flatMap((xRatio) =>
            [0.1, 0.3, 0.5, 0.7, 0.9].map((yRatio) => ({
              x: Math.floor(box.left + (box.right - box.left) * xRatio),
              y: Math.floor(box.top + (box.bottom - box.top) * yRatio),
            }))
          )
        : [];
    const hit = (point: { x: number; y: number }) => {
      const element = document.elementFromPoint(point.x, point.y);
      return {
        ...point,
        hitsTarget: Boolean(element && target.contains(element)),
        hitsLauncher: Boolean(element && launcher.contains(element)),
        hitTag: element?.tagName ?? null,
        hitClass:
          element && typeof element.className === 'string'
            ? element.className
            : '',
      };
    };
    const targetHits = sampleGrid(clipped).map(hit);
    const intersection = {
      left: Math.max(rect.left, chat.left),
      top: Math.max(rect.top, chat.top),
      right: Math.min(rect.right, chat.right),
      bottom: Math.min(rect.bottom, chat.bottom),
    };
    const intersects =
      visible &&
      intersection.right > intersection.left &&
      intersection.bottom > intersection.top;
    const intersectionHits = (intersects ? sampleGrid(intersection) : []).map(
      hit
    );
    return {
      launcherPresent: true,
      targetPresent: true,
      text: (target.textContent ?? '').replace(/\s+/g, ' ').trim(),
      visible,
      targetBounds: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      },
      viewport: { width: innerWidth, height: innerHeight },
      scrollY,
      viewportSampleCount: targetHits.length,
      viewportTargetHits: targetHits.filter((point) => point.hitsTarget).length,
      viewportLauncherHits: targetHits.filter((point) => point.hitsLauncher)
        .length,
      viewportSamples: targetHits,
      launcherBounds: {
        left: chat.left,
        top: chat.top,
        right: chat.right,
        bottom: chat.bottom,
      },
      intersectsLauncher: intersects,
      intersection: intersects ? intersection : null,
      intersectionSampleCount: intersectionHits.length,
      intersectionTargetHits: intersectionHits.filter(
        (point) => point.hitsTarget
      ).length,
      intersectionLauncherHits: intersectionHits.filter(
        (point) => point.hitsLauncher
      ).length,
      intersectionSamples: intersectionHits,
    };
  }, targetIndex);
}

test('RR09 I07 named floating chat supports keyboard and preserves focus state', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR09_I07_LIVE_STACK'] !== 'true',
    'Requires the existing live stack and retained RR09 owner account'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Run once in system Chrome; widths are controlled explicitly'
  );
  test.setTimeout(60_000);
  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  await page.setViewportSize({ width: 320, height: 740 });
  const conversations: Array<{
    id: string;
    type?: string;
    participants: string[];
  }> = [];
  let conversationListLoaded = false;
  let messageSendCount = 0;
  page.on('response', async (response) => {
    try {
      const url = new URL(response.url());
      if (
        response.request().method() !== 'GET' ||
        !/\/api\/chat\/conversations\/find\/?$/.test(url.pathname)
      ) {
        return;
      }
      const body: unknown = await response.json();
      if (!Array.isArray(body)) return;
      conversationListLoaded = true;
      for (const candidate of body) {
        if (
          candidate &&
          typeof candidate === 'object' &&
          typeof candidate.id === 'string' &&
          Array.isArray(candidate.participants) &&
          candidate.participants.every((id: unknown) => typeof id === 'string')
        ) {
          conversations.push({
            id: candidate.id,
            type:
              typeof candidate.type === 'string' ? candidate.type : undefined,
            participants: candidate.participants,
          });
        }
      }
    } catch {
      // Auth/navigation responses that are not JSON are irrelevant to this read-only probe.
    }
  });
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      /\/api\/chat\/(?:conversations\/[^/]+\/messages|messages)(?:\/|$)/.test(
        new URL(request.url()).pathname
      )
    ) {
      messageSendCount += 1;
    }
  });
  await login(page);
  const initialTheme = await page.locator('html').getAttribute('data-theme');
  if (initialTheme !== 'light' && initialTheme !== 'dark') {
    record({ type: 'invalid-initial-theme', theme: initialTheme });
    throw new Error(`Unsupported initial theme: ${initialTheme}`);
  }
  const result: Record<string, unknown> = { type: 'keyboard', origin };
  try {
    await page.goto(`${origin}/communities/create`, {
      waitUntil: 'domcontentloaded',
    });
    const launcher = page.getByRole('button', {
      name: 'Messages',
      exact: true,
    });
    const tabCount = await tabToLauncher(page);
    expect(
      tabCount,
      'Messages launcher is reachable through actual Tab'
    ).toBeGreaterThan(0);
    await expect(launcher).toBeFocused();
    await expect(launcher).toHaveAttribute('aria-expanded', 'false');
    await expect(launcher).toHaveAttribute(
      'aria-controls',
      'floating-chat-panel'
    );
    const buttonSemantics = await launcher.evaluate((button) => {
      const style = getComputedStyle(button);
      return {
        tag: button.tagName,
        role: button.getAttribute('role'),
        label: button.getAttribute('aria-label'),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
        boxShadow: style.boxShadow,
      };
    });
    expect(buttonSemantics.tag).toBe('BUTTON');
    expect(buttonSemantics.label).toBe('Messages');
    expect(
      buttonSemantics.outlineStyle !== 'none' &&
        Number.parseFloat(buttonSemantics.outlineWidth) > 0 &&
        buttonSemantics.outlineColor !== 'rgba(0, 0, 0, 0)',
      'Focused launcher has a visible focus indicator'
    ).toBeTruthy();

    await page.keyboard.press('Enter');
    const panel = page.locator('#floating-chat-panel');
    const namedPanel = page.getByRole('region', {
      name: 'Messages',
      exact: true,
    });
    await expect(panel).toBeVisible();
    await expect(namedPanel).toBeVisible();
    await expect
      .poll(() => conversationListLoaded, {
        timeout: 10_000,
        message: 'Existing chat conversation list should load read-only',
      })
      .toBeTruthy();
    await expect(launcher).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeFocused();
    const containedLandmarks = await launcher.evaluate((button) => {
      const selectors =
        'main,header,nav,aside,footer,[role="main"],[role="banner"],[role="navigation"],[role="complementary"],[role="region"]';
      return Array.from(document.querySelectorAll(selectors))
        .filter((element) => element.contains(button))
        .map((element) => ({
          tag: element.tagName,
          role: element.getAttribute('role'),
          label:
            element.getAttribute('aria-label') ??
            element.getAttribute('aria-labelledby'),
        }));
    });
    const panelSemantics = await panel.evaluate((section) => ({
      tag: section.tagName,
      role: section.getAttribute('role'),
      labelledBy: section.getAttribute('aria-labelledby'),
      id: section.id,
      tabIndex: section.tabIndex,
    }));
    await page.keyboard.press('Tab');
    const closeButton = page.getByRole('button', {
      name: 'Close messages',
      exact: true,
    });
    await expect(closeButton).toBeFocused();
    const tabEntersPanel = await panel.evaluate((element) =>
      element.contains(document.activeElement)
    );
    expect(
      tabEntersPanel,
      'Tab from panel focus enters its controls'
    ).toBeTruthy();
    await closeButton.click();
    await expect(panel).toBeHidden();
    await expect(launcher).toHaveAttribute('aria-expanded', 'false');
    await expect(launcher).toBeFocused();
    const explicitCloseRestoresFocus = await launcher.evaluate(
      (button) => document.activeElement === button
    );
    const panelAccessibleWhenClosed =
      (await page
        .getByRole('region', { name: 'Messages', exact: true })
        .count()) > 0;
    expect(panelAccessibleWhenClosed).toBeFalsy();
    await page.keyboard.press('Space');
    await expect(panel).toBeVisible();
    await expect(launcher).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(launcher).toHaveAttribute('aria-expanded', 'false');
    await expect(launcher).toBeFocused();
    const escapeCloseRestoresFocus = await launcher.evaluate(
      (button) => document.activeElement === button
    );
    await page.keyboard.press('Space');
    await expect(panel).toBeVisible();
    await expect(launcher).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeFocused();
    await launcher.focus();
    await page.keyboard.press('Enter');
    await expect(panel).toBeHidden();
    await expect(launcher).toHaveAttribute('aria-expanded', 'false');
    await expect(launcher).toBeFocused();

    await page.keyboard.press('Tab');
    const closedPanelSkippedByTab = await panel.evaluate((element) =>
      element.contains(document.activeElement)
    );
    expect(closedPanelSkippedByTab).toBeFalsy();

    const controlledProfiles = new Set([
      '9319acdf-f9de-454b-91fc-899b9e8a150f',
      '29e1f56a-78f4-4e56-972d-cd85f9e0bbff',
    ]);
    const controlledConversation = conversations.find(
      (conversation) =>
        conversation.participants.length === 2 &&
        conversation.participants.every((id) => controlledProfiles.has(id))
    );
    let draftPreservation: Record<string, unknown> = {
      status: 'NOT RUN',
      reason: controlledConversation
        ? 'Controlled conversation selected below'
        : 'Conversation list loaded but no direct conversation joined only by retained controlled profiles exists',
    };
    if (controlledConversation) {
      await launcher.focus();
      await page.keyboard.press('Enter');
      await expect(panel).toBeVisible();
      const contacts = page.locator('.chat-panel .contact-item');
      const contactNames = await contacts
        .locator('.contact-name')
        .allTextContents();
      const contactIndex = conversations.findIndex(
        (conversation) => conversation.id === controlledConversation.id
      );
      expect(contactIndex).toBeGreaterThanOrEqual(0);
      await contacts.nth(contactIndex).click();
      const draft = `I07 local draft ${Date.now()}`;
      const composer = page.locator('.chat-panel textarea.compose-textarea');
      await expect(composer).toBeVisible();
      await composer.fill(draft);
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await launcher.focus();
      await page.keyboard.press('Enter');
      await expect(panel).toBeVisible();
      await expect(composer).toHaveValue(draft);
      draftPreservation = {
        status: 'PASS',
        controlledConversationSelected: true,
        selectedConversationType: controlledConversation.type ?? null,
        controlledParticipantCount: controlledConversation.participants.length,
        visibleContactNames: contactNames.length,
        draftPreservedAfterCloseReopen: true,
      };
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(launcher).toHaveAttribute('aria-expanded', 'false');
      await expect(launcher).toBeFocused();
    }

    const focusPreservation = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(
        '#floating-chat-panel, .chat-panel'
      );
      return {
        focusedTagAfterClose: document.activeElement?.tagName ?? null,
        focusedIdAfterClose:
          (document.activeElement as HTMLElement | null)?.id ?? null,
        panelHidden: Boolean(
          panel &&
            (panel.hidden ||
              getComputedStyle(panel).display === 'none' ||
              getComputedStyle(panel).visibility === 'hidden' ||
              panel.getAttribute('aria-hidden') === 'true')
        ),
      };
    });
    Object.assign(result, {
      theme: initialTheme,
      tabCount,
      buttonSemantics,
      panelSemantics,
      containedLandmarks,
      tabEntersPanel,
      explicitCloseRestoresFocus,
      panelAccessibleWhenClosed,
      escapeCloseRestoresFocus,
      focusPreservation,
      closedPanelSkippedByTab,
      existingControlledConversationCount: conversations.filter(
        (conversation) =>
          conversation.participants.length === 2 &&
          conversation.participants.every((id) => controlledProfiles.has(id))
      ).length,
      unsentDraftPreservation: draftPreservation,
      messageSendCount,
    });
    expect(panelSemantics).toMatchObject({
      tag: 'SECTION',
      role: 'region',
      labelledBy: 'floating-chat-title',
      id: 'floating-chat-panel',
    });
    expect(containedLandmarks.length).toBeGreaterThan(0);
    expect(explicitCloseRestoresFocus).toBeTruthy();
    expect(escapeCloseRestoresFocus).toBeTruthy();
    expect(focusPreservation.panelHidden).toBeTruthy();
    expect(closedPanelSkippedByTab).toBeFalsy();
    expect(messageSendCount).toBe(0);
    record(result);
  } catch (error) {
    record({ ...result, outcome: 'failed', error: String(error) });
    throw error;
  } finally {
    await setTheme(page, initialTheme);
    record({ type: 'theme-restored', theme: initialTheme });
  }
});

test('RR09 I07 community form controls remain unobstructed at five widths and two themes', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR09_I07_LIVE_STACK'] !== 'true',
    'Requires the existing live stack and retained RR09 owner account'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Run once in system Chrome; widths are controlled explicitly'
  );
  test.setTimeout(180_000);
  mkdirSync(screenshotDirectory, { recursive: true, mode: 0o700 });
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);
  const originalTheme = await page.locator('html').getAttribute('data-theme');
  if (originalTheme !== 'light' && originalTheme !== 'dark') {
    record({ type: 'invalid-initial-theme', theme: originalTheme });
    throw new Error(`Unsupported initial theme: ${originalTheme}`);
  }
  const findings: string[] = [];
  try {
    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(`${origin}/communities/create`, {
          waitUntil: 'domcontentloaded',
        });
        await expect(
          page.getByRole('heading', { name: 'Create New Community' })
        ).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await settle(page);
        const actionTargets = page.locator(
          'lib-create-community form button, lib-create-community form [role="button"]'
        );
        const actionCount = await actionTargets.count();
        const measuredTargets = [];
        const screenshots: string[] = [];
        const failures: string[] = [];
        if (actionCount !== 2) {
          failures.push(`expected 2 form actions, found ${actionCount}`);
        }
        for (let index = 0; index < actionCount; index += 1) {
          const target = actionTargets.nth(index);
          await target.scrollIntoViewIfNeeded();
          const measurement = await measureAction(page, index);
          measuredTargets.push(measurement);
          const actionName = String(measurement.text ?? `action-${index}`)
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase();
          const screenshot = `screenshots/${viewport.label}-${theme}-${actionName}.png`;
          screenshots.push(screenshot);
          saveScreenshot(
            join(
              screenshotDirectory,
              `${viewport.label}-${theme}-${actionName}.png`
            ),
            await page.screenshot({ fullPage: false })
          );
          if (!measurement.launcherPresent) {
            failures.push('Messages launcher is absent in this route/state');
          }
          if (!measurement.visible) {
            failures.push(`${measurement.text}: target is not CSS-visible`);
          }
          if (measurement.viewportSampleCount !== 25) {
            failures.push(
              `${measurement.text}: only ${measurement.viewportSampleCount}/25 visible-surface hit samples`
            );
          }
          if (
            measurement.viewportSampleCount > 0 &&
            measurement.viewportTargetHits !== measurement.viewportSampleCount
          ) {
            failures.push(
              `${measurement.text}: full target hit-grid is obstructed`
            );
          }
          if (measurement.intersectsLauncher) {
            failures.push(
              `${measurement.text}: launcher intersects action bounds`
            );
          }
          if (measurement.intersectionLauncherHits > 0) {
            failures.push(
              `${measurement.text}: launcher hit-tests inside action`
            );
          }
          const targetText = String(measurement.text ?? '')
            .replace(/\s+/g, ' ')
            .trim();
          if (!['Cancel', 'Create Community'].includes(targetText)) {
            failures.push(`unexpected form action target: ${targetText}`);
          }
        }
        const measuredLabels = measuredTargets
          .map((measurement) =>
            String(measurement.text ?? '')
              .replace(/\s+/g, ' ')
              .trim()
          )
          .sort();
        if (
          JSON.stringify(measuredLabels) !==
          JSON.stringify(['Cancel', 'Create Community'])
        ) {
          failures.push(
            `expected Cancel and Create Community, found ${measuredLabels.join(
              ', '
            )}`
          );
        }
        const measurement = {
          viewport,
          theme,
          actionCount,
          targets: measuredTargets,
        };
        findings.push(
          ...failures.map((failure) => `${viewport.label}/${theme}: ${failure}`)
        );
        record({
          type: 'geometry',
          viewport,
          theme,
          result: measurement,
          findings: failures,
          screenshots,
        });
      }
    }
  } finally {
    await setTheme(page, originalTheme);
    record({ type: 'theme-restored', theme: originalTheme });
  }
  expect(findings, 'I07 full action hit-grid and chat clearance').toEqual([]);
});
