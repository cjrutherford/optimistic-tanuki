#!/usr/bin/env node
// Usage: node tools/app-screenshots/selector.mjs [--out /tmp/app-review-live]
// Opens the personality selector as a user would and screenshots it to
// <out>/_selector/<app>__<mode>__<viewport>.png (desktop light+dark, mobile light).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { APPS } from './apps.mjs';
const { chromium } = createRequire(import.meta.url)('@playwright/test');
const i = process.argv.indexOf('--out');
const out = path.join(
  path.resolve(i > 0 ? process.argv[i + 1] : '/tmp/app-review-live'),
  '_selector'
);
fs.mkdirSync(out, { recursive: true });
const KEY = 'optimistic-tanuki-personality-theme';
const VP = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};
const SHOTS = [
  ['light', 'desktop'],
  ['dark', 'desktop'],
  ['light', 'mobile'],
];

// how = header "Appearance" control -> "<personality> gear" button -> modal, or the settings page's inline selector
const TARGETS = {
  'client-interface': { how: 'overlay' },
  'local-hub': { how: 'overlay' },
  forgeofwill: { how: 'settings', path: '/settings' },
};
const browser = await chromium.launch();
const notes = {};
for (const [app, t] of Object.entries(TARGETS)) {
  const cfg = APPS[app];
  // learn default theme
  let seed = null;
  {
    const c = await browser.newContext();
    const p = await c.newPage();
    await p.goto(cfg.url);
    await p.waitForTimeout(2500);
    seed = await p.evaluate((k) => {
      try {
        const s = JSON.parse(localStorage.getItem(k));
        if (s) return s;
      } catch {}
      const cls = [...document.body.classList].find((c) =>
        c.startsWith('personality-')
      );
      return {
        personalityId: cls?.replace('personality-', '') ?? 'classic',
        primaryColor: '#3f51b5',
        version: '1.0.0',
      };
    }, KEY);
    await c.close();
  }
  for (const [mode, vp] of SHOTS) {
    const ctx = await browser.newContext({
      viewport: VP[vp],
      colorScheme: mode,
      isMobile: vp === 'mobile',
      reducedMotion: 'reduce',
    });
    await ctx.addInitScript(
      ([k, v]) => {
        if (!localStorage.getItem('__s')) {
          localStorage.setItem(k, v);
          localStorage.setItem('__s', '1');
        }
      },
      [KEY, JSON.stringify({ ...seed, mode })]
    );
    const page = await ctx.newPage();
    const file = path.join(out, `${app}__${mode}__${vp}.png`);
    try {
      if (t.how === 'settings') {
        await page.goto(cfg.url + cfg.login.route);
        await page.waitForTimeout(2000);
        await page
          .locator(
            'input[type="email"], input[name*="email" i], input[type="text"]'
          )
          .first()
          .fill(cfg.login.email);
        await page
          .locator('input[type="password"]')
          .first()
          .fill(cfg.login.password);
        await page
          .locator(
            'button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")'
          )
          .first()
          .click();
        await page.waitForTimeout(3000);
        await page.goto(cfg.url + t.path);
        await page.waitForTimeout(3000);
        const sel = page.locator('lib-personality-selector').first();
        await sel.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
        await page.screenshot({ path: file });
      } else {
        await page.goto(cfg.url);
        await page.waitForTimeout(2500);
        await page
          .locator('button', { hasText: /appearance/i })
          .first()
          .click();
        await page.waitForTimeout(800);
        // the overlay lists the current personality as a button; it opens the full picker
        await page
          .locator('lib-appearance-menu-overlay button, [role=dialog] button')
          .filter({ hasText: /[a-z]{3}/i })
          .filter({ hasNotText: /light|dark|close/i })
          .first()
          .click()
          .catch(() => {});
        await page.waitForTimeout(1500);
        await page.screenshot({ path: file });
      }
      notes[`${app}__${mode}__${vp}`] = 'ok';
    } catch (e) {
      notes[`${app}__${mode}__${vp}`] = 'FAILED ' + e.message.split('\n')[0];
    }
    await ctx.close();
  }
}
notes['christopherrutherford-net'] =
  'no personality selector exposed (nav drawer only lists pages)';
fs.writeFileSync(path.join(out, 'notes.json'), JSON.stringify(notes, null, 2));
console.log(notes);
await browser.close();
