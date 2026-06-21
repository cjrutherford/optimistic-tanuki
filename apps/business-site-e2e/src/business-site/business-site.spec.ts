import { expect, Locator, Page, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const OWNER_EMAIL = 'owner@localbusiness.test';
const OWNER_PASSWORD = 'BusinessOwnerPass123!';
const CLIENT_EMAIL = 'client@localbusiness.test';
const CLIENT_PASSWORD = 'ClientPass123!';
const PENDING_CLIENT_EMAIL = 'pending-client@localbusiness.test';
const PENDING_CLIENT_PASSWORD = 'PendingClientPass123!';
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
      'Use this seeded example to showcase estimate requests, repair scheduling, and homeowner communication.',
    cta: 'Request an estimate',
    serviceName: 'Repair visit',
  },
  {
    slug: 'ovenbird-bakeshop',
    businessName: 'Ovenbird Bakeshop',
    heroCopy:
      'This preset shows how a made-to-order bakery can capture event details, custom notes, and pickup timing cleanly.',
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

  const clientToken = await page.evaluate(() =>
    localStorage.getItem('business-site:client-token')
  );

  expect(clientToken).toBeTruthy();
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const raw = localStorage.getItem('business-site:client-user');
        if (!raw) {
          return '';
        }

        try {
          const clientUser = JSON.parse(raw) as { profileId?: string };
          return clientUser.profileId ?? '';
        } catch {
          return '';
        }
      });
    })
    .toBeTruthy();

  const clientProfileId = await page.evaluate(() => {
    const raw = localStorage.getItem('business-site:client-user');
    if (!raw) {
      return '';
    }

    try {
      const clientUser = JSON.parse(raw) as { profileId?: string };
      return clientUser.profileId ?? '';
    } catch {
      return '';
    }
  });

  const clientUserId = await page.evaluate(() => {
    const raw = localStorage.getItem('business-site:client-user');
    if (!raw) {
      return '';
    }

    try {
      const clientUser = JSON.parse(raw) as { userId?: string };
      return clientUser.userId ?? '';
    } catch {
      return '';
    }
  });

  return {
    token: clientToken as string,
    profileId: clientProfileId as string,
    userId: clientUserId as string,
  };
}

async function loginOwner(page: Page) {
  await page.goto('/auth');
  await page.getByLabel('Email').fill(OWNER_EMAIL);
  await page.getByLabel('Password').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/owner\/dashboard$/);

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const raw = localStorage.getItem('business-site:user');
        if (!raw) {
          return '';
        }

        try {
          const ownerUser = JSON.parse(raw) as { profileId?: string };
          return ownerUser.profileId ?? '';
        } catch {
          return '';
        }
      });
    })
    .toBeTruthy();

  const ownerToken = await page.evaluate(() => {
    const raw = localStorage.getItem('business-site:user');
    if (!raw) {
      return '';
    }

    try {
      const ownerUser = JSON.parse(raw) as { token?: string };
      return ownerUser.token ?? '';
    } catch {
      return '';
    }
  });
  expect(ownerToken).toBeTruthy();

  return ownerToken as string;
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

async function loginOwnerApi(page: Page) {
  const response = await page.request.post('/api/authentication/login', {
    headers: {
      'content-type': 'application/json',
      'x-ot-appscope': 'business-site',
    },
    data: {
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    data?: { token?: string; newToken?: string };
    token?: string;
    newToken?: string;
  };

  return (
    payload.data?.token ||
    payload.data?.newToken ||
    payload.token ||
    payload.newToken ||
    ''
  );
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
    headers: {
      Authorization: `Bearer ${token}`,
      'x-ot-appscope': 'business-site',
    },
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
    headers: {
      Authorization: `Bearer ${token}`,
      'x-ot-appscope': 'business-site',
    },
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
        Authorization: `Bearer ${token}`,
        'x-ot-appscope': 'business-site',
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

async function fetchSiteConfig(page: Page) {
  const response = await page.request.get(
    `${BUSINESS_API_BASE_URL}/api/business/site-config`,
    {
      timeout: 30_000,
    }
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as {
    configId: string | null;
    config: Record<string, any> | null;
  };
}

async function updateSiteConfig(
  page: Page,
  token: string,
  mutate: (config: Record<string, any>) => Record<string, any>
) {
  const payload = await fetchSiteConfig(page);
  const response = await page.request.put(
    `${BUSINESS_API_BASE_URL}/api/business/site-config`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-ot-appscope': 'business-site',
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
        Authorization: `Bearer ${token}`,
        'x-ot-appscope': 'business-site',
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
        Authorization: `Bearer ${token}`,
        'x-ot-appscope': 'business-site',
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
    headers: {
      Authorization: `Bearer ${token}`,
      'x-ot-appscope': 'business-site',
    },
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
      headers: {
        Authorization: `Bearer ${token}`,
        'x-ot-appscope': 'business-site',
      },
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
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'x-ot-appscope': 'business-site',
      },
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
      Authorization: `Bearer ${token}`,
      'x-ot-appscope': 'business-site',
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
        Authorization: `Bearer ${ownerToken}`,
        'x-ot-appscope': 'business-site',
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
      'Operational guidance for growing service businesses.'
    );
    await expect(
      page.getByRole('link', { name: 'Book a strategy session' }).first()
    ).toBeVisible();
  });

  for (const owner of OWNER_ACCOUNTS) {
    test(`lets ${owner.email} sign in, open the site editor, and load ${owner.slug}`, async ({
      page,
    }) => {
      await loginOwnerWithCredentials(page, owner.email, owner.password);

      await expect(page).toHaveURL(/\/owner\/dashboard$/);
      await expect(
        page.getByRole('link', { name: 'Site Editor' })
      ).toBeVisible();

      await page.getByRole('link', { name: 'Site Editor' }).click();
      await expect(page).toHaveURL(/\/owner\/site$/);
      await expect(
        page.getByRole('heading', { name: 'Site Content Editor' })
      ).toBeVisible();
      await expect(businessNameInput(page)).toHaveValue(owner.publicHeading);
      await expect(
        page.getByRole('button', { name: 'Save Changes' })
      ).toBeVisible();

      await page.goto(`/sites/${owner.slug}`);
      await expect(page.locator('body')).toContainText(owner.publicHeading);
    });
  }

  test('applies on-change studio updates for hero, custom, image, and gallery sections', async ({
    page,
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
      await loginOwnerWithCredentials(page, OWNER_EMAIL, OWNER_PASSWORD);
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
    page,
  }) => {
    const ownerToken = await loginOwnerApi(page);
    const original = await fetchSiteConfig(page);
    const updatedName = uniqueLabel('North Star Studio');
    const updatedTagline = uniqueLabel('Advisory systems that keep up');

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
        tagline: updatedTagline,
      },
    }));

    await page.goto('/sites/north-star-advisory');
    await expect(page.locator('body')).toContainText(updatedName);
    await expect(page.locator('body')).toContainText(updatedTagline);

    await updateSiteConfig(page, ownerToken, () => ({
      ...(original.config ?? {}),
    }));
  });

  test('routes owners with incomplete onboarding into the onboarding flow', async ({
    page,
  }) => {
    const ownerToken = await loginOwnerApi(page);
    const original = await fetchSiteConfig(page);

    await updateSiteConfig(page, ownerToken, (config) => ({
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

    await updateSiteConfig(page, ownerToken, () => ({
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
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(
      page.getByText('Site content saved successfully.')
    ).toBeVisible();

    await page.getByRole('button', { name: 'Sign Out' }).click();
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
  }) => {
    const tenantSlug = OWNER_ACCOUNTS[0].slug;
    const bookingTitle = uniqueLabel('client-session');
    const bookingDescription =
      'A client-booked consultation that should flow through the gateway proxy.';
    const routineTitle = uniqueLabel('four-week-plan');
    const checkInNotes = uniqueLabel('check-in-notes');

    const { token: clientToken, userId: clientUserId } = await loginClient(
      page,
      CLIENT_EMAIL,
      CLIENT_PASSWORD,
      tenantSlug
    );
    const ownerToken = await loginOwnerApi(page);
    await clearClientBookingsForSharedStack(page, ownerToken, clientUserId);
    await createOwnerAvailabilityOverride(page, ownerToken, tenantSlug);
    await loginClient(page, CLIENT_EMAIL, CLIENT_PASSWORD, tenantSlug);
    await expect(page.locator('body')).toContainText('Upcoming sessions');

    await createAcceptedClientBooking(page, {
      title: bookingTitle,
      description: bookingDescription,
    });

    await expect
      .poll(async () => {
        const bookings = await fetchBookings(page, clientToken);
        return bookings.some((booking) => booking.title === bookingTitle);
      })
      .toBe(true);

    await loginOwner(page);
    await enableClientTasksFeature(page, ownerToken);
    const pendingBooking = await waitForOwnerBooking(
      page,
      ownerToken,
      bookingTitle
    );
    await page.goto('/sites/north-star-advisory');
    await loginOwner(page);

    await page
      .getByRole('main')
      .getByRole('link', { name: 'Requests' })
      .click();
    await expect(page).toHaveURL(/\/owner\/requests$/);
    await expect
      .poll(
        async () =>
          page
            .locator('article.queue-row')
            .filter({ hasText: bookingDescription })
            .count(),
        { timeout: 15000 }
      )
      .toBe(1);
    let bookingRow = page
      .locator('article.queue-row')
      .filter({ hasText: bookingDescription })
      .first();
    await expect(bookingRow).toBeVisible({ timeout: 15000 });
    await expect(bookingRow).toContainText(CLIENT_EMAIL);
    await expect(bookingRow).toContainText(bookingDescription);

    await page.getByRole('main').getByRole('link', { name: 'Clients' }).click();
    await expect(page.locator('body')).toContainText('Approved clients');
    await page
      .getByRole('button', { name: new RegExp(CLIENT_EMAIL, 'i') })
      .first()
      .click();
    await page.getByLabel('Title').fill(routineTitle);
    await page
      .getByLabel('Summary')
      .fill('3 training sessions, mobility finishers, and weekly check-ins.');
    await page.getByRole('button', { name: /assign routine/i }).click();

    await page.getByRole('main').getByRole('link', { name: 'Clients' }).click();
    await expect(page.locator('body')).toContainText(routineTitle);

    await page
      .getByRole('main')
      .getByRole('link', { name: 'Requests' })
      .click();
    await expect(page).toHaveURL(/\/owner\/requests$/);
    await expect
      .poll(
        async () =>
          page
            .locator('article.queue-row')
            .filter({ hasText: bookingTitle })
            .count(),
        { timeout: 15000 }
      )
      .toBe(1);
    bookingRow = page
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
        const bookings = await fetchOwnerBookings(page, ownerToken);
        const booking = bookings.find((entry) => entry.title === bookingTitle);
        return booking?.status ?? null;
      })
      .toBe('completed');

    const completedBooking = (await fetchOwnerBookings(page, ownerToken)).find(
      (entry) => entry.title === bookingTitle
    );
    expect(completedBooking?.id).toBe(pendingBooking.id);
    expect(completedBooking?.totalCost).toBe('0.00');

    bookingRow = page
      .locator('article.queue-row')
      .filter({ hasText: bookingTitle })
      .first();
    await expect(bookingRow).toBeVisible({ timeout: 15000 });
    await expect(
      bookingRow.getByRole('button', { name: 'Generate invoice' })
    ).toHaveCount(0);

    await page.getByRole('link', { name: 'Client Portal' }).click();
    await expect(page).toHaveURL(/\/client\/dashboard$/);
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
  }) => {
    const pendingGoal = uniqueLabel('pending-client-intake');
    const ownerToken = await loginOwner(page);

    await loginClient(page, PENDING_CLIENT_EMAIL, PENDING_CLIENT_PASSWORD);
    await createLeadRequest(page, {
      name: 'Taylor Quinn',
      email: PENDING_CLIENT_EMAIL,
      title: pendingGoal,
      description: 'Pending client should stay in the approval queue.',
    });

    await expect
      .poll(async () => {
        const prospects = await fetchOwnerProspects(page, ownerToken);
        return prospects.some((entry) => entry.email === PENDING_CLIENT_EMAIL);
      })
      .toBe(true);

    await page.getByRole('link', { name: 'Workspace' }).click();
    await expect(page).toHaveURL(/\/owner\/dashboard$/);
    await page
      .getByRole('main')
      .getByRole('link', { name: 'Requests' })
      .click();
    const prospectRow = page
      .locator('article.queue-row.prospect-row')
      .filter({ hasText: PENDING_CLIENT_EMAIL })
      .first();
    await expect(prospectRow).toBeVisible();
    await expect(
      prospectRow.getByRole('button', { name: 'Accept client' })
    ).toBeVisible();
  });
});
