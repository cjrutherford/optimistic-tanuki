import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const enabled = process.env['RR09_I03_LIVE_STACK'] === 'true';
const origin = process.env['BASE_URL'] ?? 'http://127.0.0.1:8080';
const evidencePath = join(
  process.cwd(),
  '.runtime-artifacts',
  'rr09',
  'i03',
  'evidence.jsonl'
);
const credentialsPath =
  process.env['RR09_I03_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i03-credentials.json';
const headers = {
  'X-ot-appscope': 'client-interface',
  'X-ot-app-id': 'client-interface',
};

function record(value: Record<string, unknown>): void {
  mkdirSync(join(process.cwd(), '.runtime-artifacts', 'rr09', 'i03'), {
    recursive: true,
    mode: 0o700,
  });
  appendFileSync(
    evidencePath,
    `${JSON.stringify({ observedAt: new Date().toISOString(), ...value })}\n`,
    { mode: 0o600 }
  );
}

async function captureTargetScreenshot(
  page: import('@playwright/test').Page,
  label: string,
  locator: import('@playwright/test').Locator
): Promise<void> {
  const directory = join(process.cwd(), '.runtime-artifacts', 'rr09', 'i03');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const imagePath = join(directory, `${label}.png`);
  await locator.screenshot({ path: imagePath, animations: 'disabled' });
  chmodSync(imagePath, 0o600);
  record({
    type: 'visual-proof',
    label,
    path: imagePath,
    scope: 'target-only',
  });
}

function loadOrCreateCredentials(): {
  email: string;
  password: string;
  created: boolean;
} {
  mkdirSync(dirname(credentialsPath), { recursive: true, mode: 0o700 });
  if (existsSync(credentialsPath)) {
    chmodSync(credentialsPath, 0o600);
    const saved = JSON.parse(readFileSync(credentialsPath, 'utf8')) as {
      email?: unknown;
      password?: unknown;
    };
    if (typeof saved.email !== 'string' || typeof saved.password !== 'string') {
      throw new Error(`Invalid RR09-I03 credentials file: ${credentialsPath}`);
    }
    return { email: saved.email, password: saved.password, created: false };
  }

  const credentials = {
    email: `rr09-i03-${randomUUID()}@example.test`,
    password: `RR09-I03-${randomUUID()}!`,
  };
  writeFileSync(credentialsPath, JSON.stringify(credentials), {
    mode: 0o600,
    flag: 'wx',
  });
  chmodSync(credentialsPath, 0o600);
  return { ...credentials, created: true };
}

async function settledTheme(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const read = () => ({
      theme: document.documentElement.getAttribute('data-theme'),
      foreground: getComputedStyle(document.body).color,
      background: getComputedStyle(document.body).backgroundColor,
    });
    let previous = JSON.stringify(read());
    let stable = 0;
    const deadline = Date.now() + 5_000;
    while (stable < 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const current = JSON.stringify(read());
      stable = current === previous ? stable + 1 : 0;
      previous = current;
      if (Date.now() > deadline) {
        throw new Error('Actual theme did not settle');
      }
    }
    return { ...JSON.parse(previous), stableSamples: stable };
  });
}

async function setThemeByKeyboard(
  page: import('@playwright/test').Page,
  targetTheme: 'light' | 'dark'
) {
  const trigger = page.getByRole('button', { name: 'Appearance', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Appearance controls' });
  await expect(dialog).toBeVisible();
  const themeSwitch = dialog.locator('input[type="checkbox"]');
  if ((await themeSwitch.isChecked()) !== (targetTheme === 'dark')) {
    await themeSwitch.focus();
    await page.keyboard.press('Space');
  }
  await expect(themeSwitch).toHaveJSProperty('checked', targetTheme === 'dark');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-theme', targetTheme);
  await settledTheme(page);
}

async function settleRenderedTargets(
  page: import('@playwright/test').Page,
  selectors: string[]
): Promise<void> {
  await page.evaluate(async (requestedSelectors) => {
    const targets = requestedSelectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector))
    );
    const animations = new Set<Animation>();
    for (const target of targets) {
      let current: Element | null = target;
      while (current) {
        for (const animation of current.getAnimations()) {
          const timing = animation.effect?.getComputedTiming();
          if (
            animation.playState === 'running' &&
            timing?.iterations !== Infinity
          ) {
            animations.add(animation);
          }
        }
        current = current.parentElement;
      }
    }
    await Promise.all(
      Array.from(animations, (animation) =>
        animation.finished.catch(() => undefined)
      )
    );

    const snapshot = () =>
      targets.map((target) => {
        const chain: Array<Record<string, string>> = [];
        let current: Element | null = target;
        while (current) {
          const style = getComputedStyle(current);
          chain.push({
            color: style.color,
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            opacity: style.opacity,
          });
          current = current.parentElement;
        }
        return chain;
      });

    let previous = JSON.stringify(snapshot());
    let stableSamples = 0;
    const deadline = Date.now() + 5_000;
    while (stableSamples < 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const current = JSON.stringify(snapshot());
      stableSamples = current === previous ? stableSamples + 1 : 0;
      previous = current;
      if (Date.now() > deadline) {
        throw new Error('Target colors and ancestor opacity did not settle');
      }
    }
  }, selectors);
}

async function sampleContrastDuringHover(
  page: import('@playwright/test').Page,
  selector: string
): Promise<{
  count: number;
  frames: number;
  minimumRatio: number;
  worstFrame: {
    targetIndex: number;
    foreground: string;
    background: string;
    transitionProperty: string;
    transitionDuration: string;
  } | null;
}> {
  const result = await page.evaluate(async (targetSelector) => {
    const parseColor = (color: string): [number, number, number] => {
      const context = document.createElement('canvas').getContext('2d');
      if (!context) throw new Error('Canvas parser unavailable');
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
      return [red, green, blue];
    };
    const luminance = (color: string) => {
      const [red, green, blue] = parseColor(color).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(targetSelector)
    );
    if (targets.length === 0) throw new Error(`${targetSelector} is absent`);
    let minimumRatio = Number.POSITIVE_INFINITY;
    let worstFrame: {
      targetIndex: number;
      foreground: string;
      background: string;
      transitionProperty: string;
      transitionDuration: string;
    } | null = null;
    let frames = 0;
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const sample = () => {
        targets.forEach((target, index) => {
          const foreground = getComputedStyle(target).color;
          let current: Element | null = target;
          let background = 'rgb(255, 255, 255)';
          while (current) {
            const candidate = getComputedStyle(current).backgroundColor;
            if (Number.parseFloat(candidate.split(',').at(-1) ?? '1') >= 0.99) {
              background = candidate;
              break;
            }
            current = current.parentElement;
          }
          const values = [luminance(foreground), luminance(background)].sort(
            (left, right) => right - left
          );
          const ratio = (values[0] + 0.05) / (values[1] + 0.05);
          if (ratio < minimumRatio) {
            minimumRatio = ratio;
            const style = getComputedStyle(target);
            worstFrame = {
              targetIndex: index,
              foreground,
              background,
              transitionProperty: style.transitionProperty,
              transitionDuration: style.transitionDuration,
            };
          }
        });
        frames += 1;
        if (performance.now() - started >= 350) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return {
      count: targets.length,
      frames,
      minimumRatio,
      worstFrame,
    };
  }, selector);
  expect(
    result.count,
    `${selector} matched at least one text node`
  ).toBeGreaterThan(0);
  expect(
    result.frames,
    `${selector} was sampled across multiple animation frames`
  ).toBeGreaterThan(2);
  return result;
}

async function auditState(
  page: import('@playwright/test').Page,
  label: string,
  selectors: string[],
  strictContrastSelectors: string[] = []
): Promise<void> {
  await settleRenderedTargets(page, selectors);
  const axe = await new AxeBuilder({ page }).analyze();
  const evidence = await page.evaluate((requestedSelectors) => {
    const parseColor = (value: string): [number, number, number, number] => {
      const context = document.createElement('canvas').getContext('2d');
      if (!context) throw new Error('Canvas parser unavailable');
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, alpha / 255];
    };
    const composite = (
      source: [number, number, number, number],
      under: [number, number, number, number]
    ): [number, number, number, number] => {
      const alpha = source[3] + under[3] * (1 - source[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      return [
        (source[0] * source[3] + under[0] * under[3] * (1 - source[3])) / alpha,
        (source[1] * source[3] + under[1] * under[3] * (1 - source[3])) / alpha,
        (source[2] * source[3] + under[2] * under[3] * (1 - source[3])) / alpha,
        alpha,
      ];
    };
    const luminance = (rgba: [number, number, number, number]) => {
      const [r, g, b] = rgba.map((channel, index) =>
        index === 3 ? channel : channel / 255
      ) as [number, number, number, number];
      const linear = [r, g, b].map((channel) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4
      );
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const ratio = (foreground: string, background: string) => {
      const fg = parseColor(foreground);
      const bg = parseColor(background);
      const fgOverBg = composite(fg, bg);
      const white: [number, number, number, number] = [255, 255, 255, 1];
      const opaqueFg = fgOverBg[3] < 1 ? composite(fgOverBg, white) : fgOverBg;
      const opaqueBg = bg[3] < 1 ? composite(bg, white) : bg;
      const values = [luminance(opaqueFg), luminance(opaqueBg)].sort(
        (a, b) => b - a
      );
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const effectiveBackground = (element: Element) => {
      const layers: string[] = [];
      const images: string[] = [];
      let current: Element | null = element;
      while (current) {
        const style = getComputedStyle(current);
        const color = style.backgroundColor;
        layers.push(color);
        const image = style.backgroundImage;
        if (image !== 'none') images.push(image);
        if (parseColor(color)[3] >= 1) break;
        current = current.parentElement;
      }
      let output: [number, number, number, number] = [0, 0, 0, 0];
      for (const color of layers.reverse()) {
        output = composite(parseColor(color), output);
      }
      if (output[3] < 1) output = composite(output, [255, 255, 255, 1]);
      return {
        css: `rgb(${Math.round(output[0])}, ${Math.round(
          output[1]
        )}, ${Math.round(output[2])})`,
        images,
      };
    };
    const contrast: Array<Record<string, unknown>> = [];
    for (const selector of requestedSelectors) {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(selector)
      );
      for (const element of elements) {
        const style = getComputedStyle(element);
        const background = effectiveBackground(element);
        const rect = element.getBoundingClientRect();
        contrast.push({
          selector,
          text: element.textContent?.trim().slice(0, 100) ?? '',
          foreground: style.color,
          background: background.css,
          backgroundImages: background.images,
          ratio: ratio(style.color, background.css),
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          ancestorOpacities: (() => {
            const opacities: number[] = [];
            let current: Element | null = element;
            while (current) {
              opacities.push(
                Number.parseFloat(getComputedStyle(current).opacity)
              );
              current = current.parentElement;
            }
            return opacities;
          })(),
          visible: rect.width > 0 && rect.height > 0,
        });
      }
    }
    const fileInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="file"]')
    ).map((input) => ({
      id: input.id,
      labelText: Array.from(input.labels ?? [])
        .map((label) => label.textContent?.trim() ?? '')
        .join(' '),
      ariaLabel: input.getAttribute('aria-label'),
      accept: input.accept,
    }));
    const mains = Array.from(document.querySelectorAll('main')).map((main) => ({
      className: main.className,
      parentMain: Boolean(main.parentElement?.closest('main')),
    }));
    const notificationButton = document.querySelector(
      'notif-notification-bell otui-button button'
    );
    return {
      url: location.pathname,
      theme: document.documentElement.getAttribute('data-theme'),
      mains,
      fileInputs,
      select: (() => {
        const select = document.querySelector('lib-create-community select');
        if (!select) return null;
        const id = select.getAttribute('id');
        const labels = id
          ? Array.from(
              document.querySelectorAll(`label[for="${CSS.escape(id)}"]`)
            )
          : [];
        return {
          id,
          labelText: labels.map((label) => label.textContent?.trim() ?? ''),
          ariaLabel: select.getAttribute('aria-label'),
          ariaLabelledBy: select.getAttribute('aria-labelledby'),
        };
      })(),
      notificationButton: notificationButton
        ? {
            ariaLabel: notificationButton.getAttribute('aria-label'),
            text: notificationButton.textContent?.trim(),
            title: notificationButton.getAttribute('title'),
          }
        : null,
      contrast,
    };
  }, selectors);
  const measurements = evidence.contrast as Array<Record<string, unknown>>;
  for (const selector of selectors) {
    expect(
      measurements.some((item) => item['selector'] === selector),
      `${label}: ${selector} is present in the rendered state`
    ).toBe(true);
  }
  for (const item of measurements) {
    expect(item['visible'], `${label}: ${item['selector']} is visible`).toBe(
      true
    );
    expect(
      item['backgroundImages'],
      `${label}: contrast background is measurable`
    ).toEqual([]);
    expect(
      item['ratio'],
      `${label}: ${item['selector']} contrast`
    ).toBeGreaterThanOrEqual(4.5);
  }
  const relevantRules = new Set([
    'button-name',
    'select-name',
    'label',
    'aria-dialog-name',
  ]);
  const relevantViolations = axe.violations.filter((violation) =>
    relevantRules.has(violation.id)
  );
  expect(
    relevantViolations,
    `${label}: targeted axe criteria are clear`
  ).toEqual([]);
  const strictContrastTargets = axe.violations
    .filter((violation) => violation.id === 'color-contrast')
    .flatMap((violation) => violation.nodes.flatMap((node) => node.target))
    .filter((target) =>
      strictContrastSelectors.some((selector) => target.includes(selector))
    );
  expect(
    strictContrastTargets,
    `${label}: named core contrast targets pass axe after their rendered state settles`
  ).toEqual([]);
  record({
    type: 'state',
    label,
    theme: await settledTheme(page),
    evidence,
    axe: axe.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map(({ target }) => target),
      summaries: nodes.map(({ failureSummary }) => failureSummary),
    })),
  });
}

test.describe('RR09-I03 authenticated accessibility acceptance', () => {
  test('validates targeted names, labels, landmarks and contrast without submitting data', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !enabled,
      'Set RR09_I03_LIVE_STACK=true for the isolated live-stack audit'
    );
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'Run the focused audit once with system Chrome'
    );
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });

    const credentials = loadOrCreateCredentials();
    const { email, password } = credentials;
    if (credentials.created) {
      const registration = await request.post(
        `${origin}/api/authentication/register`,
        {
          headers,
          data: {
            fn: 'RR09',
            ln: 'I03',
            email,
            password,
            confirm: password,
            bio: 'Retained local RR09 I03 accessibility audit account',
          },
        }
      );
      expect(registration.status()).toBe(201);
    }

    await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
    const sessionResponse = await page.request.get(
      `${origin}/api/authentication/session`,
      { headers }
    );
    expect(sessionResponse.status()).toBe(200);
    const session = (await sessionResponse.json()).data;
    record({
      type: 'account',
      userId: session.userId,
      profileId: session.profileId,
      retained: true,
      reusedCredentials: !credentials.created,
    });

    await page.goto(`${origin}/communities/create`);
    await expect(
      page.getByRole('heading', { name: 'Create New Community' })
    ).toBeVisible();
    const originalTheme =
      (await page.locator('html').getAttribute('data-theme')) === 'dark'
        ? 'dark'
        : 'light';
    const communityCriteria = [
      '.no-groups',
      '.help-text',
      '.upload-placeholder > span',
      '.banner-placeholder > span',
    ];
    const communitySelect = page.locator('lib-create-community select');
    await expect(
      communitySelect,
      'Join Policy select has a programmatic name'
    ).toHaveAccessibleName('Join Policy');
    const initialJoinPolicy = await communitySelect.inputValue();
    await communitySelect.focus();
    await expect(communitySelect).toBeFocused();
    await page.keyboard.press('ArrowDown');
    expect(await communitySelect.inputValue()).not.toBe(initialJoinPolicy);
    await communitySelect.selectOption(initialJoinPolicy);
    const communityInputs = await page
      .locator('lib-create-community input[type="file"]')
      .evaluateAll((inputs) =>
        inputs.map((input) => ({
          id: (input as HTMLInputElement).id,
          labels: Array.from((input as HTMLInputElement).labels ?? []).map(
            (label) => label.textContent?.trim()
          ),
        }))
      );
    expect(communityInputs).toHaveLength(2);
    expect(communityInputs.every((input) => input.id.length > 0)).toBe(true);
    expect(
      new Set(communityInputs.map((input) => input.id)).size,
      'community file input IDs are unique'
    ).toBe(communityInputs.length);
    expect(communityInputs.map((input) => input.labels.join(' '))).toEqual([
      'Community Logo',
      'Community Banner',
    ]);
    const firstCommunityFileInput = page
      .locator('lib-create-community input[type="file"]')
      .first();
    await firstCommunityFileInput.focus();
    await expect(firstCommunityFileInput).toBeFocused();
    await expect(page.getByRole('main')).toHaveCount(1);
    const communityAxe = await new AxeBuilder({ page }).analyze();
    expect(
      communityAxe.violations.filter((violation) =>
        ['select-name', 'label'].includes(violation.id)
      )
    ).toEqual([]);
    await auditState(page, 'community-create', communityCriteria);
    await setThemeByKeyboard(page, originalTheme === 'dark' ? 'light' : 'dark');
    await auditState(page, 'community-create-other-theme', communityCriteria);
    await setThemeByKeyboard(page, originalTheme);
    await captureTargetScreenshot(
      page,
      'community-create-light',
      page.locator('lib-create-community .create-community')
    );

    await page.goto(`${origin}/settings`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Settings', exact: true })
    ).toBeVisible();
    const profileTrigger = page.locator('[data-profile-editor-trigger]');
    await auditState(page, 'profile-settings-banner', ['.profile-name']);
    const initialProfileTheme = await settledTheme(page);
    await captureTargetScreenshot(
      page,
      `profile-name-${initialProfileTheme.theme}`,
      page.locator('.profile-name')
    );
    await profileTrigger.focus();
    await expect(profileTrigger).toBeFocused();
    await expect
      .poll(() =>
        page
          .locator('.profile-overlay')
          .evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity))
      )
      .toBeGreaterThan(0.99);
    await auditState(page, 'profile-settings-hint', ['.profile-hint']);
    await captureTargetScreenshot(page, 'profile-banner-hint', profileTrigger);
    await setThemeByKeyboard(page, originalTheme === 'dark' ? 'light' : 'dark');
    await auditState(page, 'profile-settings-banner-other-theme', [
      '.profile-name',
    ]);
    const alternateProfileTheme = await settledTheme(page);
    expect(alternateProfileTheme.theme).not.toBe(initialProfileTheme.theme);
    expect(`profile-name-${alternateProfileTheme.theme}`).not.toBe(
      `profile-name-${initialProfileTheme.theme}`
    );
    await captureTargetScreenshot(
      page,
      `profile-name-${alternateProfileTheme.theme}`,
      page.locator('.profile-name')
    );
    await profileTrigger.focus();
    await expect
      .poll(() =>
        page
          .locator('.profile-overlay')
          .evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity))
      )
      .toBeGreaterThan(0.99);
    await auditState(page, 'profile-settings-hint-other-theme', [
      '.profile-hint',
    ]);
    await setThemeByKeyboard(page, originalTheme);
    await profileTrigger.focus();
    await page.keyboard.press('Enter');
    const profileEditor = page.getByRole('alertdialog', {
      name: 'Edit Profile',
      exact: true,
    });
    await expect(profileEditor).toBeVisible();
    await captureTargetScreenshot(page, 'profile-editor', profileEditor);
    const profileInputs = await profileEditor
      .locator('input[type="file"]')
      .evaluateAll((inputs) =>
        inputs.map((input) => ({
          id: (input as HTMLInputElement).id,
          labels: Array.from((input as HTMLInputElement).labels ?? []).map(
            (label) => label.textContent?.trim()
          ),
          ariaLabel: input.getAttribute('aria-label'),
        }))
      );
    expect(profileInputs).toHaveLength(2);
    expect(profileInputs.every((input) => input.id.length > 0)).toBe(true);
    expect(
      new Set(profileInputs.map((input) => input.id)).size,
      'profile file input IDs are unique'
    ).toBe(profileInputs.length);
    expect(
      profileInputs.every(
        (input) => input.labels.length > 0 || input.ariaLabel
      ),
      'profile image inputs have a visible associated label or explicit accessible name'
    ).toBe(true);
    await profileEditor.getByRole('button', { name: 'Cancel' }).click();

    await page.goto(`${origin}/feed`);
    await expect(page.locator('notif-notification-bell')).toBeVisible();
    const notificationButton = page.locator(
      'notif-notification-bell otui-button button'
    );
    await expect(
      notificationButton,
      'global notification bell has an accessible name'
    ).toHaveAccessibleName('Notifications');
    await notificationButton.focus();
    await expect(notificationButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      page.locator('notif-notification-bell .notification-dropdown')
    ).toBeVisible();
    await page.keyboard.press('Enter');
    await page.mouse.move(-100, -100);
    const componentButton = page.locator('.component-btn');
    await expect
      .poll(() =>
        componentButton.evaluate((button) =>
          Number.parseFloat(
            getComputedStyle(button.closest('.toolbar-group')!).opacity
          )
        )
      )
      .toBeGreaterThanOrEqual(0.99);
    await auditState(
      page,
      'feed-toolbar',
      ['.component-btn > span'],
      ['.component-btn > span']
    );
    await captureTargetScreenshot(
      page,
      'toolbar-default',
      page.locator('.toolbar-container')
    );
    await componentButton.hover();
    const lightHoverSamples = await sampleContrastDuringHover(
      page,
      '.component-btn > span'
    );
    record({
      type: 'contrast-transition',
      label: 'feed-toolbar-hover-light',
      theme: 'light',
      selector: '.component-btn > span',
      ...lightHoverSamples,
    });
    expect(
      lightHoverSamples.minimumRatio,
      'all rendered component-button text stays readable during the light-theme hover transition'
    ).toBeGreaterThanOrEqual(4.5);
    await auditState(
      page,
      'feed-toolbar-hover',
      ['.component-btn > span'],
      ['.component-btn > span']
    );
    await captureTargetScreenshot(
      page,
      'toolbar-hover-light',
      page.locator('.component-btn')
    );
    await page.mouse.move(0, 0);
    const formatButton = page.locator('.toolbar-btn[title^="Bold"]').first();
    await formatButton.click();
    await expect(formatButton).toHaveClass(/is-active/);
    await auditState(
      page,
      'feed-toolbar-active',
      ['.toolbar-btn.is-active'],
      ['.toolbar-btn.is-active']
    );
    await formatButton.click();
    await setThemeByKeyboard(page, originalTheme === 'dark' ? 'light' : 'dark');
    await auditState(
      page,
      'feed-toolbar-other-theme',
      ['.component-btn > span'],
      ['.component-btn > span']
    );
    await componentButton.hover();
    const darkHoverSamples = await sampleContrastDuringHover(
      page,
      '.component-btn > span'
    );
    record({
      type: 'contrast-transition',
      label: 'feed-toolbar-hover-dark',
      theme: 'dark',
      selector: '.component-btn > span',
      ...darkHoverSamples,
    });
    expect(
      darkHoverSamples.minimumRatio,
      'all rendered component-button text stays readable during the dark-theme hover transition'
    ).toBeGreaterThanOrEqual(4.5);
    await auditState(
      page,
      'feed-toolbar-hover-other-theme',
      ['.component-btn > span'],
      ['.component-btn > span']
    );
    await captureTargetScreenshot(
      page,
      'toolbar-hover-dark',
      page.locator('.component-btn')
    );
    await page.mouse.move(0, 0);
    await formatButton.click();
    await expect(formatButton).toHaveClass(/is-active/);
    await auditState(
      page,
      'feed-toolbar-active-other-theme',
      ['.toolbar-btn.is-active'],
      ['.toolbar-btn.is-active']
    );
    await formatButton.click();
    await setThemeByKeyboard(page, originalTheme);

    const postCard = page.locator('.post-container').first();
    await expect(
      postCard,
      'report dialog requires an existing read-only post'
    ).toBeVisible();
    const menuTrigger = postCard.getByRole('button', {
      name: '...',
      exact: true,
    });
    await menuTrigger.focus();
    await page.keyboard.press('Enter');
    const reportButton = postCard.getByRole('button', {
      name: 'Report post',
      exact: true,
    });
    await reportButton.focus();
    await page.keyboard.press('Enter');
    const reportDialog = page
      .getByRole('alertdialog')
      .or(page.getByRole('dialog'));
    await expect(reportDialog).toBeVisible();
    await expect(
      reportDialog,
      'report dialog is named for assistive technology'
    ).toHaveAccessibleName('Report Post');
    const closeReport = reportDialog.getByRole('button', {
      name: 'Close report',
    });
    await expect(closeReport).toBeVisible();
    await closeReport.focus();
    await expect(closeReport).toBeFocused();
    await auditState(page, 'report-dialog', []);
    await captureTargetScreenshot(page, 'report-dialog', reportDialog);
    await page.keyboard.press('Enter');
    await expect(reportDialog).toBeHidden();
  });
});
