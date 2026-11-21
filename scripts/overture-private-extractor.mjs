import { createHash } from 'node:crypto';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPinnedRangeProxy } from './overture-range-proxy.mjs';
import { parseRowGroupMetadata } from './overture-release-preflight.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
/** Source evidence from the proxy's first verified response, or null. Never inferred. */
async function sourceEvidence(proxy, item, inventory) {
  const captured = proxy?.evidence?.();
  if (!captured) return null;
  const release =
    /\/release\/(\d{4}-\d{2}-\d{2}\.\d+)\/theme=places\/type=place\/[^/]+\.parquet$/.exec(
      new URL(item.asset).pathname
    )?.[1];
  if (
    !captured ||
    !release ||
    release !== inventory.release ||
    captured.asset !== item.asset ||
    captured.etag !== item.etag
  )
    return null;
  const parsed = captured.lastModified
    ? Date.parse(captured.lastModified)
    : NaN;
  // Bundled into the directory worker, import.meta.url is not a readable file; the recorder then says so.
  const self = await readFile(fileURLToPath(import.meta.url))
    .then((bytes) => digest(bytes).slice(0, 12))
    .catch(() => 'bundled');
  return {
    kind: 'captured',
    releaseId: release,
    artifactUrl: captured.asset,
    artifactEtag: captured.etag,
    artifactBytes: captured.contentRangeTotal,
    upstreamLastModified: Number.isFinite(parsed) ? new Date(parsed) : null,
    observedAt: new Date(captured.at),
    recorder: `extractor:overture-private-extractor.mjs@${self}`,
    inventorySha256: inventory.inventorySha256,
  };
}
const sha = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function geometryBounds(geometry) {
  let xmin = Infinity,
    ymin = Infinity,
    xmax = -Infinity,
    ymax = -Infinity;
  const visit = (value) => {
    if (!Array.isArray(value)) throw Error('Invalid region coordinates');
    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      const [x, y] = value;
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        Math.abs(x) > 180 ||
        Math.abs(y) > 90
      )
        throw Error('Invalid region coordinates');
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
      return;
    }
    for (const child of value) visit(child);
  };
  visit(geometry.coordinates);
  if (![xmin, ymin, xmax, ymax].every(Number.isFinite))
    throw Error('Empty region coordinates');
  return { xmin, ymin, xmax, ymax };
}

const validBounds = (b) =>
  Array.isArray(b) &&
  b.length === 4 &&
  b.every(Number.isFinite) &&
  b[0] >= -180 &&
  b[2] <= 180 &&
  b[1] >= -90 &&
  b[3] <= 90 &&
  b[0] <= b[2] &&
  b[1] <= b[3];
function validateEnvelope(regions, envelope) {
  if (!validBounds(envelope)) throw Error('Invalid envelope');
  for (const { geometry } of regions) {
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.coordinates;
    if (!polygons.length) throw Error('Invalid region geometry');
    for (const polygon of polygons) {
      if (!Array.isArray(polygon) || !polygon.length)
        throw Error('Invalid region geometry');
      for (const ring of polygon) {
        if (
          !Array.isArray(ring) ||
          ring.length < 4 ||
          JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1))
        )
          throw Error('Invalid region geometry');
        for (const point of ring) {
          if (
            !Array.isArray(point) ||
            point.length < 2 ||
            !Number.isFinite(point[0]) ||
            !Number.isFinite(point[1]) ||
            point[0] < envelope[0] ||
            point[0] > envelope[2] ||
            point[1] < envelope[1] ||
            point[1] > envelope[3]
          )
            throw Error('Region outside envelope');
        }
      }
    }
  }
}

/**
 * Private, opt-in extraction primitive; no CLI, policy approval,
 * or production sink is provided. The caller is responsible for verifying the
 * inventory and granting authorization, including the asset's content digest.
 * The caller must provide an exclusively owned DuckDB instance and connection;
 * this function sets global memory, thread and temporary-spill limits.
 *
 * sink.load(scanId, policy.approvalSha256) returns the durable checkpoint or null. sink.commit(rows, next)
 * MUST atomically and durably commit both rows and next in one transaction, with
 * exclusive ownership of this scan. A crash must expose either the entire commit
 * or none of it. sink.isComplete(scanId) reports durable exhaustion, and
 * sink.complete() marks it only after successful stream exhaustion. Both must
 * be fenced against withdrawal and competing checkpoints. atomicCommit is an
 * assertion by the sink, not proof of those
 * guarantees. The included PostgreSQL sink has local tests; production use
 * requires independently verified deployment and authorization.
 */
export async function extractPrivate({
  connection,
  sourcePath,
  sourceMode = 'local',
  inventory,
  policy,
  sink,
  project,
  upstream,
  reserveAttempt,
}) {
  // Bind all later awaits and SQL to the exact values used to form the checkpoint identity.
  policy = structuredClone(policy);
  inventory = structuredClone(inventory);
  const memoryBytes = policy?.maxMemoryBytes ?? 512 * 1024 * 1024;
  if (
    !Number.isSafeInteger(memoryBytes) ||
    memoryBytes < 512 * 1024 * 1024 ||
    memoryBytes > 2 * 1024 * 1024 * 1024 ||
    memoryBytes % (1024 * 1024) !== 0
  )
    throw Error('Invalid extraction memory limit');
  if (
    !policy ||
    policy.authorized !== true ||
    !sha(policy.inventorySha256) ||
    (sourceMode === 'local' && !sha(policy.assetSha256)) ||
    !sha(policy.approvalSha256) ||
    !sha(policy.projectionSha256) ||
    !sha(policy.classifierSha256)
  )
    throw Error('Explicit policy authorization and digests required');
  if (
    !sink ||
    sink.atomicCommit !== true ||
    typeof sink.load !== 'function' ||
    typeof sink.commit !== 'function' ||
    typeof sink.complete !== 'function' ||
    typeof sink.isComplete !== 'function'
  )
    throw Error('Atomic durable sink required');
  if (
    !connection ||
    typeof connection.stream !== 'function' ||
    typeof connection.run !== 'function'
  )
    throw Error('Dedicated DuckDB streaming connection required');
  if (typeof project !== 'function')
    throw Error('Explicit rights-aware project function required');
  if (
    !inventory ||
    !Array.isArray(inventory.items) ||
    digest(JSON.stringify(inventory.items)) !== inventory.inventorySha256 ||
    inventory.inventorySha256 !== policy.inventorySha256
  )
    throw Error('Inventory digest mismatch');
  const items = inventory.items.filter((item) => item?.id === policy.itemId);
  if (
    items.length !== 1 ||
    typeof items[0].asset !== 'string' ||
    !Number.isSafeInteger(items[0].size) ||
    items[0].size < 1
  )
    throw Error('Invalid inventory item');
  if (
    !Array.isArray(policy.regions) ||
    !policy.regions.length ||
    policy.regions.some(
      (r) =>
        !r ||
        typeof r.id !== 'string' ||
        !r.id ||
        !['Polygon', 'MultiPolygon'].includes(r.geometry?.type) ||
        !Array.isArray(r.geometry.coordinates)
    ) ||
    new Set(policy.regions.map((r) => r.id)).size !== policy.regions.length
  )
    throw Error('Invalid regions');
  if (
    policy.singleMatch !== undefined &&
    typeof policy.singleMatch !== 'boolean'
  )
    throw Error('Invalid region matching mode');
  if (!['local', 'remote'].includes(sourceMode))
    throw Error('Invalid source mode');
  if (
    sourceMode === 'remote' &&
    (!Number.isSafeInteger(policy.maxTransferBytes) ||
      policy.maxTransferBytes < 1 ||
      policy.maxTransferBytes > 1024 * 1024 * 1024)
  )
    throw Error('Explicit remote transfer budget required');
  // A dedicated connection is required: prevent DuckDB sorting from spilling raw
  // source records to its default temporary directory. Exhaustion fails the scan.
  await connection.run(
    `SET threads = 1; SET preserve_insertion_order = true; SET memory_limit = '${
      memoryBytes / (1024 * 1024)
    }MB'; SET max_temp_directory_size = '0B'`
  );
  const item = items[0];
  if (sourceMode === 'remote') {
    validateEnvelope(policy.regions, inventory.envelope);
    const ids = new Set(),
      assets = new Set();
    if (!inventory.items.length) throw Error('Invalid remote source inventory');
    for (const entry of inventory.items) {
      let url;
      try {
        url = new URL(entry.asset);
      } catch {
        throw Error('Invalid remote source');
      }
      if (
        !entry ||
        !entry.id ||
        typeof entry.id !== 'string' ||
        ids.has(entry.id) ||
        assets.has(entry.asset)
      )
        throw Error('Invalid remote source inventory');
      ids.add(entry.id);
      assets.add(entry.asset);
      if (
        !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(inventory.release) ||
        url.protocol !== 'https:' ||
        url.hostname !== 'overturemaps-us-west-2.s3.us-west-2.amazonaws.com' ||
        url.port ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !new RegExp(
          `^/release/${inventory.release.replace(
            '.',
            '\\.'
          )}\/theme=places/type=place/[^/]+\\.parquet$`
        ).test(url.pathname) ||
        typeof entry.etag !== 'string' ||
        !/^[A-Za-z0-9-]{1,100}$/.test(entry.etag) ||
        !Number.isSafeInteger(entry.size) ||
        entry.size < 1 ||
        !Number.isSafeInteger(entry.rows) ||
        entry.rows < 0 ||
        !Number.isSafeInteger(entry.rowGroups) ||
        entry.rowGroups < 1 ||
        !validBounds(entry.bbox) ||
        typeof entry.lastModified !== 'string' ||
        !entry.lastModified ||
        typeof connection.runAndReadAll !== 'function'
      )
        throw Error('Invalid remote source inventory');
    }
  }
  const scanId = digest(
    JSON.stringify({
      version: policy.singleMatch ? 6 : 5,
      mode: sourceMode,
      inventory: inventory.inventorySha256,
      item: policy.itemId,
      asset:
        sourceMode === 'local'
          ? policy.assetSha256
          : {
              release: inventory.release,
              object: item.asset,
              etag: item.etag,
              envelope: inventory.envelope,
              maxTransferBytes: policy.maxTransferBytes,
            },
      approval: policy.approvalSha256,
      projection: policy.projectionSha256,
      classifier: policy.classifierSha256,
      regions: policy.regions,
    })
  );
  const old = await sink.load(
    scanId,
    policy.approvalSha256,
    policy.regions.map((r) => r.id)
  );
  if (
    old !== null &&
    (!old ||
      old.scanId !== scanId ||
      !Number.isSafeInteger(old.sourceFileRowNumber) ||
      old.sourceFileRowNumber < 0)
  )
    throw Error('Invalid or mismatched checkpoint');
  let last = old?.sourceFileRowNumber ?? -1;
  if (await sink.isComplete(scanId))
    return { scanId, sourceFileRowNumber: last };
  let dir, proxy;
  try {
    // Stream and hash a private snapshot; avoid buffering an entire shard in memory.
    let snapshot,
      rowFilter = '';
    if (sourceMode === 'local') {
      dir = await mkdtemp(join(tmpdir(), 'overture-private-'));
      snapshot = join(dir, 'input.parquet');
      const hash = createHash('sha256');
      let size = 0;
      const source = await open(sourcePath, 'r');
      try {
        const info = await source.stat();
        if (!info.isFile() || info.size !== item.size)
          throw Error('Asset size mismatch');
        await pipeline(
          source.createReadStream({ autoClose: false }),
          new Transform({
            transform(chunk, _encoding, done) {
              size += chunk.length;
              if (size > item.size)
                return done(Error('Asset size exceeds approved limit'));
              hash.update(chunk);
              done(null, chunk);
            },
          }),
          createWriteStream(snapshot, { mode: 0o600, flags: 'wx' })
        );
      } finally {
        await source.close();
      }
      if (size !== item.size || hash.digest('hex') !== policy.assetSha256)
        throw Error('Asset digest or size mismatch');
    } else {
      proxy = await openPinnedRangeProxy({
        asset: item.asset,
        etag: item.etag,
        maxBytes: policy.maxTransferBytes,
        reserveAttempt,
        requestTimeoutMs: policy.localSnapshot === true ? 3600000 : 30000,
        ...(upstream ? { upstream } : {}),
      });
      const head = await fetch(proxy.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(30000),
      });
      if (!head.ok || Number(head.headers.get('content-length')) !== item.size)
        throw Error(`Remote source HEAD mismatch: ${head.status}`);
      snapshot = proxy.url;
      if (policy.localSnapshot === true) {
        dir = await mkdtemp(join(tmpdir(), 'overture-private-'));
        snapshot = join(dir, 'input.parquet');
        const response = await fetch(proxy.url, {
          headers: { Range: `bytes=0-${item.size - 1}` },
          signal: AbortSignal.timeout(3600000),
        });
        if (response.status !== 206 || !response.body)
          throw Error(`Remote snapshot failed: ${response.status}`);
        let size = 0;
        await pipeline(
          Readable.fromWeb(response.body),
          new Transform({
            transform(chunk, _encoding, done) {
              size += chunk.length;
              done(
                size > item.size ? Error('Snapshot exceeds pinned size') : null,
                chunk
              );
            },
          }),
          createWriteStream(snapshot, { mode: 0o600, flags: 'wx' })
        );
        if (size !== item.size) throw Error('Remote snapshot size mismatch');
      }
      const metadata = await connection.runAndReadAll(
        `SELECT row_group_id, row_group_num_rows, path_in_schema, stats_min, stats_max, stats_null_count FROM parquet_metadata(${quote(
          snapshot
        )}) WHERE path_in_schema IN ('bbox, xmin','bbox, xmax','bbox, ymin','bbox, ymax') ORDER BY row_group_id, path_in_schema`
      );
      parseRowGroupMetadata(
        await metadata.getRowsJS(),
        item.rowGroups,
        item.rows
      );
      // Bounds can be internally valid but still disagree with the geometry.
      // Exact geometry determines membership; no bbox-based pruning is safe here.
    }
    // One Parquet source plus SELECT/WHERE/CTEs preserve insertion order in DuckDB.
    // Avoid a join and global ORDER BY, which materialize the full shard before
    // the first checkpoint. The monotonic check below still fails closed.
    const regionCase = policy.regions
      .map(
        (r) =>
          `WHEN ST_Intersects(p.geometry, ST_GeomFromGeoJSON(${quote(
            JSON.stringify(r.geometry)
          )})) THEN ${quote(r.id)}`
      )
      .join(' ');
    let sql = `WITH matched AS (SELECT p.*, CASE ${regionCase} ELSE NULL END AS region_id
        FROM read_parquet(${quote(snapshot)}, file_row_number=true) p
        WHERE p.file_row_number > ${last} AND p.geometry IS NOT NULL ${rowFilter})
      SELECT file_row_number, region_id, to_json(normalized)
      FROM (SELECT * REPLACE (ST_AsGeoJSON(geometry) AS geometry) FROM matched WHERE region_id IS NOT NULL) normalized`;
    if (policy.singleMatch) {
      const matches = policy.regions
        .map((r) => {
          const b = geometryBounds(r.geometry);
          return `CASE WHEN CASE WHEN ST_GeometryType(p.geometry)='POINT' THEN ST_X(p.geometry)>=${
            b.xmin
          } AND ST_X(p.geometry)<=${b.xmax} AND ST_Y(p.geometry)>=${
            b.ymin
          } AND ST_Y(p.geometry)<=${
            b.ymax
          } ELSE FALSE END AND ST_Intersects(p.geometry,ST_GeomFromGeoJSON(${quote(
            JSON.stringify(r.geometry)
          )})) THEN ${quote(r.id)} ELSE NULL END`;
        })
        .join(',');
      sql = `WITH matched AS (SELECT p.*, list_filter([${matches}], x -> x IS NOT NULL) AS region_ids FROM read_parquet(${quote(
        snapshot
      )}, file_row_number=true) p WHERE p.file_row_number > ${last} AND p.geometry IS NOT NULL ${rowFilter}) SELECT file_row_number,region_id,to_json(normalized) FROM (SELECT * EXCLUDE (region_ids) REPLACE (ST_AsGeoJSON(geometry) AS geometry),list_extract(region_ids,1) AS region_id FROM matched WHERE len(region_ids)=1) normalized`;
    }
    const result = await connection.stream(sql);
    for await (const chunk of result.yieldRowsJs()) {
      const rows = [];
      let next = last;
      for (const [number, regionId, json] of chunk) {
        const n = Number(number);
        if (
          !Number.isSafeInteger(n) ||
          n <= next ||
          !policy.regions.some((r) => r.id === regionId)
        )
          throw Error('Invalid source row order');
        next = n;
        const outcome = await project({
          sourceFileRowNumber: n,
          regionId,
          source: JSON.parse(json),
        });
        if (
          !outcome ||
          !['eligible', 'quarantined'].includes(outcome.status) ||
          (outcome.status === 'eligible' &&
            (!outcome.listing ||
              typeof outcome.listing !== 'object' ||
              Array.isArray(outcome.listing)))
        )
          throw Error('Invalid private projection outcome');
        rows.push({ sourceFileRowNumber: n, regionId, outcome });
      }
      if (rows.length) {
        await sink.commit(rows, { scanId, sourceFileRowNumber: next });
        last = next;
      }
    }
    const evidence = await sourceEvidence(proxy, item, inventory);
    if (!evidence || evidence.upstreamLastModified === null)
      console.warn('source evidence unavailable');
    await sink.complete(evidence);
    return { scanId, sourceFileRowNumber: last };
  } finally {
    if (proxy) await proxy.close();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}
