const test = require('node:test'),
  assert = require('node:assert/strict');
const q = require('../src/run-quality');

const base = {
  rows: 1000,
  name: 1000,
  category: 1000,
  addressPresent: 0,
  addressInvalid: 0,
  phonePresent: 0,
  phoneInvalid: 0,
  websitePresent: 0,
  hoursPresent: 0,
  outOfBoundary: 0,
  duplicates: 10,
};
const L = q.DEFAULT_QUALITY_LIMITS;

test('a typical live run passes and the scorecard carries limits and version', () => {
  const s = q.scoreQuality(base, L);
  assert.equal(s.passed, true);
  assert.deepEqual(s.breaches, []);
  assert.equal(s.duplicates.rate, 0.01);
  assert.equal(s.version, q.QUALITY_VERSION);
});

test('each limit breaches independently', () => {
  assert.deepEqual(
    q.scoreQuality({ ...base, outOfBoundary: 100 }, L).breaches,
    ['maxOutOfBoundaryRate']
  );
  assert.deepEqual(q.scoreQuality({ ...base, duplicates: 100 }, L).breaches, [
    'maxDuplicateRate',
  ]);
  assert.deepEqual(q.scoreQuality({ ...base, name: 500 }, L).breaches, [
    'minNameCompleteness',
  ]);
  assert.deepEqual(
    q.scoreQuality({ ...base, phonePresent: 100, phoneInvalid: 90 }, L)
      .breaches,
    ['maxInvalidPhoneRate']
  );
  assert.deepEqual(
    q.scoreQuality({ ...base, addressPresent: 100, addressInvalid: 90 }, L)
      .breaches,
    ['maxInvalidAddressRate']
  );
});

test('small and empty runs are not judged on rates', () => {
  assert.equal(
    q.scoreQuality(
      {
        ...base,
        rows: 10,
        name: 10,
        category: 10,
        outOfBoundary: 9,
        duplicates: 5,
      },
      L
    ).passed,
    true
  );
  assert.equal(
    q.scoreQuality({ ...base, rows: 0, name: 0, category: 0, duplicates: 0 }, L)
      .passed,
    true
  );
});

test('limits are configurable and bad overrides are ignored whole', () => {
  assert.deepEqual(q.qualityLimitsFromEnv({}), L);
  const o = q.qualityLimitsFromEnv({
    DIRECTORY_QUALITY_LIMITS:
      '{"maxDuplicateRate":0.5,"maxOutOfBoundaryRate":7,"minRowsForRates":"x"}',
  });
  assert.equal(o.maxDuplicateRate, 0.5);
  assert.equal(o.maxOutOfBoundaryRate, L.maxOutOfBoundaryRate);
  assert.equal(o.minRowsForRates, L.minRowsForRates);
  assert.deepEqual(
    q.qualityLimitsFromEnv({ DIRECTORY_QUALITY_LIMITS: '{nope' }),
    L
  );
  assert.equal(q.scoreQuality({ ...base, duplicates: 100 }, o).passed, true);
});
