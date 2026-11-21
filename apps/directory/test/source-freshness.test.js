const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('../src/source-freshness');
const DAY = 86400000;
const now = new Date('2026-11-16T00:00:00.000Z');
const make = (lastModified, over = {}) => {
  const core = {
    scanId: 'a'.repeat(64),
    evidenceVersion: 1,
    kind: 'captured',
    releaseId: '2026-10-21.0',
    artifactUrl: 'https://x/y',
    artifactEtag: 'abc-2',
    artifactBytes: '10',
    upstreamLastModified: lastModified,
    observedAt: now,
    recorder: 'r',
    inventorySha256: 'b'.repeat(64),
    ...over,
  };
  return { ...core, recordedAt: now, evidenceSha256: f.evidenceHash(core) };
};
const aged = (ms) => make(new Date(now.getTime() - ms));

test('boundaries: day 89 fresh, 90 due, 120 due, 120 days + 1 ms stale', () => {
  assert.equal(f.scanFreshness(aged(89 * DAY), now), 'fresh');
  assert.equal(f.scanFreshness(aged(90 * DAY - 1), now), 'fresh');
  assert.equal(f.scanFreshness(aged(90 * DAY), now), 'due');
  assert.equal(f.scanFreshness(aged(120 * DAY), now), 'due');
  assert.equal(f.scanFreshness(aged(120 * DAY + 1), now), 'stale');
});
test('unknown without a row, date, with a future date or a mismatched hash', () => {
  assert.equal(f.scanFreshness(null, now), 'unknown');
  assert.equal(f.scanFreshness(make(null), now), 'unknown');
  assert.equal(f.scanFreshness(aged(-DAY), now), 'unknown');
  assert.equal(
    f.scanFreshness({ ...aged(DAY), releaseId: '2026-10-22.0' }, now),
    'unknown'
  );
  assert.equal(
    f.scanFreshness({ ...aged(DAY), evidenceSha256: '0'.repeat(64) }, now),
    'unknown'
  );
});
test('hash ignores recordedAt and normalizes dates and bytes', () => {
  const a = aged(DAY);
  assert.equal(f.evidenceHashMatches({ ...a, recordedAt: new Date(0) }), true);
  assert.equal(
    f.evidenceHashMatches({
      ...a,
      upstreamLastModified: a.upstreamLastModified.toISOString(),
      artifactBytes: 10n,
    }),
    true
  );
  assert.equal(f.evidenceHashMatches({ ...a, artifactEtag: 'other' }), false);
});
test('worst wins and unknown dominates', () => {
  assert.equal(f.worstFreshness(['fresh', 'due']), 'due');
  assert.equal(f.worstFreshness(['fresh', 'stale', 'due']), 'stale');
  assert.equal(f.worstFreshness(['fresh', 'stale', 'unknown']), 'unknown');
  assert.equal(f.worstFreshness([]), 'unknown');
});
test('page aggregation reports the oldest scan and nothing when unknown', () => {
  const page = f.aggregateFreshness(
    [
      aged(10 * DAY),
      make(new Date(now.getTime() - 100 * DAY), { releaseId: '2026-08-01.0' }),
    ],
    now
  );
  assert.equal(page.state, 'due');
  assert.equal(page.releaseId, '2026-08-01.0');
  assert.equal(page.thresholds.freshDays, 90);
  assert.equal(page.thresholds.staleDays, 120);
  const unknown = f.aggregateFreshness([aged(DAY), null], now);
  assert.deepEqual(
    [
      unknown.state,
      unknown.releaseId,
      unknown.sourcePublishedAt,
      unknown.acquiredAt,
    ],
    ['unknown', null, null, null]
  );
});
test('counts and release id parsing and plausibility', () => {
  const c = f.freshnessCounts(
    [aged(DAY), aged(100 * DAY), aged(130 * DAY), null],
    now
  );
  assert.deepEqual([c.fresh, c.due, c.stale, c.unknown], [1, 1, 1, 1]);
  assert.equal(
    c.oldestPublishedAt,
    new Date(now.getTime() - 130 * DAY).toISOString()
  );
  assert.equal(
    f.releaseIdFromObject(
      'https://h/release/2026-10-21.0/theme=places/type=place/a.parquet'
    ),
    '2026-10-21.0'
  );
  assert.equal(f.releaseIdFromObject('/release/bad/x.parquet'), null);
  assert.equal(
    f
      .plausibleLastModified(new Date('2026-10-25T00:00:00Z'), '2026-10-21.0')
      ?.getTime(),
    Date.parse('2026-10-25T00:00:00Z')
  );
  assert.equal(
    f.plausibleLastModified(new Date('2026-12-25T00:00:00Z'), '2026-10-21.0'),
    null
  );
});
