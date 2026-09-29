#!/usr/bin/env node
// Scene presence (motion-ui slices M1.5/M3): is each scene visible, and does it visibly move?
// Usage: node presence.mjs --storybook <static-motion-ui-storybook-dir> [--only <scene>] [--json] [--keep <dir>]
//
// Renders each scene's Default story under its lead personality, light and dark,
// and reports two luminance measures (0-255), the same as the playground's presence.ts:
//   content  mean |lum(frame) - lum(empty frame)| over 4 frames: how much the drawn layers
//            stand out from the scene's own background (empty frame = scene children hidden)
//   motion   mean |lum(t) - lum(t + 1s)|: visible change per second
// Band: content 4-30, motion 0.5-10. Exit 1 if a scene/mode is outside the band.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');
const { PNG } = require(require.resolve('pngjs', {
  paths: [
    process.cwd(),
    ...fs
      .readdirSync(
        path.resolve(import.meta.dirname, '../../node_modules/.pnpm')
      )
      .filter((d) => d.startsWith('pngjs@'))
      .map((d) =>
        path.resolve(
          import.meta.dirname,
          '../../node_modules/.pnpm',
          d,
          'node_modules'
        )
      ),
  ],
}));

/** Each scene under the personality it suits best. */
export const LEAD = {
  'aurora-ribbon': 'classic',
  'glass-fog': 'minimal',
  'murmuration-scene': 'canopy',
  'parallax-grid-warp': 'professional',
  'particle-veil': 'observatory',
  'pulse-rings': 'clay',
  'shimmer-beam': 'bold',
  'signal-mesh': 'control-center',
  'topographic-drift': 'observatory',
  'halftone-tide': 'risograph',
  'star-atlas': 'observatory',
  'ledger-ticker': 'ledger',
  'grid-shift': 'kunsthalle',
  'canopy-dapple': 'canopy',
  'clay-blobs': 'clay',
  'neon-circuit': 'electric',
  'blueprint-scan': 'architect',
  'flock-field': 'canopy',
};
export const BAND = { content: [4, 30], motion: [0.5, 10] };

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
                all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true,
              ],
            ]
          : a,
      []
    )
);
if (!args.storybook) {
  console.error(
    'usage: presence.mjs --storybook <static-dir> [--only <scene>] [--json] [--keep <dir>]'
  );
  process.exit(2);
}
const root = path.resolve(args.storybook);
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
  if (!file.startsWith(root) || !fs.existsSync(file))
    return void res.writeHead(404).end();
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// Scene -> Default story id, from the built index.json (title "Aurora Ribbon" -> aurora-ribbon).
const index = JSON.parse(
  fs.readFileSync(path.join(root, 'index.json'), 'utf8')
);
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const stories = {};
for (const e of Object.values(index.entries ?? index.stories)) {
  if (e.type === 'story' && e.name === 'Default')
    stories[slug(e.title.split('/').pop())] = e.id;
}
const sceneIds = {
  'murmuration-scene': stories['murmuration-scene'] ?? stories['murmuration'],
};
const scenes = Object.keys(LEAD)
  .map((s) => [s, stories[s] ?? sceneIds[s]])
  .filter(([s, id]) => id && (!args.only || args.only === s));
if (!scenes.length) throw new Error('no scene stories found');

const tmp = args.keep
  ? path.resolve(args.keep)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'presence-'));
fs.mkdirSync(tmp, { recursive: true });
const lum = (file) => {
  const { data, width, height } = PNG.sync.read(fs.readFileSync(file));
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++)
    out[i] =
      0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return out;
};
const meanDiff = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};

const browser = await chromium.launch();
const jobs = scenes.flatMap(([scene, id]) =>
  ['light', 'dark'].map((mode) => ({
    scene,
    id,
    mode,
    personality: LEAD[scene],
  }))
);
async function run({ scene, id, mode, personality }) {
  const ctx = await browser.newContext({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  await page.goto(
    `${base}/iframe.html?id=${id}&viewMode=story&globals=personalityId:${personality};colorMode:${mode};primaryColor:!hex(3f51b5)`
  );
  await page.waitForFunction(
    () =>
      document.body.classList.contains('sb-show-main') &&
      document.querySelector('#storybook-root')?.children.length > 0,
    null,
    { timeout: 30000 }
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  const b = path.join(tmp, `${scene}-${mode}`);
  const frames = [];
  for (let i = 0; i < 4; i++) {
    if (i) await page.waitForTimeout(1000);
    await page.screenshot({ path: `${b}-t${i}.png` });
    frames.push(`${b}-t${i}.png`);
  }
  // Empty frame: everything inside the scene root hidden, its own background kept.
  await page.addStyleTag({
    content: `#storybook-root .${scene} > *, #storybook-root .${scene} svg, #storybook-root .${scene} canvas { visibility: hidden !important; }`,
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${b}-blank.png` });
  await ctx.close();
  const f = frames.map(lum);
  const blank = lum(`${b}-blank.png`);
  const content = f.reduce((s, x) => s + meanDiff(x, blank), 0) / f.length;
  const motion =
    f.slice(1).reduce((s, x, i) => s + meanDiff(f[i], x), 0) / (f.length - 1);
  const notes = [];
  for (const [k, v] of [
    ['content', content],
    ['motion', motion],
  ]) {
    if (v < BAND[k][0]) notes.push(`${k} low`);
    if (v > BAND[k][1]) notes.push(`${k} high`);
  }
  return {
    scene,
    personality,
    mode,
    content: +content.toFixed(2),
    motion: +motion.toFixed(2),
    ok: !notes.length,
    notes,
  };
}
const rows = [];
for (let i = 0; i < jobs.length; i += 4)
  rows.push(...(await Promise.all(jobs.slice(i, i + 4).map(run))));
await browser.close();
server.close();
if (!args.keep) fs.rmSync(tmp, { recursive: true, force: true });

rows.sort(
  (a, b) => a.mode.localeCompare(b.mode) || a.scene.localeCompare(b.scene)
);
if (args.json) console.log(JSON.stringify({ band: BAND, rows }));
else {
  for (const mode of ['light', 'dark']) {
    console.log(
      `\n${mode}: band content ${BAND.content.join(
        '-'
      )}  motion ${BAND.motion.join('-')}`
    );
    for (const r of rows.filter((r) => r.mode === mode))
      console.log(
        `  ${r.ok ? 'ok  ' : 'OUT '} ${r.scene.padEnd(
          20
        )} ${r.personality.padEnd(14)} content ${r.content
          .toFixed(2)
          .padStart(6)}  motion ${r.motion
          .toFixed(2)
          .padStart(5)}  ${r.notes.join(', ')}`
      );
  }
  const bad = rows.filter((r) => !r.ok).length;
  console.log(
    bad
      ? `\n${bad} scene/mode combination(s) outside the band`
      : '\nall scenes inside the presence band'
  );
}
process.exit(rows.some((r) => !r.ok) ? 1 : 0);
