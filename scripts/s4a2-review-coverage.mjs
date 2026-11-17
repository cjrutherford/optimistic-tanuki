const idPattern = /^[a-f0-9]{64}$/;
const reviewerPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const outcomes = new Set(['ok', 'problem', 'unknown']);

/** Synthetic completeness check only: inputs do not prove identity or independence. */
export function assessReviewCoverage({
  ids,
  reviewers,
  reviews,
  resolutions = [],
  frameType = 'records',
} = {}) {
  if (!['records', 'merges'].includes(frameType))
    throw Error('Invalid frame type');
  if (
    !Array.isArray(ids) ||
    ids.length > 200000 ||
    ids.some((id) => typeof id !== 'string' || !idPattern.test(id)) ||
    new Set(ids).size !== ids.length
  )
    throw Error('Invalid frame');
  if (
    !Array.isArray(reviewers) ||
    reviewers.length !== 2 ||
    reviewers.some(
      (id) => typeof id !== 'string' || !reviewerPattern.test(id)
    ) ||
    reviewers[0] === reviewers[1]
  )
    throw Error('Two distinct reviewers required');
  if (!Array.isArray(reviews) || !Array.isArray(resolutions))
    throw Error('Invalid reviews');
  const frame = new Set(ids),
    byId = new Map(ids.map((id) => [id, new Map()]));
  for (const review of reviews) {
    if (!review || !frame.has(review.id)) throw Error('Review outside frame');
    if (!reviewers.includes(review.reviewer) || !outcomes.has(review.outcome))
      throw Error('Invalid review');
    const record = byId.get(review.id);
    if (record.has(review.reviewer)) throw Error('Duplicate review');
    record.set(review.reviewer, review.outcome);
  }
  const compared = new Map();
  for (const resolution of resolutions) {
    const record = resolution && byId.get(resolution.id);
    if (
      !record ||
      record.size !== 2 ||
      record.get(reviewers[0]) === record.get(reviewers[1]) ||
      resolution.evidenceCompared !== true ||
      !['ok', 'problem'].includes(resolution.outcome) ||
      compared.has(resolution.id)
    )
      throw Error('Invalid resolution');
    compared.set(resolution.id, resolution.outcome);
  }
  let missing = 0,
    unresolved = 0;
  for (const [id, record] of byId) {
    missing += 2 - record.size;
    if (record.size === 2) {
      const a = record.get(reviewers[0]),
        b = record.get(reviewers[1]);
      if (a !== b ? !compared.has(id) : a === 'unknown') unresolved++;
    }
  }
  return {
    status:
      ids.length === 0 && frameType === 'merges'
        ? 'not-applicable'
        : ids.length > 0 && missing === 0 && unresolved === 0
        ? 'complete'
        : 'inconclusive',
    total: ids.length,
    missing,
    unresolved,
  };
}
