#!/usr/bin/env node
// Public release metadata only. Never requests or reads place records.
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { openPinnedRangeProxy } from './overture-range-proxy.mjs';

const validBounds = b => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[0] >= -180 && b[2] <= 180 && b[1] >= -90 && b[3] <= 90 && b[0] <= b[2] && b[1] <= b[3];

// Independent column statistics cannot prove every row's bbox is valid.
// Return every group until a separately verified row-level validation exists.
export function selectRowGroups(groups, envelope) {
  if (!validBounds(envelope) || !Array.isArray(groups)) throw Error('Invalid row-group request');
  const ids = new Set(), selected = [];
  for (const group of groups) {
    const id = group?.rowGroupId;
    if (!Number.isSafeInteger(id) || id < 0 || ids.has(id)) throw Error('Invalid row-group identity');
    ids.add(id);
    selected.push(id);
  }
  return selected.sort((a, b) => a - b);
}

// Decode DuckDB parquet_metadata rows using the four bbox statistics used by the POC.
export function parseRowGroupMetadata(rows, expectedGroups, expectedRows) {
  if (!Array.isArray(rows) || !Number.isSafeInteger(expectedGroups) || expectedGroups < 1 || !Number.isSafeInteger(expectedRows) || expectedRows < 0) throw Error('Invalid Parquet metadata request');
  const fields = new Map([['bbox, xmin', ['xminMin', 3]], ['bbox, xmax', ['xmaxMax', 4]], ['bbox, ymin', ['yminMin', 3]], ['bbox, ymax', ['ymaxMax', 4]]]);
  const groups = new Map();
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 6 || !fields.has(row[2])) throw Error('Unexpected Parquet statistics');
    if (!['number', 'bigint'].includes(typeof row[0]) || !['number', 'bigint'].includes(typeof row[1])) throw Error('Invalid Parquet row-group metadata');
    const id = Number(row[0]), count = Number(row[1]), path = row[2], field = fields.get(path);
    if (!Number.isSafeInteger(id) || id < 0 || id >= expectedGroups || !Number.isSafeInteger(count) || count < 0) throw Error('Invalid Parquet row-group metadata');
    const group = groups.get(id) ?? { rowGroupId: id, numRows: count, xminMin: null, xmaxMax: null, yminMin: null, ymaxMax: null, hasNullBounds: false, seen: new Set() };
    if (group.numRows !== count || group.seen.has(path)) throw Error('Conflicting Parquet statistics');
    const raw = row[field[1]], value = raw === null || raw === undefined || raw === '' ? null : Number(raw);
    group[field[0]] = value !== null && Number.isFinite(value) ? value : null;
    const min = row[3], max = row[4];
    if (min === null || min === undefined || min === '' || max === null || max === undefined || max === '' || !Number.isFinite(Number(min)) || !Number.isFinite(Number(max)) || Number(min) > Number(max)) group.hasNullBounds = true;
    if (row[5] === null || row[5] === undefined || !Number.isSafeInteger(Number(row[5])) || Number(row[5]) !== 0) group.hasNullBounds = true;
    group.seen.add(path);
    groups.set(id, group);
  }
  if (groups.size !== expectedGroups) throw Error('Incomplete Parquet row-group inventory');
  let next = 0;
  const result = [...groups.values()].sort((a, b) => a.rowGroupId - b.rowGroupId).map(({seen, ...group}) => {
    const startRow = next;
    next += group.numRows;
    if (!Number.isSafeInteger(next)) throw Error('Parquet row count overflow');
    return { ...group, hasNullBounds: group.hasNullBounds || seen.size !== fields.size, startRow, endRow: next };
  });
  if (next !== expectedRows) throw Error('Parquet row count mismatch');
  return result;
}

// The caller must first check the source against the currently verified inventory.
export async function readRowGroupMetadata(connection, source, envelope, release) {
  if (!connection || typeof connection.runAndReadAll !== 'function' || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release) || !validBounds(envelope)) throw Error('Invalid Parquet metadata request');
  let uri; try { uri = new URL(source?.asset); } catch { throw Error('Invalid asset URL'); }
  if (uri.protocol !== 'https:' || uri.hostname !== 'overturemaps-us-west-2.s3.us-west-2.amazonaws.com' || uri.port || !uri.pathname.startsWith(`/release/${release}/theme=places/type=place/`) || !uri.pathname.endsWith('.parquet') || uri.search || uri.hash || uri.username || uri.password) throw Error('Unexpected asset URL');
  const proxy = await openPinnedRangeProxy({asset:uri.href, etag:source.etag});
  try {
    const sql = `SELECT row_group_id, row_group_num_rows, path_in_schema, stats_min, stats_max, stats_null_count FROM parquet_metadata('${proxy.url}') WHERE path_in_schema IN ('bbox, xmin','bbox, xmax','bbox, ymin','bbox, ymax') ORDER BY row_group_id, path_in_schema`;
    const reader = await connection.runAndReadAll(sql);
    const groups = parseRowGroupMetadata(await reader.getRowsJS(), source.rowGroups, source.rows);
    return { groups, candidates: selectRowGroups(groups, envelope) };
  } finally { await proxy.close(); }
}

export function buildInventory(documents, headers, envelope, release) {
  if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release) || !validBounds(envelope) || !Array.isArray(documents) || documents.length === 0 || documents.length !== headers.length) throw Error('Invalid inventory request');
  const ids = new Set(), assets = new Set();
  const items = documents.map((item, i) => {
    const asset = item?.assets?.aws, info = headers[i], props = item?.properties;
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.id) || ids.has(item.id) || !validBounds(item.bbox) || !asset || !info) throw Error('Invalid STAC item');
    ids.add(item.id);
    let uri;
    try { uri = new URL(asset.href); } catch { throw Error('Invalid asset URL'); }
    const prefix = `/release/${release}/theme=places/type=place/`;
    if (uri.protocol !== 'https:' || uri.hostname !== 'overturemaps-us-west-2.s3.us-west-2.amazonaws.com' || uri.port || !uri.pathname.startsWith(prefix) || !uri.pathname.endsWith('.parquet') || uri.search || uri.hash || uri.username || uri.password) throw Error('Unexpected asset URL');
    if (assets.has(uri.href)) throw Error('Duplicate asset URL');
    assets.add(uri.href);
    if (!Number.isSafeInteger(asset['file:size']) || asset['file:size'] <= 0 || info.size !== asset['file:size'] || typeof info.etag !== 'string' || !info.etag || typeof info.lastModified !== 'string' || !info.lastModified || !Number.isSafeInteger(props?.num_rows) || props.num_rows < 0 || !Number.isSafeInteger(props?.num_row_groups) || props.num_row_groups <= 0) throw Error('Asset metadata mismatch');
    return { id: item.id, bbox: item.bbox, rows: props.num_rows, rowGroups: props.num_row_groups, asset: uri.href, size: info.size, etag: info.etag, lastModified: info.lastModified };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const inventorySha256 = createHash('sha256').update(JSON.stringify(items)).digest('hex');
  // A source's declared bbox is not proof that every contained geometry lies
  // inside it. Keep all assets until the release's bounds are independently verified.
  return { release, envelope, inventorySha256, items, selected: [...items] };
}

async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw Error(`Metadata request failed: ${response.status}`);
  return response.json();
}

export async function preflight(release, envelope) {
  if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release) || !validBounds(envelope)) throw Error('Invalid inventory request');
  const base = `https://stac.overturemaps.org/${release}/places/place/`;
  const collection = await json(`${base}collection.json`);
  const links = collection.links?.filter(x => x.rel === 'item').map(x => x.href);
  if (!Array.isArray(links) || !links.length || links.length > 256 || new Set(links).size !== links.length || links.some(x => typeof x !== 'string' || !x.startsWith(base) || !/^\d+\/\d+\.json$/.test(x.slice(base.length)))) throw Error('Invalid collection links');
  const documents = [], headers = [];
  for (const link of links) {
    const item = await json(link);
    // Validate the URL before issuing the HEAD request.
    const asset = item?.assets?.aws?.href;
    let u; try { u = new URL(asset); } catch { throw Error('Invalid asset URL'); }
    if (u.protocol !== 'https:' || u.hostname !== 'overturemaps-us-west-2.s3.us-west-2.amazonaws.com' || u.port || !u.pathname.startsWith(`/release/${release}/theme=places/type=place/`) || !u.pathname.endsWith('.parquet') || u.search || u.hash || u.username || u.password) throw Error('Unexpected asset URL');
    const res = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!res.ok) throw Error(`Asset metadata request failed: ${res.status}`);
    documents.push(item);
    headers.push({ size: Number(res.headers.get('content-length')), etag: res.headers.get('etag')?.replace(/^"|"$/g, ''), lastModified: res.headers.get('last-modified') });
  }
  return buildInventory(documents, headers, envelope, release);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [release, ...args] = process.argv.slice(2);
  if (args.length !== 4 || args.some(x => x.trim() === '' || !Number.isFinite(Number(x)))) {
    process.stderr.write('Usage: node scripts/overture-release-preflight.mjs RELEASE MIN_LON MIN_LAT MAX_LON MAX_LAT\n'); process.exitCode = 1;
  } else preflight(release, args.map(Number)).then(x => console.log(JSON.stringify(x, null, 2))).catch(e => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; });
}
