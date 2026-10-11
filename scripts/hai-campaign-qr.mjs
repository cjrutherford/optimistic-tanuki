#!/usr/bin/env node
// Generates QR codes for the HAI print campaigns in scripts/hai-print-campaigns.txt.
//
// Usage: node scripts/hai-campaign-qr.mjs <origin> <out-dir>
//   node scripts/hai-campaign-qr.mjs https://hopefulaspirationsindustries.com out/print
//   node scripts/hai-campaign-qr.mjs http://192.168.1.10:4000 out/test
//
// Writes an SVG (for print) and a PNG per campaign, plus index.html, a sheet
// showing every code with the URL it encodes. Only the origin differs between
// print and test codes; paths and query strings come from the campaign file
// unchanged.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import QRCode from 'qrcode';

const CAMPAIGN_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  'hai-print-campaigns.txt'
);

// Q recovers from 25% damage, enough for creased or smudged paper.
const QR_OPTIONS = { errorCorrectionLevel: 'Q', margin: 4 };

export async function readCampaigns(file = CAMPAIGN_FILE) {
  const text = await readFile(file, 'utf8');
  return text
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const [name, target] = line.split('\t');
      if (!name || !target?.startsWith('/')) {
        throw new Error(`Bad campaign line: ${JSON.stringify(line)}`);
      }
      return { name, target };
    });
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;');
}

function sheet(origin, codes) {
  const items = codes
    .map(
      ({ name, url }) => `  <figure>
    <img src="${name}.svg" alt="QR code for ${escapeHtml(url)}">
    <figcaption><strong>${name}</strong><br><code>${escapeHtml(
        url
      )}</code></figcaption>
  </figure>`
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>HAI print campaign QR codes: ${escapeHtml(origin)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; }
  main { display: flex; flex-wrap: wrap; gap: 2rem; }
  figure { margin: 0; width: 18rem; }
  img { width: 100%; image-rendering: pixelated; }
  code { word-break: break-all; }
</style>
<h1>HAI print campaign QR codes</h1>
<p>Origin: <code>${escapeHtml(origin)}</code></p>
<main>
${items}
</main>
</html>
`;
}

async function main() {
  const [origin, outDir] = process.argv.slice(2);
  if (!origin || !outDir || !/^https?:\/\/[^/]+$/.test(origin)) {
    console.error(
      'Usage: node scripts/hai-campaign-qr.mjs <origin without trailing slash> <out-dir>'
    );
    process.exit(2);
  }
  const out = resolve(outDir);
  await mkdir(out, { recursive: true });

  const codes = [];
  for (const { name, target } of await readCampaigns()) {
    const url = `${origin}${target}`;
    await writeFile(
      join(out, `${name}.svg`),
      await QRCode.toString(url, { ...QR_OPTIONS, type: 'svg' })
    );
    await QRCode.toFile(join(out, `${name}.png`), url, {
      ...QR_OPTIONS,
      width: 600,
    });
    codes.push({ name, url });
    console.log(`${name}\t${url}`);
  }
  // Formatted like the rest of the repo, so a committed sheet regenerates
  // byte for byte.
  const sheetFile = join(out, 'index.html');
  const options = await prettier.resolveConfig(sheetFile);
  await writeFile(
    sheetFile,
    await prettier.format(sheet(origin, codes), { ...options, parser: 'html' })
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
