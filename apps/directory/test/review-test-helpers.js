const { randomUUID } = require('node:crypto');
const {
  recordHumanAddressReviewDecision,
  undoAddressReviewDecision,
  addressVersionTokens,
} = require('../src/address-review-store');

/** Records a human address decision against the candidate's current version token unless the test names one. */
async function recordHuman(db, input) {
  const expectedVersionToken =
    input.expectedVersionToken ??
    (await addressVersionTokens(db, [input.candidateId])).get(
      input.candidateId
    ) ??
    'f'.repeat(64);
  return recordHumanAddressReviewDecision(db, {
    decisionId: randomUUID(),
    ...input,
    expectedVersionToken,
  });
}

async function undoHuman(db, input) {
  const expectedVersionToken =
    input.expectedVersionToken ??
    (await addressVersionTokens(db, [input.candidateId])).get(
      input.candidateId
    );
  return undoAddressReviewDecision(db, {
    decisionId: randomUUID(),
    reason: 'undo',
    ...input,
    expectedVersionToken,
  });
}

module.exports = { recordHuman, undoHuman };
