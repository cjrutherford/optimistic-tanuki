#!/usr/bin/env node
/**
 * Read-only readiness report for automate-able address review candidates.
 *
 * This does not write to the database and does not publish anything. It reads a
 * checksum-pinned Overture JSONL artifact and reports how many rows have the
 * source fields needed by the address-review decision engine.
 *
 * Usage:
 *   node scripts/local-directory-address-review.mjs
 *   node scripts/local-directory-address-review.mjs --source /path/to/file.jsonl --limit 500
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const defaultSource =
  '/home/cjrutherford/workspace/business-directory-poc/data/providers/overture/2026-09-23.0/four-seat-places.jsonl';

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const source = value('--source', defaultSource);
const limit = Number(value('--limit', '0'));

const text = (value) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const summary = {
  rows: 0,
  withAddress: 0,
  singleAddress: 0,
  multipleAddresses: 0,
  withWebsite: 0,
  withPhone: 0,
  addressAndWebsite: 0,
  addressAndPhone: 0,
  addressAndWebsiteAndPhone: 0,
  categories: new Map(),
  samples: [],
};

const reader = createInterface({
  input: createReadStream(source, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

for await (const line of reader) {
  if (limit > 0 && summary.rows >= limit) break;
  if (!line.trim()) continue;
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    continue;
  }
  summary.rows += 1;
  const addresses = Array.isArray(row.addresses)
    ? row.addresses
        .map((address) =>
          typeof address === 'string' ? address : address?.freeform
        )
        .map(text)
        .filter(Boolean)
    : [];
  const websites = Array.isArray(row.websites)
    ? row.websites.map(text).filter(Boolean)
    : [];
  const phones = Array.isArray(row.phones)
    ? row.phones.map(text).filter(Boolean)
    : [];
  const category = text(row.basic_category) || 'unknown';
  summary.categories.set(category, (summary.categories.get(category) || 0) + 1);

  if (addresses.length > 0) summary.withAddress += 1;
  if (addresses.length === 1) summary.singleAddress += 1;
  if (addresses.length > 1) summary.multipleAddresses += 1;
  if (websites.length > 0) summary.withWebsite += 1;
  if (phones.length > 0) summary.withPhone += 1;
  if (addresses.length > 0 && websites.length > 0)
    summary.addressAndWebsite += 1;
  if (addresses.length > 0 && phones.length > 0) summary.addressAndPhone += 1;
  if (addresses.length > 0 && websites.length > 0 && phones.length > 0)
    summary.addressAndWebsiteAndPhone += 1;

  if (summary.samples.length < 5 && addresses.length > 0) {
    summary.samples.push({
      name: text(row.names?.primary) || 'unknown',
      category,
      addresses,
      websites,
      phones,
    });
  }
}

const topCategories = [...summary.categories.entries()]
  .sort((left, right) => right[1] - left[1])
  .slice(0, 10)
  .map(([category, count]) => ({ category, count }));

console.log(
  JSON.stringify(
    {
      source,
      limit: limit || null,
      rows: summary.rows,
      withAddress: summary.withAddress,
      singleAddress: summary.singleAddress,
      multipleAddresses: summary.multipleAddresses,
      withWebsite: summary.withWebsite,
      withPhone: summary.withPhone,
      addressAndWebsite: summary.addressAndWebsite,
      addressAndPhone: summary.addressAndPhone,
      addressAndWebsiteAndPhone: summary.addressAndWebsiteAndPhone,
      topCategories,
      samples: summary.samples,
    },
    null,
    2
  )
);
