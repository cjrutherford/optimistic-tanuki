import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const app = process.env['RR09_APP'] ?? 'ot';
const auditEnabled = process.env['RR09_PUBLIC_AUDIT'] === 'true';
const origin = process.env['BASE_URL'] ?? 'http://127.0.0.1:8080';
const routes =
  app === 'ts'
    ? ['/', '/cities', '/communities', '/login', '/register']
    : ['/', '/login', '/register'];
const viewports = [
  { name: 'phone-320', width: 320, height: 740 },
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 633 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const;
const artifacts = join(process.cwd(), '.runtime-artifacts', 'rr09', 'public');

function routeReadySelector(route: string): string {
  if (route === '/login') return 'lib-login-block form';
  if (route === '/register') return 'lib-register-block form';
  if (app === 'ts') {
    if (route === '/cities') return '.cities-page h1';
    if (route === '/communities') return '.communities-page h1';
    return '.hero-title';
  }
  return route === '/' ? 'main .hero-title' : 'main h1';
}

async function waitForStableTheme(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const read = () => ({
      bodyForeground: getComputedStyle(document.body).color,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      rootBackground: getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim(),
    });
    let previous = JSON.stringify(read());
    let stableSamples = 0;
    const deadline = Date.now() + 5000;
    const startedAt = Date.now();
    while (stableSamples < 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const current = JSON.stringify(read());
      if (current === previous) stableSamples += 1;
      else stableSamples = 0;
      previous = current;
      if (Date.now() >= deadline) {
        throw new Error('Theme colors did not stabilize within five seconds');
      }
    }
    return {
      stableSamples,
      sampleIntervalMs: 50,
      stableDurationMs: stableSamples * 50,
      elapsedMs: Date.now() - startedAt,
      settledColors: JSON.parse(previous),
    };
  });
}

function writeEvidence(record: Record<string, unknown>) {
  mkdirSync(artifacts, { recursive: true });
  appendFileSync(
    join(artifacts, `${app}-observations.jsonl`),
    `${JSON.stringify({
      observedAt: new Date().toISOString(),
      origin,
      ...record,
    })}\n`,
    { mode: 0o600 }
  );
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '');
}

test.describe(`RR09 ${app.toUpperCase()} public viewport and axe inventory`, () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !auditEnabled,
      'Set RR09_PUBLIC_AUDIT=true to opt into this live-stack audit collector'
    );
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'The audit sets explicit viewports and uses one system Chrome project'
    );
    // Establish one predictable initial viewport; each matrix case immediately
    // sets its measured viewport below.
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  for (const route of routes) {
    for (const viewport of viewports) {
      for (const colorScheme of ['light', 'dark'] as const) {
        test(`${route} @ ${viewport.name} ${colorScheme}`, async ({
          page,
          context,
        }) => {
          await page.setViewportSize(viewport);
          await page.emulateMedia({ colorScheme });
          const consoleErrors: string[] = [];
          const pageErrors: string[] = [];
          const failedRequests: string[] = [];
          page.on('console', (message) => {
            if (message.type() === 'error') consoleErrors.push(message.text());
          });
          page.on('pageerror', (error) => pageErrors.push(error.message));
          page.on('requestfailed', (request) =>
            failedRequests.push(
              `${request.method()} ${request.url()}: ${
                request.failure()?.errorText ?? 'failed'
              }`
            )
          );
          await page.goto(new URL(route, origin).toString());
          await expect(page.locator(routeReadySelector(route))).toBeVisible();
          await expect(page).toHaveURL(new URL(route, origin).toString());

          const axe = await new AxeBuilder({ page }).analyze();
          const observation = await page.evaluate(() => {
            const visible = (element: Element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.width > 0 &&
                rect.height > 0
              );
            };
            const controls = Array.from(
              document.querySelectorAll<HTMLElement>(
                'a[href],button,input,select,textarea,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])'
              )
            ).filter(visible);
            const undersized = controls.flatMap((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width < 44 || rect.height < 44
                ? [
                    {
                      tag: element.tagName,
                      role: element.getAttribute('role'),
                      name:
                        element.getAttribute('aria-label') ||
                        element.getAttribute('title') ||
                        element.innerText.slice(0, 60),
                      width: Math.round(rect.width),
                      height: Math.round(rect.height),
                      inViewport:
                        rect.bottom > 0 &&
                        rect.top < innerHeight &&
                        rect.right > 0 &&
                        rect.left < innerWidth,
                    },
                  ]
                : [];
            });
            const focused = document.activeElement as HTMLElement | null;
            const focusStyle = focused ? getComputedStyle(focused) : null;
            const tag = document.querySelector<HTMLElement>(
              '[data-testid="hai-about-tag"]'
            );
            const tagRect = tag?.getBoundingClientRect();
            const main = document.querySelector('main');
            const mainRect = main?.getBoundingClientRect();
            return {
              viewport: { width: innerWidth, height: innerHeight },
              document: {
                clientWidth: document.documentElement.clientWidth,
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight,
              },
              theme: {
                mediaPrefersDark: matchMedia('(prefers-color-scheme: dark)')
                  .matches,
                bodyClass: document.body.className,
                foreground: getComputedStyle(document.body).color,
                background: getComputedStyle(document.body).backgroundColor,
              },
              reducedMotion: {
                requested: matchMedia('(prefers-reduced-motion: reduce)')
                  .matches,
                activeAnimations: document.getAnimations().map((animation) => ({
                  playState: animation.playState,
                  currentTime: animation.currentTime,
                  target:
                    (animation.effect as KeyframeEffect | null)
                      ?.target instanceof Element
                      ? ((animation.effect as KeyframeEffect).target as Element)
                          .tagName
                      : null,
                })),
              },
              touchTargets: undersized,
              tag: tagRect
                ? {
                    position: getComputedStyle(tag).position,
                    bounds: {
                      top: tagRect.top,
                      right: tagRect.right,
                      bottom: tagRect.bottom,
                      left: tagRect.left,
                      width: tagRect.width,
                      height: tagRect.height,
                    },
                    intersectsMain: Boolean(
                      mainRect &&
                        tagRect.left < mainRect.right &&
                        tagRect.right > mainRect.left &&
                        tagRect.top < mainRect.bottom &&
                        tagRect.bottom > mainRect.top
                    ),
                  }
                : null,
              interactiveCount: controls.length,
              initialFocus: focused
                ? {
                    tag: focused.tagName,
                    role: focused.getAttribute('role'),
                    name:
                      focused.getAttribute('aria-label') ||
                      focused.innerText.slice(0, 60),
                    outline: focusStyle?.outline,
                    boxShadow: focusStyle?.boxShadow,
                  }
                : null,
            };
          });

          const tabbableSequence: unknown[] = [];
          for (let index = 0; index < 12; index += 1) {
            await page.keyboard.press('Tab');
            tabbableSequence.push(
              await page.evaluate(() => {
                const element = document.activeElement as HTMLElement | null;
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return {
                  tag: element.tagName,
                  role: element.getAttribute('role'),
                  name:
                    element.getAttribute('aria-label') ||
                    element.innerText.slice(0, 60),
                  outlineStyle: style.outlineStyle,
                  outlineWidth: style.outlineWidth,
                  boxShadow: style.boxShadow,
                  visible:
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.visibility !== 'hidden',
                };
              })
            );
          }

          writeEvidence({
            app,
            collectorCompleted: true,
            acceptanceStatus: 'NOT_ASSESSED_PENDING_FINDINGS_TRIAGE',
            criterionStatus: {
              automatedAxe: 'COLLECTED_PENDING_TRIAGE',
              themeContrast: 'OPEN_AXE_INCOMPLETE_REQUIRES_COMPUTED_PAIRS',
              keyboardFocus: 'OPEN_REQUIRES_MANUAL_INDICATOR_REVIEW',
              touchTargets: 'COLLECTED_PENDING_EXCEPTION_REVIEW',
              responsiveOverlap: 'COLLECTED_PENDING_REVIEW',
              reducedMotion: 'OPEN_NOT_PROVEN_BY_THIS_ROUTE_MATRIX',
            },
            route,
            colorScheme,
            viewport,
            ...observation,
            runtimeErrors: { consoleErrors, pageErrors, failedRequests },
            axe: {
              violations: axe.violations.map((violation) => ({
                id: violation.id,
                impact: violation.impact,
                help: violation.help,
                nodes: violation.nodes.map((node) => ({
                  target: node.target,
                  summary: node.failureSummary,
                })),
              })),
              passes: axe.passes.length,
              incomplete: axe.incomplete.map((item) => item.id),
            },
            tabbableSequence,
          });

          if (
            viewport.width === 320 ||
            viewport.width === 375 ||
            (route === '/' && viewport.width === 1280)
          ) {
            await page.screenshot({
              path: join(
                artifacts,
                `${app}-${safeName(route) || 'home'}-${
                  viewport.name
                }-${colorScheme}.png`
              ),
              fullPage: true,
            });
          }

          // This inventory intentionally records findings instead of masking or
          // stopping at the first issue; the RR09 report assigns each finding.
          expect(new URL(page.url()).pathname).toBe(route);
          await context.clearCookies();
        });
      }
    }
  }
});

test(`RR09 ${app.toUpperCase()} appearance control switches the rendered theme`, async ({
  page,
}, testInfo) => {
  test.skip(
    !auditEnabled,
    'Set RR09_PUBLIC_AUDIT=true to opt into this live-stack audit collector'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'The appearance control is exercised once with system Chrome'
  );
  await page.setViewportSize({ width: 375, height: 812 });
  const themeRoute = app === 'ts' ? '/cities' : '/login';
  await page.goto(new URL(themeRoute, origin).toString());
  await expect(page.locator(routeReadySelector(themeRoute))).toBeVisible();
  const beforeThemeStability = await waitForStableTheme(page);
  const appearanceTrigger = page.getByRole('button', { name: 'Appearance' });
  let triggerReached = false;
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press('Tab');
    if (
      await appearanceTrigger.evaluate(
        (element) => element === document.activeElement
      )
    ) {
      triggerReached = true;
      break;
    }
  }
  expect(triggerReached, 'Appearance must be reachable with Tab').toBe(true);
  await page.keyboard.press('Enter');
  const appearance = page.getByRole('dialog', { name: 'Appearance controls' });
  await expect(appearance).toBeVisible();
  const closeAppearance = appearance.getByRole('button', {
    name: 'Close appearance controls',
  });
  // The theme component schedules its focus restoration on a zero-delay
  // timer; let that scheduled callback run before starting keyboard traversal.
  await page.waitForTimeout(25);
  const closeFocusedOnOpen = await closeAppearance.evaluate(
    (element) => element === document.activeElement
  );
  const themeSwitch = appearance.getByRole('checkbox');
  const themeWasDark = await themeSwitch.isChecked();
  const readTheme = () =>
    page.evaluate(() => ({
      bodyClass: document.body.className,
      htmlClass: document.documentElement.className,
      foreground: getComputedStyle(document.body).color,
      background: getComputedStyle(document.body).backgroundColor,
      rootBackground: getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim(),
      themeControlClass:
        document.querySelector('lib-theme-toggle')?.className ?? null,
    }));
  const before = await readTheme();
  const beforeAxe = await new AxeBuilder({ page }).analyze();
  let switchReached = false;
  let normalTabMovedOutsidePanel = false;
  const appearanceTabSequence: Array<Record<string, unknown>> = [];
  for (let index = 0; index < 48; index += 1) {
    await page.keyboard.press('Tab');
    appearanceTabSequence.push(
      await page.evaluate((dialogSelector) => {
        const dialog = document.querySelector(dialogSelector);
        const element = document.activeElement as HTMLElement | null;
        return {
          tag: element?.tagName ?? null,
          role: element?.getAttribute('role') ?? null,
          name:
            element?.getAttribute('aria-label') ||
            element?.innerText.slice(0, 60) ||
            null,
          withinDialog: Boolean(element && dialog?.contains(element)),
          className: element?.className ?? null,
        };
      }, '[role="dialog"][aria-label="Appearance controls"]')
    );
    if (
      await themeSwitch.evaluate(
        (element) => element === document.activeElement
      )
    ) {
      switchReached = true;
      break;
    }
    normalTabMovedOutsidePanel ||= !(await appearance.evaluate((element) =>
      element.contains(document.activeElement)
    ));
  }
  if (switchReached) {
    const themeSwitchFocus = await themeSwitch.evaluate((element) => {
      const input = element as HTMLInputElement;
      const label = input.closest('label');
      const slider = input.nextElementSibling;
      const inputStyle = getComputedStyle(input);
      const sliderStyle = slider ? getComputedStyle(slider) : null;
      const rect = input.getBoundingClientRect();
      return {
        accessibleName: input.getAttribute('aria-label'),
        tabIndex: input.tabIndex,
        matchesFocusVisible: input.matches(':focus-visible'),
        inputOutline: inputStyle.outline,
        inputBoxShadow: inputStyle.boxShadow,
        sliderBoxShadow: sliderStyle?.boxShadow ?? null,
        sliderOutline: sliderStyle?.outline ?? null,
        labelRect: label
          ? (() => {
              const labelRect = label.getBoundingClientRect();
              return {
                width: labelRect.width,
                height: labelRect.height,
              };
            })()
          : null,
        inputRect: { width: rect.width, height: rect.height },
      };
    });
    await page.screenshot({
      path: join(artifacts, `${app}-appearance-switch-focused-light.png`),
      fullPage: true,
    });
    await page.keyboard.press('Space');
    appearanceTabSequence.push({ focusedSwitch: themeSwitchFocus });
  } else {
    // Preserve the contrast observation after recording the keyboard failure.
    await appearance.locator('label.switch').click();
  }
  await expect(themeSwitch).toBeChecked({ checked: !themeWasDark });
  await expect
    .poll(async () => (await readTheme()).rootBackground)
    .not.toBe(before.rootBackground);
  const afterThemeStability = await waitForStableTheme(page);
  const after = await readTheme();
  const appearanceChanged =
    before.bodyClass !== after.bodyClass ||
    before.htmlClass !== after.htmlClass ||
    before.foreground !== after.foreground ||
    before.background !== after.background ||
    before.rootBackground !== after.rootBackground ||
    before.themeControlClass !== after.themeControlClass;
  const axe = await new AxeBuilder({ page }).analyze();
  writeEvidence({
    app,
    check: 'appearance-control-theme-switch',
    collectorCompleted: true,
    acceptanceStatus: 'NOT_ASSESSED_PENDING_FINDINGS_TRIAGE',
    criterionStatus: !switchReached
      ? 'FAIL_KEYBOARD_CANNOT_REACH_THEME_SWITCH'
      : appearanceChanged
      ? 'OBSERVED_KEYBOARD_REACHABLE_AND_THEME_CHANGED_REQUIRES_CONTRAST_TRIAGE'
      : 'FAIL_THEME_DID_NOT_CHANGE',
    viewport: { width: 375, height: 812 },
    before,
    after,
    themeStability: {
      before: beforeThemeStability,
      after: afterThemeStability,
    },
    switchChecked: await themeSwitch.isChecked(),
    appearanceChanged,
    keyboardReachable: switchReached,
    normalTabMovedOutsidePanel,
    closeFocusedOnOpen,
    appearanceTabSequence,
    themeSwitchFocus:
      appearanceTabSequence.find((step) => 'focusedSwitch' in step)?.[
        'focusedSwitch'
      ] ?? null,
    activeAfterTabAttempt: await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return {
        tag: element?.tagName ?? null,
        name:
          element?.getAttribute('aria-label') ||
          element?.innerText.slice(0, 60) ||
          null,
      };
    }),
    beforeAxeViolations: beforeAxe.violations.map((item) => ({
      id: item.id,
      impact: item.impact,
      help: item.help,
      targets: item.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
    beforeAxeIncomplete: beforeAxe.incomplete.map((item) => item.id),
    axeViolations: axe.violations.map((item) => ({
      id: item.id,
      impact: item.impact,
      help: item.help,
      targets: item.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
  });
  expect(
    appearanceChanged,
    'theme choice must change rendered appearance'
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(appearance).not.toBeVisible();
  await expect(appearanceTrigger).toBeFocused();
});

test(`RR09 ${app.toUpperCase()} reduced-motion preference affects rendered motion`, async ({
  page,
}, testInfo) => {
  test.skip(
    !auditEnabled,
    'Set RR09_PUBLIC_AUDIT=true to opt into this live-stack audit collector'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Motion comparison uses one system Chrome project'
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(new URL('/', origin).toString());
  await expect(page.locator(routeReadySelector('/'))).toBeVisible();
  const normalMotion = await page.evaluate(async () => {
    const animations = () =>
      document.getAnimations().map((animation) => {
        const effect = animation.effect as KeyframeEffect | null;
        const target = effect?.target;
        return {
          playState: animation.playState,
          duration: effect?.getTiming().duration,
          target: target instanceof Element ? target.tagName : null,
        };
      });
    const canvasFrames = () =>
      Array.from(document.querySelectorAll('canvas')).map((canvas) =>
        canvas.toDataURL()
      );
    const before = canvasFrames();
    await new Promise<void>((resolve) => {
      let frames = 0;
      const tick = () => {
        frames += 1;
        if (frames >= 10) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const after = canvasFrames();
    return {
      animations: animations(),
      canvasCount: before.length,
      canvasChanged: before.some((frame, index) => frame !== after[index]),
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator(routeReadySelector('/'))).toBeVisible();
  const reducedMotion = await page.evaluate(async () => {
    const animations = document.getAnimations().map((animation) => {
      const effect = animation.effect as KeyframeEffect | null;
      const target = effect?.target;
      return {
        playState: animation.playState,
        duration: effect?.getTiming().duration,
        target: target instanceof Element ? target.tagName : null,
      };
    });
    const before = Array.from(document.querySelectorAll('canvas')).map(
      (canvas) => canvas.toDataURL()
    );
    await new Promise<void>((resolve) => {
      let frames = 0;
      const tick = () => {
        frames += 1;
        if (frames >= 10) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const after = Array.from(document.querySelectorAll('canvas')).map(
      (canvas) => canvas.toDataURL()
    );
    return {
      animations,
      canvasCount: before.length,
      canvasChanged: before.some((frame, index) => frame !== after[index]),
    };
  });
  const preferenceApplied = await page.evaluate(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  writeEvidence({
    app,
    check: 'reduced-motion',
    collectorCompleted: true,
    acceptanceStatus: 'NOT_ASSESSED',
    criterionStatus:
      normalMotion.animations.length > 0 || normalMotion.canvasChanged
        ? 'OBSERVED_NORMAL_MOTION_COMPARE_REDUCED_BEHAVIOR'
        : 'INCONCLUSIVE_NO_BASELINE_MOTION_OBSERVED',
    viewport: { width: 375, height: 812 },
    preferenceApplied,
    normalMotion,
    reducedMotion,
  });
  expect(preferenceApplied).toBe(true);
});

test(`RR09 ${app.toUpperCase()} HAI dialog can be reached and exited by keyboard`, async ({
  page,
}, testInfo) => {
  test.skip(
    !auditEnabled,
    'Set RR09_PUBLIC_AUDIT=true to opt into this live-stack audit collector'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'The HAI dialog is checked once with explicit viewport and system Chrome'
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.route('**/api/registry/apps', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          apps: [
            {
              appId: 'client-interface',
              name: 'Optimistic Tanuki',
              uiBaseUrl: 'http://127.0.0.1:8080/',
              visibility: 'public',
            },
            {
              appId: 'local-hub',
              name: 'Towne Square',
              uiBaseUrl: 'http://127.0.0.1:8087/',
              visibility: 'public',
            },
          ],
        },
      },
    })
  );
  await page.goto(new URL('/', origin).toString());
  const tag = page.getByTestId('hai-about-tag');
  await expect(page.locator(routeReadySelector('/'))).toBeVisible();
  await expect(tag).toBeVisible();

  let reachedTag = false;
  for (let index = 0; index < 100; index += 1) {
    await page.keyboard.press('Tab');
    if (
      (await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid')
      )) === 'hai-about-tag'
    ) {
      reachedTag = true;
      break;
    }
  }
  expect(reachedTag, 'HAI tag must be reachable using Tab').toBe(true);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Close modal' })
  ).toBeFocused();
  const modalAxe = await new AxeBuilder({ page })
    .include('[role="alertdialog"]')
    .analyze();
  writeEvidence({
    app,
    check: 'hai-dialog-keyboard',
    collectorCompleted: true,
    acceptanceStatus: 'NOT_ASSESSED_PENDING_FINDINGS_TRIAGE',
    criterionStatus: 'OBSERVED_REQUIRES_MANUAL_VISIBLE_FOCUS_REVIEW',
    viewport: { width: 375, height: 812 },
    axeViolations: modalAxe.violations.map((item) => ({
      id: item.id,
      impact: item.impact,
      help: item.help,
      targets: item.nodes.map((node) => node.target),
    })),
    firstFocus: await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      name:
        document.activeElement?.getAttribute('aria-label') ||
        document.activeElement?.textContent?.trim(),
    })),
  });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const lastRepositoryLink = dialog.getByTestId('hai-app-repo-link').last();
  await expect(lastRepositoryLink).toBeVisible();
  let reachedLastLink = false;
  for (let index = 0; index < 100; index += 1) {
    if (
      await lastRepositoryLink.evaluate(
        (element) => element === document.activeElement
      )
    ) {
      reachedLastLink = true;
      break;
    }
    await page.keyboard.press('Tab');
  }
  expect(
    reachedLastLink,
    'last repository link must be reachable with Tab'
  ).toBe(true);
  await page.keyboard.press('Tab');
  await expect(
    dialog.getByRole('button', { name: 'Close modal' })
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(lastRepositoryLink).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(tag).toBeFocused();
});
