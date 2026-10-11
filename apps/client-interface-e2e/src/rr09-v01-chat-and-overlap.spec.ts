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
  'v01'
);
const evidencePath = join(evidenceDirectory, 'chat-overlap.jsonl');
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

async function settleTheme(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const value = () => {
      const body = getComputedStyle(document.body);
      return [
        document.documentElement.getAttribute('data-theme'),
        body.color,
        body.backgroundColor,
      ].join('|');
    };
    let previous = value();
    let stable = 0;
    const deadline = Date.now() + 5_000;
    while (stable < 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const current = value();
      stable = current === previous ? stable + 1 : 0;
      previous = current;
      if (Date.now() > deadline) throw new Error('Theme failed to settle');
    }
  });
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const trigger = page.getByRole('button', { name: 'Appearance', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('dialog', { name: 'Appearance controls' });
  const toggle = menu.locator('input[type="checkbox"]');
  if ((await toggle.isChecked()) !== (theme === 'dark')) {
    await toggle.focus();
    await page.keyboard.press('Space');
  }
  await expect(toggle).toHaveJSProperty('checked', theme === 'dark');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await settleTheme(page);
}

async function keyboardReachability(page: Page): Promise<{
  reachable: boolean;
  focusedTag?: string;
  focusedRole?: string | null;
  focusedName?: string;
  outline?: string;
  boxShadow?: string;
  visited: number;
}> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
  });
  let focused: {
    tag: string;
    role: string | null;
    name: string;
    outline: string;
  } | null = null;
  let visited = 0;
  for (let index = 0; index < 120; index += 1) {
    await page.keyboard.press('Tab');
    visited += 1;
    focused = await page.evaluate(() => {
      const target = document.activeElement as HTMLElement | null;
      if (!target?.matches('.chat-floating-button')) return null;
      const style = getComputedStyle(target);
      return {
        tag: target.tagName,
        role: target.getAttribute('role'),
        name:
          target.getAttribute('aria-label') ??
          target.innerText.replace(/\s+/g, ' ').trim(),
        outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
        boxShadow: style.boxShadow,
      };
    });
    if (focused) break;
  }
  await page.evaluate(() => document.body.removeAttribute('tabindex'));
  return focused
    ? {
        reachable: true,
        focusedTag: focused.tag,
        focusedRole: focused.role,
        focusedName: focused.name,
        outline: focused.outline,
        boxShadow: focused.boxShadow,
        visited,
      }
    : { reachable: false, visited };
}

async function overlapSnapshot(page: Page, label: string) {
  await page.locator('.image-uploads').scrollIntoViewIfNeeded();
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  );
  const result = await page.evaluate(() => {
    const chat = document.querySelector<HTMLElement>('.chat-floating-button');
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.image-uploads .image-upload')
    );
    const rect = (element: Element) => {
      const r = element.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    if (!chat) return { chatPresent: false, cards: [] };
    const chatRect = chat.getBoundingClientRect();
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        'lib-create-community form button, lib-create-community form [role="button"], .image-uploads .image-label, .image-uploads .upload-placeholder'
      )
    ).map((target) => {
      const r = target.getBoundingClientRect();
      const style = getComputedStyle(target);
      const visible =
        r.width > 0 &&
        r.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
      const left = Math.max(r.left, chatRect.left);
      const right = Math.min(r.right, chatRect.right);
      const top = Math.max(r.top, chatRect.top);
      const bottom = Math.min(r.bottom, chatRect.bottom);
      const intersects = visible && right > left && bottom > top;
      const samples = intersects
        ? [0.1, 0.3, 0.5, 0.7, 0.9].flatMap((xRatio) =>
            [0.1, 0.3, 0.5, 0.7, 0.9].map((yRatio) => ({
              x: Math.floor(left + (right - left) * xRatio),
              y: Math.floor(top + (bottom - top) * yRatio),
            }))
          )
        : [];
      const hitResults = samples.map((point) => {
        const hit = document.elementFromPoint(point.x, point.y);
        return {
          ...point,
          insideChat: Boolean(hit && chat.contains(hit)),
          insideTarget: Boolean(hit && target.contains(hit)),
          hitTag: hit?.tagName ?? null,
          hitClass:
            hit && typeof hit.className === 'string' ? hit.className : '',
        };
      });
      return {
        tag: target.tagName,
        text: (target.textContent ?? '').replace(/\s+/g, ' ').trim(),
        bounds: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
        visible,
        intersectsChat: intersects,
        intersection: intersects ? { left, top, right, bottom } : null,
        samples: hitResults,
        chatOccludingSamples: hitResults.filter((item) => item.insideChat)
          .length,
      };
    });
    return {
      chatPresent: true,
      chat: rect(chat),
      actionTargets: targets,
      cards: cards.map((card) => {
        const cardRect = card.getBoundingClientRect();
        const left = Math.max(chatRect.left, cardRect.left);
        const right = Math.min(chatRect.right, cardRect.right);
        const top = Math.max(chatRect.top, cardRect.top);
        const bottom = Math.min(chatRect.bottom, cardRect.bottom);
        const intersects = right > left && bottom > top;
        const points = intersects
          ? [0.1, 0.3, 0.5, 0.7, 0.9].flatMap((xRatio) =>
              [0.1, 0.3, 0.5, 0.7, 0.9].map((yRatio) => ({
                x: Math.floor(left + (right - left) * xRatio),
                y: Math.floor(top + (bottom - top) * yRatio),
              }))
            )
          : [];
        const sampledHits = points.map((point) => {
          const hit = document.elementFromPoint(point.x, point.y);
          return {
            ...point,
            insideChat: Boolean(hit && chat.contains(hit)),
            insideUploadCard: Boolean(hit && card.contains(hit)),
            tag: hit?.tagName ?? null,
            className:
              hit && typeof hit.className === 'string' ? hit.className : '',
          };
        });
        const targetControls = Array.from(
          card.querySelectorAll('label,button,[role="button"],input')
        ).map((control) => {
          const bounds = control.getBoundingClientRect();
          const style = getComputedStyle(control);
          const visible =
            bounds.width > 0 &&
            bounds.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none';
          const targetPoints = points.filter(
            (point) =>
              point.x >= bounds.left &&
              point.x <= bounds.right &&
              point.y >= bounds.top &&
              point.y <= bounds.bottom
          );
          return {
            tag: control.tagName,
            text: (control.textContent ?? '').replace(/\s+/g, ' ').trim(),
            bounds: {
              left: bounds.left,
              top: bounds.top,
              right: bounds.right,
              bottom: bounds.bottom,
            },
            visible,
            sampledPoints: targetPoints.length,
            obscuredSamples: targetPoints.filter((point) => {
              const hit = document.elementFromPoint(point.x, point.y);
              return Boolean(hit && chat.contains(hit));
            }).length,
          };
        });
        return {
          card: rect(card),
          intersects,
          intersection: intersects ? { left, top, right, bottom } : null,
          sampledHitCount: sampledHits.length,
          sampledChatHits: sampledHits.filter((hit) => hit.insideChat).length,
          targetControls,
        };
      }),
    };
  });
  saveScreenshot(
    join(screenshotDirectory, `${label}.png`),
    await page.screenshot({ fullPage: false })
  );
  return result;
}

test('RR09 V01 floating chat keyboard and community upload overlap', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR09_LIVE_STACK'] !== 'true',
    'Requires the existing live stack and retained RR09 owner account'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Viewport matrix is controlled explicitly with system Chrome'
  );
  test.setTimeout(180_000);
  mkdirSync(screenshotDirectory, { recursive: true, mode: 0o700 });
  const saved = JSON.parse(readFileSync(credentialsPath, 'utf8')) as {
    email: string;
    password: string;
  };
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(saved.email);
  await page.getByLabel('Password', { exact: true }).fill(saved.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
  const issues: string[] = [];
  const originalTheme = await page.locator('html').getAttribute('data-theme');
  if (originalTheme !== 'light' && originalTheme !== 'dark') {
    record({ type: 'theme-baseline-invalid', theme: originalTheme });
    throw new Error(`Unsupported initial app theme: ${originalTheme}`);
  }

  try {
    await page.goto(`${origin}/communities/create`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByRole('heading', { name: 'Create New Community' })
    ).toBeVisible();

    const themes: Array<'light' | 'dark'> = ['light', 'dark'];
    for (const theme of themes) {
      await setTheme(page, theme);
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(`${origin}/communities/create`, {
          waitUntil: 'domcontentloaded',
        });
        await expect(
          page.getByRole('heading', { name: 'Create New Community' })
        ).toBeVisible();
        await settleTheme(page);
        const chat = page.locator('.chat-floating-button');
        await expect(chat).toBeVisible();

        const overlap = await overlapSnapshot(
          page,
          `chat-overlap-${viewport.label}-${theme}`
        );
        const obstructed =
          overlap.cards.some(
            (card: any) =>
              card.intersects &&
              (card.sampledChatHits > 0 ||
                card.targetControls.some(
                  (control: any) =>
                    control.visible && control.obscuredSamples > 0
                ))
          ) ||
          overlap.actionTargets.some(
            (target: any) => target.visible && target.chatOccludingSamples > 0
          );
        if (obstructed)
          issues.push(`${viewport.label}/${theme}: chat occludes form target`);
        record({
          type: 'chat-overlap',
          viewport,
          theme,
          result: overlap,
          obstructed,
          screenshot: `screenshots/chat-overlap-${viewport.label}-${theme}.png`,
        });

        if (viewport.width === 320 && theme === 'light') {
          await page.evaluate(() => window.scrollTo(0, 0));
          const keyboard = await keyboardReachability(page);
          let keyboardActivation: 'passed' | 'failed' | 'not-run-unreachable' =
            'not-run-unreachable';
          let panelOpened = false;
          if (keyboard.reachable) {
            await page.keyboard.press('Enter');
            panelOpened = await page.locator('.chat-panel').isVisible();
            keyboardActivation = panelOpened ? 'passed' : 'failed';
          }
          const ariaSnapshot = await chat.ariaSnapshot();
          const landmarks = await chat.evaluate((node) => {
            const candidates = Array.from(
              document.querySelectorAll(
                'main,header,nav,aside,footer,[role="main"],[role="banner"],[role="navigation"],[role="complementary"],[role="region"]'
              )
            );
            return candidates
              .filter((candidate) => candidate.contains(node))
              .map((candidate) => ({
                tag: candidate.tagName,
                role: candidate.getAttribute('role'),
                label:
                  candidate.getAttribute('aria-label') ??
                  candidate.getAttribute('aria-labelledby'),
              }));
          });
          if (!keyboard.reachable)
            issues.push('320x740/light: chat is unreachable by Tab');
          if (
            keyboard.reachable &&
            !(
              (Boolean(keyboard.outline) &&
                !keyboard.outline?.startsWith('none') &&
                !keyboard.outline?.includes('0px')) ||
              (Boolean(keyboard.boxShadow) && keyboard.boxShadow !== 'none')
            )
          ) {
            issues.push('320x740/light: chat focus indicator is not visible');
          }
          if (!/button/.test(ariaSnapshot) || !/Messages/.test(ariaSnapshot))
            issues.push('320x740/light: chat has no named button role');
          if (keyboardActivation === 'failed')
            issues.push('320x740/light: Enter did not activate focused chat');
          if (!landmarks.length)
            issues.push('320x740/light: chat is outside a landmark');
          record({
            type: 'chat-keyboard-accessibility',
            viewport,
            theme,
            keyboard,
            keyboardActivation,
            panelOpened,
            ariaSnapshot,
            landmarks,
            landmarkContainment: landmarks.length > 0,
            semantics: await chat.evaluate((node) => ({
              tag: node.tagName,
              role: node.getAttribute('role'),
              tabindex: node.getAttribute('tabindex'),
              label: node.getAttribute('aria-label'),
            })),
          });
        }
      }
    }
  } finally {
    await setTheme(page, originalTheme)
      .then(() => record({ type: 'theme-restored', theme: originalTheme }))
      .catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        issues.push(`theme restore failed: ${detail}`);
        record({ type: 'theme-restore-failure', message: detail });
      });
  }

  expect(issues, 'RR09 V01 chat accessibility/overlap findings').toEqual([]);
});
