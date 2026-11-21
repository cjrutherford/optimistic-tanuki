import test from 'node:test';
import assert from 'node:assert/strict';
import { planQualitySample } from './s4a2-sampling.mjs';
const seed = 'a'.repeat(64),
  release = 'b'.repeat(64),
  protocol = 'c'.repeat(64);
const frame = Array.from({ length: 12 }, (_, i) => ({
  id: (i + 1).toString(16).padStart(64, '0'),
  town: i < 6 ? 'town-a' : 'town-b',
  contributor: i % 2 ? 'source-a' : 'source-b',
}));
const allocation = [
  { town: 'town-a', contributor: 'source-a', count: 2 },
  { town: 'town-a', contributor: 'source-b', count: 1 },
  { town: 'town-b', contributor: 'source-a', count: 1 },
  { town: 'town-b', contributor: 'source-b', count: 2 },
];
test('a fixed frame, allocation and seed produce a reproducible sample with explicit inclusion probabilities', () => {
  const args = {
    frame,
    allocation,
    seed,
    releaseSha256: release,
    protocolSha256: protocol,
    targetCount: 6,
  };
  const a = planQualitySample(args),
    b = planQualitySample({
      ...args,
      frame: [...frame].reverse(),
      allocation: [...allocation].reverse(),
    });
  assert.deepEqual(a, b);
  assert.equal(a.selected.length, 6);
  assert.equal(new Set(a.selected.map((r) => r.id)).size, 6);
  assert.ok(
    a.selected.every(
      (r) => r.probability.numerator > 0 && r.probability.denominator === 3
    )
  );
  assert.equal(a.coverage, 'all-strata-represented');
});
test('a full-frame review keeps every record, and an omitted stratum is inconclusive', () => {
  const all = allocation.map((a) => ({ ...a, count: 3 }));
  const result = planQualitySample({
    frame,
    allocation: all,
    seed,
    releaseSha256: release,
    protocolSha256: protocol,
    targetCount: 12,
  });
  assert.equal(result.selected.length, 12);
  assert.ok(
    result.selected.every(
      (r) => r.probability.numerator === r.probability.denominator
    )
  );
  const partial = allocation.map((a, i) => ({
    ...a,
    count: i === 0 ? 0 : a.count,
  }));
  assert.equal(
    planQualitySample({
      frame,
      allocation: partial,
      seed,
      releaseSha256: release,
      protocolSha256: protocol,
      targetCount: 4,
    }).coverage,
    'incomplete'
  );
});
test('rejects duplicate identities, missing allocations and malformed evidence before selecting', () => {
  const args = {
    frame,
    allocation,
    seed,
    releaseSha256: release,
    protocolSha256: protocol,
    targetCount: 6,
  };
  assert.throws(
    () => planQualitySample({ ...args, frame: [...frame, frame[0]] }),
    /duplicate/i
  );
  assert.throws(
    () => planQualitySample({ ...args, allocation: allocation.slice(1) }),
    /allocation/i
  );
  assert.throws(() => planQualitySample({ ...args, seed: 'weak' }), /seed/i);
  assert.throws(
    () => planQualitySample({ ...args, targetCount: 7 }),
    /allocation/i
  );
});
test('an empty frame cannot be reported as complete coverage', () => {
  const result = planQualitySample({
    frame: [],
    allocation: [],
    seed,
    releaseSha256: release,
    protocolSha256: protocol,
    targetCount: 0,
  });
  assert.equal(result.coverage, 'incomplete');
  assert.equal(result.sampleSize, 0);
});
