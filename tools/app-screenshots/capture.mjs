#!/usr/bin/env node
// Usage: node tools/app-screenshots/capture.mjs --app <name> [--out /tmp/app-review]
//        [--dist <dir>] [--gateway http://127.0.0.1:PORT] [--routes /a,/b]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { APPS } from './apps.mjs';
import { renderedContrastFailures } from './contrast.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (a, v, i, all) =>
        v.startsWith('--')
          ? [
              ...a,
              [
                v.slice(2),
                all[i + 1] === undefined || all[i + 1].startsWith('--')
                  ? true
                  : all[i + 1],
              ],
            ]
          : a,
      []
    )
);
const repo = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..'
);
const app = args.app;
if (!app) {
  console.error(
    'usage: capture.mjs --app <name> [--out dir] [--dist dir] [--gateway url] [--routes /a,/b]'
  );
  process.exit(2);
}
const cfg = APPS[app] ?? {
  routes: ['/'],
  skipped: ['(no entry in apps.mjs: only / captured)'],
};
const live = Boolean(args.live || args['base-url']);
const authRoutes = live && !args['no-login'] && cfg.login ? cfg.auth ?? [] : [];
const routes = args.routes
  ? args.routes.split(',')
  : [...cfg.routes, ...authRoutes];
const isAuth = (r) => authRoutes.includes(r);
const outDir = path.join(path.resolve(args.out ?? '/tmp/app-review'), app);
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir))
  if (f.endsWith('.png')) fs.rmSync(path.join(outDir, f));

// --- dist ---
let root = args.dist && path.resolve(args.dist);
if (!root && !live) {
  const c = [`dist/apps/${app}/browser`, `dist/apps/${app}`].map((p) =>
    path.join(repo, p)
  );
  root = c.find(
    (p) =>
      fs.existsSync(path.join(p, 'index.html')) ||
      fs.existsSync(path.join(p, 'index.csr.html'))
  );
}
if (!root && !live)
  throw new Error(`no build for ${app}; run: nx build ${app} -c development`);

// --- gateway: a running container whose name contains "gateway" ---
function detectGateway() {
  if (args.gateway) return args.gateway;
  try {
    const rows = execSync(`docker ps --format '{{.Names}}|{{.Ports}}'`, {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((l) => /gateway/i.test(l.split('|')[0]));
    for (const r of rows) {
      const m = r.split('|')[1].match(/(?:0\.0\.0\.0|\[::\]):(\d+)->3000/);
      if (m) return `http://127.0.0.1:${m[1]}`;
    }
  } catch {}
  return null;
}
const gateway = detectGateway();
console.log(
  `${live ? 'live' : 'dist: ' + root}\ngateway: ${
    gateway ?? 'NOT RUNNING (API calls will 502)'
  }`
);

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
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
};
const API = /^\/(api|admin-api|socket\.io|chat|social)(\/|$|\?)/;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (API.test(u.pathname + u.search)) {
    if (!gateway) return res.writeHead(502).end('gateway not running');
    const g = new URL(gateway);
    const p = http.request(
      {
        host: g.hostname,
        port: g.port,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: g.host },
      },
      (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      }
    );
    p.on('error', () => res.writeHead(502).end('gateway unreachable'));
    return req.pipe(p);
  }
  let file = path.join(root, decodeURIComponent(u.pathname));
  if (
    file.startsWith(root) &&
    fs.existsSync(file) &&
    fs.statSync(file).isDirectory()
  )
    file = path.join(file, 'index.html');
  if (
    !file.startsWith(root) ||
    !fs.existsSync(file) ||
    fs.statSync(file).isDirectory()
  ) {
    if (path.extname(u.pathname)) return res.writeHead(404).end();
    file = ['index.csr.html', 'index.html']
      .map((f) => path.join(root, f))
      .find(fs.existsSync);
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
  });
  fs.createReadStream(file).pipe(res);
});
let base;
if (live) {
  base = String(args['base-url'] ?? cfg.url ?? '').replace(/\/$/, '');
  if (!base) throw new Error(`no url for ${app}; pass --base-url`);
} else {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
}

const KEY = 'optimistic-tanuki-personality-theme';
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};
const slug = (r) =>
  r === '/' ? 'home' : r.replace(/^\//, '').replace(/[^\w]+/g, '-');
const browser = await chromium.launch();

async function newCtx(vp, mode, seed, storageState) {
  const ctx = await browser.newContext({
    ...(storageState
      ? {
          storageState: {
            cookies: storageState.cookies,
            origins: storageState.origins,
          },
        }
      : {}),
    viewport: VIEWPORTS[vp],
    colorScheme: mode,
    reducedMotion: 'reduce',
    isMobile: vp === 'mobile',
    deviceScaleFactor: 1,
  });
  if (seed)
    await ctx.addInitScript(
      ([k, v]) => {
        try {
          if (!localStorage.getItem('__seeded')) {
            localStorage.setItem(k, v);
            localStorage.setItem('__seeded', '1');
          }
        } catch {}
      },
      [KEY, seed]
    );
  if (storageState?.sessionStorage && storageState.sessionStorage !== '{}')
    await ctx.addInitScript((j) => {
      try {
        for (const [k, v] of Object.entries(JSON.parse(j)))
          sessionStorage.setItem(k, v);
      } catch {}
    }, storageState.sessionStorage);
  if (gateway) {
    await ctx.route('http://localhost:3000/**', (route) => {
      const u = new URL(route.request().url());
      route.continue({ url: gateway + u.pathname + u.search });
    });
  }
  return ctx;
}

async function readTheme(page) {
  return page.evaluate((k) => {
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(k));
    } catch {}
    const cls = [
      ...document.body.classList,
      ...document.documentElement.classList,
    ].find((c) => c.startsWith('personality-'));
    const cs = getComputedStyle(document.documentElement);
    return {
      stored,
      personalityClass: cls ? cls.replace('personality-', '') : null,
      dataPersonality:
        document.documentElement.getAttribute('data-personality'),
      dataMode: document.documentElement.getAttribute('data-mode'),
      primary: cs.getPropertyValue('--primary').trim(),
    };
  }, KEY);
}

// Some apps scroll the body or an inner container instead of the document, so
// a fullPage shot only captures the first screen. Neutralise every scroller
// that is clipping content, then report the resulting page height.
async function expandScrollers(page) {
  return page.evaluate(() => {
    const before = document.documentElement.scrollHeight;
    const st = document.createElement('style');
    st.textContent =
      'html,body{height:auto !important;min-height:0 !important;overflow:visible !important}';
    document.head.appendChild(st);
    const fixed = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (
        /(auto|scroll)/.test(cs.overflowY) &&
        el.scrollHeight > el.clientHeight + 40 &&
        el.clientHeight > 200
      ) {
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('max-height', 'none', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
        fixed.push(
          el.tagName.toLowerCase() +
            (el.className && typeof el.className === 'string'
              ? '.' + el.className.split(/\s+/)[0]
              : '')
        );
      }
    }
    return {
      before,
      after: Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      ),
      expanded: fixed.slice(0, 5),
    };
  });
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

// Fills and submits the app's own login form; resolves to the login POST response.
async function formLogin(page) {
  const L = cfg.login;
  await page.goto(base + L.route);
  await settle(page);
  const email = page
    .locator(
      L.emailSel ??
        'input[type="email"], input[name*="email" i], input[formcontrolname*="email" i], input[autocomplete="username"], input[placeholder*="email" i], input[type="text"]'
    )
    .first();
  await email.fill(L.email, { timeout: 8000 });
  await page.locator('input[type="password"]').first().fill(L.password);
  let submit = page.locator(L.submitSel ?? 'button[type="submit"]').first();
  if (!L.submitSel && !(await submit.count()))
    submit = page
      .locator(
        'button:has-text("Log in"), button:has-text("Login"), button:has-text("Sign in")'
      )
      .first();
  const [resp] = await Promise.all([
    page
      .waitForResponse(
        (r) =>
          /login|sign-?in|auth/i.test(r.url()) &&
          r.request().method() === 'POST',
        { timeout: 10000 }
      )
      .catch(() => null),
    submit.click(),
  ]);
  return resp;
}

// Logs in through the app's own login form with a seeded account and returns
// Playwright storageState (cookies + localStorage) minus the theme keys.
async function login() {
  const L = cfg.login;
  const ctx = await newCtx('desktop', 'light');
  const page = await ctx.newPage();
  const result = { ok: false, account: L.email, note: '' };
  try {
    const resp = await formLogin(page);
    await settle(page);
    await page.waitForTimeout(1500);
    const status = resp?.status() ?? 0;
    const stillLogin = page.url().includes(L.route.split('?')[0]);
    // Some apps stay on /login after a successful POST (no profile yet), so the
    // API status decides; the URL is only reported.
    result.ok = status >= 200 && status < 300;
    result.note = `login POST ${status}; after login: ${
      page.url().replace(base, '') || '/'
    }${stillLogin ? ' (still on login route)' : ''}`;
    result.sessionStorage = await page.evaluate(() =>
      JSON.stringify({ ...sessionStorage })
    );
    const state = await ctx.storageState();
    for (const o of state.origins)
      o.localStorage = o.localStorage.filter(
        (i) => i.name !== KEY && i.name !== '__seeded'
      );
    result.state = state;
  } catch (e) {
    result.note = `login error: ${e.message.split('\n')[0]}`;
  }
  await ctx.close();
  return result;
}

// 1. Discover the app's default personality with a clean profile.
let seedBase = null;
let defaults = null;
{
  const ctx = await newCtx('desktop', 'light');
  const page = await ctx.newPage();
  await page.goto(base + routes[0]);
  await settle(page);
  defaults = await readTheme(page);
  seedBase = defaults.stored;
  await ctx.close();
}
const personalityId =
  defaults.stored?.personalityId ??
  defaults.personalityClass ??
  defaults.dataPersonality ??
  'unknown';
// Apps that never persist a theme still have a default primary colour, set in
// their ThemeService defaults; use it so seeding the mode changes nothing else.
function appDefaultPrimary() {
  try {
    const out = execSync(
      `grep -rhoE "primaryColor:\\s*'#[0-9a-fA-F]{3,8}'" ${path.join(
        repo,
        'apps',
        app,
        'src'
      )} --include=*.ts --exclude=*.spec.ts`,
      { encoding: 'utf8' }
    );
    return out.match(/#[0-9a-fA-F]{3,8}/)?.[0];
  } catch {
    return null;
  }
}
if (!seedBase && defaults.personalityClass) {
  seedBase = {
    personalityId: defaults.personalityClass,
    primaryColor: appDefaultPrimary() ?? '#3f51b5',
    version: '1.0.0',
  };
}
if (args.personality && seedBase) {
  seedBase = { ...seedBase, personalityId: args.personality };
}
console.log(
  `default personality: ${personalityId} (stored=${!!defaults.stored}, seed primary=${
    seedBase?.primaryColor
  })`
);

let loginResult = null;
if (authRoutes.length) {
  loginResult = await login();
  console.log(
    `login ${loginResult.account}: ${loginResult.ok ? 'OK' : 'FAILED'} ${
      loginResult.note
    }`
  );
}
const meta = {
  app,
  mode: live ? 'live' : 'dist',
  login: loginResult
    ? {
        account: loginResult.account,
        ok: loginResult.ok,
        note: loginResult.note,
      }
    : null,
  modeNote: cfg.modeNote ?? null,
  base,
  gateway,
  root,
  personality: personalityId,
  defaultTheme: defaults,
  skippedAuthRoutes: cfg.skipped,
  shots: [],
};

for (const route of routes) {
  for (const mode of ['light', 'dark']) {
    for (const vp of ['desktop', 'mobile']) {
      const seed = seedBase ? JSON.stringify({ ...seedBase, mode }) : null;
      const authed = isAuth(route) && loginResult?.ok;
      if (isAuth(route) && !authed) continue;
      const ctx = await newCtx(
        vp,
        mode,
        seed,
        authed ? loginResult.state : undefined
      );
      const page = await ctx.newPage();
      const consoleErrors = [];
      const failedRequests = [];
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
      });
      page.on('pageerror', (e) =>
        consoleErrors.push(`pageerror: ${String(e.message).slice(0, 300)}`)
      );
      page.on('response', (r) => {
        if (r.status() >= 400)
          failedRequests.push(
            `${r.status()} ${r.request().method()} ${r
              .url()
              .replace(base, '')}`.slice(0, 200)
          );
      });
      page.on('requestfailed', (r) =>
        failedRequests.push(
          `FAILED ${r.method()} ${r.url().replace(base, '')} ${
            r.failure()?.errorText ?? ''
          }`.slice(0, 200)
        )
      );
      if (authed && cfg.login.inPage) {
        // Auth held in memory: sign in inside this page, then route client-side.
        await formLogin(page).catch((e) =>
          consoleErrors.push(`login: ${e.message}`)
        );
        await settle(page);
        await page.evaluate((r) => {
          history.pushState({}, '', r);
          window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        }, route);
        await page.waitForTimeout(1500);
      } else
        await page
          .goto(base + route)
          .catch((e) => consoleErrors.push(`goto: ${e.message}`));
      await settle(page);
      const finalUrl = page.url().replace(base, '') || '/';
      const applied = await readTheme(page);
      const readability = await page
        .evaluate(renderedContrastFailures)
        .catch((e) => [
          { text: `check failed: ${e.message}`, ratio: 0, min: 0, el: '' },
        ]);
      const file = `${slug(route)}__${mode}__${vp}.png`;
      const expanded = await expandScrollers(page).catch(() => null);
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(outDir, file),
        fullPage: true,
        animations: 'disabled',
      });
      const renderedBg = await page.evaluate(() => {
        for (const el of [document.body, document.documentElement]) {
          const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
          if (m && (m[3] === undefined || +m[3] > 0.5)) {
            const [r, g, b] = m.slice(0, 3).map(Number);
            return {
              rgb: `rgb(${r},${g},${b})`,
              luminance: +(
                (0.2126 * r + 0.7152 * g + 0.0722 * b) /
                255
              ).toFixed(3),
            };
          }
        }
        return { rgb: 'transparent', luminance: null };
      });
      const bodyText = await page.evaluate(
        () => document.body.innerText.trim().length
      );
      meta.shots.push({
        route,
        url: base + route,
        finalRoute: finalUrl,
        redirected: finalUrl.split('?')[0] !== route,
        file,
        mode,
        viewport: vp,
        personality:
          applied.stored?.personalityId ??
          applied.personalityClass ??
          applied.dataPersonality,
        modeApplied: applied.dataMode,
        loggedIn: Boolean(authed),
        pageHeight: expanded,
        renderedBackground: renderedBg,
        renderedMode:
          renderedBg.luminance === null
            ? 'unknown'
            : renderedBg.luminance < 0.4
            ? 'dark'
            : 'light',
        bodyTextLength: bodyText,
        consoleErrors: [...new Set(consoleErrors)],
        failedRequests: [...new Set(failedRequests)],
        readabilityFailures: readability.slice(0, 60),
        readabilityFailureCount: readability.length,
      });
      console.log(
        `${file}  mode=${applied.dataMode} pers=${applied.personalityClass} ->${finalUrl} text=${bodyText} contrast=${readability.length} err=${consoleErrors.length} req=${failedRequests.length}`
      );
      await ctx.close();
    }
  }
}
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
await browser.close();
server.close();
process.exit(0);
