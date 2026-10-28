/** U03: rebuilt OT/TS UI over real guarded HTTP/TCP and all twelve owners.
 * Only unrelated shell/profile display reads are controlled; account rights,
 * session validation, archives and deletion receipts always hit the private stack. */
import {
  chromium,
  Browser,
  BrowserContext,
  Page,
  expect,
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export class U03BrowserControls {
  private browser!: Browser;
  private contexts: BrowserContext[] = [];
  private pages = new Map<string, Page>();
  readonly evidence: Record<string, unknown>[] = [];
  receipt = '';
  constructor(
    private readonly root: string,
    private readonly accountId: string,
    private readonly profileIds: string[],
    private readonly tokens: Record<string, string>
  ) {}

  async openAndExport() {
    this.browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const [app, port, key, profileId, path] of [
      ['client-interface', 19080, 'ownOt', this.profileIds[1], '/settings'],
      ['local-hub', 19081, 'ownTs', this.profileIds[0], '/account'],
    ] as const) {
      const origin = `http://127.0.0.1:${port}`;
      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 900 },
        acceptDownloads: true,
      });
      this.contexts.push(context);
      await context.addCookies([
        {
          name: 'ot_session',
          value: this.tokens[key],
          url: origin,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      await context.route('**/api/**', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith('/api/authentication/'))
          return route.continue();
        const p = {
          id: profileId,
          userId: this.accountId,
          appScope: app,
          profileName: 'OWN_PRIVATE',
          name: 'OWN_PRIVATE',
        };
        if (url.pathname === '/api/profile')
          return route.fulfill({ json: [p] });
        if (/\/profile\/(?:me|by-id\/[^/]+|[0-9a-f-]+)$/.test(url.pathname))
          return route.fulfill({ json: p });
        return route.fulfill({ json: [] });
      });
      const session = await context.request.get(
        origin + '/api/authentication/session'
      );
      expect(session.status()).toBe(200);
      expect((await session.json()).data.userId).toBe(this.accountId);
      const page = await context.newPage();
      page.on('response', (response) => {
        const path = new URL(response.url()).pathname;
        if (path.startsWith('/api/authentication/'))
          void appendFile(
            join(this.root, 'u03-http.ndjson'),
            JSON.stringify({ app, path, status: response.status() }) + '\n'
          );
      });
      page.on('pageerror', (error) => {
        void appendFile(
          join(this.root, 'u03-page-errors.log'),
          error.name + '\n'
        );
      });

      this.pages.set(app, page);
      await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
      const panel = page.locator('lib-account-rights');
      try {
        await expect(panel).toBeVisible({ timeout: 20000 });
      } catch (error) {
        await page.screenshot({
          path: join(this.root, `u03-${app}-failure.png`),
        });
        await writeFile(
          join(this.root, 'u03-navigation.json'),
          JSON.stringify({ app, url: page.url() })
        );
        throw error;
      }
      await expect(panel).toContainText('OWN_PRIVATE');
      await expect(
        panel.getByRole('button', { name: 'Request export', exact: true })
      ).toBeEnabled();
      await panel
        .getByRole('button', { name: 'Request export', exact: true })
        .click();
      await expect
        .poll(
          async () => {
            const ready = panel.getByRole('button', {
              name: 'Download archive',
              exact: true,
            });
            if ((await ready.isVisible()) && (await ready.isEnabled()))
              return 'ready';
            if (
              await panel
                .getByRole('button', { name: 'Retry export', exact: true })
                .isVisible()
            )
              return 'blocked';
            return 'waiting';
          },
          { timeout: 90000 }
        )
        .not.toBe('waiting');
      await expect(
        panel.getByRole('button', { name: 'Download archive', exact: true })
      ).toBeVisible();
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await panel
        .getByRole('button', { name: 'Download archive', exact: true })
        .click();
      const download = await downloadPromise;
      const file = join(this.root, `u03-${app}.tar`);
      await download.saveAs(file);
      const bytes = await readFile(file);
      expect(bytes.subarray(257, 262).toString()).toBe('ustar');
      expect(bytes.length).toBeGreaterThan(1024);
      // Independent TAR framing and manifest/owner presence, not just HTTP success.
      const entries: string[] = [];
      const contents = new Map<string, Buffer>();
      for (let offset = 0; offset + 512 <= bytes.length; ) {
        const header = bytes.subarray(offset, offset + 512);
        if (header.every((v) => v === 0)) break;
        const name = header.subarray(0, 100).toString().split('\0')[0];
        const size = parseInt(
          header.subarray(124, 136).toString().split('\0')[0].trim(),
          8
        );
        expect(Number.isSafeInteger(size) && size >= 0).toBe(true);
        entries.push(name);
        contents.set(name, bytes.subarray(offset + 512, offset + 512 + size));
        offset += 512 + Math.ceil(size / 512) * 512;
      }
      expect(entries.some((name) => /manifest/.test(name))).toBe(true);
      const manifest = JSON.parse(contents.get('manifest.json')!.toString());
      expect(manifest.accountId).toBe(this.accountId);
      expect(manifest.appId).toBe(app);
      expect(manifest.owners).toHaveLength(12);
      expect(new Set(manifest.owners.map((v: any) => v.owner)).size).toBe(12);
      for (const owner of manifest.owners) {
        const data = contents.get(`owners/${owner.owner}.ndjson`)!;
        expect(data.length).toBe(owner.sizeBytes);
        expect(createHash('sha256').update(data).digest('hex')).toBe(
          owner.sha256
        );
      }

      expect(
        entries.filter((name) => /\.ndjson$/.test(name)).length
      ).toBeGreaterThanOrEqual(12);
      await panel
        .getByRole('button', { name: 'Delete account', exact: true })
        .focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('button', {
          name: 'Permanently delete account',
          exact: true,
        })
      ).toBeDisabled();
      await dialog.getByLabel('Type DELETE to confirm').fill('delete');
      await expect(
        dialog.getByRole('button', {
          name: 'Permanently delete account',
          exact: true,
        })
      ).toBeDisabled();
      const dialogAccessibility = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(dialogAccessibility.violations).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(
        panel.getByRole('button', { name: 'Delete account', exact: true })
      ).toBeFocused();
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        const accessibility = await new AxeBuilder({ page })
          .include('lib-account-rights')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze();
        expect(accessibility.violations).toEqual([]);
        expect(
          await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
        ).toBe(true);
        await panel.screenshot({
          path: join(this.root, `u03-${app}-${width}.png`),
        });
      }
      const stale = await context.request.post(
        origin + '/api/authentication/account-deletion/prepare',
        {
          headers: { 'x-ot-appscope': app },
          data: {
            accountId: '00000000-0000-4000-8000-000000000001',
            idempotencyKey: crypto.randomUUID(),
          },
        }
      );
      expect(stale.status()).toBe(409);
      this.evidence.push({
        app,
        exportBytes: bytes.length,
        entries,
        viewports: [390, 1280],
        keyboardConfirmation: true,
        staleAccountDenied: true,
      });
    }
  }
  async acceptDeletion(): Promise<string> {
    const page = this.pages.get('local-hub')!;
    await page
      .locator('lib-account-rights')
      .getByRole('button', { name: 'Delete account', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByLabel('Type DELETE to confirm')
      .fill('DELETE');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Permanently delete account', exact: true })
      .click();
    await expect(page).toHaveURL(/\/account-deletion\/?$/, { timeout: 20000 });
    this.receipt = await page.evaluate(
      () => sessionStorage.getItem('ot:deletion-receipt:local-hub') ?? ''
    );
    expect(this.receipt.length).toBeGreaterThan(100);
    const payload = JSON.parse(
      Buffer.from(this.receipt.split('.')[0], 'base64url').toString()
    );
    expect(page.url()).not.toContain(this.receipt);
    expect(JSON.stringify(payload)).not.toContain(this.accountId);
    return payload.operationId;
  }
  async retry() {
    const page = this.pages.get('local-hub')!;
    await page
      .getByRole('button', { name: 'Refresh deletion status', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Retry deletion', exact: true })
    ).toBeVisible({ timeout: 20000 });
    await page
      .getByRole('button', { name: 'Retry deletion', exact: true })
      .click();
  }
  async complete() {
    const page = this.pages.get('local-hub')!;
    await page
      .getByRole('button', { name: 'Refresh deletion status', exact: true })
      .click();
    await expect(
      page.locator('lib-account-deletion-status').getByRole('status').first()
    ).toContainText('removed from application storage', {
      timeout: 20000,
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('lib-account-deletion-status').getByRole('status').first()
    ).toContainText('removed from application storage', {
      timeout: 20000,
    });
    await page.evaluate(() =>
      sessionStorage.removeItem('ot:deletion-receipt:local-hub')
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByLabel('Paste your private receipt').fill(this.receipt);
    await page
      .getByRole('button', { name: 'Check saved receipt', exact: true })
      .click();
    await expect(
      page.locator('lib-account-deletion-status').getByRole('status').first()
    ).toContainText('removed from application storage', { timeout: 20000 });
    const accessible = await new AxeBuilder({ page })
      .include('lib-account-deletion-status')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(accessible.violations).toEqual([]);
    await page.screenshot({
      path: join(this.root, 'u03-deletion-complete.png'),
    });
    await page.context().addCookies([
      {
        name: 'ot_session',
        value: this.tokens['other'],
        url: 'http://127.0.0.1:19081',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('lib-account-deletion-status').getByRole('status').first()
    ).toContainText('removed from application storage', {
      timeout: 20000,
    });
    const session = await page
      .context()
      .request.get('http://127.0.0.1:19081/api/authentication/session');
    expect(session.status()).toBe(200);
    expect((await session.json()).data.userId).not.toBe(this.accountId);
    await writeFile(
      join(this.root, 'u03-browser-result.json'),
      JSON.stringify(
        {
          passed: true,
          apps: this.evidence,
          receiptSurvivesRevocationAndReload: true,
          newAccountPreserved: true,
        },
        null,
        2
      )
    );
  }
  async close() {
    for (const context of this.contexts) await context.close();
    await this.browser?.close();
  }
}
