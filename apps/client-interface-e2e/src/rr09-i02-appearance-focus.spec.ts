import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const enabled = process.env['RR09_I02_LIVE_STACK'] === 'true';
const apps = [
  { name: 'ot', origin: 'http://127.0.0.1:8080', route: '/login' },
  { name: 'ts', origin: 'http://127.0.0.1:8087', route: '/cities' },
  { name: 'fow', origin: 'http://127.0.0.1:8081', route: '/' },
] as const;
const evidencePath = join(
  process.cwd(),
  '.runtime-artifacts',
  'rr09',
  'i02',
  'evidence.jsonl'
);

function record(value: Record<string, unknown>): void {
  mkdirSync(dirname(evidencePath), { recursive: true, mode: 0o700 });
  appendFileSync(
    evidencePath,
    `${JSON.stringify({ observedAt: new Date().toISOString(), ...value })}\n`,
    { mode: 0o600 }
  );
}

async function tabToAppearance(page: import('@playwright/test').Page) {
  const trigger = page.getByRole('button', {
    name: 'Appearance',
    exact: true,
  });
  for (let index = 0; index < 48; index += 1) {
    if (
      await trigger.evaluate((element) => element === document.activeElement)
    ) {
      return trigger;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error('Keyboard traversal did not reach the Appearance trigger');
}

async function settleTheme(
  page: import('@playwright/test').Page,
  mode: 'light' | 'dark'
) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
  return page.evaluate(async () => {
    const read = () => ({
      theme: document.documentElement.getAttribute('data-theme'),
      foreground: getComputedStyle(document.body).color,
      background: getComputedStyle(document.body).backgroundColor,
    });
    let previous = JSON.stringify(read());
    let stable = 0;
    const deadline = Date.now() + 5000;
    while (stable < 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const current = JSON.stringify(read());
      stable = current === previous ? stable + 1 : 0;
      previous = current;
      if (Date.now() > deadline) {
        throw new Error('Actual theme did not settle within five seconds');
      }
    }
    return { ...JSON.parse(previous), stableSamples: stable };
  });
}

async function captureFocusedState(
  page: import('@playwright/test').Page,
  checkbox: import('@playwright/test').Locator,
  appName: string,
  mode: 'light' | 'dark',
  viewportName: string,
  testInfo: import('@playwright/test').TestInfo
) {
  // The shared stylesheet transitions all slider properties. Wait for the
  // visible ring geometry to finish moving before measuring or capturing it.
  await expect
    .poll(() =>
      checkbox.evaluate((input) => {
        const slider = input.nextElementSibling;
        return slider ? getComputedStyle(slider).outlineOffset : 'missing';
      })
    )
    .toBe('3px');
  const state = await checkbox.evaluate((input) => {
    const slider = input.nextElementSibling as HTMLElement | null;
    const label = input.closest('label');
    const panel = input.closest('[role="dialog"]');
    if (!slider || !label || !panel) {
      throw new Error('Appearance checkbox, slider, or panel is missing');
    }

    const style = getComputedStyle(slider);
    const ring = parseColor(style.outlineColor);
    const surface = compositeBackground(panel);
    const contrast = contrastRatio(ring, surface);
    const rect = label.getBoundingClientRect();
    const sliderRect = slider.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const outlineWidth = Number.parseFloat(style.outlineWidth);
    const outlineOffset = Number.parseFloat(style.outlineOffset);
    const ringBounds = {
      left: sliderRect.left - outlineWidth - outlineOffset,
      right: sliderRect.right + outlineWidth + outlineOffset,
      top: sliderRect.top - outlineWidth - outlineOffset,
      bottom: sliderRect.bottom + outlineWidth + outlineOffset,
    };
    return {
      focusVisible: input.matches(':focus-visible'),
      checked: (input as HTMLInputElement).checked,
      ring: {
        style: style.outlineStyle,
        width: style.outlineWidth,
        offset: style.outlineOffset,
        color: style.outlineColor,
      },
      adjacentSurface: surface,
      contrast,
      target: { width: rect.width, height: rect.height },
      ringWithinPanel:
        ringBounds.left >= panelRect.left &&
        ringBounds.right <= panelRect.right &&
        ringBounds.top >= panelRect.top &&
        ringBounds.bottom <= panelRect.bottom,
    };

    function parseColor(value: string): [number, number, number, number] {
      const context = document.createElement('canvas').getContext('2d');
      if (!context) throw new Error('Canvas color parser is unavailable');
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [red, green, blue, alpha / 255];
    }

    function compositeBackground(element: Element): string {
      let color: [number, number, number, number] = [0, 0, 0, 0];
      let current: Element | null = element;
      while (current) {
        const source = parseColor(getComputedStyle(current).backgroundColor);
        const alpha = source[3] + color[3] * (1 - source[3]);
        if (alpha > 0) {
          color = [
            (source[0] * source[3] + color[0] * color[3] * (1 - source[3])) /
              alpha,
            (source[1] * source[3] + color[1] * color[3] * (1 - source[3])) /
              alpha,
            (source[2] * source[3] + color[2] * color[3] * (1 - source[3])) /
              alpha,
            alpha,
          ];
        }
        current = current.parentElement;
      }
      if (color[3] < 1) {
        color = [
          color[0] * color[3] + 255 * (1 - color[3]),
          color[1] * color[3] + 255 * (1 - color[3]),
          color[2] * color[3] + 255 * (1 - color[3]),
          1,
        ];
      }
      return `rgb(${Math.round(color[0])}, ${Math.round(
        color[1]
      )}, ${Math.round(color[2])})`;
    }

    function contrastRatio(
      first: [number, number, number, number],
      secondCss: string
    ): number {
      const second = parseColor(secondCss);
      const luminance = (color: [number, number, number, number]) => {
        const channels = color.slice(0, 3).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return (
          0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
        );
      };
      const values = [luminance(first), luminance(second)].sort(
        (a, b) => b - a
      );
      return (values[0] + 0.05) / (values[1] + 0.05);
    }
  });

  expect(state.focusVisible, 'Native checkbox must retain keyboard focus').toBe(
    true
  );
  expect(state.ring.style).toBe('solid');
  expect(Number.parseFloat(state.ring.width)).toBeGreaterThanOrEqual(2);
  expect(state.contrast).toBeGreaterThanOrEqual(3);
  expect(state.target).toEqual({ width: 48, height: 44 });
  expect(state.ringWithinPanel).toBe(true);

  const screenshot = testInfo.outputPath(
    `${appName}-${mode}-${viewportName}-focus.png`
  );
  mkdirSync(dirname(screenshot), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: false });

  const axe = await new AxeBuilder({ page })
    .include('[role="dialog"][aria-label="Appearance controls"]')
    .analyze();
  record({
    app: appName,
    mode,
    state,
    axeViolations: axe.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map(({ target }) => target),
    })),
    screenshot,
  });
  return { state, axe };
}

test.describe('RR09-I02 shared Appearance focus indicator', () => {
  for (const app of apps) {
    test(`${app.name} shows keyboard focus on the switch in both actual themes`, async ({
      page,
    }, testInfo) => {
      test.skip(
        !enabled,
        'Set RR09_I02_LIVE_STACK=true for fixture-free live-stack acceptance'
      );
      test.skip(
        testInfo.project.name !== 'chromium-desktop',
        'The theme and keyboard checks run once with system Chrome'
      );
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(new URL(app.route, app.origin).toString());
      const trigger = await tabToAppearance(page);
      await page.keyboard.press('Enter');
      const panel = page.getByRole('dialog', { name: 'Appearance controls' });
      await expect(panel).toBeVisible();
      await expect(panel).not.toHaveAttribute('aria-modal', 'true');
      const close = panel.getByRole('button', {
        name: 'Close appearance controls',
      });
      // Opening schedules focus to the close control on a zero-delay timer.
      await page.waitForTimeout(25);
      const closeFocusedOnOpen = await close.evaluate(
        (element) => element === document.activeElement
      );
      const checkbox = panel.getByRole('checkbox');
      let reached = false;
      for (let index = 0; index < 48; index += 1) {
        await page.keyboard.press('Tab');
        if (
          await checkbox.evaluate(
            (element) => element === document.activeElement
          )
        ) {
          reached = true;
          break;
        }
      }
      expect(reached).toBe(true);

      const initialTheme = await page
        .locator('html')
        .getAttribute('data-theme');
      const firstMode = initialTheme === 'dark' ? 'dark' : 'light';
      if ((await checkbox.isChecked()) !== (firstMode === 'dark')) {
        await page.keyboard.press('Space');
      }
      await settleTheme(page, firstMode);
      await expect(checkbox).toBeFocused();
      const first = await captureFocusedState(
        page,
        checkbox,
        app.name,
        firstMode,
        'desktop-1280',
        testInfo
      );
      expect(first.axe.violations).toEqual([]);

      // Space is a real native activation; focus must stay on the checkbox
      // while the theme service changes the rendered page mode.
      await page.keyboard.press('Space');
      const secondMode = firstMode === 'dark' ? 'light' : 'dark';
      await settleTheme(page, secondMode);
      await expect(checkbox).toBeFocused();
      const second = await captureFocusedState(
        page,
        checkbox,
        app.name,
        secondMode,
        'desktop-1280',
        testInfo
      );
      expect(second.axe.violations).toEqual([]);

      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        secondMode
      );

      await page.setViewportSize({ width: 375, height: 812 });
      await expect(trigger).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(panel).toBeVisible();
      await page.waitForTimeout(25);
      reached = false;
      for (let index = 0; index < 48; index += 1) {
        await page.keyboard.press('Tab');
        if (
          await checkbox.evaluate(
            (element) => element === document.activeElement
          )
        ) {
          reached = true;
          break;
        }
      }
      expect(
        reached,
        'Phone-width Tab must reach the native theme checkbox'
      ).toBe(true);
      await expect(checkbox).toBeFocused();
      const mobile = await captureFocusedState(
        page,
        checkbox,
        app.name,
        secondMode,
        'phone-375',
        testInfo
      );
      expect(mobile.state.focusVisible).toBe(true);
      expect(mobile.axe.violations).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(trigger).toBeFocused();
      record({
        app: app.name,
        firstMode,
        secondMode,
        viewports: ['desktop-1280', 'phone-375'],
        closeFocusedOnOpen,
        restoredFocus: true,
        modeless: true,
      });
    });
  }
});
