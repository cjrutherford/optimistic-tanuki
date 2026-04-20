import { test } from '@playwright/test';
import { expectRedirectsToLogin } from './helpers/local-hub-api';

test.describe('Protected routes - server-side authentication', () => {
  for (const path of [
    '/account',
    '/seller-dashboard',
    '/messages',
    '/messages/new',
    '/city/test/classifieds/new',
    '/c/test/classifieds/new',
  ]) {
    test(`redirects ${path} to login`, async ({ page }) => {
      await expectRedirectsToLogin(page, path);
    });
  }
});
