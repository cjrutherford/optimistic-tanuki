import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInflateRaw } from 'node:zlib';
import {
  atpFeatureToRow,
  type AtpArchivePin,
  type AtpRightsPolicy,
} from '../../directory/src/alltheplaces';
import type { AtpSnapshot } from '../../directory/src/alltheplaces-acquisition';

/**
 * Builds the local snapshot the standalone AllThePlaces stage reads. The pinned `output.zip` is downloaded once, its
 * size and SHA-256 are checked against the rights-policy pin (a mismatch fails closed and nothing is derived), each
 * spider's GeoJSON is streamed out of it, and the mapped low-risk places inside the US are written as an Overture-shaped
 * Parquet file. The archive and the intermediate NDJSON are deleted; only the derived snapshot is kept.
 */
export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  offset: number;
}

const u16 = (b: Buffer, o: number) => b.readUInt16LE(o);
const u32 = (b: Buffer, o: number) => b.readUInt32LE(o);

/** Reads a zip's central directory by range, so entries can be streamed without unpacking the archive. */
export async function readZipDirectory(path: string): Promise<ZipEntry[]> {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const tailLength = Math.min(size, 65557 + 20 + 56);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, size - tailLength);
    let eocd = -1;
    for (let i = tailLength - 22; i >= 0; i--)
      if (u32(tail, i) === 0x06054b50) {
        eocd = i;
        break;
      }
    if (eocd < 0) throw Error('Invalid archive: no end of central directory');
    let entries = u16(tail, eocd + 10);
    let cdSize = u32(tail, eocd + 12);
    let cdOffset = u32(tail, eocd + 16);
    if (
      entries === 0xffff ||
      cdSize === 0xffffffff ||
      cdOffset === 0xffffffff
    ) {
      const loc = eocd - 20;
      if (loc < 0 || u32(tail, loc) !== 0x07064b50)
        throw Error('Invalid archive: zip64 locator missing');
      const z64At = Number(tail.readBigUInt64LE(loc + 8));
      const z = Buffer.alloc(56);
      await handle.read(z, 0, 56, z64At);
      if (u32(z, 0) !== 0x06064b50)
        throw Error('Invalid archive: zip64 record missing');
      entries = Number(z.readBigUInt64LE(32));
      cdSize = Number(z.readBigUInt64LE(40));
      cdOffset = Number(z.readBigUInt64LE(48));
    }
    if (cdOffset + cdSize > size) throw Error('Invalid archive: directory');
    const cd = Buffer.alloc(cdSize);
    await handle.read(cd, 0, cdSize, cdOffset);
    const out: ZipEntry[] = [];
    let p = 0;
    for (let i = 0; i < entries; i++) {
      if (p + 46 > cd.length || u32(cd, p) !== 0x02014b50)
        throw Error('Invalid archive: directory entry');
      const method = u16(cd, p + 10);
      const compressedSize = u32(cd, p + 20);
      const nameLength = u16(cd, p + 28);
      const extraLength = u16(cd, p + 30);
      const commentLength = u16(cd, p + 32);
      const offset = u32(cd, p + 42);
      if (compressedSize === 0xffffffff || offset === 0xffffffff)
        throw Error('Invalid archive: entry needs zip64');
      out.push({
        name: cd.toString('utf8', p + 46, p + 46 + nameLength),
        method,
        compressedSize,
        offset,
      });
      p += 46 + nameLength + extraLength + commentLength;
    }
    return out;
  } finally {
    await handle.close();
  }
}

/** Streams one entry's uncompressed bytes. Only stored (0) and deflated (8) entries are accepted. */
export async function entryStream(
  path: string,
  entry: ZipEntry
): Promise<Readable> {
  if (entry.method !== 0 && entry.method !== 8)
    throw Error('Invalid archive: unsupported compression');
  // A spider that found nothing is a zero-length stored entry; there is nothing to read.
  if (entry.compressedSize === 0) return Readable.from([]);
  const handle = await open(path, 'r');
  let start: number;
  try {
    const header = Buffer.alloc(30);
    await handle.read(header, 0, 30, entry.offset);
    if (u32(header, 0) !== 0x04034b50)
      throw Error('Invalid archive: local header');
    start = entry.offset + 30 + u16(header, 26) + u16(header, 28);
  } finally {
    await handle.close();
  }
  const raw = createReadStream(path, {
    start,
    end: start + entry.compressedSize - 1,
  });
  return entry.method === 8 ? raw.pipe(createInflateRaw()) : raw;
}

/** GeoJSON features, one per line inside a FeatureCollection (the AllThePlaces layout); a one-line collection also works. */
export async function* geojsonFeatures(
  input: Readable
): AsyncGenerator<unknown> {
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const raw of lines) {
    let line = raw.trim();
    if (line.endsWith(',')) line = line.slice(0, -1);
    if (!line.startsWith('{') || !line.endsWith('}')) continue;
    let value: { type?: unknown; features?: unknown };
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    if (value?.type === 'Feature') yield value;
    else if (
      value?.type === 'FeatureCollection' &&
      Array.isArray(value.features)
    )
      for (const f of value.features) yield f;
  }
}

/** Continental US, Alaska, Hawaii and the territories: the snapshot is for US towns. */
export const US_BOUNDS = { xmin: -180, ymin: 17, xmax: -64, ymax: 72 };
const inUs = (lon: number, lat: number) =>
  lon >= US_BOUNDS.xmin &&
  lon <= US_BOUNDS.xmax &&
  lat >= US_BOUNDS.ymin &&
  lat <= US_BOUNDS.ymax;

export async function archiveToNdjson(
  zipPath: string,
  ndjsonPath: string
): Promise<{ rows: number; entries: number; bbox: AtpSnapshot['bbox'] }> {
  const entries = (await readZipDirectory(zipPath)).filter((e) =>
    e.name.toLowerCase().endsWith('.geojson')
  );
  const out = createWriteStream(ndjsonPath, { mode: 0o600, flags: 'w' });
  let rows = 0;
  const bbox: AtpSnapshot['bbox'] = [180, 90, -180, -90];
  const write = (line: string) =>
    out.write(line)
      ? Promise.resolve()
      : new Promise<void>((r) => out.once('drain', r));
  try {
    for (const entry of entries) {
      const spider =
        entry.name
          .split('/')
          .pop()
          ?.replace(/\.geojson$/i, '') ?? '';
      for await (const feature of geojsonFeatures(
        await entryStream(zipPath, entry)
      )) {
        const row = atpFeatureToRow(feature, spider);
        if (!row || !inUs(row.lon, row.lat)) continue;
        rows++;
        bbox[0] = Math.min(bbox[0], row.lon);
        bbox[1] = Math.min(bbox[1], row.lat);
        bbox[2] = Math.max(bbox[2], row.lon);
        bbox[3] = Math.max(bbox[3], row.lat);
        await write(
          `${JSON.stringify({
            id: row.id ?? null,
            name: row.names.primary,
            basic_category: row.basic_category,
            address: row.address,
            lon: row.lon,
            lat: row.lat,
          })}\n`
        );
      }
    }
  } finally {
    await new Promise<void>((resolve) => out.end(resolve));
  }
  return { rows, entries: entries.length, bbox };
}

export interface SnapshotConnection {
  run: (sql: string) => Promise<unknown>;
}
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;

export async function ndjsonToParquet(
  connection: SnapshotConnection,
  ndjsonPath: string,
  parquetPath: string
): Promise<void> {
  await connection.run('SET threads = 1; SET preserve_insertion_order = true');
  await connection.run(
    `COPY (SELECT id, struct_pack("primary" := name) AS names, basic_category,
        struct_pack("primary" := basic_category, hierarchy := [basic_category]) AS taxonomy,
        CASE WHEN address IS NULL THEN NULL ELSE [address] END AS addresses,
        ST_Point(lon, lat) AS geometry
       FROM read_ndjson(${quote(
         ndjsonPath
       )}, columns = {id: 'VARCHAR', name: 'VARCHAR', basic_category: 'VARCHAR', address: 'VARCHAR', lon: 'DOUBLE', lat: 'DOUBLE'}))
     TO ${quote(parquetPath)} (FORMAT parquet)`
  );
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(
    createReadStream(path),
    async (source: AsyncIterable<Buffer>) => {
      for await (const chunk of source) hash.update(chunk);
    }
  );
  return hash.digest('hex');
}

/** Downloads the pinned archive, enforcing the pinned size and SHA-256. Nothing is kept on a mismatch. */
export async function downloadPinnedArchive(
  pin: AtpArchivePin,
  destination: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const response = await fetchImpl(pin.url, {
    signal: AbortSignal.timeout(3_600_000),
    redirect: 'error',
  });
  if (!response.ok || !response.body)
    throw Error(`Archive download failed: ${response.status}`);
  const hash = createHash('sha256');
  let size = 0;
  try {
    await pipeline(
      Readable.fromWeb(response.body as never),
      new Transform({
        transform(chunk, _encoding, done) {
          size += chunk.length;
          if (size > pin.sizeBytes)
            return done(Error('Invalid archive: exceeds the pinned size'));
          hash.update(chunk);
          done(null, chunk);
        },
      }),
      createWriteStream(destination, { mode: 0o600, flags: 'w' })
    );
    if (size !== pin.sizeBytes || hash.digest('hex') !== pin.sha256)
      throw Error('Invalid archive: size or SHA-256 differs from the pin');
  } catch (error) {
    await rm(destination, { force: true });
    throw error;
  }
}

export interface SnapshotProviderOptions {
  policy: AtpRightsPolicy;
  cacheDir: string;
  connection: () => Promise<SnapshotConnection>;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}
interface SnapshotMeta {
  archiveSha256: string;
  sha256: string;
  size: number;
  rows: number;
  bbox: AtpSnapshot['bbox'];
}

/** Returns the cached snapshot for the pinned archive, building it (and reserving the budget attempt) on first use. */
export function createAtpSnapshotProvider(
  options: SnapshotProviderOptions
): (reserve: (attempt: any) => Promise<unknown>) => Promise<AtpSnapshot> {
  const { policy } = options;
  const dir = join(
    options.cacheDir,
    `atp-${policy.archive.sha256.slice(0, 16)}`
  );
  const parquet = join(dir, 'snapshot.parquet');
  const metaPath = join(dir, 'snapshot.json');
  const log = options.log ?? (() => undefined);
  let building: Promise<AtpSnapshot> | null = null;

  const cached = async (): Promise<AtpSnapshot | null> => {
    try {
      const meta = JSON.parse(await readFile(metaPath, 'utf8')) as SnapshotMeta;
      const info = await stat(parquet);
      if (
        meta.archiveSha256 !== policy.archive.sha256 ||
        info.size !== meta.size ||
        (await sha256File(parquet)) !== meta.sha256
      )
        return null;
      return { path: parquet, ...meta };
    } catch {
      return null;
    }
  };

  const build = async (
    reserve: (attempt: any) => Promise<unknown>
  ): Promise<AtpSnapshot> => {
    // The budget reservation comes first: no budget or a paused kill switch means no download.
    await reserve({
      asset: policy.archive.url,
      etag: policy.archive.sha256,
      method: 'GET',
    });
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const zip = join(dir, 'archive.zip');
    const ndjson = join(dir, 'rows.ndjson');
    const partial = join(dir, 'snapshot.parquet.partial');
    try {
      log('atp snapshot: downloading the pinned archive');
      await downloadPinnedArchive(policy.archive, zip, options.fetchImpl);
      log('atp snapshot: deriving rows');
      const derived = await archiveToNdjson(zip, ndjson);
      await ndjsonToParquet(await options.connection(), ndjson, partial);
      await rename(partial, parquet);
      const meta: SnapshotMeta = {
        archiveSha256: policy.archive.sha256,
        sha256: await sha256File(parquet),
        size: (await stat(parquet)).size,
        rows: derived.rows,
        bbox: derived.bbox,
      };
      await writeFile(metaPath, JSON.stringify(meta), { mode: 0o600 });
      log(`atp snapshot: ready (${derived.rows} rows)`);
      return { path: parquet, ...meta };
    } finally {
      await Promise.all(
        [zip, ndjson, partial].map((f) => rm(f, { force: true }))
      );
    }
  };

  return async (reserve) => {
    const hit = await cached();
    if (hit) return hit;
    building ??= build(reserve).finally(() => {
      building = null;
    });
    return building;
  };
}
