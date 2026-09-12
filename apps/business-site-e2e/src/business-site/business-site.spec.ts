import { Locator, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { expect, test } from '../support/fixtures';
import { getOwnerAuthScope } from '../support/owner-auth-scope';

const OWNER_EMAIL = 'owner@localbusiness.test';
const OWNER_PASSWORD = 'BusinessOwnerPass123!';
const CLIENT_EMAIL = 'client@localbusiness.test';
const CLIENT_PASSWORD = 'ClientPass123!';
const PENDING_CLIENT_EMAIL = 'pending-client@localbusiness.test';
const PENDING_CLIENT_PASSWORD = 'PendingClientPass123!';
const BUSINESS_TEST_CATALOG_NAME = 'Business Site E2E Catalog';
const BUSINESS_TEST_CATALOG_DESCRIPTION =
  'Deterministic catalog used by the Business Site browser suite.';
const BUSINESS_API_BASE_URL =
  process.env['BUSINESS_API_BASE_URL'] || 'http://127.0.0.1:3000';
const OWNER_ACCOUNTS = [
  {
    label: 'North Star Advisory',
    email: 'owner@localbusiness.test',
    password: 'BusinessOwnerPass123!',
    slug: 'north-star-advisory',
    publicHeading: 'North Star Advisory',
  },
  {
    label: 'Steady Hand Contracting',
    email: 'owner-handyman@localbusiness.test',
    password: 'BusinessOwnerPass123!',
    slug: 'steady-hand-contracting',
    publicHeading: 'Steady Hand Contracting',
  },
  {
    label: 'Clearcrest Pressure Washing',
    email: 'owner-pressure@localbusiness.test',
    password: 'BusinessOwnerPass123!',
    slug: 'clearcrest-pressure-washing',
    publicHeading: 'Clearcrest Pressure Washing',
  },
  {
    label: 'Ovenbird Bakeshop',
    email: 'owner-baker@localbusiness.test',
    password: 'BusinessOwnerPass123!',
    slug: 'ovenbird-bakeshop',
    publicHeading: 'Ovenbird Bakeshop',
  },
  {
    label: 'Canopy Tree Service',
    email: 'owner-tree@localbusiness.test',
    password: 'BusinessOwnerPass123!',
    slug: 'canopy-tree-service',
    publicHeading: 'Canopy Tree Service',
  },
] as const;
const SEEDED_SAMPLE_TENANTS = [
  {
    slug: 'steady-hand-contracting',
    businessName: 'Steady Hand Contracting',
    heroCopy:
      'Keep estimate requests, repair scheduling, and homeowner communication moving in one place.',
    cta: 'Request an estimate',
    serviceName: 'Repair visit',
  },
  {
    slug: 'ovenbird-bakeshop',
    businessName: 'Ovenbird Bakeshop',
    heroCopy:
      'Capture event details, custom notes, and pickup timing without losing the thread.',
    cta: 'Start an order',
    serviceName: 'Custom cake order',
  },
] as const;

test.describe.configure({ mode: 'serial' });

function uniqueLabel(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function resolveBookingPath(
  page: Page,
  tenantSlug: string = OWNER_ACCOUNTS[0].slug
) {
  const currentPath = new URL(page.url()).pathname;
  const tenantMatch = currentPath.match(/^\/sites\/([^/]+)/);
  const slug = tenantMatch?.[1] ?? tenantSlug;
  return `/sites/${slug}/book`;
}

function svgDataUrl(label: string, fill: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="${fill}"/><text x="60" y="120" fill="#ffffff" font-size="64" font-family="Arial, sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function cookieSessionHeaders(sessionCookie: string) {
  return {
    Cookie: `ot_session=${sessionCookie}`,
    'x-ot-appscope': 'business-site',
    'x-ot-session-mode': 'cookie',
  };
}

async function openSiteEditor(page: Page) {
  await page.getByRole('link', { name: 'Site Editor' }).click();
  await expect(page).toHaveURL(/\/owner\/site$/);
  await expect(
    page.getByRole('heading', { name: 'Site Content Editor' })
  ).toBeVisible();
}

async function switchToStudio(page: Page) {
  await page
    .locator('[data-editor-mode-switch]')
    .getByRole('button', {
      name: 'Studio',
    })
    .click();
  await expect(page.locator('.page-header .workspace-kicker')).toContainText(
    'Studio workspace'
  );
}

function businessNameInput(page: Page) {
  return page
    .locator('#guided-business-info app-schema-form-panel input')
    .first();
}

function schemaFieldControl(scope: Locator, key: string) {
  return scope
    .locator(`[id="field-${key}"]`)
    .locator('input, textarea, select')
    .first();
}

async function replaceComposeContent(page: Page, scope: Locator, text: string) {
  const editor = scope.locator('.ProseMirror').first();
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await editor.press('Backspace');
  await page.keyboard.insertText(text);
}

async function loginClient(
  page: Page,
  email = CLIENT_EMAIL,
  password = CLIENT_PASSWORD,
  tenantSlug?: string
) {
  await page.goto(
    tenantSlug ? `/sites/${tenantSlug}/client/login` : '/client/login'
  );
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(
    tenantSlug
      ? new RegExp(`/sites/${tenantSlug}/client/dashboard$`)
      : /\/client\/dashboard$/
  );

  await expect
    .poll(async () => {
      return page.evaluate(() =>
        sessionStorage.getItem('business-site:session-kind')
      );
    })
    .toBe('client');

  const sessionCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'ot_session' && cookie.value
  );
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.value).toBeTruthy();

  const sessionResponse = await page.request.get(
    '/api/authentication/session',
    {
      headers: cookieSessionHeaders(sessionCookie!.value),
    }
  );
  expect(sessionResponse.ok()).toBeTruthy();
  const sessionPayload = (await sessionResponse.json()) as {
    data?: { userId?: string; profileId?: string };
  };

  return {
    cookieValue: sessionCookie!.value,
    profileId: sessionPayload.data?.profileId ?? '',
    userId: sessionPayload.data?.userId ?? '',
  };
}

async function loginOwner(page: Page) {
  await page.goto('/owner/dashboard');
  await expect(page).toHaveURL(/\/owner\/dashboard$/);

  await expect
    .poll(async () => {
      return page.evaluate(() =>
        sessionStorage.getItem('business-site:session-kind')
      );
    })
    .toBe('owner');

  return loginOwnerApi(page);
}

async function loginOwnerWithCredentials(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/auth');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

async function registerOwner(
  page: Page,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    bio?: string;
  }
) {
  await page.goto('/owner/register');
  await page.getByLabel('First name').fill(input.firstName);
  await page.getByLabel('Last name').fill(input.lastName);
  await page.getByLabel('Email').fill(input.email);
  await page.locator('input[name="password"]').fill(input.password);
  await page.locator('input[name="confirm"]').fill(input.password);
  await page
    .getByLabel('What are you building?')
    .fill(input.bio ?? 'Launching a new business site.');
  await page.getByRole('button', { name: /create owner account/i }).click();
}

let cachedOwnerSessionToken: string | undefined;

async function loginOwnerApi(page: Page) {
  if (cachedOwnerSessionToken) {
    return cachedOwnerSessionToken;
  }

  const sessionCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'ot_session'
  );
  expect(sessionCookie?.value).toBeTruthy();
  cachedOwnerSessionToken = sessionCookie?.value;
  return cachedOwnerSessionToken as string;
}

async function readSessionCookie(page: Page): Promise<string> {
  const sessionCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'ot_session' && cookie.value
  );
  expect(sessionCookie?.value).toBeTruthy();
  return sessionCookie!.value;
}

async function ensureBusinessTestBlogCatalog(
  page: Page,
  ownerToken: string
): Promise<string> {
  const headers = cookieSessionHeaders(ownerToken);
  const workspaceQuery = 'workspaceSlug=north-star-advisory';
  const listResponse = await page.request.get(
    `/api/blog/catalogs/mine?${workspaceQuery}`,
    { headers }
  );
  expect(listResponse.ok()).toBeTruthy();

  const catalogs = (await listResponse.json()) as Array<{
    id?: string;
    name?: string;
  }>;
  const existingCatalog = catalogs.find(
    (catalog) => catalog.name === BUSINESS_TEST_CATALOG_NAME && catalog.id
  );
  if (existingCatalog?.id) {
    return existingCatalog.id;
  }

  const createResponse = await page.request.post(
    `/api/blog/catalogs?${workspaceQuery}`,
    {
      headers: {
        ...headers,
        'content-type': 'application/json',
      },
      data: {
        name: BUSINESS_TEST_CATALOG_NAME,
        description: BUSINESS_TEST_CATALOG_DESCRIPTION,
      },
    }
  );
  expect(createResponse.ok()).toBeTruthy();
  const createdCatalog = (await createResponse.json()) as { id?: string };
  expect(createdCatalog.id).toBeTruthy();
  return createdCatalog.id as string;
}

async function createLeadRequest(
  page: Page,
  input: {
    name: string;
    email?: string;
    title: string;
    description: string;
    tenantSlug?: string;
  }
) {
  await page.goto(resolveBookingPath(page, input.tenantSlug));
  await page.getByLabel('Name').fill(input.name);
  if (input.email) {
    await page.getByLabel('Email').fill(input.email);
  }
  await page.getByLabel('Phone').fill('(555) 100-2000');
  await page.getByLabel('Requested offer').selectOption({ index: 0 });
  const slotSelect = page.getByLabel('Available hour block');
  await expect(slotSelect).toBeVisible();
  await slotSelect.selectOption({ index: 1 });
  await page.getByLabel('Primary goal').fill(input.title);
  await page.getByLabel('Context').fill(input.description);

  const intakeRequest = page.waitForResponse((response) => {
    return (
      response.url().endsWith('/api/business/leads') &&
      response.request().method() === 'POST'
    );
  });
  await submitBookingCta(page);

  const response = await intakeRequest;
  expect(response.ok()).toBeTruthy();
  await expect(page.getByText(/Your request is in review/)).toBeVisible({
    timeout: 15000,
  });
}

async function createAcceptedClientBooking(
  page: Page,
  input: {
    title: string;
    description: string;
    tenantSlug?: string;
  }
) {
  await page.goto(resolveBookingPath(page, input.tenantSlug));
  await page.getByLabel('Requested offer').selectOption({ index: 0 });
  await selectFirstPublishedSlot(page);
  await page.getByLabel('Primary goal').fill(input.title);
  await page.getByLabel('Context').fill(input.description);

  const bookingRequest = page.waitForResponse((response) => {
    return (
      response.url().endsWith('/api/business/bookings') &&
      response.request().method() === 'POST'
    );
  });
  await submitBookingCta(page);

  const response = await bookingRequest;
  expect(response.ok()).toBeTruthy();
  await expect(page.getByText('Consultation request submitted.')).toBeVisible({
    timeout: 15000,
  });
}

async function submitBookingCta(page: Page) {
  await page
    .getByRole('button', {
      name: /request consultation|book session/i,
    })
    .click();
}

async function selectFirstPublishedSlot(page: Page) {
  const slotSelect = page.getByLabel('Available hour block');
  await expect(slotSelect).toBeVisible();

  await expect
    .poll(async () => {
      const options = await slotSelect.locator('option').evaluateAll((nodes) =>
        nodes.map((node) => ({
          value: (node as HTMLOptionElement).value,
          text: node.textContent?.trim() ?? '',
        }))
      );
      return options.find((option) => option.value)?.value ?? '';
    })
    .toBeTruthy();

  const slotValue = await slotSelect.locator('option').evaluateAll((nodes) => {
    return (
      nodes
        .map((node) => ({
          value: (node as HTMLOptionElement).value,
          text: node.textContent?.trim() ?? '',
        }))
        .find((option) => option.value)?.value ?? ''
    );
  });

  await slotSelect.selectOption(slotValue);
}

async function waitForOwnerBooking(
  page: Page,
  ownerToken: string,
  bookingTitle: string
) {
  await expect
    .poll(
      async () => {
        const bookings = await fetchOwnerBookings(page, ownerToken);
        return bookings.find((entry) => entry.title === bookingTitle) ?? null;
      },
      { timeout: 15000 }
    )
    .toBeTruthy();

  return (await fetchOwnerBookings(page, ownerToken)).find(
    (entry) => entry.title === bookingTitle
  ) as {
    id: string;
    title: string;
    status: string;
    totalCost?: number;
    userId?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
  };
}

async function fetchBookings(page: Page, token: string) {
  const response = await page.request.get('/api/business/bookings', {
    headers: cookieSessionHeaders(token),
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Array<{
    id: string;
    userId: string;
    title: string;
    status: string;
    totalCost?: number;
  }>;
}

async function fetchOwnerProspects(page: Page, token: string) {
  const response = await page.request.get('/api/business/owner/leads', {
    headers: cookieSessionHeaders(token),
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Array<{
    id: string;
    name: string;
    email?: string;
    status: string;
  }>;
}

async function enableClientTasksFeature(page: Page, token: string) {
  const configResponse = await page.request.get(
    `${BUSINESS_API_BASE_URL}/api/business/site-config`,
    {
      timeout: 30_000,
    }
  );
  expect(configResponse.ok()).toBeTruthy();
  const payload = (await configResponse.json()) as {
    configId: string | null;
    config: Record<string, any> | null;
  };

  const config = payload.config ?? {};
  const response = await page.request.put(
    `${BUSINESS_API_BASE_URL}/api/business/site-config`,
    {
      headers: {
        ...cookieSessionHeaders(token),
        'content-type': 'application/json',
      },
      data: {
        configId: payload.configId,
        config: {
          ...config,
          features: {
            ...(config['features'] ?? {}),
            clientTasks: {
              enabled: true,
              allowClientCompletion: true,
            },
            invoices: {
              enabled: true,
            },
          },
        },
      },
      timeout: 30_000,
    }
  );

  expect(response.ok()).toBeTruthy();
}

async function fetchSiteConfig(
  page: Page,
  token?: string,
  tenantSlug = OWNER_ACCOUNTS[0].slug
) {
  const siteConfigUrl = `${BUSINESS_API_BASE_URL}/api/business/site-config?slug=${encodeURIComponent(
    tenantSlug
  )}`;
  const response = await page.request.get(siteConfigUrl, {
    headers: token ? cookieSessionHeaders(token) : undefined,
    timeout: 30_000,
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as {
    configId: string | null;
    config: Record<string, any> | null;
  };
}

async function updateSiteConfig(
  page: Page,
  token: string,
  mutate: (config: Record<string, any>) => Record<string, any>,
  tenantSlug = OWNER_ACCOUNTS[0].slug
) {
  const payload = await fetchSiteConfig(page, token, tenantSlug);
  const response = await page.request.put(
    `${BUSINESS_API_BASE_URL}/api/business/site-config?slug=${encodeURIComponent(
      tenantSlug
    )}`,
    {
      headers: {
        ...cookieSessionHeaders(token),
        'content-type': 'application/json',
      },
      data: {
        configId: payload.configId,
        config: mutate((payload.config ?? {}) as Record<string, any>),
      },
      timeout: 30_000,
    }
  );

  expect(response.ok()).toBeTruthy();
}

async function fetchClientRoutines(
  page: Page,
  clientId: string,
  token: string,
  tenantSlug?: string
) {
  const params = new URLSearchParams({
    clientId,
    ...(tenantSlug ? { slug: tenantSlug } : {}),
  });
  const response = await page.request.get(
    `/api/business/client/routines?${params.toString()}`,
    {
      headers: {
        ...cookieSessionHeaders(token),
      },
    }
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Array<{
    id: string;
    title: string;
    summary: string;
  }>;
}

async function fetchClientCheckIns(
  page: Page,
  clientId: string,
  token: string,
  tenantSlug?: string
) {
  const params = new URLSearchParams({
    clientId,
    ...(tenantSlug ? { slug: tenantSlug } : {}),
  });
  const response = await page.request.get(
    `/api/business/client/check-ins?${params.toString()}`,
    {
      headers: {
        ...cookieSessionHeaders(token),
      },
    }
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Array<{
    id: string;
    assignmentId: string;
    notes: string;
    energy: number;
  }>;
}

async function fetchOwnerBookings(page: Page, token: string) {
  const response = await page.request.get('/api/business/owner/bookings', {
    headers: cookieSessionHeaders(token),
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Array<{
    id: string;
    userId: string;
    title: string;
    description?: string;
    status: string;
    startTime?: string;
    endTime?: string;
    totalCost?: number;
  }>;
}

type OwnerAvailabilityOverride = {
  id: string;
  startTime: string;
  endTime: string;
  mode: string;
  serviceType?: string;
};

async function fetchOwnerAvailabilityOverrides(page: Page, token: string) {
  const response = await page.request.get(
    '/api/business/owner/availability-overrides',
    {
      headers: cookieSessionHeaders(token),
    }
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as OwnerAvailabilityOverride[];
}

async function removeOwnerAvailabilityOverride(
  page: Page,
  ownerToken: string,
  overrideId: string
) {
  const response = await page.request.delete(
    `/api/business/owner/availability-overrides/${overrideId}`,
    {
      headers: cookieSessionHeaders(ownerToken),
    }
  );
  expect(response.ok()).toBeTruthy();
}

async function updateOwnerBookingStatus(
  page: Page,
  token: string,
  bookingId: string,
  action: 'approve' | 'complete'
) {
  const endpoint =
    action === 'approve'
      ? `/api/business/owner/bookings/${bookingId}/approve`
      : `/api/business/owner/bookings/${bookingId}/complete`;
  const response = await page.request.put(endpoint, {
    headers: {
      ...cookieSessionHeaders(token),
      'content-type': 'application/json',
    },
    data:
      action === 'approve'
        ? {
            hourlyRate: 120,
            notes: 'Approved during business-site e2e stack normalization.',
          }
        : {},
  });
  expect(response.ok()).toBeTruthy();
}

async function clearClientBookingsForSharedStack(
  page: Page,
  ownerToken: string,
  clientUserId: string
) {
  const existingBookings = (await fetchOwnerBookings(page, ownerToken)).filter(
    (booking) =>
      booking.userId === clientUserId &&
      (booking.status === 'pending' || booking.status === 'approved')
  );

  for (const booking of existingBookings) {
    if (booking.status === 'pending') {
      await updateOwnerBookingStatus(page, ownerToken, booking.id, 'approve');
    }

    await updateOwnerBookingStatus(page, ownerToken, booking.id, 'complete');
  }
}

async function createOwnerAvailabilityOverride(
  page: Page,
  ownerToken: string,
  tenantSlug: string
) {
  const recoveryServiceType = 'Shared stack recovery slot';
  const existingOverrides = await fetchOwnerAvailabilityOverrides(
    page,
    ownerToken
  );
  const busyWindowsResponse = await page.request.get(
    `/api/business/busy-windows?slug=${tenantSlug}`
  );
  expect(busyWindowsResponse.ok()).toBeTruthy();
  const busyWindows = (await busyWindowsResponse.json()) as Array<{
    startTime: string;
    endTime: string;
  }>;
  const existingWindows = [
    ...existingOverrides.map((override) => ({
      startTime: override.startTime,
      endTime: override.endTime,
    })),
    ...busyWindows,
  ];

  const overlapsExistingWindow = (candidateStart: Date, candidateEnd: Date) =>
    existingWindows.some((window) => {
      const windowStart = new Date(window.startTime);
      const windowEnd = new Date(window.endTime);
      return (
        candidateStart.getTime() < windowEnd.getTime() &&
        candidateEnd.getTime() > windowStart.getTime()
      );
    });

  const existingRecoveryOverride = existingOverrides.find(
    (override) =>
      override.serviceType === recoveryServiceType &&
      !overlapsExistingWindow(
        new Date(override.startTime),
        new Date(override.endTime)
      )
  );

  if (existingRecoveryOverride) {
    return;
  }

  let start: Date | null = null;
  let end: Date | null = null;

  for (let dayOffset = 1; dayOffset <= 30 && !start; dayOffset += 1) {
    for (let hour = 8; hour <= 21; hour += 1) {
      const candidateStart = new Date();
      candidateStart.setDate(candidateStart.getDate() + dayOffset);
      candidateStart.setHours(hour, 0, 0, 0);
      const candidateEnd = new Date(candidateStart.getTime() + 60 * 60 * 1000);

      if (!overlapsExistingWindow(candidateStart, candidateEnd)) {
        start = candidateStart;
        end = candidateEnd;
        break;
      }
    }
  }

  expect(start).toBeTruthy();
  expect(end).toBeTruthy();

  const response = await page.request.post(
    '/api/business/owner/availability-overrides',
    {
      headers: {
        ...cookieSessionHeaders(ownerToken),
        'content-type': 'application/json',
      },
      data: {
        startTime: start!.toISOString(),
        endTime: end!.toISOString(),
        mode: 'available',
        serviceType: recoveryServiceType,
        hourlyRate: 120,
        isActive: true,
      },
    }
  );

  if (!response.ok()) {
    throw new Error(
      `Expected availability override seed to succeed, received ${response.status()}: ${await response.text()}`
    );
  }
}

test.describe('Business site user stories', () => {
  test('shows the platform homepage, shared auth entry, and client mode switch', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.locator('body')).toContainText(
      'Launch a client-ready business site without stitching the stack together yourself.'
    );
    await expect(page.locator('body')).toContainText(
      'Hosted business connection services'
    );
    await expect(page.locator('body')).toContainText(
      'Browse the businesses currently published in the platform.'
    );

    for (const owner of OWNER_ACCOUNTS) {
      const publicSiteLink = page.getByRole('link', {
        name: new RegExp(`${owner.label}.*Visit site`, 'i'),
      });
      await expect(publicSiteLink).toBeVisible();
      await expect(publicSiteLink).toHaveAttribute(
        'href',
        `/sites/${owner.slug}`
      );
    }

    await page.getByRole('link', { name: 'Start as an owner' }).click();
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole('button', { name: 'Owner' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Client' })).toBeVisible();

    await page.getByRole('button', { name: 'Client' }).click();
    await expect(page).toHaveURL(/\/client\/login$/);
  });

  test('serves the hosted tenant site from the tenant slug route', async ({
    page,
  }) => {
    await page.goto('/sites/north-star-advisory');

    await expect(page.locator('body')).toContainText('North Star Advisory');
    await expect(page.locator('body')).toContainText(
      'Clear scheduling, better client handoff, and a simpler approval flow.'
    );
    await expect(
      page.getByRole('link', { name: 'Book a strategy session' }).first()
    ).toBeVisible();
  });

  test('keeps the public hero readable and unobscured at mobile and desktop widths', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/sites/north-star-advisory');

      const hero = page.locator('otui-public-landing-hero');
      const heading = hero.locator('h1');
      const body = hero.locator('[slot="body"]');
      await expect(heading).toHaveCount(1);
      await expect(heading).toBeVisible();
      await expect(body).toBeVisible();
      await expect(hero).not.toContainText(
        /(?:\bP\d+(?:\.\d+)?\b|\bslice\b|\bpreset\b)/i
      );

      const boxes = await Promise.all([
        heading.boundingBox(),
        body.boundingBox(),
      ]);
      expect(boxes[0]).not.toBeNull();
      expect(boxes[1]).not.toBeNull();
      expect(boxes[1]!.y).toBeGreaterThanOrEqual(
        boxes[0]!.y + boxes[0]!.height - 1
      );
    }
  });

  test('renders only the configured blog catalog on the published tenant route', async ({
    ownerPage: page,
  }) => {
    const ownerToken = await loginOwnerApi(page);
    const original = await fetchSiteConfig(
      page,
      ownerToken,
      'north-star-advisory'
    );
    const originalConfig = JSON.parse(
      JSON.stringify(original.config ?? {})
    ) as Record<string, any>;
    const catalogId = await ensureBusinessTestBlogCatalog(page, ownerToken);
    const sectionTitle = uniqueLabel('Operations notes');
    const catalogPostTitle = uniqueLabel('Catalog-specific update');

    await page.route(
      `**/api/blog/catalogs/${catalogId}/posts`,
      async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: '4f0a7c50-41d2-434e-b7cc-bf82a3cbdc78',
              name: catalogPostTitle,
              description: 'This entry belongs only to the configured catalog.',
            },
          ]),
        });
      }
    );

    try {
      await updateSiteConfig(
        page,
        ownerToken,
        (config) => ({
          ...config,
          site: {
            ...(config['site'] ?? {}),
            slug: 'north-star-advisory',
            status: 'published',
          },
          plugins: {
            schemaVersion: 1,
            surfaceType: 'business-site',
            capabilities: {
              ...(config['plugins']?.capabilities ?? {}),
              'blogging.posts': {
                enabled: true,
                placement: 'public-content',
                resourceRef: { type: 'blog-catalog', id: catalogId },
              },
            },
          },
          landingPage: {
            ...(config['landingPage'] ?? {}),
            sections: [
              ...((config['landingPage']?.sections ?? []) as Array<any>).filter(
                (section) => section.id !== 'p8-blog-runtime'
              ),
              {
                id: 'p8-blog-runtime',
                type: 'blog',
                title: sectionTitle,
                enabled: true,
                order: 999,
              },
            ],
          },
        }),
        'north-star-advisory'
      );

      await page.goto('/sites/north-star-advisory');
      await expect(
        page.getByRole('heading', { name: sectionTitle })
      ).toBeVisible();
      await expect(page.getByText(catalogPostTitle)).toBeVisible();
      await expect(
        page.getByText('This entry belongs only to the configured catalog.')
      ).toBeVisible();
    } finally {
      await updateSiteConfig(
        page,
        ownerToken,
        () => originalConfig,
        'north-star-advisory'
      );
      await page.unroute(`**/api/blog/catalogs/${catalogId}/posts`);
    }
  });

  test('keeps Blog preview, published placement, and direct entry on one catalog', async ({
    ownerPage: page,
  }) => {
    const ownerToken = await loginOwnerApi(page);
    const original = await fetchSiteConfig(
      page,
      ownerToken,
      'north-star-advisory'
    );
    const originalConfig = JSON.parse(
      JSON.stringify(original.config ?? {})
    ) as Record<string, any>;
    const catalogId = await ensureBusinessTestBlogCatalog(page, ownerToken);
    const sectionTitle = uniqueLabel('Preview parity notes');
    const catalogPostTitle = uniqueLabel('One catalog across every entry');

    await page.route(
      `**/api/blog/catalogs/${catalogId}/posts`,
      async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: '8856de43-b9a7-4e27-9f67-9fcbba79c84a',
              name: catalogPostTitle,
              description: 'The direct route and placement share this catalog.',
            },
          ]),
        });
      }
    );

    try {
      await updateSiteConfig(
        page,
        ownerToken,
        (config) => ({
          ...config,
          site: {
            ...(config['site'] ?? {}),
            slug: 'north-star-advisory',
            status: 'published',
          },
          plugins: {
            schemaVersion: 1,
            surfaceType: 'business-site',
            capabilities: {
              ...(config['plugins']?.capabilities ?? {}),
              'blogging.posts': {
                enabled: true,
                placement: 'public-content',
                resourceRef: { type: 'blog-catalog', id: catalogId },
              },
            },
          },
          landingPage: {
            ...(config['landingPage'] ?? {}),
            sections: [
              ...((config['landingPage']?.sections ?? []) as Array<any>).filter(
                (section) => section.id !== 'p8-3-blog-runtime'
              ),
              {
                id: 'p8-3-blog-runtime',
                type: 'blog',
                title: sectionTitle,
                enabled: true,
                order: 999,
              },
            ],
          },
        }),
        'north-star-advisory'
      );

      await page.goto('/sites/north-star-advisory');
      await expect(page.getByText(catalogPostTitle)).toBeVisible();

      await page.goto('/sites/north-star-advisory/blog');
      await expect(page.getByText(catalogPostTitle)).toBeVisible();

      await loginOwner(page);
      await openSiteEditor(page);
      await switchToStudio(page);
      await expect(
        page.locator('business-landing-page').getByText(catalogPostTitle)
      ).toBeVisible();
    } finally {
      await updateSiteConfig(
        page,
        ownerToken,
        () => originalConfig,
        'north-star-advisory'
      );
      await page.unroute(`**/api/blog/catalogs/${catalogId}/posts`);
    }
  });

  for (const owner of OWNER_ACCOUNTS) {
    test(`lets ${owner.email} sign in, open the site editor, and load ${owner.slug}`, async ({
      page,
      ownerPage,
    }) => {
      const authScope = getOwnerAuthScope(owner.email);
      const authenticatedPage = authScope === 'reusable' ? ownerPage : page;
      await authenticatedPage.goto('about:blank');
      if (authScope === 'credentials') {
        await loginOwnerWithCredentials(page, owner.email, owner.password);
      } else {
        await authenticatedPage.goto('/owner/dashboard');
      }

      await expect(authenticatedPage).toHaveURL(/\/owner\/dashboard$/);
      await expect(
        authenticatedPage.getByRole('link', { name: 'Site Editor' })
      ).toBeVisible();

      await authenticatedPage
        .getByRole('link', { name: 'Site Editor' })
        .click();
      await expect(authenticatedPage).toHaveURL(/\/owner\/site$/);
      await expect(
        authenticatedPage.getByRole('heading', { name: 'Site Content Editor' })
      ).toBeVisible();
      await expect(businessNameInput(authenticatedPage)).toHaveValue(
        owner.publicHeading
      );
      await expect(
        authenticatedPage.getByRole('button', { name: 'Save Changes' })
      ).toBeVisible();

      await authenticatedPage.goto(`/sites/${owner.slug}`);
      await expect(authenticatedPage.locator('body')).toContainText(
        owner.publicHeading
      );
    });
  }

  test('keeps owner views and mutations isolated across tenant configurations', async ({
    page,
    ownerPage,
  }) => {
    const primaryOwner = OWNER_ACCOUNTS[0];
    const secondOwner = OWNER_ACCOUNTS[1];
    const primaryToken = await readSessionCookie(ownerPage);

    // The reusable owner session can only load its own owner workspace.
    await ownerPage.goto('/owner/site');
    await expect(businessNameInput(ownerPage)).toHaveValue(
      primaryOwner.publicHeading
    );
    await expect(ownerPage.locator('body')).not.toContainText(
      secondOwner.publicHeading
    );

    // A second owner session resolves the second tenant independently.
    await loginOwnerWithCredentials(
      page,
      secondOwner.email,
      secondOwner.password
    );
    await expect(page).toHaveURL(/\/owner\/dashboard$/);
    const secondToken = await readSessionCookie(page);
    await page.goto('/owner/site');
    await expect(businessNameInput(page)).toHaveValue(
      secondOwner.publicHeading
    );
    await expect(page.locator('body')).not.toContainText(
      primaryOwner.publicHeading
    );

    const primaryConfigResponse = await ownerPage.request.get(
      `${BUSINESS_API_BASE_URL}/api/business/site-config`,
      { headers: cookieSessionHeaders(primaryToken), timeout: 30_000 }
    );
    const secondConfigResponse = await page.request.get(
      `${BUSINESS_API_BASE_URL}/api/business/site-config`,
      { headers: cookieSessionHeaders(secondToken), timeout: 30_000 }
    );
    expect(primaryConfigResponse.ok()).toBeTruthy();
    expect(secondConfigResponse.ok()).toBeTruthy();
    const primaryConfig = (await primaryConfigResponse.json()) as {
      config?: { brand?: { businessName?: string } };
    };
    const secondConfig = (await secondConfigResponse.json()) as {
      configId?: string | null;
      config?: Record<string, any> | null;
    };
    expect(primaryConfig.config?.brand?.businessName).toBe(
      primaryOwner.publicHeading
    );
    expect(secondConfig.config?.brand?.businessName).toBe(
      secondOwner.publicHeading
    );

    // The public slug may be read for rendering, but an owner from another
    // workspace cannot use it to update the second tenant's configuration.
    const publicSecondBefore = await fetchSiteConfig(
      ownerPage,
      undefined,
      secondOwner.slug
    );
    const crossTenantUpdate = await ownerPage.request.put(
      `${BUSINESS_API_BASE_URL}/api/business/site-config?slug=${encodeURIComponent(
        secondOwner.slug
      )}`,
      {
        headers: {
          ...cookieSessionHeaders(primaryToken),
          'content-type': 'application/json',
        },
        data: {
          configId: publicSecondBefore.configId,
          config: {
            ...(publicSecondBefore.config ?? {}),
            brand: {
              ...(publicSecondBefore.config?.['brand'] ?? {}),
              businessName: 'Cross-tenant mutation should be rejected',
            },
          },
        },
        timeout: 30_000,
      }
    );
    expect(crossTenantUpdate.ok()).toBeFalsy();

    const publicSecondAfter = await fetchSiteConfig(
      ownerPage,
      undefined,
      secondOwner.slug
    );
    expect(publicSecondAfter.configId).toBe(publicSecondBefore.configId);
    expect(publicSecondAfter.config).toEqual(publicSecondBefore.config);
  });

  test('applies on-change studio updates for hero, custom, image, and gallery sections', async ({
    ownerPage: page,
  }) => {
    test.setTimeout(240_000);

    const ownerToken = await loginOwnerApi(page);
    const original = await fetchSiteConfig(page);
    const originalConfig = JSON.parse(
      JSON.stringify(original.config ?? {})
    ) as Record<string, any>;

    const updatedBusinessName = uniqueLabel('North Star Studio');
    const heroCopy =
      'Studio mode should reflect live hero updates before saving changes.';
    const customTitle = uniqueLabel('Delivery Process');
    const customCopy =
      'Discovery first, shared plan second, weekly review third.';
    const imageTitle = uniqueLabel('Field Notes');
    const imageCaption = uniqueLabel(
      'Behind the scenes with the advisory team'
    );
    const galleryTitle = uniqueLabel('Proof Gallery');
    const galleryCaptionOne = uniqueLabel('Workshop whiteboard');
    const galleryCaptionTwo = uniqueLabel('Client delivery snapshot');
    const imageSource = svgDataUrl('field-notes', '#1f7a63');
    const gallerySourceOne = svgDataUrl('gallery-one', '#2563eb');
    const gallerySourceTwo = svgDataUrl('gallery-two', '#be185d');

    const preview = page.locator('[data-live-preview]');
    const selectedSectionShell = page.locator('.selected-section-shell');

    try {
      await page.goto('/owner/dashboard');
      await expect(page).toHaveURL(/\/owner\/dashboard$/);

      await openSiteEditor(page);
      await switchToStudio(page);

      await businessNameInput(page).fill(updatedBusinessName);
      await expect(preview).toContainText(updatedBusinessName);

      await page
        .locator('[data-block-tree]')
        .getByRole('button', { name: /Welcome/i })
        .click();
      await selectedSectionShell
        .getByRole('button', { name: 'Open content editor' })
        .click();
      await replaceComposeContent(page, selectedSectionShell, heroCopy);
      await expect(preview).toContainText(heroCopy);

      await page.getByRole('button', { name: '+ Add custom section' }).click();
      await schemaFieldControl(selectedSectionShell, 'title').fill(customTitle);
      await expect(preview).toContainText(customTitle);
      await replaceComposeContent(page, selectedSectionShell, customCopy);
      await expect(preview).toContainText(customCopy);

      await page.getByRole('button', { name: '+ Add image block' }).click();
      await schemaFieldControl(selectedSectionShell, 'title').fill(imageTitle);
      await schemaFieldControl(selectedSectionShell, 'image.src').fill(
        imageSource
      );
      await schemaFieldControl(selectedSectionShell, 'image.alt').fill(
        'Field notes alt'
      );
      await schemaFieldControl(selectedSectionShell, 'image.caption').fill(
        imageCaption
      );
      await expect(preview).toContainText(imageTitle);
      await expect(preview).toContainText(imageCaption);
      await expect(preview.locator(`img[src="${imageSource}"]`)).toBeVisible();

      await page.getByRole('button', { name: '+ Add gallery block' }).click();
      await schemaFieldControl(selectedSectionShell, 'title').fill(
        galleryTitle
      );
      await schemaFieldControl(
        selectedSectionShell,
        'gallery.style'
      ).selectOption('masonry');
      await schemaFieldControl(
        selectedSectionShell,
        'gallery.columns'
      ).selectOption('2');

      const firstGalleryItem = selectedSectionShell
        .locator('.gallery-item-editor')
        .nth(0);
      await firstGalleryItem.getByLabel('Image URL').fill(gallerySourceOne);
      await firstGalleryItem.getByLabel('Alt Text').fill('Gallery one alt');
      await firstGalleryItem.getByLabel('Caption').fill(galleryCaptionOne);

      await selectedSectionShell
        .getByRole('button', { name: '+ Add gallery image' })
        .click();
      const secondGalleryItem = selectedSectionShell
        .locator('.gallery-item-editor')
        .nth(1);
      await secondGalleryItem.getByLabel('Image URL').fill(gallerySourceTwo);
      await secondGalleryItem.getByLabel('Alt Text').fill('Gallery two alt');
      await secondGalleryItem.getByLabel('Caption').fill(galleryCaptionTwo);

      await expect(preview).toContainText(galleryTitle);
      await expect(preview).toContainText(galleryCaptionOne);
      await expect(preview).toContainText(galleryCaptionTwo);
      await expect(
        preview.locator(`img[src="${gallerySourceOne}"]`)
      ).toBeVisible();
      await expect(
        preview.locator(`img[src="${gallerySourceTwo}"]`)
      ).toBeVisible();

      await page.getByRole('button', { name: 'Save Changes' }).click();
      await expect(
        page.getByText('Site content saved successfully.')
      ).toBeVisible();

      await page.goto('/sites/north-star-advisory');
      await expect(page.locator('body')).toContainText(updatedBusinessName);
      await expect(page.locator('body')).toContainText(heroCopy);
      await expect(page.locator('body')).toContainText(customTitle);
      await expect(page.locator('body')).toContainText(customCopy);
      await expect(page.locator('body')).toContainText(imageTitle);
      await expect(page.locator('body')).toContainText(imageCaption);
      await expect(page.locator('body')).toContainText(galleryTitle);
      await expect(page.locator('body')).toContainText(galleryCaptionOne);
      await expect(page.locator('body')).toContainText(galleryCaptionTwo);
      await expect(page.locator(`img[src="${imageSource}"]`)).toBeVisible();
      await expect(
        page.locator(`img[src="${gallerySourceOne}"]`)
      ).toBeVisible();
      await expect(
        page.locator(`img[src="${gallerySourceTwo}"]`)
      ).toBeVisible();
    } finally {
      await updateSiteConfig(page, ownerToken, () => originalConfig);
    }
  });

  for (const tenant of SEEDED_SAMPLE_TENANTS) {
    test(`serves seeded sample tenant ${tenant.slug} with distinct public content`, async ({
      page,
    }) => {
      const rawResponse = await page.request.get(`/sites/${tenant.slug}`);
      expect(rawResponse.ok()).toBeTruthy();
      const rawHtml = await rawResponse.text();
      expect(rawHtml).toContain(tenant.businessName);
      expect(rawHtml).toContain(tenant.heroCopy);
      expect(rawHtml).toContain(tenant.serviceName);
      expect(rawHtml).not.toContain('My Business');

      await page.goto(`/sites/${tenant.slug}`);

      await expect(page.locator('body')).toContainText(tenant.businessName);
      await expect(page.locator('body')).toContainText(tenant.heroCopy);
      await expect(page.locator('body')).toContainText(tenant.serviceName);
      await expect(
        page.getByRole('link', { name: tenant.cta }).first()
      ).toBeVisible();
    });
  }

  test('reflects owner site-config changes on the hosted tenant route', async ({
    ownerPage: page,
  }) => {
    const ownerToken = await loginOwnerApi(page);
    const original = await fetchSiteConfig(page);
    const originalConfig = JSON.parse(
      JSON.stringify(original.config ?? {})
    ) as Record<string, any>;
    const updatedName = uniqueLabel('North Star Studio');
    const updatedHeroHeading = uniqueLabel('Advisory systems that keep up');

    try {
      await updateSiteConfig(page, ownerToken, (config) => ({
        ...config,
        site: {
          ...(config['site'] ?? {}),
          slug: 'north-star-advisory',
          status: 'published',
        },
        brand: {
          ...(config['brand'] ?? {}),
          businessName: updatedName,
        },
        landingPage: {
          ...(config['landingPage'] ?? {}),
          sections: Array.isArray(config['landingPage']?.sections)
            ? config['landingPage'].sections.map(
                (section: Record<string, any>) =>
                  section.id === 'hero'
                    ? {
                        ...section,
                        richContent: {
                          ...(section['richContent'] ?? {}),
                          title: updatedHeroHeading,
                        },
                      }
                    : section
              )
            : config['landingPage']?.sections,
        },
      }));

      await page.goto('/sites/north-star-advisory');
      await expect(page.locator('body')).toContainText(updatedName);
      await expect(page.locator('body')).toContainText(updatedHeroHeading);
    } finally {
      await updateSiteConfig(page, ownerToken, () => originalConfig);
    }
  });

  test('routes owners with incomplete onboarding into the onboarding flow', async ({
    page,
    ownerPage,
  }) => {
    const ownerToken = await loginOwnerApi(ownerPage);
    const original = await fetchSiteConfig(ownerPage);

    await updateSiteConfig(ownerPage, ownerToken, (config) => ({
      ...config,
      site: {
        ...(config['site'] ?? {}),
        slug: 'north-star-advisory',
        status: 'draft',
        onboardingCompletedAt: '',
      },
    }));

    await page.goto('/auth');
    await page.getByLabel('Email').fill(OWNER_EMAIL);
    await page.getByLabel('Password').fill(OWNER_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/owner\/onboarding$/);
    await expect(page.locator('body')).toContainText('Guided Setup');

    await updateSiteConfig(ownerPage, ownerToken, () => ({
      ...(original.config ?? {}),
    }));
  });

  test('registers a new owner, completes onboarding, and re-enters on the owner dashboard', async ({
    page,
  }) => {
    const email = `owner-${Date.now()}@example.test`;
    const password = `OwnerPass!${Date.now()}`;
    const businessName = uniqueLabel('Harbor Light Studio');

    await registerOwner(page, {
      firstName: 'Harbor',
      lastName: 'Owner',
      email,
      password,
      bio: 'A new owner using the business-site onboarding flow.',
    });

    await expect(page).toHaveURL(/\/owner\/onboarding$/);
    await expect(page.locator('body')).toContainText('Guided Setup');

    await businessNameInput(page).fill(businessName);
    await page.getByRole('button', { name: 'Save as draft' }).click();
    await expect(
      page.getByText('Site content saved successfully.')
    ).toBeVisible();

    const logoutResponse = page.waitForResponse((response) => {
      return (
        response.url().endsWith('/api/authentication/logout') &&
        response.request().method() === 'POST'
      );
    });
    await page.getByRole('button', { name: 'Sign Out' }).click();
    const response = await logoutResponse;
    expect(response.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/$/);

    await loginOwnerWithCredentials(page, email, password);
    await expect(page).toHaveURL(/\/owner\/dashboard$/);
  });

  test('lets an existing business client add owner access with the same login', async ({
    page,
  }) => {
    await registerOwner(page, {
      firstName: 'Taylor',
      lastName: 'Client',
      email: CLIENT_EMAIL,
      password: CLIENT_PASSWORD,
      bio: 'Already a client, now claiming owner access too.',
    });

    await expect(page).toHaveURL(/\/owner\/onboarding$/);
    await expect(page.locator('body')).toContainText('Guided Setup');
  });

  test('covers the public landing page and booking flow through the SSR proxy', async ({
    page,
  }) => {
    const bookingTitle = uniqueLabel('proxy-booking');

    await page.goto('/sites/north-star-advisory');
    await expect(
      page.getByRole('link', { name: 'Book a strategy session' }).first()
    ).toBeVisible();
    await expect(page.locator('body')).toContainText('North Star Advisory');
    await expect(page.locator('body')).toContainText(
      'Services that fit real schedules and still move the needle.'
    );

    await createLeadRequest(page, {
      name: `Jordan Prospect ${randomUUID().slice(0, 8)}`,
      email: `public-${Date.now()}@example.com`,
      title: bookingTitle,
      description:
        'Proxy smoke test intake created through the business SSR app.',
    });
  });

  test('supports client and owner CRUD across bookings, routines, and check-ins', async ({
    page,
    ownerPage,
  }) => {
    const tenantSlug = OWNER_ACCOUNTS[0].slug;
    const bookingTitle = uniqueLabel('client-session');
    const bookingDescription =
      'A client-booked consultation that should flow through the gateway proxy.';
    const routineTitle = uniqueLabel('four-week-plan');
    const checkInNotes = uniqueLabel('check-in-notes');

    const { cookieValue: clientSessionCookie, userId: clientUserId } =
      await loginClient(page, CLIENT_EMAIL, CLIENT_PASSWORD, tenantSlug);
    const ownerToken = await loginOwnerApi(ownerPage);
    await clearClientBookingsForSharedStack(
      ownerPage,
      ownerToken,
      clientUserId
    );
    await createOwnerAvailabilityOverride(ownerPage, ownerToken, tenantSlug);
    await loginClient(page, CLIENT_EMAIL, CLIENT_PASSWORD, tenantSlug);
    await expect(page.locator('body')).toContainText('Upcoming sessions');

    await createAcceptedClientBooking(page, {
      title: bookingTitle,
      description: bookingDescription,
    });

    await expect
      .poll(async () => {
        const bookings = await fetchBookings(page, clientSessionCookie);
        return bookings.some((booking) => booking.title === bookingTitle);
      })
      .toBe(true);

    await loginOwner(ownerPage);
    await enableClientTasksFeature(ownerPage, ownerToken);
    const pendingBooking = await waitForOwnerBooking(
      ownerPage,
      ownerToken,
      bookingTitle
    );
    await ownerPage.goto('/sites/north-star-advisory');
    await loginOwner(ownerPage);

    await ownerPage
      .getByRole('main')
      .getByRole('link', { name: 'Requests' })
      .click();
    await expect(ownerPage).toHaveURL(/\/owner\/requests$/);
    await expect
      .poll(
        async () =>
          ownerPage
            .locator('article.queue-row')
            .filter({ hasText: bookingDescription })
            .count(),
        { timeout: 15000 }
      )
      .toBe(1);
    let bookingRow = ownerPage
      .locator('article.queue-row')
      .filter({ hasText: bookingDescription })
      .first();
    await expect(bookingRow).toBeVisible({ timeout: 15000 });
    await expect(bookingRow).toContainText(CLIENT_EMAIL);
    await expect(bookingRow).toContainText(bookingDescription);

    await ownerPage
      .getByRole('main')
      .getByRole('link', { name: 'Clients' })
      .click();
    await expect(ownerPage.locator('body')).toContainText('Approved clients');
    await ownerPage
      .getByRole('button', { name: new RegExp(CLIENT_EMAIL, 'i') })
      .first()
      .click();
    await ownerPage.getByLabel('Title').fill(routineTitle);
    await ownerPage
      .getByLabel('Summary')
      .fill('3 training sessions, mobility finishers, and weekly check-ins.');
    await ownerPage.getByRole('button', { name: /assign routine/i }).click();

    await ownerPage
      .getByRole('main')
      .getByRole('link', { name: 'Clients' })
      .click();
    await expect(ownerPage.locator('body')).toContainText(routineTitle);

    await ownerPage
      .getByRole('main')
      .getByRole('link', { name: 'Requests' })
      .click();
    await expect(ownerPage).toHaveURL(/\/owner\/requests$/);
    await expect
      .poll(
        async () =>
          ownerPage
            .locator('article.queue-row')
            .filter({ hasText: bookingTitle })
            .count(),
        { timeout: 15000 }
      )
      .toBe(1);
    bookingRow = ownerPage
      .locator('article.queue-row')
      .filter({ hasText: bookingTitle })
      .first();
    await expect(bookingRow).toBeVisible({ timeout: 15000 });

    await bookingRow.getByRole('button', { name: 'Approve booking' }).click();
    await expect(bookingRow).toContainText('approved');
    await bookingRow.getByRole('button', { name: 'Mark complete' }).click();
    await expect(bookingRow).toContainText('completed');

    await expect
      .poll(async () => {
        const bookings = await fetchOwnerBookings(ownerPage, ownerToken);
        const booking = bookings.find((entry) => entry.title === bookingTitle);
        return booking?.status ?? null;
      })
      .toBe('completed');

    const completedBooking = (
      await fetchOwnerBookings(ownerPage, ownerToken)
    ).find((entry) => entry.title === bookingTitle);
    expect(completedBooking?.id).toBe(pendingBooking.id);
    expect(completedBooking?.totalCost).toBe('0.00');

    bookingRow = ownerPage
      .locator('article.queue-row')
      .filter({ hasText: bookingTitle })
      .first();
    await expect(bookingRow).toBeVisible({ timeout: 15000 });
    await expect(
      bookingRow.getByRole('button', { name: 'Generate invoice' })
    ).toHaveCount(0);

    await page.goto(`/sites/${tenantSlug}/client/dashboard`);
    await expect(page).toHaveURL(
      new RegExp(`/sites/${tenantSlug}/client/dashboard$`)
    );
    await page
      .getByRole('main')
      .getByRole('link', { name: 'Routines' })
      .click();
    await expect(page.locator('body')).toContainText(routineTitle);
    await page.getByLabel('Routine').selectOption({ label: routineTitle });
    await page.getByLabel('Notes').fill(checkInNotes);
    await page.getByLabel('Energy').fill('8');
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(page.getByLabel('Notes')).toHaveValue('Check-in saved.');

    await page.getByRole('main').getByRole('link', { name: 'Billing' }).click();
    await expect(page.locator('body')).toContainText(bookingTitle);
    await expect(page.locator('body')).toContainText('completed');
    await expect(page.locator('body')).toContainText(
      `$${completedBooking?.totalCost ?? ''}`
    );
  });

  test('queues non-accepted signed-in clients for owner approval instead of creating bookings', async ({
    page,
    ownerPage,
  }) => {
    const pendingGoal = uniqueLabel('pending-client-intake');
    const ownerToken = await loginOwner(ownerPage);

    await loginClient(page, PENDING_CLIENT_EMAIL, PENDING_CLIENT_PASSWORD);
    await createLeadRequest(page, {
      name: 'Taylor Quinn',
      email: PENDING_CLIENT_EMAIL,
      title: pendingGoal,
      description: 'Pending client should stay in the approval queue.',
    });

    await expect
      .poll(async () => {
        const prospects = await fetchOwnerProspects(ownerPage, ownerToken);
        return prospects.some((entry) => entry.email === PENDING_CLIENT_EMAIL);
      })
      .toBe(true);

    await ownerPage.getByRole('link', { name: 'Workspace' }).click();
    await expect(ownerPage).toHaveURL(/\/owner\/dashboard$/);
    await ownerPage
      .getByRole('main')
      .getByRole('link', { name: 'Requests' })
      .click();
    const prospectRow = ownerPage
      .locator('article.queue-row')
      .filter({
        has: ownerPage.getByText(PENDING_CLIENT_EMAIL, { exact: true }),
      })
      .first();
    await expect(prospectRow).toBeVisible();
    await expect(
      prospectRow.getByText(PENDING_CLIENT_EMAIL, { exact: true })
    ).toBeVisible();
    await expect(prospectRow.locator('.status-pill')).toHaveText('new');
    await expect(prospectRow).toContainText(
      'Accept the client or follow up before booking.'
    );
    await expect(
      prospectRow.getByRole('button', { name: 'Accept client' })
    ).toBeVisible();
  });
});
