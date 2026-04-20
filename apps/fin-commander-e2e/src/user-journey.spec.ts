import { expect, Page, test } from '@playwright/test';

type BrowserDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedResponses: string[];
  requestFailures: string[];
};

type BrowserUser = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

function uniqueEmail(prefix = 'fc-e2e'): string {
  return `${prefix}-${Date.now()}-${Math.round(
    Math.random() * 1000
  )}@example.com`;
}

function startDiagnostics(page: Page): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedResponses: [],
    requestFailures: [],
  };

  page.on('console', async (message) => {
    if (message.type() === 'error') {
      let text = message.text();
      if (text === 'ERROR HttpErrorResponse') {
        try {
          const values = await Promise.all(
            message.args().map(async (arg) => {
              try {
                return await arg.jsonValue();
              } catch {
                return '<unserializable>';
              }
            })
          );
          text = `${text} ${JSON.stringify(values)}`;
        } catch {
          // Keep the original text when console arguments cannot be resolved.
        }
      }
      if (
        text ===
        'Failed to load resource: the server responded with a status of 404 (Not Found)'
      ) {
        return;
      }
      if (text === 'ERROR HttpErrorResponse ["ERROR","<unserializable>"]') {
        return;
      }
      diagnostics.consoleErrors.push(text);
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(error.message);
  });

  page.on('response', async (response) => {
    if (!response.url().includes('/api/finance') || response.ok()) {
      return;
    }

    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '<unavailable>';
    }

    diagnostics.failedResponses.push(
      `${response
        .request()
        .method()} ${response.url()} -> ${response.status()} ${body}`
    );
  });

  page.on('requestfailed', (request) => {
    if (!request.url().includes('/api/finance')) {
      return;
    }

    if (request.failure()?.errorText === 'net::ERR_ABORTED') {
      return;
    }

    diagnostics.requestFailures.push(
      `${request.method()} ${request.url()} -> ${
        request.failure()?.errorText ?? 'unknown'
      }`
    );
  });

  return diagnostics;
}

function expectNoBrowserErrors(diagnostics: BrowserDiagnostics) {
  expect(
    diagnostics.failedResponses,
    `Failed responses:\n${diagnostics.failedResponses.join('\n')}`
  ).toEqual([]);
  expect(
    diagnostics.requestFailures,
    `Request failures:\n${diagnostics.requestFailures.join('\n')}`
  ).toEqual([]);
  expect(
    diagnostics.consoleErrors,
    `Console errors:\n${diagnostics.consoleErrors.join('\n')}`
  ).toEqual([]);
  expect(
    diagnostics.pageErrors,
    `Page errors:\n${diagnostics.pageErrors.join('\n')}`
  ).toEqual([]);
}

async function openMenu(page: Page) {
  await page.getByRole('button', { name: '☰' }).click();
  await page.waitForTimeout(200);
}

async function closeMenu(page: Page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
}

async function clickMenuItem(page: Page, label: string) {
  await openMenu(page);
  await page
    .locator('otui-modal button')
    .filter({ hasText: label })
    .first()
    .click();
  await page.waitForLoadState('networkidle');
}

async function currentPlanId(page: Page): Promise<string> {
  const match = page.url().match(/\/commander\/([^/]+)/);
  expect(match?.[1]).toBeTruthy();
  return match![1];
}

async function expectResponseOk(
  page: Page,
  matcher: Parameters<Page['waitForResponse']>[0],
  action: () => Promise<void>
) {
  const responsePromise = page.waitForResponse(matcher, { timeout: 20000 });
  await action();
  const response = await responsePromise;
  expect(response.ok(), `${response.url()} -> ${response.status()}`).toBe(true);
  return response;
}

async function registerViaBrowser(
  page: Page,
  baseURL: string,
  user: BrowserUser
) {
  await page.goto(`${baseURL}/register`, { waitUntil: 'networkidle' });
  await page.getByLabel('First Name').fill(user.firstName);
  await page.getByLabel('Last Name').fill(user.lastName);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByLabel('Confirm Password').fill(user.password);

  await expectResponseOk(
    page,
    (response) =>
      response.url().includes('/api/authentication/register') &&
      response.request().method() === 'POST',
    async () => {
      await page
        .locator('.register-container form')
        .evaluate((form) => form.requestSubmit());
    }
  );
  await page.waitForURL(/\/login$/, { timeout: 20000 });
}

async function loginViaBrowser(
  page: Page,
  baseURL: string,
  user: Pick<BrowserUser, 'email' | 'password'>
) {
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await expectResponseOk(
    page,
    (response) =>
      response.url().includes('/api/authentication/login') &&
      response.request().method() === 'POST',
    async () => {
      await page
        .locator('.login-container form')
        .evaluate((form) => form.requestSubmit());
    }
  );
  await page.waitForLoadState('networkidle');
}

async function ensureProfileSaved(page: Page) {
  await clickMenuItem(page, 'Settings');
  await expect(page).toHaveURL(/\/settings$/);

  await page
    .getByRole('button', { name: /Create profile|Edit profile/i })
    .click();
  const profileHeading = page.getByRole('heading', {
    name: /Edit Profile|New Profile/i,
  });
  await expect(profileHeading).toBeVisible();

  await page.getByLabel('Profile Name').fill('Fin Commander Updated');
  await page.getByLabel('Bio').fill('Updated from fin-commander e2e');

  await expectResponseOk(
    page,
    (response) =>
      response.url().includes('/api/profile') &&
      ['PUT', 'POST'].includes(response.request().method()),
    async () => {
      await page.getByRole('button', { name: 'Submit' }).click();
    }
  );

  await expect(profileHeading).toHaveCount(0);
  await page.waitForLoadState('networkidle');
}

async function bootstrapFinanceWorkspaces(page: Page) {
  await page.goto('/onboarding', { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('heading', { name: 'Create your account' })
  ).toBeVisible();

  await page.getByLabel('Account name').fill('Household Command');
  await expectResponseOk(
    page,
    (response) =>
      response.url().includes('/api/finance/tenant') &&
      response.request().method() === 'POST',
    async () => {
      await page.getByRole('button', { name: 'Continue' }).click();
    }
  );

  await expect(
    page.getByRole('heading', { name: 'Choose your workspaces' })
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Business Operating cash, expenses, and revenue',
    })
    .click();

  await expectResponseOk(
    page,
    (response) =>
      response.url().includes('/api/finance/onboarding/bootstrap') &&
      response.request().method() === 'POST',
    async () => {
      await page.getByRole('button', { name: 'Continue' }).click();
    }
  );

  await expect(
    page.getByRole('heading', { name: 'Add your first financial account' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open setup checklist' }).click();
  await page.waitForURL(/\/finance\/personal\/setup$/, { timeout: 20000 });
}

async function createAndUpdateAccount(
  page: Page,
  workspace: 'personal' | 'business',
  namePrefix: string
) {
  await page.goto(`/finance/${workspace}/accounts`, {
    waitUntil: 'networkidle',
  });

  const accountName = `${namePrefix} ${Date.now()}`;
  await expectResponseOk(
    page,
    (response) =>
      response.url().includes('/api/finance/account') &&
      response.request().method() === 'POST',
    async () => {
      await page.locator('[name="name"]').fill(accountName);
      await page.locator('[name="type"]').selectOption('bank');
      await page.locator('[name="balance"]').fill('1234');
      await page.locator('[name="currency"]').fill('USD');
      await page.getByRole('button', { name: 'Create account' }).click();
    }
  );

  await expect(
    page.locator(`tr:has-text("${accountName}")`).first()
  ).toBeVisible();

  const updatedName = `${accountName} Updated`;
  const row = page.locator(`tr:has-text("${accountName}")`).first();
  await row.getByRole('button', { name: 'Edit' }).click();

  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/account\/.+/.test(response.url()) &&
      response.request().method() === 'PUT',
    async () => {
      await page.locator('[name="name"]').fill(updatedName);
      await page.getByRole('button', { name: 'Update account' }).click();
    }
  );
  await expect(
    page.locator(`tr:has-text("${updatedName}")`).first()
  ).toBeVisible();

  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/account\/.+/.test(response.url()) &&
      response.request().method() === 'PUT',
    async () => {
      await page
        .locator(`tr:has-text("${updatedName}")`)
        .first()
        .getByRole('button', { name: 'Mark Reviewed' })
        .click();
    }
  );
  await page.waitForLoadState('networkidle');

  return updatedName;
}

async function createUpdateDeleteTransaction(
  page: Page,
  workspace: 'personal' | 'business',
  categoryPrefix: string
) {
  await page.goto(`/finance/${workspace}/transactions`, {
    waitUntil: 'networkidle',
  });

  const category = `${categoryPrefix}-${Date.now()}`;
  await expectResponseOk(
    page,
    (response) =>
      response.url().includes('/api/finance/transaction') &&
      response.request().method() === 'POST',
    async () => {
      const accountId = await page
        .locator('[name="accountId"] option')
        .first()
        .getAttribute('value');
      expect(accountId).toBeTruthy();
      await page
        .locator('[name="accountId"]')
        .selectOption(accountId as string);
      await page.locator('[name="amount"]').fill('45');
      await page.locator('[name="type"]').selectOption('debit');
      await page.locator('[name="category"]').fill(category);
      await page.locator('[name="payeeOrVendor"]').fill('Verifier Vendor');
      await page.locator('[name="transactionDate"]').fill('2026-04-14');
      await page.getByRole('button', { name: 'Create transaction' }).click();
    }
  );
  await expect(
    page.locator(`tr:has-text("${category}")`).first()
  ).toBeVisible();

  const updatedCategory = `${category}-updated`;
  const transactionRow = page.locator(`tr:has-text("${category}")`).first();
  await transactionRow.getByRole('button', { name: 'Edit' }).click();
  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/transaction\/.+/.test(response.url()) &&
      response.request().method() === 'PUT',
    async () => {
      await page.locator('[name="category"]').fill(updatedCategory);
      await page.getByRole('button', { name: 'Update transaction' }).click();
    }
  );
  await expect(
    page.locator(`tr:has-text("${updatedCategory}")`).first()
  ).toBeVisible();
  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/transaction\/.+/.test(response.url()) &&
      response.request().method() === 'DELETE',
    async () => {
      await page
        .locator(`tr:has-text("${updatedCategory}")`)
        .first()
        .getByRole('button', { name: 'Delete' })
        .click();
    }
  );
  await expect(page.locator(`tr:has-text("${updatedCategory}")`)).toHaveCount(
    0
  );
}

async function createUpdateDeleteBudget(
  page: Page,
  workspace: 'personal' | 'business'
) {
  await page.goto(`/finance/${workspace}/budgets`, {
    waitUntil: 'networkidle',
  });

  const budgetName = `Budget ${Date.now()}`;
  await expectResponseOk(
    page,
    (response) =>
      response.url().includes('/api/finance/budget') &&
      response.request().method() === 'POST',
    async () => {
      await page.locator('[name="name"]').fill(budgetName);
      await page.locator('[name="category"]').fill('Operations');
      await page.locator('[name="limit"]').fill('500');
      await page.getByRole('button', { name: 'Create budget' }).click();
    }
  );
  await expect(
    page.locator(`article:has-text("${budgetName}")`).first()
  ).toBeVisible();

  const updatedBudgetName = `${budgetName} Updated`;
  await page
    .locator(`article:has-text("${budgetName}")`)
    .first()
    .getByRole('button', { name: 'Edit' })
    .click();
  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/budget\/.+/.test(response.url()) &&
      response.request().method() === 'PUT',
    async () => {
      await page.locator('[name="name"]').fill(updatedBudgetName);
      await page.getByRole('button', { name: 'Update budget' }).click();
    }
  );
  await expect(
    page.locator(`article:has-text("${updatedBudgetName}")`).first()
  ).toBeVisible();
  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/budget\/.+/.test(response.url()) &&
      response.request().method() === 'DELETE',
    async () => {
      await page
        .locator(`article:has-text("${updatedBudgetName}")`)
        .first()
        .getByRole('button', { name: 'Delete' })
        .click();
    }
  );
  await expect(
    page.locator(`article:has-text("${updatedBudgetName}")`)
  ).toHaveCount(0);
}

async function createUpdateDeleteRecurring(
  page: Page,
  workspace: 'personal' | 'business'
) {
  await page.goto(`/finance/${workspace}/recurring`, {
    waitUntil: 'networkidle',
  });

  const recurringName = `Recurring ${Date.now()}`;
  await expectResponseOk(
    page,
    (response) =>
      response.url().includes('/api/finance/recurring-item') &&
      response.request().method() === 'POST',
    async () => {
      await page.locator('[name="name"]').fill(recurringName);
      await page.locator('[name="amount"]').fill('75');
      await page.locator('[name="type"]').selectOption('debit');
      await page.locator('[name="category"]').fill('Subscriptions');
      await page.locator('[name="nextDueDate"]').fill('2026-05-01');
      await page.getByRole('button', { name: 'Create item' }).click();
    }
  );
  await expect(
    page.locator(`article:has-text("${recurringName}")`).first()
  ).toBeVisible();

  const updatedRecurringName = `${recurringName} Updated`;
  await page
    .locator(`article:has-text("${recurringName}")`)
    .first()
    .getByRole('button', { name: 'Edit' })
    .click();
  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/recurring-item\/.+/.test(response.url()) &&
      response.request().method() === 'PUT',
    async () => {
      await page.locator('[name="name"]').fill(updatedRecurringName);
      await page.getByRole('button', { name: 'Update item' }).click();
    }
  );
  await expect(
    page.locator(`article:has-text("${updatedRecurringName}")`).first()
  ).toBeVisible();
  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/recurring-item\/.+/.test(response.url()) &&
      response.request().method() === 'DELETE',
    async () => {
      await page
        .locator(`article:has-text("${updatedRecurringName}")`)
        .first()
        .getByRole('button', { name: 'Delete' })
        .click();
    }
  );
  await expect(
    page.locator(`article:has-text("${updatedRecurringName}")`)
  ).toHaveCount(0);
}

async function createUpdateDeleteAsset(page: Page) {
  await page.goto('/finance/net-worth/assets', { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('heading', { name: 'Tracked Assets' })
  ).toBeVisible();

  const assetName = `Asset ${Date.now()}`;
  await expectResponseOk(
    page,
    (response) =>
      response.url().includes('/api/finance/inventory-item') &&
      response.request().method() === 'POST',
    async () => {
      await page.locator('[name="name"]').fill(assetName);
      await page.locator('[name="category"]').fill('Equipment');
      await page.locator('[name="quantity"]').fill('2');
      await page.locator('[name="unitValue"]').fill('1500');
      await page.locator('[name="location"]').fill('Office');
      await page.getByRole('button', { name: 'Add asset' }).click();
    }
  );
  await expect(
    page.locator(`article:has-text("${assetName}")`).first()
  ).toBeVisible();

  const updatedAssetName = `${assetName} Updated`;
  await page
    .locator(`article:has-text("${assetName}")`)
    .first()
    .getByRole('button', { name: 'Edit' })
    .click();
  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/inventory-item\/.+/.test(response.url()) &&
      response.request().method() === 'PUT',
    async () => {
      await page.locator('[name="name"]').fill(updatedAssetName);
      await page.getByRole('button', { name: 'Update asset' }).click();
    }
  );
  await expect(
    page.locator(`article:has-text("${updatedAssetName}")`).first()
  ).toBeVisible();
  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/inventory-item\/.+/.test(response.url()) &&
      response.request().method() === 'DELETE',
    async () => {
      await page
        .locator(`article:has-text("${updatedAssetName}")`)
        .first()
        .getByRole('button', { name: 'Delete' })
        .click();
    }
  );
  await expect(
    page.locator(`article:has-text("${updatedAssetName}")`)
  ).toHaveCount(0);
}

test.describe('Fin Commander user journey', () => {
  test('shows signed-out navigation and redirects protected routes', async ({
    page,
    baseURL,
  }) => {
    const diagnostics = startDiagnostics(page);

    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
    await openMenu(page);
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Home' })
    ).toBeVisible();
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Register' })
    ).toBeVisible();
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Login' })
    ).toBeVisible();
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Personal Ledger' })
    ).toHaveCount(0);
    await closeMenu(page);

    await expect(page.locator('#fin-tenant-selector')).toHaveCount(0);
    await expect(page.locator('#fin-profile-selector')).toHaveCount(0);

    await page.goto(`${baseURL}/finance/personal`, {
      waitUntil: 'networkidle',
    });
    await expect(page).toHaveURL(/\/login$/);

    await page.goto(`${baseURL}/settings`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/login$/);

    await page.goto(`${baseURL}/commander/home-command/overview`, {
      waitUntil: 'networkidle',
    });
    await expect(page).toHaveURL(/\/login$/);

    expectNoBrowserErrors(diagnostics);
  });

  test('supports fresh-user registration, login, profile update, and personal finance CRUD', async ({
    page,
    baseURL,
  }) => {
    const diagnostics = startDiagnostics(page);
    const user: BrowserUser = {
      email: uniqueEmail(),
      password: 'TestPassword123!',
      firstName: 'Fin',
      lastName: 'Commander',
    };

    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
    await registerViaBrowser(page, baseURL as string, user);
    await loginViaBrowser(page, baseURL as string, user);

    await expect(page).toHaveURL(
      /\/(settings|onboarding|finance(\/personal)?)$/,
      {
        timeout: 20000,
      }
    );

    await openMenu(page);
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Ledger' })
    ).toBeVisible();
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Commander' })
    ).toBeVisible();
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Settings' })
    ).toBeVisible();
    await closeMenu(page);

    await expect(page.locator('#fin-tenant-selector')).toHaveCount(1);
    await expect(page.locator('#fin-tenant-selector option')).toHaveCount(1);
    await expect(page.locator('#fin-profile-selector')).toHaveCount(1);

    await ensureProfileSaved(page);
    await createAndUpdateAccount(page, 'personal', 'Checking');
    await createUpdateDeleteTransaction(page, 'personal', 'category');
    await createUpdateDeleteBudget(page, 'personal');
    await createUpdateDeleteRecurring(page, 'personal');

    expectNoBrowserErrors(diagnostics);
  });

  test('covers the canonical first-run path without seeded demo plans', async ({
    page,
    baseURL,
  }) => {
    const diagnostics = startDiagnostics(page);
    const user: BrowserUser = {
      email: uniqueEmail('fc-rich'),
      password: 'TestPassword123!',
      firstName: 'Rich',
      lastName: 'Operator',
    };

    await registerViaBrowser(page, baseURL as string, user);
    await loginViaBrowser(page, baseURL as string, user);
    await page.goto('/commander/home-command/overview', {
      waitUntil: 'networkidle',
    });
    await expect(page).toHaveURL(
      /\/(settings|onboarding|finance\/personal\/setup)$/
    );

    await ensureProfileSaved(page);
    await bootstrapFinanceWorkspaces(page);

    await openMenu(page);
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Ledger' })
    ).toBeVisible();
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Commander' })
    ).toBeVisible();
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Settings' })
    ).toBeVisible();
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'home-command' })
    ).toHaveCount(0);
    await closeMenu(page);

    await createAndUpdateAccount(page, 'business', 'Operating');
    await createUpdateDeleteTransaction(page, 'business', 'biz-category');
    await createUpdateDeleteBudget(page, 'business');
    await createUpdateDeleteRecurring(page, 'business');
    await createUpdateDeleteAsset(page);

    await clickMenuItem(page, 'Commander');
    await expect(page).toHaveURL(/\/commander\/new\/overview$/);
    await expect(page.getByLabel('Plan name')).toBeVisible();
    const planName = `First Plan ${Date.now()}`;
    await page.getByLabel('Plan name').fill(planName);
    await page
      .getByLabel('What is this plan for?')
      .fill('Cover monthly obligations and savings goals');
    await page.getByRole('button', { name: 'Create your first plan' }).click();
    await expect(page).toHaveURL(/\/commander\/[^/]+\/overview$/);
    await expect(page).not.toHaveURL(/home-command/);
    await expect(
      page.getByText(
        'Keep your next money moves, tradeoffs, and workspace rollups in one planning view.'
      )
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Open workspace →' }).first()
    ).toBeVisible();
    const planId = await currentPlanId(page);

    await page.goto(`/commander/${planId}/cash-flow`, {
      waitUntil: 'networkidle',
    });
    await expect(page).toHaveURL(new RegExp(`/commander/${planId}/cash-flow$`));
    await expect(
      page.getByRole('heading', { name: 'Navigate your finance workspaces' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Accounts' }).first()
    ).toBeVisible();

    await page.goto(`/commander/${planId}/goals`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`/commander/${planId}/goals$`));
    const goalName = `Goal ${Date.now()}`;
    await page.getByLabel('Goal name').fill(goalName);
    await page.getByLabel('Target amount').fill('10000');
    await page.getByLabel('Current amount').fill('2500');
    await page.getByLabel('Due date').fill('2026-09-01');
    await page.getByLabel('Strategy').fill('Send monthly surplus to savings');
    await page.getByRole('button', { name: 'Save Goal' }).click();
    await expect(page.locator(`article:has-text("${goalName}")`)).toBeVisible();
    await page
      .locator(`article:has-text("${goalName}")`)
      .getByRole('button', { name: 'Remove' })
      .click();
    await expect(page.locator(`article:has-text("${goalName}")`)).toHaveCount(
      0
    );

    await page.goto(`/commander/${planId}/scenarios`, {
      waitUntil: 'networkidle',
    });
    await expect(page).toHaveURL(new RegExp(`/commander/${planId}/scenarios$`));
    const scenarioName = `Scenario ${Date.now()}`;
    await page.getByLabel('Scenario name').fill(scenarioName);
    await page.getByLabel('Summary').fill('Stress test the command plan');
    await page.getByLabel('Assumption label').fill('Contract expansion');
    await page.getByLabel('Delta').fill('+$4,000 / month');
    await page.getByLabel('Impact area').selectOption('income');
    await page.getByRole('button', { name: 'Create Scenario' }).click();
    await expect(
      page.locator(`article:has-text("${scenarioName}")`)
    ).toBeVisible();
    await page
      .locator(`article:has-text("${scenarioName}")`)
      .getByRole('button', { name: 'Remove' })
      .click();
    await expect(
      page.locator(`article:has-text("${scenarioName}")`)
    ).toHaveCount(0);

    await page.goto(`/commander/${planId}/imports`, {
      waitUntil: 'networkidle',
    });
    await expect(page).toHaveURL(new RegExp(`/commander/${planId}/imports$`));
    await expect(
      page.getByRole('heading', {
        name: 'Transaction intake and reconciliation',
      })
    ).toBeVisible();
    await page.getByLabel('Workspace').selectOption('business');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Preview import' }).click();
    await expect(
      page.getByText('Preview ready. Review the rows before commit.')
    ).toBeVisible();
    await expectResponseOk(
      page,
      (response) =>
        response.url().includes('/api/finance/transaction') &&
        response.request().method() === 'POST',
      async () => {
        await page.getByRole('button', { name: 'Commit preview' }).click();
      }
    );
    await expect(
      page.getByText('Committed 1 imported transactions.')
    ).toBeVisible();

    await page.goto('/finance/business/transactions', {
      waitUntil: 'networkidle',
    });
    await expect(
      page.locator('tr:has-text("Neighborhood Market")')
    ).toBeVisible();

    expectNoBrowserErrors(diagnostics);
  });
});
