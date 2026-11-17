import test from 'node:test';
import assert from 'node:assert/strict';
import { assessReviewCoverage } from './s4a2-review-coverage.mjs';
const ids = ['a'.repeat(64), 'b'.repeat(64)],
  reviewers = ['reviewer-a', 'reviewer-b'];
const reviews = ids.flatMap((id) =>
  reviewers.map((reviewer) => ({ id, reviewer, outcome: 'ok' }))
);
test('requires independent assessments of every frozen record and reports unresolved disagreements', () => {
  assert.deepEqual(assessReviewCoverage({ ids, reviewers, reviews }), {
    status: 'complete',
    total: 2,
    missing: 0,
    unresolved: 0,
  });
  assert.deepEqual(
    assessReviewCoverage({ ids, reviewers, reviews: reviews.slice(1) }),
    { status: 'inconclusive', total: 2, missing: 1, unresolved: 0 }
  );
  const disagree = reviews.map((r, i) =>
    i === 0 ? { ...r, outcome: 'problem' } : r
  );
  assert.equal(
    assessReviewCoverage({ ids, reviewers, reviews: disagree }).unresolved,
    1
  );
  assert.equal(
    assessReviewCoverage({
      ids,
      reviewers,
      reviews: disagree,
      resolutions: [{ id: ids[0], outcome: 'problem', evidenceCompared: true }],
    }).status,
    'complete'
  );
});
test('rejects malformed, duplicate and out-of-frame reviews or unsupported resolutions', () => {
  assert.throws(
    () => assessReviewCoverage({ ids, reviewers: ['same', 'same'], reviews }),
    /reviewer/i
  );
  assert.throws(
    () =>
      assessReviewCoverage({
        ids,
        reviewers,
        reviews: [...reviews, reviews[0]],
      }),
    /duplicate/i
  );
  assert.throws(
    () =>
      assessReviewCoverage({
        ids,
        reviewers,
        reviews: [
          ...reviews,
          { id: 'c'.repeat(64), reviewer: reviewers[0], outcome: 'ok' },
        ],
      }),
    /frame/i
  );
  assert.throws(
    () =>
      assessReviewCoverage({
        ids,
        reviewers,
        reviews,
        resolutions: [{ id: ids[0], outcome: 'ok', evidenceCompared: true }],
      }),
    /resolution/i
  );
  assert.equal(
    assessReviewCoverage({ ids: [], reviewers, reviews: [] }).status,
    'inconclusive'
  );
});
test('an empty merge frame is not applicable without validating the merge process', () => {
  assert.deepEqual(
    assessReviewCoverage({
      ids: [],
      reviewers,
      reviews: [],
      frameType: 'merges',
    }),
    { status: 'not-applicable', total: 0, missing: 0, unresolved: 0 }
  );
  assert.throws(
    () =>
      assessReviewCoverage({
        ids,
        reviewers,
        reviews,
        frameType: 'unsupported',
      }),
    /frame type/i
  );
});
