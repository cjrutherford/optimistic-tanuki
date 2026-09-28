import { test, expect } from '@playwright/test';
import * as crypto from 'crypto';

const escrowToken = process.env.LIVE_ESCROW_TOKEN || '';
const rfcSecret = process.env.LIVE_RFC_SECRET || '';
const dropToken = process.env.LIVE_DROP_TOKEN || '';

test.skip(!escrowToken || !rfcSecret || !dropToken, 'live tokens required');

const rfcCode = (base32Secret: string): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32Secret.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));
  const hmac = crypto
    .createHmac('sha1', Buffer.from(bytes))
    .update(buffer)
    .digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 1000000).toString().padStart(6, '0');
};

test('live escrow reveal shows real decrypted wire details, then locks', async ({
  page,
}) => {
  await page.goto(`/escrow-verify/${escrowToken}`);
  await expect(page.getByText('CALL BEFORE YOU WIRE')).toBeVisible();
  await expect(page.locator('.wire-revealed-card')).toHaveCount(0);

  await page.getByLabel('Enter 6-digit rolling code').fill(rfcCode(rfcSecret));
  await page.getByRole('button', { name: 'Decrypt wire details' }).click();

  await expect(page.locator('.wire-revealed-card')).toBeVisible();
  await expect(page.getByText('061000104')).toBeVisible();

  await page.getByRole('button', { name: 'Re-encrypt instructions' }).click();
  await expect(page.locator('.wire-revealed-card')).toHaveCount(0);
});

test('live drop without ClamAV fails closed in the browser', async ({
  page,
}) => {
  await page.goto(`/drop/${dropToken}`);
  const zone = page.locator('.otui-drop-zone');
  await expect(zone).toBeVisible();
  await zone.locator('input[type="file"]').setInputFiles({
    name: 'live-note.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('live browser drop content'),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.audit-receipt-card')).toHaveCount(0);
});

test('live compliance without staff auth shows the auth state', async ({
  page,
}) => {
  await page.goto('/admin/compliance');
  await expect(page.getByTestId('staff-auth-error')).toBeVisible();
  await expect(page.getByText('VERIFIED INTACT')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
});
