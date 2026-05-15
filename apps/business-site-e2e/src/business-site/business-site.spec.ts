import { expect, Page, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const OWNER_EMAIL = 'owner@localbusiness.test';
const OWNER_PASSWORD = 'BusinessOwnerPass123!';
const CLIENT_EMAIL = 'client@localbusiness.test';
const CLIENT_PASSWORD = 'ClientPass123!';
const PENDING_CLIENT_EMAIL = 'pending-client@localbusiness.test';
const PENDING_CLIENT_PASSWORD = 'PendingClientPass123!';

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
  await page.goto('/owner/login');
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
  test('covers the public landing page and booking flow through the SSR proxy', async ({
    page,
  }) => {
    const bookingTitle = uniqueLabel('proxy-booking');

    await page.goto('/');
    await expect(
      page.getByRole('link', { name: 'Book a consultation' }).first()
    ).toBeVisible();
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
    await page.goto('/client/dashboard');
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

    await page.goto('/owner/requests');
    let bookingRow = page
      .locator('article.queue-row.booking-row')
      .filter({ hasText: bookingTitle })
      .first();
    await expect(bookingRow).toBeVisible();
    await expect(bookingRow).toContainText(clientUserId);
    await expect(bookingRow).toContainText(
      'A client-booked consultation that should flow through the gateway proxy.'
    );

    await page.goto('/owner/clients');
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

    await page.goto('/owner/clients');
    await expect(page.locator('body')).toContainText(routineTitle);

    await page.goto('/owner/requests');
    bookingRow = page
      .locator('article.queue-row.booking-row')
      .filter({ hasText: bookingTitle })
      .first();
    await expect(bookingRow).toBeVisible();

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

    await page.goto('/client/routines');
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

    await page.goto('/client/billing');
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

    await page.goto('/owner/requests');
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
