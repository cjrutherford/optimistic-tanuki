const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const zlib = require('node:zlib');
const snap = require('../src/alltheplaces-snapshot');

const fixture = readFileSync(
  join(
    __dirname,
    '../../directory/test/fixtures/alltheplaces-synthetic.geojson'
  )
);
const crc32 = (buf) => {
  let c,
    crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
};
/** A minimal zip writer: [name, Buffer, method] entries. */
function makeZip(entries) {
  const parts = [],
    central = [];
  let offset = 0;
  for (const [name, data, method = 8] of entries) {
    const body = method === 8 ? zlib.deflateRawSync(data) : data;
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, body);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt32LE(crc32(data), 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cdBuf, eocd]);
}
const tmp = () => mkdtempSync(join(tmpdir(), 'atp-test-'));
// One feature per line, as the real archive lays them out.
const lined = Buffer.from(
  '{"type":"FeatureCollection","features":[\n' +
    JSON.parse(fixture.toString())
      .features.map((f) => JSON.stringify(f))
      .join(',\n') +
    '\n]}\n'
);

test('zip reader lists entries and streams deflated and stored data', async () => {
  const dir = tmp();
  try {
    const zip = join(dir, 'a.zip');
    writeFileSync(
      zip,
      makeZip([
        ['syn_spider.geojson', lined],
        ['notes.txt', Buffer.from('hello'), 0],
      ])
    );
    const entries = await snap.readZipDirectory(zip);
    assert.deepEqual(
      entries.map((e) => e.name),
      ['syn_spider.geojson', 'notes.txt']
    );
    const text = async (e) => {
      const chunks = [];
      for await (const c of await snap.entryStream(zip, e)) chunks.push(c);
      return Buffer.concat(chunks);
    };
    assert.deepEqual(await text(entries[0]), lined);
    assert.equal((await text(entries[1])).toString(), 'hello');
    writeFileSync(join(dir, 'bad.zip'), Buffer.from('not a zip at all'));
    await assert.rejects(
      snap.readZipDirectory(join(dir, 'bad.zip')),
      /Invalid archive/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('archive becomes NDJSON of mapped US places only', async () => {
  const dir = tmp();
  try {
    const abroad = Buffer.from(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { ref: '9', name: 'Abroad Cafe', amenity: 'cafe' },
            geometry: { type: 'Point', coordinates: [2.35, 48.85] },
          },
        ],
      })
    );
    const zip = join(dir, 'a.zip');
    writeFileSync(
      zip,
      makeZip([
        ['syn_spider.geojson', lined],
        ['abroad.geojson', abroad],
      ])
    );
    const out = join(dir, 'rows.ndjson');
    const r = await snap.archiveToNdjson(zip, out);
    assert.equal(r.rows, 2);
    assert.equal(r.entries, 2);
    const rows = readFileSync(out, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    assert.deepEqual(
      rows.map((x) => x.name),
      ['Synthetic Diner', 'Synthetic Hardware']
    );
    assert.equal(rows[0].id, 'syn_spider:1001');
    assert.deepEqual(r.bbox, [-87.6, 31.5, -87.5, 31.6]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const pinFor = (body) => ({
  runId: '2026-11-07-13-32-32',
  url: 'https://alltheplaces-data.openaddresses.io/runs/2026-11-07-13-32-32/output.zip',
  sizeBytes: body.length,
  sha256: createHash('sha256').update(body).digest('hex'),
});
const fetchOf = (body) => async () => new Response(body, { status: 200 });

test('download enforces the pinned size and SHA-256, and keeps nothing on a mismatch', async () => {
  const dir = tmp();
  try {
    const body = Buffer.from('archive-bytes');
    const dest = join(dir, 'ok.zip');
    await snap.downloadPinnedArchive(pinFor(body), dest, fetchOf(body));
    assert.equal(readFileSync(dest).toString(), 'archive-bytes');
    const bad = join(dir, 'bad.zip');
    await assert.rejects(
      snap.downloadPinnedArchive(
        pinFor(Buffer.from('other-bytes!')),
        bad,
        fetchOf(body)
      ),
      /pin/
    );
    assert.equal(existsSync(bad), false);
    const big = join(dir, 'big.zip');
    await assert.rejects(
      snap.downloadPinnedArchive(
        { ...pinFor(body), sizeBytes: 3 },
        big,
        fetchOf(body)
      ),
      /pinned size/
    );
    assert.equal(existsSync(big), false);
    await assert.rejects(
      snap.downloadPinnedArchive(
        pinFor(body),
        join(dir, 'x.zip'),
        async () => new Response('', { status: 503 })
      ),
      /503/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('snapshot provider reserves budget first, builds once, then serves from cache', async () => {
  const dir = tmp();
  try {
    const zip = makeZip([['syn_spider.geojson', lined]]);
    const policy = { archive: pinFor(zip) };
    let fetches = 0;
    const order = [];
    const provider = snap.createAtpSnapshotProvider({
      policy,
      cacheDir: dir,
      fetchImpl: async () => {
        order.push('fetch');
        fetches++;
        return new Response(zip, { status: 200 });
      },
      connection: async () => ({
        run: async (sql) => {
          order.push('duck');
          if (/COPY/.test(sql)) {
            const m = /TO '([^']+)'/.exec(sql);
            writeFileSync(m[1], 'parquet');
          }
        },
      }),
    });
    const reserve = async () => order.push('reserve');
    const a = await provider(reserve);
    assert.equal(a.rows, 2);
    assert.deepEqual(order.slice(0, 2), ['reserve', 'fetch']);
    const b = await provider(reserve);
    assert.equal(fetches, 1);
    assert.equal(b.sha256, a.sha256);
    assert.equal(
      existsSync(
        join(dir, `atp-${policy.archive.sha256.slice(0, 16)}`, 'archive.zip')
      ),
      false
    );
    // A budget refusal means no download.
    const dir2 = tmp();
    let fetched = false;
    const refused = snap.createAtpSnapshotProvider({
      policy,
      cacheDir: dir2,
      fetchImpl: async () => ((fetched = true), new Response(zip)),
      connection: async () => ({ run: async () => undefined }),
    });
    await assert.rejects(
      refused(async () => {
        throw Error('paused');
      }),
      /paused/
    );
    assert.equal(fetched, false);
    rmSync(dir2, { recursive: true, force: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('DuckDB writes an Overture-shaped parquet the extractor can read', async (t) => {
  const { SpatialSession } = require('../src/geometry-sweep');
  const spatial = new SpatialSession();
  const dir = tmp();
  try {
    let conn;
    try {
      conn = await spatial.connection();
    } catch {
      return t.skip('DuckDB spatial extension unavailable');
    }
    const nd = join(dir, 'r.ndjson');
    const zip = join(dir, 'a.zip');
    writeFileSync(zip, makeZip([['syn_spider.geojson', lined]]));
    await snap.archiveToNdjson(zip, nd);
    const pq = join(dir, 's.parquet');
    await snap.ndjsonToParquet(conn, nd, pq);
    const reader = await conn.runAndReadAll(
      `SELECT id, names."primary" AS name, basic_category, ST_AsGeoJSON(geometry) AS g FROM read_parquet('${pq}', file_row_number=true) ORDER BY file_row_number`
    );
    const rows = reader.getRowObjects();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, 'Synthetic Diner');
    assert.deepEqual(JSON.parse(rows[0].g).coordinates, [-87.5, 31.5]);
  } finally {
    spatial.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an empty stored entry (a spider with no results) reads as no features', async () => {
  const dir = tmp();
  try {
    const zip = join(dir, 'a.zip');
    writeFileSync(
      zip,
      makeZip([
        ['empty.geojson', Buffer.alloc(0), 0],
        ['syn_spider.geojson', lined],
      ])
    );
    const [empty] = await snap.readZipDirectory(zip);
    const out = [];
    for await (const f of snap.geojsonFeatures(
      await snap.entryStream(zip, empty)
    ))
      out.push(f);
    assert.equal(out.length, 0);
    const r = await snap.archiveToNdjson(zip, join(dir, 'r.ndjson'));
    assert.equal(r.rows, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
