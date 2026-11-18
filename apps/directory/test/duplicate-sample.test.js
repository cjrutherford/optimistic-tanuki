const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  drawSample,
  wrongMergeReport,
  WRONG_MERGE_LIMIT,
} = require('../src/duplicate-sample');
const {
  parseDuplicateRoute,
  parseListQuery,
  parseDecideBody,
  parseDrawBody,
  parseJudgeBody,
} = require('../src/duplicate-routes');

const ids = Array.from(
  { length: 500 },
  (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
);
const TOWN = '11111111-1111-4111-8111-111111111111';
const CASE = '22222222-2222-4222-8222-222222222222';
const base = `/internal/local-evaluation/towns/${TOWN}/duplicate-cases`;

test('the same seed over the same population draws the same sample, whatever the input order', () => {
  const a = drawSample(ids, 'round-1', 200);
  const b = drawSample([...ids].reverse(), 'round-1', 200);
  assert.equal(a.length, 200);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 200);
});

test('a different seed draws a different sample, and a small population is drawn whole', () => {
  assert.notDeepEqual(drawSample(ids, 'a', 50), drawSample(ids, 'b', 50));
  assert.equal(drawSample(ids.slice(0, 7), 'a', 200).length, 7);
  assert.deepEqual(
    drawSample(ids, 'a', 10),
    drawSample(ids, 'a', 50).slice(0, 10)
  );
});

test('wrong-merge rate is distinct over judged, and is within the limit only when complete and bounded', () => {
  assert.equal(WRONG_MERGE_LIMIT, 0.02);
  const none = wrongMergeReport(200, 0, 0);
  assert.equal(none.rate, null);
  assert.equal(none.withinLimit, false);
  const partial = wrongMergeReport(200, 100, 0);
  assert.equal(partial.rate, 0);
  assert.equal(partial.complete, false);
  assert.equal(partial.withinLimit, false);
  const clean = wrongMergeReport(200, 200, 0);
  assert.equal(clean.rate, 0);
  assert.ok(clean.upperBound95 < 0.02);
  assert.equal(clean.withinLimit, true);
  const dirty = wrongMergeReport(200, 200, 5);
  assert.equal(dirty.rate, 0.025);
  assert.equal(dirty.withinLimit, false);
  // Four of 200 is exactly 2% on the point estimate but the upper bound is above the limit.
  const edge = wrongMergeReport(200, 200, 4);
  assert.equal(edge.rate, 0.02);
  assert.equal(edge.withinLimit, false);
});

test('routes parse and refuse what they should', () => {
  assert.deepEqual(parseDuplicateRoute('GET', base, ''), {
    kind: 'list',
    townId: TOWN,
    query: {},
  });
  assert.equal(parseDuplicateRoute('GET', base, '?state=queued').kind, 'list');
  assert.equal(
    parseDuplicateRoute('GET', `${base}/${CASE}`, '').kind,
    'detail'
  );
  assert.equal(
    parseDuplicateRoute('POST', `${base}/${CASE}/decide`, '').kind,
    'decide'
  );
  assert.equal(
    parseDuplicateRoute('POST', `${base}/${CASE}/decide`, '?x=1'),
    null
  );
  assert.equal(parseDuplicateRoute('GET', `${base}/${CASE}/decide`, ''), null);
  assert.equal(
    parseDuplicateRoute('GET', `${base}/samples`, '').kind,
    'samples'
  );
  assert.equal(
    parseDuplicateRoute('POST', `${base}/samples`, '').kind,
    'sample-draw'
  );
  assert.equal(
    parseDuplicateRoute('GET', `${base}/samples/${CASE}`, '').kind,
    'sample'
  );
  assert.equal(
    parseDuplicateRoute('POST', `${base}/samples/${CASE}/judge`, '').kind,
    'sample-judge'
  );
  assert.equal(parseDuplicateRoute('GET', `${base}/nope`, ''), null);
  assert.equal(parseDuplicateRoute('DELETE', base, ''), null);
});

test('list queries are strict and bounded', () => {
  assert.deepEqual(
    parseListQuery('state=queued&rule=similar_name&limit=50&offset=100'),
    {
      state: 'queued',
      rule: 'similar_name',
      limit: 50,
      offset: 100,
    }
  );
  assert.deepEqual(parseListQuery(''), {});
  for (const bad of [
    'state=x',
    'rule=x',
    'limit=0',
    'limit=101',
    'offset=-1',
    'limit=1&limit=2',
    'q=1',
  ])
    assert.equal(parseListQuery(bad), null, bad);
});

test('bodies reject unknown keys, bad ids and missing reasons', () => {
  const actorId = randomUUID();
  assert.ok(
    parseDecideBody({
      action: 'merge',
      reason: 'same shop',
      actorId,
      expectedState: 'queued',
    })
  );
  assert.equal(
    parseDecideBody({ action: 'merge', reason: ' ', actorId }),
    null
  );
  assert.equal(parseDecideBody({ action: 'swap', reason: 'x', actorId }), null);
  assert.equal(
    parseDecideBody({ action: 'merge', reason: 'x', actorId, extra: 1 }),
    null
  );
  assert.equal(
    parseDecideBody({
      action: 'merge',
      reason: 'x',
      actorId,
      expectedState: 'weird',
    }),
    null
  );
  assert.ok(
    parseDrawBody({ round: '2026-r1', actorId, size: 200, seed: 'abc' })
  );
  assert.equal(parseDrawBody({ round: 'bad round', actorId }), null);
  assert.equal(parseDrawBody({ round: 'r', actorId, size: 5000 }), null);
  assert.ok(parseJudgeBody({ caseId: CASE, verdict: 'distinct', actorId }));
  assert.equal(
    parseJudgeBody({ caseId: CASE, verdict: 'maybe', actorId }),
    null
  );
});
