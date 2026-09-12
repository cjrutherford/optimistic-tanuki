import { expect, Page, test as base } from '@playwright/test';

import { getOwnerStorageStatePath } from '../../global-setup';

export const test = base.extend<{ ownerPage: Page }>({
  ownerPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      baseURL: process.env['BASE_URL'] || 'http://127.0.0.1:8094',
      storageState: getOwnerStorageStatePath(),
    });
    await context.addInitScript(() => {
      sessionStorage.setItem('business-site:session-kind', 'owner');
    });

    try {
      await use(await context.newPage());
    } finally {
      await context.close();
    }
  },
});

export { expect };
