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
const STORY = args.story ?? 'common-ui-theme-personality-review--review';
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
const checkedFontLinks = new Set();
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
    if (checkedFontLinks.has(href)) continue;
    // A slow network must not abort the whole capture: retry, then record it.
    let status = 'no response';
    for (let attempt = 0; attempt < 3 && status !== 200; attempt++) {
      try {
        status = (await page.request.get(href, { timeout: 15000 })).status();
      } catch (e) {
        status = e.name ?? 'error';
      }
    }
    checkedFontLinks.add(href);
    if (status !== 200) fontIssues.add(`${label}: ${href} -> ${status}`);
  }
  if (info.bad.length)
    fontIssues.add(
      `${label}: font faces in error state: ${info.bad.join(', ')}`
    );
  return info.links.length;
}

const labels = {};
const colors = {};
const rendered = {};

// Runs in the page. Returns text elements below their WCAG AA ratio.
function renderedContrastFailures() {
  // Any CSS colour (rgb, oklab, oklch, hsl, color-mix results...) to
  // [r, g, b, a] via a 1x1 canvas, which Chromium converts to sRGB.
  const ctx = Object.assign(document.createElement('canvas'), {
    width: 1,
    height: 1,
  }).getContext('2d', { willReadFrequently: true });
  const parse = (c) => {
    if (!c || c === 'transparent') return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = (fg, bg) =>
    fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]));
  const lum = (rgb) =>
    rgb
      .map((c) => c / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  // The backgrounds behind `el`: composited background colours, or, when a
  // gradient paints first, each of its colour stops (text is judged against
  // its worst stop).
  const backgrounds = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage.includes('gradient')) {
        const stops = [
          ...cs.backgroundImage.matchAll(
            /(?:rgba?|oklab|oklch|lab|lch|hsla?|color)\([^()]*\)/g
          ),
        ]
          .map((m) => parse(m[0]))
          .filter(Boolean);
        if (stops.length) {
          // What the gradient is painted over: its own background colour,
          // then its ancestors'.
          const under = [];
          for (let u = e; u; u = u.parentElement) {
            const c = parse(getComputedStyle(u).backgroundColor);
            if (c && c[3] > 0) {
              under.push(c);
              if (c[3] >= 1) break;
            }
          }
          let base = [255, 255, 255];
          for (const c of under.reverse()) base = over(c, base);
          // Each stop over that base (a transparent stop is the base showing
          // through), then the translucent layers above the gradient.
          return stops
            .map((stop) => over(stop, base))
            .map((bg) => {
              for (const c of layers.slice().reverse()) bg = over(c, bg);
              return bg;
            });
        }
      }
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) break;
      }
    }
    let bg = [255, 255, 255];
    for (const c of layers.reverse()) bg = over(c, bg);
    return [bg];
  };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || cs.display === 'none' || !rect.width)
      continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const r = Math.min(...backgrounds(el).map((bg) => ratio(over(fg, bg), bg)));
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const min = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    // Disabled controls are exempt from WCAG contrast.
    if (el.closest('[disabled], [aria-disabled="true"]')) continue;
    if (r < min)
      out.push({
        text: text.slice(0, 40),
        el: `${el.tagName.toLowerCase()}${
          el.classList.length
            ? '.' + [...el.classList].slice(0, 2).join('.')
            : ''
        }`,
        ratio: +r.toFixed(2),
        min,
      });
  }
  return out;
}
const COLOR_VARS = [
  '--background',
  '--surface',
  '--foreground',
  '--muted-foreground',
  '--primary',
  '--primary-text',
  '--on-primary',
  '--primary-foreground',
];
let stills = 0,
  focus = 0,
  clips = 0,
  fontLinks = 0;
fs.mkdirSync(path.join(out, 'stills'), { recursive: true });
fs.mkdirSync(path.join(out, 'focus'), { recursive: true });
fs.mkdirSync(path.join(out, 'motion'), { recursive: true });
const ctxOpts = {
  viewport: { width: 1100, height: 900 },
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
        fullPage: true,
        animations: 'disabled',
      });
      stills++;
      // Rendered readability: every visible text element's computed colour
      // against the first opaque background behind it (WCAG: 4.5:1, or 3:1
      // for large text). Measures what is on screen, not theme variables.
      rendered[`stills/${pid}__${mode}__${primary}.png`] = await page.evaluate(
        renderedContrastFailures
      );
      // The colours text is drawn in and on, for the report's readability check.
      colors[`stills/${pid}__${mode}__${primary}.png`] = await page.evaluate(
        (names) => {
          const cs = getComputedStyle(document.documentElement);
          return Object.fromEntries(
            names.map((n) => [n, cs.getPropertyValue(n).trim()])
          );
        },
        COLOR_VARS
      );
    }
    // focus pass: Tab through focusables, screenshot each focused element
    await page.goto(url(pid, mode));
    await settle(page, label);
    await page.evaluate(() => document.activeElement?.blur());
    for (let i = 0; i < FOCUS_COUNT; i++) {
      await page.keyboard.press('Tab');
      // Let focus transitions (box-shadow, outline) finish before the shot.
      await page.waitForTimeout(250);
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
        x: Math.max(0, box.x - 12),
        y: Math.max(0, box.y - 12),
        width: box.width + 24,
        height: box.height + 24,
      };
      // What was focused, for the review report's labels.
      labels[`focus/${pid}__${mode}__${String(i).padStart(2, '0')}.png`] =
        await el.evaluate((e) => {
          const text = (e.getAttribute('aria-label') || e.textContent || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 40);
          return `${e.tagName.toLowerCase()}${text ? ` "${text}"` : ''}`;
        });
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
    recordVideo: { dir: tmp, size: { width: 1100, height: 900 } },
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

const renderedFile = path.join(out, 'rendered-contrast.json');
const priorRendered = fs.existsSync(renderedFile)
  ? JSON.parse(fs.readFileSync(renderedFile, 'utf8'))
  : {};
fs.writeFileSync(
  renderedFile,
  JSON.stringify({ ...priorRendered, ...rendered }, null, 2)
);
const colorsFile = path.join(out, 'colors.json');
const priorColors = fs.existsSync(colorsFile)
  ? JSON.parse(fs.readFileSync(colorsFile, 'utf8'))
  : {};
fs.writeFileSync(
  colorsFile,
  JSON.stringify({ ...priorColors, ...colors }, null, 2)
);
// Merge with labels from earlier --only runs into the same directory.
const labelsFile = path.join(out, 'labels.json');
const prior = fs.existsSync(labelsFile)
  ? JSON.parse(fs.readFileSync(labelsFile, 'utf8'))
  : {};
fs.writeFileSync(labelsFile, JSON.stringify({ ...prior, ...labels }, null, 2));
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
