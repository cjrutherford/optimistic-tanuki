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

type TenantRouteContext = {
  accountsPath: string;
  plansPath: string;
};

function uniqueEmail(prefix = 'fc-e2e'): string {
  return `${prefix}-${Date.now()}-${Math.round(
    Math.random() * 1000
  )}@example.com`;
}

async function startDiagnostics(page: Page): Promise<BrowserDiagnostics> {
  const diagnostics: BrowserDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedResponses: [],
    requestFailures: [],
  };

  await page.addInitScript(() => {
    const summarize = (value: unknown): unknown => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }

      if (
        value === null ||
        ['string', 'number', 'boolean'].includes(typeof value)
      ) {
        return value;
      }

      if (Array.isArray(value)) {
        return value.map((entry) => summarize(entry));
      }

      if (typeof value === 'object') {
        const input = value as Record<string, unknown>;
        const keys = [
          'name',
          'message',
          'status',
          'statusText',
          'url',
          'type',
          'error',
        ];
        const summary: Record<string, unknown> = {
          constructor: input.constructor?.name ?? typeof input,
          tag: Object.prototype.toString.call(input),
        };

        for (const key of keys) {
          if (!(key in input)) {
            continue;
          }

          summary[key] = summarize(input[key]);
        }

        return summary;
      }

      return String(value);
    };

    const originalConsoleError = console.error.bind(console);
    const debugWindow = window as Window & {
      __otConsoleErrors?: Array<{ args: unknown[]; stack?: string }>;
      __otPageErrors?: Array<unknown>;
      __otUnhandledRejections?: Array<unknown>;
    };
    debugWindow.__otConsoleErrors = [];
    debugWindow.__otPageErrors = [];
    debugWindow.__otUnhandledRejections = [];

    window.addEventListener('error', (event) => {
      debugWindow.__otPageErrors?.push({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: summarize(event.error),
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      debugWindow.__otUnhandledRejections?.push({
        reason: summarize(event.reason),
      });
    });

    console.error = (...args: unknown[]) => {
      debugWindow.__otConsoleErrors?.push({
        args: args.map((arg) => summarize(arg)),
        stack: new Error().stack,
      });

      originalConsoleError(...args);
    };
  });

  page.on('console', async (message) => {
    if (message.type() === 'error') {
      let text = message.text();
      const location = message.location();
      const isExpectedAnonymousProbe =
        text ===
          'Failed to load resource: the server responded with a status of 401 (Unauthorized)' &&
        ['/api/authentication/session', '/api/profile'].some((path) =>
          location.url.includes(path)
        );

      if (isExpectedAnonymousProbe) {
        return;
      }

      if (text === 'ERROR HttpErrorResponse' || text === 'ERROR rt') {
        try {
          const values = await Promise.all(
            message.args().map(async (arg) => {
              try {
                return await arg.evaluate((value: unknown) => {
                  const summarizeObject = (input: Record<string, unknown>) => {
                    const keys = [
                      'name',
                      'message',
                      'status',
                      'statusText',
                      'url',
                      'type',
                      'error',
                    ];
                    const summary: Record<string, unknown> = {
                      constructor: input.constructor?.name ?? typeof input,
                      tag: Object.prototype.toString.call(input),
                    };

                    for (const key of keys) {
                      if (!(key in input)) {
                        continue;
                      }

                      const property = input[key];
                      if (
                        property === null ||
                        ['string', 'number', 'boolean'].includes(
                          typeof property
                        )
                      ) {
                        summary[key] = property;
                        continue;
                      }

                      if (Array.isArray(property)) {
                        summary[key] = property.map((entry) =>
                          typeof entry === 'object' && entry !== null
                            ? Object.prototype.toString.call(entry)
                            : entry
                        );
                        continue;
                      }

                      if (typeof property === 'object') {
                        summary[key] = Object.prototype.toString.call(property);
                        continue;
                      }

                      summary[key] = String(property);
                    }

                    return summary;
                  };

                  if (value instanceof Error) {
                    return {
                      name: value.name,
                      message: value.message,
                      stack: value.stack,
                    };
                  }

                  if (typeof value === 'object' && value !== null) {
                    return summarizeObject(value as Record<string, unknown>);
                  }

                  return value;
                });
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
      if (
        text ===
        'ERROR HttpErrorResponse ["<unserializable>","<unserializable>"]'
      ) {
        return;
      }
      if (location.url) {
        text = `${text} @ ${location.url}:${location.lineNumber}:${location.columnNumber}`;
      }
      if (text.startsWith('ERROR HttpErrorResponse')) {
        try {
          const latestStack = await page.evaluate(() => {
            const debugWindow = window as Window & {
              __otConsoleErrors?: Array<{ stack?: string }>;
            };
            return debugWindow.__otConsoleErrors?.at(-1)?.stack ?? null;
          });
          if (latestStack) {
            text = `${text}\n${latestStack}`;
          }
        } catch {
          // Keep the console text if the page has already navigated.
        }
      }
      diagnostics.consoleErrors.push(text);
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(error.message);
  });

  page.on('response', async (response) => {
    if (!response.url().includes('/api/') || response.ok()) {
      return;
    }

    const request = response.request();
    const isAnonymousBootstrapProbe =
      response.status() === 401 &&
      request.method() === 'GET' &&
      !(await request.headerValue('cookie')) &&
      ['/api/authentication/session', '/api/profile'].some((path) =>
        response.url().includes(path)
      );

    if (isAnonymousBootstrapProbe) {
      return;
    }

    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '<unavailable>';
    }

    diagnostics.failedResponses.push(
      `${request.method()} ${response.url()} -> ${response.status()} ${body}`
    );
  });

  page.on('requestfailed', (request) => {
    if (!request.url().includes('/api/')) {
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

async function logRuntimeBundleContext(
  page: Page,
  diagnostics: BrowserDiagnostics
) {
  if (!diagnostics.consoleErrors.some((entry) => entry.includes('ERROR rt'))) {
    return;
  }

  try {
    const debug = await page.evaluate(async () => {
      // Discover loaded JS chunk URLs from the page's performance entries
      const scriptEntries = performance
        .getEntriesByType('resource')
        .filter((e) => e.name.match(/\/chunk-[A-Z0-9]+\.js$/))
        .map((e) => e.name);

      const chunkResults: Array<{
        chunkUrl: string;
        sourceMappingMatch: string | null;
      }> = [];
      for (const chunkUrl of scriptEntries) {
        try {
          const source = await fetch(chunkUrl).then((r) => r.text());
          const sourceMappingMatch =
            source.match(/\/\/# sourceMappingURL=(.+)$/m)?.[1] ?? null;
          chunkResults.push({ chunkUrl, sourceMappingMatch });
        } catch {
          chunkResults.push({ chunkUrl, sourceMappingMatch: null });
        }
      }

      return {
        discoveredChunks: chunkResults,
        consoleErrors: (
          (
            window as Window & {
              __otConsoleErrors?: Array<{ args: unknown[]; stack?: string }>;
            }
          ).__otConsoleErrors ?? []
        ).slice(-5),
        pageErrors: (
          (
            window as Window & {
              __otPageErrors?: Array<unknown>;
            }
          ).__otPageErrors ?? []
        ).slice(-5),
        unhandledRejections: (
          (
            window as Window & {
              __otUnhandledRejections?: Array<unknown>;
            }
          ).__otUnhandledRejections ?? []
        ).slice(-5),
      };
    });

    console.log(`BUNDLE_DEBUG ${JSON.stringify(debug)}`);
  } catch (err) {
    console.log(`BUNDLE_DEBUG_ERROR ${String(err)}`);
  }
}

function logDiagnosticsCheckpoint(
  label: string,
  diagnostics: BrowserDiagnostics
) {
  console.log(
    `DIAGNOSTICS ${label} ${JSON.stringify({
      consoleErrors: diagnostics.consoleErrors,
      pageErrors: diagnostics.pageErrors,
      failedResponses: diagnostics.failedResponses,
      requestFailures: diagnostics.requestFailures,
    })}`
  );
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
  const match = page.url().match(/\/(?:plans|commander)\/([^/]+)/);
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
  await page.getByLabel('Email', { exact: true }).fill(user.email);
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
        .evaluate((form) => (form as HTMLFormElement).requestSubmit());
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
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await expectResponseOk(
    page,
    (response) =>
      response.url().includes('/api/authentication/login') &&
      response.request().method() === 'POST',
    async () => {
      await page
        .locator('.login-container form')
        .evaluate((form) => (form as HTMLFormElement).requestSubmit());
    }
  );
  await page.waitForLoadState('networkidle');
}

async function ensureProfileSaved(page: Page) {
  // A newly registered user is correctly routed to onboarding after login,
  // where the global title bar is intentionally absent. Profile setup must
  // therefore use the route directly instead of depending on that menu.
  await page.goto('/settings', { waitUntil: 'networkidle' });
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

async function bootstrapFinanceWorkspaces(
  page: Page,
  options?: {
    accountName?: string;
    includeBusinessWorkspace?: boolean;
  }
): Promise<TenantRouteContext> {
  const accountName = options?.accountName ?? 'Household Command';
  const includeBusinessWorkspace = options?.includeBusinessWorkspace ?? true;

  await page.goto('/onboarding', { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('heading', { name: 'Create your account' })
  ).toBeVisible();

  await page.getByLabel('Account name').fill(accountName);
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

  await expect(page.locator('fc-title-bar')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Account' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Profile' })).toHaveCount(0);

  const personalWorkspace = page.getByRole('button', {
    name: 'Personal Income, bills, and everyday spending',
  });
  await page.mouse.wheel(0, 400);
  await personalWorkspace.click();
  await expect(personalWorkspace).toHaveClass(/selected/);

  if (includeBusinessWorkspace) {
    await page
      .getByRole('button', {
        name: 'Business Operating cash, expenses, and revenue',
      })
      .click();
  }

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
    page.getByRole('heading', { name: 'Review your finance accounts' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open accounts' }).click();
  await page.waitForURL(/\/tenants\/[^/]+\/accounts\/personal\/accounts$/, {
    timeout: 20000,
  });

  const pathname = new URL(page.url()).pathname;
  const match = pathname.match(/^(\/tenants\/[^/]+)\/accounts\//);
  if (!match) {
    expect(pathname).toMatch(/^\/finance\//);
    return {
      accountsPath: '/finance',
      plansPath: '/commander',
    };
  }
  return {
    accountsPath: `${match![1]}/accounts`,
    plansPath: `${match![1]}/plans`,
  };
}

async function openOnboardingFinanceStep(
  page: Page,
  heading: string,
  action: string
) {
  await page.goto('/onboarding', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await page.getByRole('button', { name: action }).click();
  await page.waitForLoadState('networkidle');
}

async function createAndUpdateAccount(
  page: Page,
  routes: TenantRouteContext,
  workspace: 'personal' | 'business',
  namePrefix: string,
  options?: { useCurrentRoute?: boolean }
) {
  if (!options?.useCurrentRoute) {
    await page.goto(`${routes.accountsPath}/${workspace}/accounts`, {
      waitUntil: 'networkidle',
    });
  }

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

  await page.locator('otui-ag-grid').scrollIntoViewIfNeeded();
  const row = page
    .locator('.ag-center-cols-container .ag-row')
    .filter({ hasText: accountName });
  await expect(row).toBeVisible();

  const updatedName = `${accountName} Updated`;
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
  const updatedRow = page
    .locator('.ag-center-cols-container .ag-row')
    .filter({ hasText: updatedName });
  await expect(updatedRow).toBeVisible();

  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/account\/.+/.test(response.url()) &&
      response.request().method() === 'PUT',
    async () => {
      await updatedRow.getByRole('button', { name: 'Reviewed' }).click();
    }
  );
  await page.waitForLoadState('networkidle');

  return updatedName;
}

async function createUpdateDeleteTransaction(
  page: Page,
  routes: TenantRouteContext,
  workspace: 'personal' | 'business',
  categoryPrefix: string,
  options?: { useCurrentRoute?: boolean }
) {
  if (!options?.useCurrentRoute) {
    await page.goto(`${routes.accountsPath}/${workspace}/transactions`, {
      waitUntil: 'networkidle',
    });
  }

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
    page.getByRole('row', { name: new RegExp(category) })
  ).toBeVisible();

  const updatedCategory = `${category}-updated`;
  const transactionRow = page.getByRole('row', {
    name: new RegExp(category),
  });
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
    page.getByRole('row', { name: new RegExp(updatedCategory) })
  ).toBeVisible();
  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/transaction\/.+/.test(response.url()) &&
      response.request().method() === 'DELETE',
    async () => {
      await page
        .getByRole('row', { name: new RegExp(updatedCategory) })
        .getByRole('button', { name: 'Delete' })
        .click();
    }
  );
  await expect(
    page.getByRole('row', { name: new RegExp(updatedCategory) })
  ).toHaveCount(0);
}

async function createUpdateDeleteBudget(
  page: Page,
  routes: TenantRouteContext,
  workspace: 'personal' | 'business',
  options?: { useCurrentRoute?: boolean }
) {
  if (!options?.useCurrentRoute) {
    await page.goto(`${routes.accountsPath}/${workspace}/budgets`, {
      waitUntil: 'networkidle',
    });
  }

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
  await page.locator('otui-ag-grid').scrollIntoViewIfNeeded();
  const budgetRow = page
    .locator('.ag-center-cols-container .ag-row')
    .filter({ hasText: budgetName });
  await expect(budgetRow).toBeVisible();

  const updatedBudgetName = `${budgetName} Updated`;
  await budgetRow.getByRole('button', { name: 'Edit' }).click();
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
  const updatedBudgetRow = page
    .locator('.ag-center-cols-container .ag-row')
    .filter({ hasText: updatedBudgetName });
  await expect(updatedBudgetRow).toBeVisible();
  await expectResponseOk(
    page,
    (response) =>
      /\/api\/finance\/budget\/.+/.test(response.url()) &&
      response.request().method() === 'DELETE',
    async () => {
      await updatedBudgetRow.getByRole('button', { name: 'Delete' }).click();
    }
  );
  await expect(updatedBudgetRow).toHaveCount(0);
}

async function createCategorizedTransaction(
  page: Page,
  routes: TenantRouteContext,
  workspace: 'personal' | 'business',
  categoryPrefix: string,
  options?: { useCurrentRoute?: boolean }
) {
  if (!options?.useCurrentRoute) {
    await page.goto(`${routes.accountsPath}/${workspace}/transactions`, {
      waitUntil: 'networkidle',
    });
  }

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
      await page.locator('[name="payeeOrVendor"]').fill('Setup Vendor');
      await page.locator('[name="transactionDate"]').fill('2026-04-15');
      await page.getByRole('button', { name: 'Create transaction' }).click();
    }
  );

  await expect(
    page.getByRole('row', { name: new RegExp(category) })
  ).toBeVisible();
  return category;
}

async function createBudget(
  page: Page,
  routes: TenantRouteContext,
  workspace: 'personal' | 'business',
  namePrefix = 'Setup Budget',
  options?: { useCurrentRoute?: boolean }
) {
  if (!options?.useCurrentRoute) {
    await page.goto(`${routes.accountsPath}/${workspace}/budgets`, {
      waitUntil: 'networkidle',
    });
  }

  const budgetName = `${namePrefix} ${Date.now()}`;
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

  await page.locator('otui-ag-grid').scrollIntoViewIfNeeded();
  await expect(
    page
      .locator('.ag-center-cols-container .ag-row')
      .filter({ hasText: budgetName })
  ).toBeVisible();
  return budgetName;
}

async function createUpdateDeleteRecurring(
  page: Page,
  routes: TenantRouteContext,
  workspace: 'personal' | 'business'
) {
  await page.goto(`${routes.accountsPath}/${workspace}/recurring`, {
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

async function createUpdateDeleteAsset(page: Page, routes: TenantRouteContext) {
  await page.goto(`${routes.accountsPath}/net-worth/assets`, {
    waitUntil: 'networkidle',
  });
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
    const diagnostics = await startDiagnostics(page);

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
    const diagnostics = await startDiagnostics(page);
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

    await ensureProfileSaved(page);
    const routes = await bootstrapFinanceWorkspaces(page, {
      accountName: 'Personal Command',
      includeBusinessWorkspace: false,
    });
    logDiagnosticsCheckpoint('after-bootstrap-personal', diagnostics);
    await createAndUpdateAccount(page, routes, 'personal', 'Checking', {
      useCurrentRoute: true,
    });
    logDiagnosticsCheckpoint('after-account-personal', diagnostics);
    await logRuntimeBundleContext(page, diagnostics);
    await createCategorizedTransaction(
      page,
      routes,
      'personal',
      'Setup baseline'
    );
    await createUpdateDeleteTransaction(page, routes, 'personal', 'category');
    logDiagnosticsCheckpoint('after-transaction-personal', diagnostics);
    await createBudget(page, routes, 'personal', 'Setup baseline');
    await createUpdateDeleteBudget(page, routes, 'personal');
    logDiagnosticsCheckpoint('after-budget-personal', diagnostics);
    await createUpdateDeleteRecurring(page, routes, 'personal');
    logDiagnosticsCheckpoint('after-recurring-personal', diagnostics);

    await logRuntimeBundleContext(page, diagnostics);
    expectNoBrowserErrors(diagnostics);
  });

  test('allows a personal-only account to add the business workspace later', async ({
    page,
    baseURL,
  }) => {
    const diagnostics = await startDiagnostics(page);
    const user: BrowserUser = {
      email: uniqueEmail('fc-add-workspace'),
      password: 'TestPassword123!',
      firstName: 'Workspace',
      lastName: 'Adder',
    };

    await registerViaBrowser(page, baseURL as string, user);
    await loginViaBrowser(page, baseURL as string, user);
    await ensureProfileSaved(page);
    const routes = await bootstrapFinanceWorkspaces(page, {
      accountName: 'Workspace Expansion',
      includeBusinessWorkspace: false,
    });
    await createAndUpdateAccount(
      page,
      routes,
      'personal',
      'Expansion Checking',
      { useCurrentRoute: true }
    );
    await openOnboardingFinanceStep(
      page,
      'Categorize your first transactions',
      'Open transactions'
    );
    await createCategorizedTransaction(
      page,
      routes,
      'personal',
      'expansion-category',
      { useCurrentRoute: true }
    );
    await openOnboardingFinanceStep(
      page,
      'Create a first budget',
      'Open budgets'
    );
    await createBudget(page, routes, 'personal', 'Expansion Budget', {
      useCurrentRoute: true,
    });

    await page.goto('/onboarding', { waitUntil: 'networkidle' });
    await expect(
      page.getByRole('heading', { name: 'Start in Fin Commander' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Add workspaces' }).click();
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

    await page.goto(`${routes.accountsPath}/business/accounts`, {
      waitUntil: 'networkidle',
    });
    await expect(
      page.getByRole('row', { name: /Business Operating/ })
    ).toBeVisible();

    expectNoBrowserErrors(diagnostics);
  });

  test('covers the canonical first-run path without seeded demo plans', async ({
    page,
    baseURL,
  }) => {
    const diagnostics = await startDiagnostics(page);
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
    const routes = await bootstrapFinanceWorkspaces(page, {
      accountName: 'Household Command',
      includeBusinessWorkspace: true,
    });
    logDiagnosticsCheckpoint('after-bootstrap-canonical', diagnostics);
    await logRuntimeBundleContext(page, diagnostics);

    await openMenu(page);
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Tenant' })
    ).toBeVisible();
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Plans' })
    ).toBeVisible();
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'Settings' })
    ).toBeVisible();
    await expect(
      page.locator('otui-modal button').filter({ hasText: 'home-command' })
    ).toHaveCount(0);
    await closeMenu(page);

    const personalFundingAccount = await createAndUpdateAccount(
      page,
      routes,
      'personal',
      'Household Checking',
      {
        useCurrentRoute: true,
      }
    );
    await createAndUpdateAccount(page, routes, 'business', 'Operating');
    logDiagnosticsCheckpoint('after-account-business', diagnostics);
    await createUpdateDeleteTransaction(
      page,
      routes,
      'business',
      'biz-category'
    );
    logDiagnosticsCheckpoint('after-transaction-business', diagnostics);
    await createUpdateDeleteBudget(page, routes, 'business');
    logDiagnosticsCheckpoint('after-budget-business', diagnostics);
    await createUpdateDeleteRecurring(page, routes, 'business');
    logDiagnosticsCheckpoint('after-recurring-business', diagnostics);
    await createUpdateDeleteAsset(page, routes);
    logDiagnosticsCheckpoint('after-asset', diagnostics);

    await clickMenuItem(page, 'Plans');
    await expect(page).toHaveURL(new RegExp(`${routes.plansPath}$`));
    await expect(page.getByLabel('Plan name')).toBeVisible();
    const planName = `First Plan ${Date.now()}`;
    await page.getByLabel('Plan name').fill(planName);
    await page
      .getByLabel('Description')
      .fill('Cover monthly obligations and savings goals');
    await page.getByRole('button', { name: 'Create plan' }).click();
    await expect(page).toHaveURL(
      new RegExp(`${routes.plansPath}/[^/]+/overview$`)
    );
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

    const projectionResponse = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(`/api/finance/fin-commander/plan/${planId}/projection`) &&
        response.request().method() === 'GET'
    );
    await page.goto(`${routes.plansPath}/${planId}/cash-flow`, {
      waitUntil: 'networkidle',
    });
    await expect((await projectionResponse).ok()).toBe(true);
    await expect(page).toHaveURL(
      new RegExp(`${routes.plansPath}/${planId}/cash-flow$`)
    );
    await expect(
      page.getByRole('heading', { name: 'Account operating areas' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Accounts' }).first()
    ).toBeVisible();
    await expect(page.getByLabel('90-day cash flow forecast')).toContainText(
      '90-day forecast'
    );

    await page.goto(`${routes.plansPath}/${planId}/goals`, {
      waitUntil: 'networkidle',
    });
    await expect(page).toHaveURL(
      new RegExp(`${routes.plansPath}/${planId}/goals$`)
    );
    const goalName = `Goal ${Date.now()}`;
    await page.getByLabel('Goal name').fill(goalName);
    await page.getByLabel('Target amount').fill('10000');
    await page.getByLabel('Current amount').fill('2500');
    await page.getByLabel('Due date').fill('2026-09-01');
    const fundingAccount = page.getByLabel('Funding account');
    const fundingAccountId = await fundingAccount
      .locator('option')
      .filter({ hasText: personalFundingAccount })
      .getAttribute('value');
    expect(fundingAccountId).toBeTruthy();
    await fundingAccount.selectOption(fundingAccountId as string);
    await page.getByLabel('Strategy').fill('Send monthly surplus to savings');
    const goalResponse = await expectResponseOk(
      page,
      (response) =>
        response
          .url()
          .includes(`/api/finance/fin-commander/plan/${planId}/goal`) &&
        response.request().method() === 'POST',
      async () => {
        await page.getByRole('button', { name: 'Save Goal' }).click();
      }
    );
    const createdGoal = await goalResponse.json();
    expect(createdGoal.fundingAccountId).toBeTruthy();
    expect(createdGoal.fundingDirective).toMatchObject({
      fundingAccountName: personalFundingAccount,
      fundingAccountBalanceCents: 123400,
      remainingAmountCents: 876600,
    });
    const goalCard = page.locator(`article:has-text("${goalName}")`);
    await expect(goalCard).toBeVisible();
    await expect(goalCard.getByLabel('Funding directive')).toContainText(
      'Fund monthly:'
    );
    await expect(goalCard.getByLabel('Funding directive')).toContainText(
      personalFundingAccount
    );
    await page
      .locator(`article:has-text("${goalName}")`)
      .getByRole('button', { name: 'Remove' })
      .click();
    await expect(page.getByText('Delete this goal?')).toBeVisible();
    await page
      .locator(`article:has-text("${goalName}")`)
      .getByRole('button', { name: 'Confirm remove' })
      .click();
    await expect(page.locator(`article:has-text("${goalName}")`)).toHaveCount(
      0
    );

    await page.goto(`${routes.plansPath}/${planId}/scenarios`, {
      waitUntil: 'networkidle',
    });
    await expect(page).toHaveURL(
      new RegExp(`${routes.plansPath}/${planId}/scenarios$`)
    );
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
    await expect(page.getByText('Delete this scenario?')).toBeVisible();
    await page
      .locator(`article:has-text("${scenarioName}")`)
      .getByRole('button', { name: 'Confirm remove' })
      .click();
    await expect(
      page.locator(`article:has-text("${scenarioName}")`)
    ).toHaveCount(0);

    await page.goto(`${routes.plansPath}/${planId}/imports`, {
      waitUntil: 'networkidle',
    });
    await expect(page).toHaveURL(
      new RegExp(`${routes.plansPath}/${planId}/imports$`)
    );
    await expect(
      page.getByRole('heading', {
        name: 'Transaction intake and reconciliation',
      })
    ).toBeVisible();
    await page.getByLabel('Workspace').selectOption('business');
    await expect(page.getByLabel('Account').locator('option')).not.toHaveCount(
      0
    );
    await page.getByRole('button', { name: 'Preview import' }).click();
    await expect(page.getByText('Preview ready: 1 transaction.')).toBeVisible();
    await page.getByRole('button', { name: 'Commit preview' }).click();
    await expect(
      page.getByText(
        'About to write 1 transactions to the selected account. This cannot be undone from here.'
      )
    ).toBeVisible();
    await expectResponseOk(
      page,
      (response) =>
        response.url().includes('/api/finance/transaction') &&
        response.request().method() === 'POST',
      async () => {
        await page.getByRole('button', { name: 'Confirm commit (1)' }).click();
      }
    );
    await expect(
      page.getByText('Committed 1 imported transactions.')
    ).toBeVisible();

    await page.goto(`${routes.accountsPath}/business/transactions`, {
      waitUntil: 'networkidle',
    });
    await page.locator('otui-ag-grid').scrollIntoViewIfNeeded();
    await expect(
      page
        .locator('.ag-center-cols-container .ag-row')
        .filter({ hasText: 'Neighborhood Market' })
    ).toBeVisible();
    logDiagnosticsCheckpoint('after-import-verification', diagnostics);

    await logRuntimeBundleContext(page, diagnostics);
    expectNoBrowserErrors(diagnostics);
  });
});
