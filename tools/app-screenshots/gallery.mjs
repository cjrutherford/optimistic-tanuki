#!/usr/bin/env node
// Usage: node tools/app-screenshots/gallery.mjs [--out /tmp/app-review]
// Builds <out>/index.html from every <out>/<app>/meta.json. Images are referenced by relative path.
import fs from 'node:fs';
import path from 'node:path';

const i = process.argv.indexOf('--out');
const out = path.resolve(i > 0 ? process.argv[i + 1] : '/tmp/app-review');
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
const apps = fs
  .readdirSync(out)
  .filter((d) => fs.existsSync(path.join(out, d, 'meta.json')))
  .sort()
  .map((d) =>
    JSON.parse(fs.readFileSync(path.join(out, d, 'meta.json'), 'utf8'))
  );

const warnings = (s) => {
  const parts = [];
  if (s.readabilityFailureCount)
    parts.push(
      `<details><summary class="w">${
        s.readabilityFailureCount
      } readability failure(s)</summary><ul>${s.readabilityFailures
        .map(
          (f) =>
            `<li>${esc(f.ratio)} &lt; ${f.min} &middot; <code>${esc(
              f.el
            )}</code> &ldquo;${esc(f.text)}&rdquo;</li>`
        )
        .join('')}</ul></details>`
    );
  if (s.consoleErrors.length)
    parts.push(
      `<details><summary class="w">${
        s.consoleErrors.length
      } console error(s)</summary><ul>${s.consoleErrors
        .map((e) => `<li>${esc(e)}</li>`)
        .join('')}</ul></details>`
    );
  if (s.failedRequests.length)
    parts.push(
      `<details><summary class="w">${
        s.failedRequests.length
      } failed request(s)</summary><ul>${s.failedRequests
        .map((e) => `<li>${esc(e)}</li>`)
        .join('')}</ul></details>`
    );
  if (s.redirected)
    parts.push(`<div class="w">redirected to ${esc(s.finalRoute)}</div>`);
  if (s.modeApplied && s.modeApplied !== s.mode)
    parts.push(
      `<div class="w">requested ${s.mode}, page reports ${esc(
        s.modeApplied
      )}</div>`
    );
  return parts.join('') || '<div class="ok">no warnings</div>';
};
const img = (app, s, cls) =>
  `<a href="${app.app}/${
    s.file
  }" target="_blank"><img class="${cls}" loading="eager" src="${app.app}/${
    s.file
  }" alt="${esc(
    app.app + ' ' + s.route + ' ' + s.mode + ' ' + s.viewport
  )}"></a>`;

const section = (a) => {
  const routes = [...new Set(a.shots.map((s) => s.route))];
  const rows = routes
    .map((r) => {
      const g = (m, v) =>
        a.shots.find((s) => s.route === r && s.mode === m && s.viewport === v);
      const cell = (m, v, cls) => {
        const s = g(m, v);
        return s
          ? `<figure><figcaption>${m} ${v}</figcaption>${img(
              a,
              s,
              cls
            )}${warnings(s)}</figure>`
          : '';
      };
      return `<div class="route"><h3>${esc(r)}</h3>
      <div class="desk">${cell('light', 'desktop', 'd')}${cell(
        'dark',
        'desktop',
        'd'
      )}</div>
      <div class="mob">${cell('light', 'mobile', 'm')}${cell(
        'dark',
        'mobile',
        'm'
      )}</div></div>`;
    })
    .join('');
  return `<section id="${a.app}"><h2>${a.app}</h2>
    <p>Personality applied: <b>${esc(
      a.personality
    )}</b> &middot; gateway: ${esc(
    a.gateway ?? 'not running (API calls returned 502)'
  )}</p>
    <p>Skipped auth routes: ${
      a.skippedAuthRoutes.length
        ? a.skippedAuthRoutes.map((x) => `<code>${esc(x)}</code>`).join(' ')
        : 'none'
    }</p>${rows}</section>`;
};

const html = `<!doctype html><meta charset="utf-8"><title>App review</title>
<style>
body{font:14px system-ui;margin:0;background:#f4f4f6;color:#111}
nav{position:sticky;top:0;background:#111;padding:8px 16px;z-index:5;display:flex;flex-wrap:wrap;gap:12px}
nav a{color:#fff;text-decoration:none}
section{padding:16px 24px;border-bottom:4px solid #999}
.route{background:#fff;margin:12px 0;padding:12px;border:1px solid #ccc}
.desk{display:flex;gap:16px;flex-wrap:wrap}.mob{display:flex;gap:16px;margin-top:12px;flex-wrap:wrap}
figure{margin:0}figcaption{font-weight:600;margin-bottom:4px}
img.d{width:640px;max-height:520px;object-fit:cover;object-position:top;border:1px solid #888;display:block}
img.m{width:140px;max-height:300px;object-fit:cover;object-position:top;border:1px solid #888;display:block}
.desk figure{max-width:640px}.mob figure{max-width:220px}
.w{color:#a40000;font-size:12px;margin-top:4px}.ok{color:#060;font-size:12px;margin-top:4px}
ul{margin:2px 0;padding-left:18px;font-size:11px}code{background:#eee;padding:0 3px}
</style>
<nav>${apps.map((a) => `<a href="#${a.app}">${a.app}</a>`).join('')}</nav>
<h1 style="padding:0 24px">App review &mdash; ${apps.length} apps</h1>
${apps.map(section).join('\n')}`;
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log(`wrote ${path.join(out, 'index.html')} (${apps.length} apps)`);
