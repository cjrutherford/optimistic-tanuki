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
const readLabels = (d) => {
  const f = path.join(d, 'labels.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
};
const labels = { ...readLabels(a), ...readLabels(b) };
const groups = ['stills', 'focus'];
const summary = {};
const results = []; // { n, g, status: 'identical'|'changed', note, pa, pb, diff }
const onlyIn = { A: [], B: [] };
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

for (const g of groups) {
  const s = (summary[g] = { identical: 0, changed: 0 });
  const inA = new Set(list(a, g));
  const inB = new Set(list(b, g));
  for (const n of inA) if (!inB.has(n)) onlyIn.A.push(n);
  for (const n of inB) if (!inA.has(n)) onlyIn.B.push(n);
  // Only files captured on both sides are compared.
  for (const n of [...inA].filter((x) => inB.has(x)).sort()) {
    const pa = path.join(a, n),
      pb = path.join(b, n);
    const A = PNG.sync.read(fs.readFileSync(pa)),
      B = PNG.sync.read(fs.readFileSync(pb));
    if (A.width !== B.width || A.height !== B.height) {
      s.changed++;
      results.push({
        n,
        g,
        status: 'changed',
        pa,
        pb,
        note: `size ${A.width}x${A.height} → ${B.width}x${B.height}`,
      });
      continue;
    }
    // Diff: the new image faded to grey, changed pixels in solid red.
    const D = new PNG({ width: B.width, height: B.height });
    let px = 0;
    for (let i = 0; i < B.data.length; i += 4) {
      const same =
        A.data[i] === B.data[i] &&
        A.data[i + 1] === B.data[i + 1] &&
        A.data[i + 2] === B.data[i + 2] &&
        A.data[i + 3] === B.data[i + 3];
      if (same) {
        const l =
          (B.data[i] * 0.3 + B.data[i + 1] * 0.59 + B.data[i + 2] * 0.11) | 0;
        D.data[i] = D.data[i + 1] = D.data[i + 2] = 200 + (l * 55) / 255;
      } else {
        px++;
        D.data[i] = 230;
        D.data[i + 1] = D.data[i + 2] = 20;
      }
      D.data[i + 3] = 255;
    }
    if (px === 0) {
      s.identical++;
      results.push({ n, g, status: 'identical' });
      continue;
    }
    s.changed++;
    const pct = ((px / (B.width * B.height)) * 100).toFixed(1);
    results.push({
      n,
      g,
      status: 'changed',
      pa,
      pb,
      diff: PNG.sync.write(D),
      note: `${pct}% of pixels changed`,
    });
  }
}

// ---- readability: rendered text contrast from each capture ----
// capture.mjs measures every visible text element's computed colour against
// the background actually behind it (rendered-contrast.json).
const readRendered = (d) => {
  const f = path.join(d, 'rendered-contrast.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
const renderedA = readRendered(a) ?? {};
const renderedB = readRendered(b);
const readability = []; // text elements below their ratio after the change
for (const n of Object.keys(renderedB ?? {}).sort()) {
  const beforeByKey = new Map(
    (renderedA[n] ?? []).map((x) => [`${x.el}|${x.text}`, x.ratio])
  );
  for (const x of renderedB[n]) {
    const key = `${x.el}|${x.text}`;
    readability.push({
      n,
      ...x,
      before: renderedA[n] ? beforeByKey.get(key) ?? null : undefined,
    });
  }
}
// ---- report ----
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const parse = (n) => {
  const [pid, mode, rest] = path.basename(n, '.png').split('__');
  return { pid, mode, rest };
};
let uid = 0;
const stillCard = (r) => {
  const { mode, rest } = parse(r.n);
  const id = `s${uid++}`;
  const view = (k, label, checked) =>
    `<input type=radio name=${id} id=${id}${k} ${
      checked ? 'checked' : ''
    }><label for=${id}${k}>${label}</label>`;
  return `<div class="still"><h4>${esc(mode)} · primary #${esc(
    rest
  )} <small>${esc(r.note)}</small></h4>
    <div class="toggle">${view('b', 'After', true)}${view('a', 'Before')}${
    r.diff ? view('d', 'Changed pixels') : ''
  }
      <div class="frames">
        <img class="fb" src="${b64(fs.readFileSync(r.pb))}">
        <img class="fa" src="${b64(fs.readFileSync(r.pa))}">
        ${r.diff ? `<img class="fd" src="${b64(r.diff)}">` : ''}
      </div></div></div>`;
};
const focusCard = (r) => {
  const { mode, rest } = parse(r.n);
  return `<figure class="focus"><figcaption>${esc(mode)} · tab ${esc(
    rest
  )} · ${esc(labels[r.n] ?? '')}</figcaption>
    <div><span>Before</span><img src="${b64(fs.readFileSync(r.pa))}"></div>
    <div><span>After</span><img src="${b64(
      fs.readFileSync(r.pb)
    )}"></div></figure>`;
};
const byPid = new Map();
for (const r of results) {
  const { pid } = parse(r.n);
  if (!byPid.has(pid)) byPid.set(pid, []);
  byPid.get(pid).push(r);
}
const sections = [...byPid.entries()]
  .sort(([x], [y]) => x.localeCompare(y))
  .map(([pid, rs]) => {
    const ch = rs.filter((r) => r.status === 'changed');
    const stillsCh = ch.filter((r) => r.g === 'stills');
    const focusCh = ch.filter((r) => r.g === 'focus');
    const same = rs.length - ch.length;
    return `<section id="${esc(pid)}"><h2>${esc(pid)} <small>${
      ch.length
    } changed · ${same} identical</small></h2>
      ${
        stillsCh.length
          ? `<h3>Page</h3>${stillsCh.map(stillCard).join('')}`
          : ''
      }
      ${
        focusCh.length
          ? `<h3>Keyboard focus</h3><div class="focusgrid">${focusCh
              .map(focusCard)
              .join('')}</div>`
          : ''
      }
      ${ch.length ? '' : '<p class="same">No visual change.</p>'}</section>`;
  })
  .join('\n');
const nav = [...byPid.entries()]
  .sort(([x], [y]) => x.localeCompare(y))
  .map(([pid, rs]) => {
    const c = rs.filter((r) => r.status === 'changed').length;
    return `<a href="#${esc(pid)}" class="${c ? 'ch' : ''}">${esc(
      pid
    )} (${c})</a>`;
  })
  .join('');
const fmt = (x) => (x == null ? '–' : `${x.toFixed(2)}:1`);
const readTable = renderedB
  ? `<section id="readability"><h2>Readability <small>rendered text below WCAG AA after the change (${
      readability.length
    })</small></h2>${
      readability.length
        ? `<table><tr><th>Personality</th><th>Mode</th><th>Primary</th><th>Element</th><th>Text</th><th>Needs</th><th>Before</th><th>After</th></tr>${readability
            .map((r) => {
              const { pid, mode, rest } = parse(r.n);
              // before: number = already failing; null = passed before; undefined = no before data
              const cls =
                r.before === null
                  ? 'new'
                  : r.before != null && r.ratio < r.before - 0.05
                  ? 'worse'
                  : '';
              return `<tr class="${cls}"><td>${esc(pid)}</td><td>${esc(
                mode
              )}</td><td>#${esc(rest)}</td><td><code>${esc(
                r.el
              )}</code></td><td>${esc(r.text)}</td><td>${r.min}:1</td><td>${
                r.before === null ? 'passed' : fmt(r.before)
              }</td><td>${fmt(r.ratio)}</td></tr>`;
            })
            .join(
              ''
            )}</table><p class="same">Measured from rendered pixels' colours: text colour against the first opaque background behind it. Red rows fail only after the change; amber rows got worse. Text over gradients or images is measured against the background colour beneath them.</p>`
        : '<p class="same">All rendered text meets WCAG AA.</p>'
    }</section>`
  : '';
const skipped = onlyIn.A.length + onlyIn.B.length;
fs.writeFileSync(
  report,
  `<!doctype html><meta charset=utf-8><title>Personality visual review</title>
<style>
body{font:14px/1.5 system-ui,sans-serif;margin:0;background:#f4f4f5;color:#18181b}
header{position:sticky;top:0;background:#18181b;color:#fafafa;padding:10px 20px;z-index:2}
header h1{font-size:16px;margin:0 0 4px}header code{color:#a1a1aa}
nav a{color:#d4d4d8;margin-right:12px;text-decoration:none}nav a.ch{color:#fca5a5;font-weight:600}
main{padding:12px 20px}section{background:#fff;border:1px solid #e4e4e7;border-radius:8px;margin:16px 0;padding:12px 16px}
h2{margin:0 0 8px}h2 small,h4 small{color:#71717a;font-weight:400}h3{margin:16px 0 8px}
.still{margin:12px 0 24px}.still h4{margin:0 0 6px}
.toggle>input{display:none}.toggle>label{display:inline-block;padding:4px 12px;border:1px solid #d4d4d8;border-radius:6px;margin:0 6px 8px 0;cursor:pointer;background:#fafafa}
.toggle>input:checked+label{background:#18181b;color:#fff;border-color:#18181b}
.frames img{display:none;max-width:100%;border:1px solid #d4d4d8}
.toggle>input[id$=b]:checked~.frames .fb,.toggle>input[id$=a]:checked~.frames .fa,.toggle>input[id$=d]:checked~.frames .fd{display:block}
.focusgrid{display:flex;flex-wrap:wrap;gap:12px}.focus{margin:0;border:1px solid #e4e4e7;border-radius:6px;padding:8px;background:#fafafa}
.focus figcaption{font-size:12px;color:#52525b;margin-bottom:6px}.focus div{display:inline-block;margin-right:8px;vertical-align:top}
.focus span{display:block;font-size:11px;color:#71717a}.focus img{zoom:2;image-rendering:auto;border:1px solid #d4d4d8}
.same{color:#71717a}table{border-collapse:collapse;font-size:13px}td,th{border-bottom:1px solid #e4e4e7;padding:3px 10px;text-align:left}tr.new td{background:#fee2e2}tr.worse td{background:#fef3c7}
</style>
<header><h1>Personality visual review</h1><div>Before <code>${esc(
    a
  )}</code> → After <code>${esc(b)}</code> ·
 page: ${summary.stills.changed} changed / ${
    summary.stills.identical
  } identical · focus: ${summary.focus.changed} changed / ${
    summary.focus.identical
  } identical${
    skipped ? ` · ${skipped} not compared (captured on one side only)` : ''
  }</div>
<nav><a href="#readability" class="${
    readability.length ? 'ch' : ''
  }">readability (${readability.length})</a>${nav}</nav></header>
<main>${readTable}${sections || '<p>Nothing to compare.</p>'}</main>`
);
for (const g of groups)
  console.log(
    `${g}: identical=${summary[g].identical} changed=${summary[g].changed}`
  );
for (const r of results.filter(
  (x) => x.status === 'changed' && x.g === 'stills'
))
  console.log(`  CHANGED ${r.n}: ${r.note}`);
if (!renderedB)
  console.log(
    'readability: NOT CHECKED (no rendered-contrast.json in B; recapture with the current capture.mjs)'
  );
else
  console.log(
    `readability: ${readability.length} rendered text elements below WCAG AA after`
  );
if (skipped)
  console.log(
    `WARNING: ${skipped} images captured on one side only; was a capture incomplete?`
  );
console.log(`report: ${report}`);
