import { expect, Page, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const OWNER_EMAIL = 'owner@localbusiness.test';
const OWNER_PASSWORD = 'BusinessOwnerPass123!';
const CLIENT_EMAIL = 'client@localbusiness.test';
const CLIENT_PASSWORD = 'ClientPass123!';
const PENDING_CLIENT_EMAIL = 'pending-client@localbusiness.test';
const PENDING_CLIENT_PASSWORD = 'PendingClientPass123!';
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
      'Use this sample tenant to showcase estimate requests, repair scheduling, and homeowner communication.',
    cta: 'Request an estimate',
    serviceName: 'Repair visit',
  },
  {
    slug: 'ovenbird-bakeshop',
    businessName: 'Ovenbird Bakeshop',
    heroCopy:
      'This sample tenant shows how a made-to-order bakery can capture event details, custom notes, and pickup timing cleanly.',
    cta: 'Start an order',
    serviceName: 'Custom cake order',
  },
] as const;

test.describe.configure({ mode: 'serial' });

function uniqueLabel(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

async function loginClient(
  page: Page,
  email = CLIENT_EMAIL,
  password = CLIENT_PASSWORD
) {
  await page.goto('/client/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/client\/dashboard$/);

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
  }
) {
  await page.goto('/book');
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
  await page.getByRole('button', { name: /send request/i }).click();

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
  }
) {
  await page.goto('/book');
  await page.getByLabel('Requested offer').selectOption({ index: 0 });
  const slotSelect = page.getByLabel('Available hour block');
  await expect(slotSelect).toBeVisible();
  await slotSelect.selectOption({ index: 1 });
  await page.getByLabel('Primary goal').fill(input.title);
  await page.getByLabel('Context').fill(input.description);

  const bookingRequest = page.waitForResponse((response) => {
    return (
      response.url().endsWith('/api/business/bookings') &&
      response.request().method() === 'POST'
    );
  });
  await page.getByRole('button', { name: /send request/i }).click();

  const response = await bookingRequest;
  expect(response.ok()).toBeTruthy();
  await expect(page.getByText('Consultation request submitted.')).toBeVisible({
    timeout: 15000,
  });
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
  const configResponse = await page.request.get('/api/business/site-config');
  expect(configResponse.ok()).toBeTruthy();
  const payload = (await configResponse.json()) as {
    configId: string | null;
    config: Record<string, any> | null;
  };

  const config = payload.config ?? {};
  const response = await page.request.put('/api/business/site-config', {
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
  });

  expect(response.ok()).toBeTruthy();
}

async function fetchSiteConfig(page: Page) {
  const response = await page.request.get('/api/business/site-config');
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
  const response = await page.request.put('/api/business/site-config', {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-ot-appscope': 'business-site',
      'content-type': 'application/json',
    },
    data: {
      configId: payload.configId,
      config: mutate((payload.config ?? {}) as Record<string, any>),
    },
  });

  expect(response.ok()).toBeTruthy();
}

async function fetchClientRoutines(
  page: Page,
  clientId: string,
  token: string
) {
  const response = await page.request.get(
    `/api/business/client/routines?clientId=${encodeURIComponent(clientId)}`,
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
  token: string
) {
  const response = await page.request.get(
    `/api/business/client/check-ins?clientId=${encodeURIComponent(clientId)}`,
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
      await expect(
        page.locator('#guided-business-info').getByLabel('Business Name')
      ).toHaveValue(owner.publicHeading);
      await expect(
        page.getByRole('button', { name: 'Save Changes' })
      ).toBeVisible();

      await page.goto(`/sites/${owner.slug}`);
      await expect(page.locator('body')).toContainText(owner.publicHeading);
    });
  }

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
    const bookingTitle = uniqueLabel('client-session');
    const routineTitle = uniqueLabel('four-week-plan');
    const checkInNotes = uniqueLabel('check-in-notes');

    const {
      profileId: clientProfileId,
      token: clientToken,
      userId: clientUserId,
    } = await loginClient(page);
    await expect(page.locator('body')).toContainText('Upcoming sessions');

    await createAcceptedClientBooking(page, {
      title: bookingTitle,
      description:
        'A client-booked consultation that should flow through the gateway proxy.',
    });

    await expect
      .poll(async () => {
        const bookings = await fetchBookings(page, clientToken);
        return bookings.some((booking) => booking.title === bookingTitle);
      })
      .toBe(true);

    const ownerToken = await loginOwner(page);
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
            .locator('article.queue-row.booking-row')
            .filter({ hasText: bookingTitle })
            .count(),
        { timeout: 15000 }
      )
      .toBe(1);
    let bookingRow = page
      .locator('article.queue-row.booking-row')
      .filter({ hasText: bookingTitle })
      .first();
    await expect(bookingRow).toBeVisible({ timeout: 15000 });
    await expect(bookingRow).toContainText(clientUserId);
    await expect(bookingRow).toContainText(
      'A client-booked consultation that should flow through the gateway proxy.'
    );

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

    await expect
      .poll(async () => {
        const routines = await fetchClientRoutines(
          page,
          clientUserId,
          clientToken
        );
        return (
          routines.find((routine) => routine.title === routineTitle)?.id ?? null
        );
      })
      .toBeTruthy();

    const assignedRoutine = (
      await fetchClientRoutines(page, clientUserId, clientToken)
    ).find((routine) => routine.title === routineTitle);
    const routineId = assignedRoutine?.id;
    expect(routineId).toBeTruthy();

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
            .locator('article.queue-row.booking-row')
            .filter({ hasText: bookingTitle })
            .count(),
        { timeout: 15000 }
      )
      .toBe(1);
    bookingRow = page
      .locator('article.queue-row.booking-row')
      .filter({ hasText: bookingTitle })
      .first();
    await expect(bookingRow).toBeVisible({ timeout: 15000 });

    await bookingRow.getByRole('button', { name: 'Approve' }).click();
    await expect(bookingRow).toContainText('approved');
    await bookingRow.getByRole('button', { name: 'Complete' }).click();
    await expect(bookingRow).toContainText('completed');
    await bookingRow.getByRole('button', { name: 'Invoice' }).click();

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
    expect(completedBooking?.totalCost).toBeTruthy();
    expect(completedBooking?.id).toBe(pendingBooking.id);

    await expect(bookingRow).toContainText(
      `$${completedBooking?.totalCost ?? ''}`
    );

    await page.getByRole('link', { name: 'Client Portal' }).click();
    await expect(page).toHaveURL(/\/client\/dashboard$/);
    await page
      .getByRole('main')
      .getByRole('link', { name: 'Routines' })
      .click();
    await expect(page.locator('body')).toContainText(routineTitle);
    await page.getByLabel('Routine').selectOption(routineId as string);
    await page.getByLabel('Notes').fill(checkInNotes);
    await page.getByLabel('Energy').fill('8');
    await page.getByRole('button', { name: 'Save check-in' }).click();

    await expect
      .poll(async () => {
        const checkIns = await fetchClientCheckIns(
          page,
          clientUserId,
          clientToken
        );
        return checkIns.some((entry) => entry.notes === checkInNotes);
      })
      .toBe(true);

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
