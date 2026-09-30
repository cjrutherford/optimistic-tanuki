import { test, expect } from '@playwright/test';

/**
 * Bug-report chain slice (unauthenticated, nonce-secured).
 * Requires live stack (SKIP_SETUP=true): gateway proxies /api/bug-reports/*
 * to the bug-report service. No auth headers are sent at any step.
 */
test.describe('Bug report (unauthenticated nonce flow)', () => {
  test('issues a nonce without auth', async ({ request }) => {
    const res = await request.get('/api/bug-reports/nonce');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(body.expiresAt).toBeTruthy();
  });

  test('rejects submit with invalid nonce', async ({ request }) => {
    const res = await request.post('/api/bug-reports', {
      data: {
        nonce: '0'.repeat(64),
        description: 'e2e probe',
        pageUrl: '/login',
        userAgent: 'playwright',
        browserLogs: [],
        backendTraceIds: [],
        screenshotDataUrl: 'data:image/jpeg;base64,/9j/',
        occurredAt: new Date().toISOString(),
      },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('report button is visible on the login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await expect(
      page.getByRole('button', { name: /report a bug/i })
    ).toBeVisible();
  });
});
