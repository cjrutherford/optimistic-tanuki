const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  acquisitionSweepConfig,
  loadAcquisitionInputs,
  AcquisitionSweepStatus,
  runAcquisitionSweepLoop,
} = require('../src/acquisition-sweep');
const {
  assetsForBounds,
} = require('../../directory/src/overture-auto-acquisition');
const {
  isAcquisitionAuthorized,
  anyAcquisitionAuthorized,
} = require('../../directory/src/acquisition-authorization');

test('acquisition is on by default, off only when explicitly off, bounded to 2 towns', () => {
  const c = acquisitionSweepConfig({});
  assert.equal(c.limit, 2);
  assert.equal(
    acquisitionSweepConfig({ DIRECTORY_AUTO_ACQUISITION: 'off' }),
    null
  );
  assert.throws(() =>
    acquisitionSweepConfig({ DIRECTORY_AUTO_ACQUISITION: 'x' })
  );
  assert.throws(() =>
    acquisitionSweepConfig({ DIRECTORY_AUTO_ACQUISITION_LIMIT: '500' })
  );
});

test('only Overture and AllThePlaces are authorized for acquisition; Geoapify is not', () => {
  assert.equal(isAcquisitionAuthorized('overture'), true);
  assert.equal(isAcquisitionAuthorized('alltheplaces'), true);
  for (const p of ['geoapify', 'foursquare', 'google_places', 'yelp', ''])
    assert.equal(isAcquisitionAuthorized(p), false);
  assert.equal(anyAcquisitionAuthorized(), true);
});

test('inputs need the pinned release and an approved rights policy', () => {
  const cfg = { inventoryFile: 'inv', rightsPolicyFile: 'rp' };
  const files = (release, policyRelease) => (f) =>
    f === 'inv'
      ? JSON.stringify({ release, items: [] })
      : JSON.stringify([{ releaseId: policyRelease }]);
  assert.ok(loadAcquisitionInputs(cfg, files('2026-10-21.0', '2026-10-21.0')));
  assert.equal(
    loadAcquisitionInputs(cfg, files('2026-10-21.0', 'other')),
    null
  );
  assert.equal(
    loadAcquisitionInputs(cfg, files('other', '2026-10-21.0')),
    null
  );
  assert.equal(
    loadAcquisitionInputs(
      { ...cfg, rightsPolicyFile: '' },
      files('2026-10-21.0', '2026-10-21.0')
    ),
    null
  );
});

test('assets are selected by bounds overlap in id order', () => {
  const items = [
    { id: '2', bbox: [0, 0, 10, 10] },
    { id: '1', bbox: [5, 5, 20, 20] },
    { id: '3', bbox: [50, 50, 60, 60] },
  ];
  assert.deepEqual(
    assetsForBounds(items, [8, 8, 9, 9]).map((i) => i.id),
    ['1', '2']
  );
  assert.deepEqual(assetsForBounds(items, [100, 0, 101, 1]), []);
});

test('loop records status, never throws, and stops on abort', async () => {
  const status = new AcquisitionSweepStatus(true);
  const ctl = new AbortController();
  let n = 0;
  await runAcquisitionSweepLoop({
    signal: ctl.signal,
    intervalMs: 1,
    status,
    log: () => undefined,
    pause: async () => {
      if (++n >= 2) ctl.abort();
    },
    run: async () => {
      if (n === 0) throw Error('boom');
      return {
        status: 'paused',
        examined: 0,
        succeeded: 0,
        empty: 0,
        partial: 0,
        failed: 0,
        blocked: 0,
        recordedPending: 0,
      };
    },
  });
  assert.equal(status.snapshot().lastStatus, 'paused');
});

test('a promoted release supplies the inputs; otherwise the files do', async () => {
  const {
    resolveAcquisitionInputs,
    createStacReleaseSource,
  } = require('../src/acquisition-sweep');
  const cfg = { inventoryFile: 'inv', rightsPolicyFile: 'rp' };
  const files = (f) =>
    f === 'inv'
      ? JSON.stringify({ release: '2026-10-21.0', items: [] })
      : JSON.stringify([{ releaseId: '2026-10-21.0' }]);
  const dbWith = (rows) => ({ query: async () => rows });
  const pinned = await resolveAcquisitionInputs(cfg, dbWith([]), files);
  assert.equal(pinned.inventory.release, '2026-10-21.0');
  const inventory = { release: '2026-11-18.0', items: [{ id: 'x' }] };
  const rights = { releaseId: '2026-11-18.0' };
  const promoted = await resolveAcquisitionInputs(
    cfg,
    dbWith([{ release: '2026-11-18.0', inventory, rightsPolicy: rights }]),
    files
  );
  assert.deepEqual(promoted, { inventory, rights });
  // A promoted release without stored inputs yields nothing rather than falling back to the old pin.
  assert.equal(
    await resolveAcquisitionInputs(
      cfg,
      dbWith([
        { release: '2026-11-18.0', inventory: null, rightsPolicy: null },
      ]),
      files
    ),
    null
  );

  const base = 'https://stac.overturemaps.org';
  const fetched = [];
  const src = createStacReleaseSource(async (url) => {
    fetched.push(url);
    const body = url.endsWith('/catalog.json')
      ? {
          links: [
            { rel: 'self', href: `${base}/catalog.json` },
            { rel: 'child', href: `${base}/2026-10-21.0/catalog.json` },
            { rel: 'child', href: `${base}/2026-11-18.0/catalog.json` },
            { rel: 'child', href: `${base}/not-a-release/catalog.json` },
          ],
        }
      : {
          license: 'other',
          links: [
            {
              rel: 'license',
              href: 'https://docs.overturemaps.org/attribution/',
            },
          ],
        };
    return { ok: true, status: 200, json: async () => body };
  });
  assert.deepEqual(await src.listReleases(), ['2026-10-21.0', '2026-11-18.0']);
  assert.equal(
    await src.licenseOf('2026-11-18.0'),
    'other|https://docs.overturemaps.org/attribution/'
  );
  await assert.rejects(src.licenseOf('../x'), /Invalid release/);
  assert.ok(fetched.every((u) => u.startsWith(base)));
});
