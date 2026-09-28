#!/usr/bin/env node
// Usage: node capture.mjs --storybook <static-dir> --out <dir> [--story <id>] [--only <personalityId>]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (a, v, i, all) =>
        v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a,
      []
    )
);
if (!args.storybook || !args.out) {
  console.error(
    'usage: capture.mjs --storybook <static-dir> --out <dir> [--story <id>] [--only <personalityId>]'
  );
  process.exit(2);
}
const STORY = args.story ?? 'common-ui-theme-personality-showcase--showcase';
const MODES = ['light', 'dark'];
// Storybook globals: personalityId, colorMode, primaryColor. Stills cover every
// primary in PRIMARIES; focus shots and motion clips use the first (indigo).
const FOCUS_COUNT = 12;
const CLIP_MS = 3000;
const root = path.resolve(args.storybook);
const out = path.resolve(args.out);
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  const p = path.join(
    root,
    decodeURIComponent(new URL(req.url, 'http://x').pathname)
  );
  const file =
    fs.existsSync(p) && fs.statSync(p).isDirectory()
      ? path.join(p, 'index.html')
      : p;
  if (!file.startsWith(root) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// Personality ids come from the built storybook's own globalTypes, so they cannot drift.
const browser = await chromium.launch();
async function personalityIds() {
  const page = await browser.newPage();
  await page.goto(`${base}/iframe.html?id=${STORY}&viewMode=story`);
  await page.waitForFunction(
    () =>
      window.__STORYBOOK_PREVIEW__?.storeInitializationPromise ||
      window.__STORYBOOK_PREVIEW__
  );
  const ids = await page.evaluate(async () => {
    const p = window.__STORYBOOK_PREVIEW__;
    await p.storeInitializationPromise;
    const g =
      p.storyStoreValue.projectAnnotations.globalTypes.personalityId.toolbar
        .items;
    return g.map((i) => i.value);
  });
  await page.close();
  return ids;
}
let ids = await personalityIds();
if (args.only) ids = ids.filter((i) => i === args.only);
if (ids.length === 0) throw new Error('no personalities found');

const fontIssues = new Set();
const PRIMARIES = ['3f51b5', 'd97706', '0d9488'];
const url = (pid, mode, primary = PRIMARIES[0]) =>
  `${base}/iframe.html?id=${STORY}&viewMode=story&globals=personalityId:${pid};colorMode:${mode};primaryColor:!hex(${primary})`;

async function settle(page, label) {
  await page.waitForFunction(
    () =>
      document.body.classList.contains('sb-show-main') &&
      !document.body.classList.contains('sb-show-errordisplay') &&
      document.querySelector('#storybook-root')?.children.length > 0,
    null,
    { timeout: 30000 }
  );
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  // fonts assertion
  const info = await page.evaluate(async () => {
    const links = [
      ...document.querySelectorAll('link[href*="fonts.googleapis"]'),
    ].map((l) => l.href);
    const bad = [...document.fonts]
      .filter((f) => f.status === 'error')
      .map((f) => f.family);
    return { links, bad };
  });
  for (const href of info.links) {
    const r = await page.request.get(href);
    if (r.status() !== 200)
      fontIssues.add(`${label}: ${href} -> ${r.status()}`);
  }
  if (info.bad.length)
    fontIssues.add(
      `${label}: font faces in error state: ${info.bad.join(', ')}`
    );
  return info.links.length;
}

let stills = 0,
  focus = 0,
  clips = 0,
  fontLinks = 0;
fs.mkdirSync(path.join(out, 'stills'), { recursive: true });
fs.mkdirSync(path.join(out, 'focus'), { recursive: true });
fs.mkdirSync(path.join(out, 'motion'), { recursive: true });
const ctxOpts = {
  viewport: { width: 1000, height: 700 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
};

const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();
for (const pid of ids) {
  for (const mode of MODES) {
    const label = `${pid}/${mode}`;
    for (const primary of PRIMARIES) {
      await page.goto(url(pid, mode, primary));
      fontLinks += await settle(page, `${label}/${primary}`);
      await page.screenshot({
        path: path.join(out, 'stills', `${pid}__${mode}__${primary}.png`),
        animations: 'disabled',
      });
      stills++;
    }
    // focus pass: Tab through focusables, screenshot each focused element
    await page.goto(url(pid, mode));
    await settle(page, label);
    await page.evaluate(() => document.activeElement?.blur());
    for (let i = 0; i < FOCUS_COUNT; i++) {
      await page.keyboard.press('Tab');
      const handle = await page.evaluateHandle(() => {
        let a = document.activeElement;
        while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
        return a && a !== document.body ? a : null;
      });
      const el = handle.asElement();
      if (!el) break;
      const box = await el.boundingBox();
      if (!box) continue;
      const clip = {
        x: Math.max(0, box.x - 8),
        y: Math.max(0, box.y - 8),
        width: box.width + 16,
        height: box.height + 16,
      };
      await page.screenshot({
        path: path.join(
          out,
          'focus',
          `${pid}__${mode}__${String(i).padStart(2, '0')}.png`
        ),
        clip,
        animations: 'disabled',
      });
      focus++;
    }
  }
}
await ctx.close();

// motion: one clip per personality, light mode
for (const pid of ids) {
  const tmp = path.join(out, 'motion', `.tmp-${pid}`);
  const c = await browser.newContext({
    ...ctxOpts,
    recordVideo: { dir: tmp, size: { width: 1000, height: 700 } },
  });
  const p = await c.newPage();
  await p.goto(url(pid, 'light'));
  await settle(p, `${pid}/motion`);
  await p.mouse.move(120, 120);
  await p.keyboard.press('Tab');
  await p.waitForTimeout(CLIP_MS);
  const v = p.video();
  await c.close();
  fs.renameSync(await v.path(), path.join(out, 'motion', `${pid}__light.webm`));
  fs.rmSync(tmp, { recursive: true, force: true });
  clips++;
}
await browser.close();
server.close();

console.log(
  `personalities=${ids.length} stills=${stills} focus=${focus} motion=${clips} googleFontLinks=${fontLinks}`
);
if (fontIssues.size) {
  console.error('FONT ASSERTION FAILED:\n' + [...fontIssues].join('\n'));
  process.exit(1);
}
console.log(
  fontLinks
    ? 'fonts: OK (stylesheets 200, no errored faces)'
    : 'fonts: OK (no Google Fonts links; no errored faces)'
);
