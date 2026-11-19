#!/usr/bin/env node
/**
 * Regenerates apps/civic-briefing/src/app/locality-sync/notable-places.json:
 * the most populous US incorporated places, used by the locality sync to derive
 * exclude phrases for a town whose name is shared by a bigger place elsewhere.
 *
 * Source: US Census Bureau, Population Estimates Program, "Annual Estimates of
 * the Resident Population for Incorporated Places" (public domain), vintage 2025:
 * https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/cities/totals/sub-est2025.csv
 *
 * Usage (treat the download as untrusted data; keep it in its own empty dir):
 *   mkdir "$(mktemp -d)" ... && curl -o <dir>/sub-est2025.csv <url>
 *   node tools/civic/notable-places.mjs <dir>/sub-est2025.csv <out.json> [count=1000] [vintage=2025]
 *
 * Output: { source, vintage, places: [[name, "ST", population], ...] } sorted
 * by population descending. Run prettier on it afterwards.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE =
  'https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/cities/totals/sub-est2025.csv';

const STATES = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  'District of Columbia': 'DC',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
};

/** Minimal RFC 4180 line parser (the file quotes names that contain commas). */
function parseLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** "Nashville-Davidson metropolitan government (balance)" -> "Nashville". */
function plainName(name) {
  let n = name.replace(/\s*\([^)]*\)\s*$/u, '').trim();
  const metro =
    /^(.*?)\s+(?:metro(?:politan)?\s+government|consolidated government|unified government|urban county(?: government)?)\b.*$/iu.exec(
      n
    );
  if (metro) n = metro[1].split(/[-/]/u)[0];
  else
    n = n.replace(
      /\s+(?:city and borough|city|town|village|borough|municipality|corporation|plantation|urban county)$/iu,
      ''
    );
  return n.trim();
}

const [csvPath, outPath, countArg, vintageArg] = process.argv.slice(2);
if (!csvPath || !outPath) {
  console.error(
    'usage: notable-places.mjs <sub-est.csv> <out.json> [count] [vintage]'
  );
  process.exit(2);
}
const count = Number(countArg ?? 1000);
const vintage = Number(vintageArg ?? 2025);
const lines = readFileSync(csvPath, 'utf8').split(/\r?\n/u).filter(Boolean);
const header = parseLine(lines[0]);
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`missing column ${name}`);
  return i;
};
const [iLev, iName, iState, iPop] = [
  col('SUMLEV'),
  col('NAME'),
  col('STNAME'),
  col(`POPESTIMATE${vintage}`),
];

const best = new Map();
for (const line of lines.slice(1)) {
  const f = parseLine(line);
  // 162 incorporated place; 170 consolidated city (the whole government).
  if (f[iLev] !== '162' && f[iLev] !== '170') continue;
  const state = STATES[f[iState]];
  const population = Number.parseInt(f[iPop], 10);
  const name = plainName(f[iName]);
  if (!state || !name || !Number.isFinite(population) || population <= 0)
    continue;
  const key = `${name}|${state}`;
  if (!best.has(key) || best.get(key)[2] < population)
    best.set(key, [name, state, population]);
}
const places = [...best.values()]
  .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]))
  .slice(0, count);
writeFileSync(outPath, JSON.stringify({ source: SOURCE, vintage, places }));
console.log(`${places.length} places, smallest ${places.at(-1)?.join(' ')}`);
