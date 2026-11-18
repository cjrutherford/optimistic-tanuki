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
