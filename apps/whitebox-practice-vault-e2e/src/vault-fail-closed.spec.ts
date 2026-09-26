import { test, expect } from '@playwright/test';

// Fail-closed contract for the Practice Vault SPA served WITHOUT a backend.
// Every route must render a truthful unavailable/locked state and must never
// display fabricated scans, ledgers, wire details, or copilot answers.

test('portal renders without demo-token links', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Practice Vault' })
  ).toBeVisible();
  const body = await page.textContent('body');
  expect(body).not.toContain('demo-cpa-token');
  expect(body).not.toContain('849201');
});

test('drop without a token fails closed', async ({ page }) => {
  await page.goto('/drop');
  await expect(
    page.getByText('Secure document-drop token is required.')
  ).toBeVisible();
  await expect(page.getByText('clean', { exact: false })).toHaveCount(0);
});

test('escrow verify shows callback banner and no wire details before TOTP', async ({
  page,
}) => {
  await page.goto('/escrow-verify/e2e-token-1');
  await expect(page.getByText('CALL BEFORE YOU WIRE')).toBeVisible();
  await expect(page.getByText('verbally confirm')).toBeVisible();
  await expect(page.locator('.wire-revealed-card')).toHaveCount(0);
  await expect(page.locator('.callback-banner')).toBeVisible();
});

test('TOTP modal exposes dialog semantics and closes on Escape', async ({
  page,
}) => {
  await page.goto('/escrow-verify/e2e-token-1');
  await page.getByRole('button', { name: 'Launch TOTP modal' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  for (let digit = 1; digit <= 6; digit += 1) {
    await expect(page.getByLabel(`Digit ${digit} of 6`)).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('compliance ledger shows unavailable state, never fabricated rows', async ({
  page,
}) => {
  await page.goto('/admin/compliance');
  await expect(
    page.getByText('Ledger unavailable. No audit records are displayed.')
  ).toBeVisible();
  await expect(page.getByText('VERIFIED INTACT')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Export JSON' })
  ).toBeDisabled();
  const body = await page.textContent('body');
  expect(body).not.toContain('IRS-Form-1040-Client.pdf');
});

test('drop zone is keyboard operable', async ({ page }) => {
  await page.goto('/drop/e2e-token-1');
  const zone = page.locator('.otui-drop-zone');
  await expect(zone).toBeVisible();
  await expect(zone).toHaveAttribute('role', 'button');
  await expect(zone).toHaveAttribute('tabindex', '0');
  await zone.focus();
  await expect(zone).toBeFocused();
});
