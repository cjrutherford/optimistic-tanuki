const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, readdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Readable } = require('node:stream');
const {
  geometrySweepConfig,
  CensusArchiveStore,
  GeometrySweepStatus,
  runGeometrySweepLoop,
} = require('../src/geometry-sweep');

test('sweep is on by default, off only when explicitly off, and validates numbers', () => {
  const config = geometrySweepConfig({});
  assert.equal(config.limit, 10);
  assert.equal(config.intervalMs, 60000);
  assert.equal(geometrySweepConfig({ DIRECTORY_AUTO_GEOMETRY: 'off' }), null);
  assert.throws(
    () => geometrySweepConfig({ DIRECTORY_AUTO_GEOMETRY: 'maybe' }),
    /Invalid/
  );
  assert.throws(
    () => geometrySweepConfig({ DIRECTORY_AUTO_GEOMETRY_LIMIT: '1000' }),
    /Invalid/
  );
});

test('archive store refuses unpinned states, bad digests, oversize and failed downloads', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'geom-store-'));
  try {
    const stream = (chunks) => Readable.from(chunks);
    const store = (fetchArchive) =>
      new CensusArchiveStore(dir, fetchArchive, 5000);
    assert.equal(store(async () => null).pinned('99'), false);
    await assert.rejects(
      store(async () => assert.fail('no fetch')).ensure('99', 'place'),
      /no_pinned_archive/
    );
    const urls = [];
    await assert.rejects(
      store(async (url) => {
        urls.push(url);
        return { ok: true, body: stream([Buffer.from('not the archive')]) };
      }).ensure('13', 'place'),
      /archive_digest_mismatch/
    );
    assert.match(
      urls[0],
      /^https:\/\/www2\.census\.gov\/geo\/tiger\/TIGER2026\/PLACE\/tl_2026_13_place\.zip$/
    );
    await assert.rejects(
      store(async () => ({
        ok: true,
        body: stream(
          [Buffer.alloc(1024 * 1024, 1)].concat(
            Array.from({ length: 32 }, () => Buffer.alloc(1024 * 1024, 1))
          )
        ),
      })).ensure('13', 'cousub'),
      /archive_too_large/
    );
    await assert.rejects(
      store(async () => ({ ok: false, body: null })).ensure('13', 'place'),
      /archive_unavailable/
    );
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loop drains a backlog quickly, backs off when idle or failing, and survives a throw', async () => {
  const controller = new AbortController();
  const status = new GeometrySweepStatus(true);
  const results = [
    {
      status: 'ok',
      examined: 3,
      installed: 3,
      queued: 0,
      errors: 0,
      reasons: {},
    },
    {
      status: 'ok',
      examined: 0,
      installed: 0,
      queued: 0,
      errors: 0,
      reasons: {},
    },
    new Error('boom'),
    {
      status: 'paused',
      examined: 0,
      installed: 0,
      queued: 0,
      errors: 0,
      reasons: {},
    },
  ];
  const waits = [];
  await runGeometrySweepLoop({
    signal: controller.signal,
    intervalMs: 60000,
    status,
    log: () => undefined,
    run: async () => {
      const next = results.shift();
      if (!next) throw Error('done');
      if (next instanceof Error) throw next;
      return next;
    },
    pause: async (ms) => {
      waits.push(ms);
      if (!results.length) controller.abort();
    },
  });
  assert.deepEqual(waits, [2000, 60000, 60000, 60000]);
  assert.equal(status.snapshot().lastStatus, 'paused');
});
