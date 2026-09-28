#!/usr/bin/env node
// Usage: node compare.mjs <dirA> <dirB> --report <html>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
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

const [a, b] = process.argv
  .slice(2)
  .filter((x, i, all) => !x.startsWith('--') && all[i - 1] !== '--report');
const report = process.argv[process.argv.indexOf('--report') + 1];
if (!a || !b || !report) {
  console.error('usage: compare.mjs <dirA> <dirB> --report <html>');
  process.exit(2);
}

const list = (d, g) =>
  fs.existsSync(path.join(d, g))
    ? fs
        .readdirSync(path.join(d, g))
        .filter((f) => f.endsWith('.png'))
        .map((f) => `${g}/${f}`)
    : [];
const groups = ['stills', 'focus'];
const summary = {};
const changed = [];
const diffDir = path.join(path.dirname(report), 'diffs');
fs.mkdirSync(diffDir, { recursive: true });
const b64 = (p) => fs.readFileSync(p).toString('base64');

for (const g of groups) {
  const s = (summary[g] = { identical: 0, changed: 0, missing: 0 });
  const names = new Set([...list(a, g), ...list(b, g)]);
  for (const n of [...names].sort()) {
    const pa = path.join(a, n),
      pb = path.join(b, n);
    if (!fs.existsSync(pa) || !fs.existsSync(pb)) {
      s.missing++;
      changed.push({ n, note: `missing in ${fs.existsSync(pa) ? 'B' : 'A'}` });
      continue;
    }
    const A = PNG.sync.read(fs.readFileSync(pa)),
      B = PNG.sync.read(fs.readFileSync(pb));
    if (A.width !== B.width || A.height !== B.height) {
      s.changed++;
      changed.push({
        n,
        note: `size ${A.width}x${A.height} vs ${B.width}x${B.height}`,
        pa,
        pb,
      });
      continue;
    }
    const D = new PNG({ width: A.width, height: A.height });
    let px = 0;
    for (let i = 0; i < A.data.length; i += 4) {
      const same =
        A.data[i] === B.data[i] &&
        A.data[i + 1] === B.data[i + 1] &&
        A.data[i + 2] === B.data[i + 2] &&
        A.data[i + 3] === B.data[i + 3];
      if (same) {
        D.data[i] = D.data[i + 1] = D.data[i + 2] = 0;
        D.data[i + 3] = 255;
        D.data[i] = B.data[i] >> 2;
      } else {
        px++;
        D.data[i] = 255;
        D.data[i + 1] = 0;
        D.data[i + 2] = 255;
        D.data[i + 3] = 255;
      }
    }
    if (px === 0) {
      s.identical++;
      continue;
    }
    s.changed++;
    const dp = path.join(diffDir, n.replace('/', '__'));
    fs.writeFileSync(dp, PNG.sync.write(D));
    changed.push({ n, note: `${px} px differ`, pa, pb, dp });
  }
}

const rows = changed
  .map(
    (c) =>
      `<section><h3>${c.n} <small>${c.note}</small></h3>${
        c.pa && c.dp
          ? ['pa', 'pb', 'dp']
              .map(
                (k) =>
                  `<img src="data:image/png;base64,${b64(c[k])}" title="${k}">`
              )
              .join('')
          : ''
      }</section>`
  )
  .join('\n');
fs.writeFileSync(
  report,
  `<!doctype html><meta charset=utf-8><title>Personality baseline diff</title><style>body{font:14px system-ui;background:#eee}img{margin:4px;border:1px solid #999;max-width:32%}section{background:#fff;margin:8px;padding:8px}</style><h1>A: ${a}<br>B: ${b}</h1><pre>${JSON.stringify(
    summary,
    null,
    2
  )}</pre>${rows || '<p>No differences.</p>'}`
);
for (const g of groups)
  console.log(
    `${g}: identical=${summary[g].identical} changed=${summary[g].changed} missing=${summary[g].missing}`
  );
for (const c of changed.filter((x) => x.n.startsWith('stills/')))
  console.log(`  CHANGED ${c.n}: ${c.note}`);
const byIdx = {};
for (const c of changed.filter((x) => x.n.startsWith('focus/'))) {
  const k = c.n.match(/__(\d+)\.png$/)?.[1];
  byIdx[k] = (byIdx[k] ?? 0) + 1;
}
if (Object.keys(byIdx).length)
  console.log(
    '  changed focus shots by tab index (count of personality x mode):',
    JSON.stringify(byIdx)
  );
console.log(`report: ${report}`);
