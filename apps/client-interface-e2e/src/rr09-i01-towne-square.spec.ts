import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const enabled = process.env['RR09_I01_LIVE_STACK'] === 'true';
const origin = process.env['BASE_URL'] ?? 'http://127.0.0.1:8087';
const evidenceDir = join(process.cwd(), '.runtime-artifacts', 'rr09', 'i01');
const viewports = [
  { name: 'phone-320', width: 320, height: 740 },
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 633 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const;
const headers = { 'X-ot-appscope': 'local-hub', 'X-ot-app-id': 'local-hub' };
const password = `RR09-I01-${randomUUID()}!`;
type ThemeMode = 'light' | 'dark';

function recordEvidence(value: Record<string, unknown>) {
  mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  appendFileSync(
    join(evidenceDir, 'evidence.jsonl'),
    `${JSON.stringify({ observedAt: new Date().toISOString(), ...value })}\n`,
    { mode: 0o600 }
  );
}

async function runAxe(page: import('@playwright/test').Page, state: string) {
  const result = await new AxeBuilder({ page }).analyze();
  recordEvidence({
    state,
    axe: {
      violations: result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target),
      })),
      incomplete: result.incomplete.map((item) => item.id),
      passes: result.passes.length,
    },
  });
}

async function register(page: import('@playwright/test').Page, role: string) {
  const email = `rr09-i01-${role}-${Date.now()}-${randomUUID().slice(
    0,
    8
  )}@example.test`;
  const response = await page.request.post(
    `${origin}/api/authentication/register`,
    {
      headers,
      data: {
        fn: 'RR09-I01',
        ln: role,
        email,
        password,
        confirm: password,
        bio: 'Retained local RR09-I01 acceptance account',
      },
    }
  );
  expect(response.status(), await response.text()).toBe(201);
  return email;
}

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto(new URL('/login', origin).toString());
  await expect(page.locator('lib-login-block form')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /login/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
}

async function setActualTheme(
  page: import('@playwright/test').Page,
  theme: ThemeMode
) {
  const trigger = page.getByRole('button', { name: 'Appearance', exact: true });
  await trigger.click();
  const panel = page.getByRole('dialog', { name: 'Appearance controls' });
  await expect(panel).toBeVisible();
  const toggle = panel.getByRole('checkbox');
  if ((await toggle.isChecked()) !== (theme === 'dark')) {
    await panel.locator('label.switch').click();
  }
  await expect(toggle).toHaveJSProperty('checked', theme === 'dark');
  await panel
    .getByRole('button', { name: 'Close appearance controls' })
    .click();

  const settled = await page.evaluate(async () => {
    const read = () => ({
      body: getComputedStyle(document.body).color,
      background: getComputedStyle(document.body).backgroundColor,
      theme: document.documentElement.getAttribute('data-theme'),
    });
    let previous = JSON.stringify(read());
    let stableSamples = 0;
    const deadline = Date.now() + 5000;
    while (stableSamples < 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const current = JSON.stringify(read());
      stableSamples = current === previous ? stableSamples + 1 : 0;
      previous = current;
      if (Date.now() > deadline) {
        throw new Error('Actual theme did not settle before contrast sampling');
      }
    }
    return { ...JSON.parse(previous), stableSamples };
  });
  return settled as {
    body: string;
    background: string;
    theme: string | null;
    stableSamples: number;
  };
}

async function assertTextContrast(
  locator: import('@playwright/test').Locator,
  description: string,
  expectedTheme: ThemeMode
) {
  await expect(locator.first(), `${description} is present`).toBeVisible();
  const sample = await locator.evaluateAll(async (elements) => {
    const readTargetColors = () => ({
      theme: document.documentElement.getAttribute('data-theme'),
      elements: elements.map((element) => {
        const backgrounds: string[] = [];
        let ancestor: Element | null = element;
        while (ancestor) {
          backgrounds.push(getComputedStyle(ancestor).backgroundColor);
          ancestor = ancestor.parentElement;
        }
        return {
          text: element.textContent?.trim(),
          color: getComputedStyle(element).color,
          backgrounds,
        };
      }),
    });
    let previous = JSON.stringify(readTargetColors());
    let stableSamples = 0;
    const deadline = Date.now() + 5000;
    while (stableSamples < 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const current = JSON.stringify(readTargetColors());
      stableSamples = current === previous ? stableSamples + 1 : 0;
      previous = current;
      if (Date.now() > deadline) {
        throw new Error(
          'Target colors did not settle before contrast sampling'
        );
      }
    }
    return { ...JSON.parse(previous), stableSamples };
  });
  expect(sample.theme, `${description} actual theme`).toBe(expectedTheme);
  expect(
    sample.stableSamples,
    `${description} stable color samples`
  ).toBeGreaterThanOrEqual(7);

  const measurements = await locator.evaluateAll((elements, sampled) => {
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = 1;
    colorCanvas.height = 1;
    const colorContext = colorCanvas.getContext('2d', {
      willReadFrequently: true,
    });
    const parse = (value: string) => {
      if (!colorContext) return null;
      colorContext.clearRect(0, 0, 1, 1);
      colorContext.fillStyle = value;
      colorContext.fillRect(0, 0, 1, 1);
      const pixel = Array.from(colorContext.getImageData(0, 0, 1, 1).data);
      pixel[3] /= 255;
      return pixel;
    };
    const composite = (foreground: number[], background: number[]) => {
      const alpha = foreground[3] ?? 1;
      return [0, 1, 2].map((channel) =>
        Math.round(
          foreground[channel] * alpha + background[channel] * (1 - alpha)
        )
      );
    };
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : Math.pow((value + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    return sampled.elements.map(
      (target: {
        text: string | undefined;
        color: string;
        backgrounds: string[];
      }) => {
        const foreground = parse(target.color);
        if (!foreground) {
          return { text: target.text, color: target.color, ratio: null };
        }
        const backgrounds = target.backgrounds
          .map(parse)
          .filter((color): color is number[] => !!color && (color[3] ?? 1) > 0);
        let background = [255, 255, 255];
        for (const layer of backgrounds.reverse()) {
          background = composite(layer, background);
        }
        const renderedForeground = composite(foreground, background);
        const ratio =
          (Math.max(luminance(renderedForeground), luminance(background)) +
            0.05) /
          (Math.min(luminance(renderedForeground), luminance(background)) +
            0.05);
        return {
          text: target.text,
          color: target.color,
          background: `rgb(${background.join(', ')})`,
          ratio,
        };
      }
    );
  }, sample);
  recordEvidence({
    state: 'stable-target-contrast-sample',
    target: description,
    theme: sample.theme,
    stableSamples: sample.stableSamples,
    colors: measurements.map(({ color, background, ratio }) => ({
      color,
      background,
      ratio,
    })),
  });
  for (const measurement of measurements) {
    expect(
      measurement.ratio,
      `${description}: ${JSON.stringify(measurement)}`
    ).not.toBeNull();
    expect(
      measurement.ratio!,
      `${description}: ${JSON.stringify(measurement)}`
    ).toBeGreaterThanOrEqual(4.5);
  }
}

async function assertTargetSize(
  locator: import('@playwright/test').Locator,
  description: string
) {
  await expect(locator.first(), `${description} is present`).toBeVisible();
  const dimensions = await locator.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        name:
          element.getAttribute('aria-label') ||
          element.textContent?.trim() ||
          element.tagName.toLowerCase(),
        width: rect.width,
        height: rect.height,
      };
    })
  );
  for (const size of dimensions) {
    const diagnostic = {
      ...size,
      width: Number(size.width.toFixed(2)),
      height: Number(size.height.toFixed(2)),
    };
    expect(
      size.width,
      `${description}: ${JSON.stringify(diagnostic)}`
    ).toBeGreaterThanOrEqual(44);
    expect(
      size.height,
      `${description}: ${JSON.stringify(diagnostic)}`
    ).toBeGreaterThanOrEqual(44);
  }
}

test.describe('RR09-I01 Towne Square responsive and accessible controls', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !enabled,
      'Set RR09_I01_LIVE_STACK=true to run against the live TS stack'
    );
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'This live acceptance uses one system Chrome project and explicit viewports'
    );
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  for (const viewport of viewports) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${viewport.name} ${theme} keeps TS public controls readable and in bounds`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(new URL('/cities', origin).toString());
        await expect(page.locator('.cities-page h1')).toBeVisible();
        const actualTheme = await setActualTheme(page, theme);
        expect(actualTheme.stableSamples).toBeGreaterThanOrEqual(7);
        expect(actualTheme.theme).toBe(theme);

        const filterToggle = page.getByRole('button', {
          name: /Search & Filters/,
        });
        if ((await filterToggle.getAttribute('aria-expanded')) !== 'true') {
          await filterToggle.click();
        }
        await expect(filterToggle).toHaveAttribute('aria-expanded', 'true');
        const softFilters = page.locator('.filter-chip.soft');
        await expect(softFilters.first()).toBeVisible();
        await assertTextContrast(
          softFilters,
          'Inactive locality filter',
          theme
        );
        await runAxe(page, `${viewport.name}-${theme}-cities-inactive`);
        await assertTargetSize(softFilters, 'Locality type filter chips');
        await softFilters.first().click();
        await assertTextContrast(
          page.locator('.filter-chip.soft.active'),
          'Active locality filter',
          theme
        );
        await assertTargetSize(
          page.locator('.map-control-btn'),
          'Reset map control'
        );
        const zoomControls = page.locator('.leaflet-control-zoom a:visible');
        await expect(
          zoomControls,
          'Leaflet provides visible zoom-in and zoom-out controls'
        ).toHaveCount(2);
        await assertTargetSize(zoomControls, 'Map zoom controls');

        await page.goto(new URL('/communities', origin).toString());
        await expect(page.locator('.communities-page h1')).toBeVisible();
        const communityTheme = await setActualTheme(page, theme);
        expect(communityTheme.theme).toBe(theme);
        expect(communityTheme.stableSamples).toBeGreaterThanOrEqual(7);
        const scroll = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(
          scroll.scrollWidth,
          `Community page horizontal bounds: ${JSON.stringify(scroll)}`
        ).toBeLessThanOrEqual(scroll.clientWidth);
        await assertTargetSize(
          page.locator('.filter-chip'),
          'Community filter chips'
        );
        await assertTargetSize(page.locator('.map-link'), 'City map link');
        await assertTextContrast(
          page.locator('.map-link'),
          'City map link',
          theme
        );
        const communityFilters = page.locator('.filter-chip');
        await assertTextContrast(
          communityFilters,
          'Inactive community filter',
          theme
        );
        await communityFilters.first().click();
        await assertTextContrast(
          page.locator('.filter-chip.active'),
          'Active community filter',
          theme
        );
        await assertTextContrast(
          page.locator('.clear-filters'),
          'Clear community filters',
          theme
        );
        await runAxe(page, `${viewport.name}-${theme}-communities`);

        for (const [route, selector, description] of [
          ['/login', '.register-link a', 'Login registration link'],
          ['/register', '.login-link a', 'Registration login link'],
        ] as const) {
          await page.goto(new URL(route, origin).toString());
          await expect(page.locator(selector)).toBeVisible();
          const routeTheme = await setActualTheme(page, theme);
          expect(routeTheme.theme).toBe(theme);
          expect(routeTheme.stableSamples).toBeGreaterThanOrEqual(7);
          await assertTextContrast(page.locator(selector), description, theme);
          await assertTargetSize(page.locator(selector), description);
          await runAxe(page, `${viewport.name}-${theme}-${route.slice(1)}`);
        }

        mkdirSync(evidenceDir, { recursive: true });
        await page.goto(new URL('/communities', origin).toString());
        const screenshotTheme = await setActualTheme(page, theme);
        expect(screenshotTheme.theme).toBe(theme);
        expect(screenshotTheme.stableSamples).toBeGreaterThanOrEqual(7);
        await page.screenshot({
          path: join(evidenceDir, `${viewport.name}-${theme}.png`),
          fullPage: true,
        });
      });
    }
  }

  test('authenticated text-only listing states keep labels and contrast readable in both actual themes', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const sellerContext = await browser.newContext({ baseURL: origin });
    let buyerContext: import('@playwright/test').BrowserContext | undefined;
    const page = await sellerContext.newPage();
    let buyerPage: import('@playwright/test').Page | undefined;
    let cityId: string | undefined;
    let communityId: string | undefined;
    let listingId: string | undefined;
    let primaryError: unknown;
    try {
      const email = await register(page, 'seller');
      await login(page, email);
      buyerContext = await browser.newContext({ baseURL: origin });
      buyerPage = await buyerContext.newPage();
      const buyerEmail = await register(buyerPage, 'buyer');
      await login(buyerPage, buyerEmail);
      const unique = randomUUID().slice(0, 8);
      const cityResponse = await page.request.post(
        `${origin}/api/social/community`,
        {
          headers,
          data: {
            name: `RR09 I01 city ${unique}`,
            slug: `rr09-i01-city-${unique}`,
            description: 'Temporary text-only RR09-I01 locality',
            localityType: 'city',
            city: 'RR09 I01 fixture',
            countryCode: 'USA',
            adminArea: 'RR09',
          },
        }
      );
      expect(cityResponse.status(), await cityResponse.text()).toBe(201);
      const city = await cityResponse.json();
      cityId = city.id;

      const communityResponse = await page.request.post(
        `${origin}/api/social/community`,
        {
          headers,
          data: {
            name: `RR09 I01 neighborhood ${unique}`,
            slug: `rr09-i01-neighborhood-${unique}`,
            description: 'Temporary text-only RR09-I01 community',
            parentId: city.id,
            localityType: 'neighborhood',
            city: 'RR09 I01 fixture',
            countryCode: 'USA',
            adminArea: 'RR09',
            isPrivate: false,
            joinPolicy: 'public',
          },
        }
      );
      expect(communityResponse.status(), await communityResponse.text()).toBe(
        201
      );
      const community = await communityResponse.json();
      communityId = community.id;
      expect(community.adminArea).toBe('RR09');
      expect(community.city).toBe('RR09 I01 fixture');
      const membershipResponse = await buyerPage.request.post(
        `${origin}/api/social/community/${community.id}/join`,
        { headers }
      );
      expect(membershipResponse.status(), await membershipResponse.text()).toBe(
        201
      );

      await page.goto(new URL('/cities', origin).toString());
      await expect(page.locator('.cities-page h1')).toBeVisible();
      const stateFilter = page
        .locator('.filter-block')
        .filter({ hasText: /^States/ })
        .getByRole('button', { name: 'RR09', exact: true });
      await expect(
        stateFilter,
        'The owned locality fixture contributes its state filter'
      ).toBeVisible();
      await expect(stateFilter).toHaveClass(/filter-chip/);
      await expect(stateFilter).not.toHaveClass(/soft/);
      await stateFilter.click();
      const allCommunitiesSection = page
        .locator('section.panel-section')
        .filter({
          has: page.getByRole('heading', {
            name: 'All Communities',
            exact: true,
          }),
        });
      await expect(
        allCommunitiesSection,
        'The All Communities browse section'
      ).toHaveCount(1);
      const fixtureCommunity = allCommunitiesSection
        .locator('.community-card')
        .filter({ hasText: community.name });
      await expect(
        fixtureCommunity,
        'The owned public locality fixture contributes one card in All Communities'
      ).toHaveCount(1);
      await expect(
        fixtureCommunity,
        'The owned All Communities card is visible'
      ).toBeVisible();
      const stateFilterThemes: Array<
        Awaited<ReturnType<typeof setActualTheme>>
      > = [];
      for (const theme of ['light', 'dark'] as const) {
        const settled = await setActualTheme(page, theme);
        expect(settled.theme).toBe(theme);
        expect(settled.stableSamples).toBeGreaterThanOrEqual(7);
        stateFilterThemes.push(settled);
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await assertTextContrast(stateFilter, 'Locality state filter', theme);
          await assertTargetSize(stateFilter, 'Locality state filter');
          await assertTextContrast(
            fixtureCommunity.locator('.community-type, .community-location'),
            'Fixture locality card metadata',
            theme
          );
        }
      }
      expect(
        `${stateFilterThemes[0].body}|${stateFilterThemes[0].background}`
      ).not.toBe(
        `${stateFilterThemes[1].body}|${stateFilterThemes[1].background}`
      );

      const title = `RR09 I01 listing ${unique}`;
      const listingResponse = await page.request.post(
        `${origin}/api/classifieds`,
        {
          headers,
          data: {
            title,
            description:
              'Temporary text-only listing for accessibility checks.',
            price: 7,
            currency: 'USD',
            category: 'for-sale',
            communityId: community.id,
          },
        }
      );
      expect(listingResponse.status(), await listingResponse.text()).toBe(201);
      const listing = await listingResponse.json();
      listingId = listing.id;

      await page.goto(
        new URL(`/c/${community.slug}/classifieds/new`, origin).toString()
      );
      await expect(
        page.getByRole('heading', { name: 'Post a New Listing' })
      ).toBeVisible();
      const imageInput = page.getByLabel('Images (optional, up to 5)');
      await expect(imageInput).toHaveAttribute('type', 'file');
      await expect(imageInput).toHaveAttribute('multiple', '');
      const imageInputId = await imageInput.getAttribute('id');
      expect(imageInputId).toBeTruthy();
      const imageLabel = page.locator(`label[for="${imageInputId}"]`);

      const themes: Array<{
        theme: 'light' | 'dark';
        settled: Awaited<ReturnType<typeof setActualTheme>>;
      }> = [];
      for (const theme of ['light', 'dark'] as const) {
        const settled = await setActualTheme(page, theme);
        expect(settled.theme).toBe(theme);
        expect(settled.stableSamples).toBeGreaterThanOrEqual(7);
        themes.push({ theme, settled });
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await assertTextContrast(
            page.locator('.classified-form .btn-secondary'),
            'Listing form Cancel action',
            theme
          );
          await assertTextContrast(
            imageLabel,
            'Listing image input label',
            theme
          );
          await runAxe(page, `${viewport.name}-${theme}-listing-form`);
          if (viewport.width === 375 || viewport.width === 1280) {
            mkdirSync(evidenceDir, { recursive: true });
            await page.screenshot({
              path: join(
                evidenceDir,
                `${viewport.name}-${theme}-listing-form.png`
              ),
              fullPage: true,
            });
          }
        }

        await buyerPage.goto(
          new URL(`/c/${community.slug}/classifieds`, origin).toString()
        );
        const buyerTheme = await setActualTheme(buyerPage, theme);
        expect(buyerTheme.theme).toBe(theme);
        expect(buyerTheme.stableSamples).toBeGreaterThanOrEqual(7);
        const card = buyerPage
          .locator('.classified-card')
          .filter({ hasText: title });
        await expect(card).toBeVisible();
        for (const viewport of viewports) {
          await buyerPage.setViewportSize(viewport);
          await assertTextContrast(
            card.locator('.card-price'),
            'Listing price',
            theme
          );
          await assertTextContrast(
            card.locator('.card-status'),
            'Listing status',
            theme
          );
          await assertTextContrast(
            card.locator('.card-actions .btn-secondary'),
            'Listing action',
            theme
          );
          await runAxe(buyerPage, `${viewport.name}-${theme}-listing-card`);
          if (viewport.width === 375 || viewport.width === 1280) {
            mkdirSync(evidenceDir, { recursive: true });
            await buyerPage.screenshot({
              path: join(
                evidenceDir,
                `${viewport.name}-${theme}-listing-card.png`
              ),
              fullPage: true,
            });
          }
        }
      }
      expect(
        `${themes[0].settled.body}|${themes[0].settled.background}`
      ).not.toBe(`${themes[1].settled.body}|${themes[1].settled.background}`);
      recordEvidence({
        state: 'authenticated-listing-fixture',
        fixtureIds: { cityId, communityId, listingId },
        account: 'retained controlled audit account; credentials not recorded',
        imageUploads: 0,
        themes,
      });
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      const cleanupErrors: string[] = [];
      for (const [kind, id, path] of [
        ['listing', listingId, '/api/classifieds/'],
        ['community', communityId, '/api/social/community/'],
        ['city', cityId, '/api/social/community/'],
      ] as const) {
        if (!id) continue;
        try {
          const response = await page.request.delete(`${origin}${path}${id}`, {
            headers,
          });
          if (![200, 204].includes(response.status())) {
            cleanupErrors.push(`${kind} ${id}: ${response.status()}`);
            continue;
          }
          const readback = await page.request.get(`${origin}${path}${id}`, {
            headers,
          });
          if (kind === 'listing') {
            if (readback.status() !== 200) {
              cleanupErrors.push(
                `${kind} ${id}: owner readback ${readback.status()}`
              );
              continue;
            }
            const listing = await readback.json();
            if (listing?.id !== id || listing?.status !== 'removed') {
              cleanupErrors.push(`${kind} ${id}: owner state is not removed`);
            }
            if (communityId && buyerPage) {
              const activeListings = await buyerPage.request.get(
                `${origin}/api/classifieds/community/${communityId}`,
                { headers }
              );
              if (activeListings.status() !== 200) {
                cleanupErrors.push(
                  `${kind} ${id}: buyer active-list readback ${activeListings.status()}`
                );
              } else if (
                JSON.stringify(await activeListings.json()).includes(id)
              ) {
                cleanupErrors.push(
                  `${kind} ${id}: remains in buyer active list`
                );
              }
            }
          } else if (readback.status() === 404) {
            // The exact city/community ID is absent.
          } else if (readback.status() === 200) {
            const text = await readback.text();
            let value: unknown;
            try {
              value = text ? JSON.parse(text) : null;
            } catch {
              cleanupErrors.push(`${kind} ${id}: readback was not empty JSON`);
              continue;
            }
            if (
              value !== null &&
              !(Array.isArray(value) && value.length === 0)
            ) {
              cleanupErrors.push(
                `${kind} ${id}: exact resource remains in readback`
              );
            }
          } else {
            cleanupErrors.push(`${kind} ${id}: readback ${readback.status()}`);
          }
        } catch (error) {
          cleanupErrors.push(
            error instanceof Error ? error.message : String(error)
          );
        }
      }
      recordEvidence({
        state: 'authenticated-listing-fixture-cleanup',
        fixtureIds: { cityId, communityId, listingId },
        cleanupErrors,
        primaryError: primaryError ? 'preserved in test result' : undefined,
      });
      if (!primaryError) expect(cleanupErrors).toEqual([]);
      await Promise.all([
        sellerContext.close(),
        buyerContext?.close().catch(() => undefined),
      ]);
    }
  });
});
