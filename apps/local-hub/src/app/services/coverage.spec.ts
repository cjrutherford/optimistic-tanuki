import {
  describeCoverage,
  LocalDirectoryCoverage,
  readCoverage,
  WITHHELD_NOTE,
} from './coverage';

const cov = (
  state: LocalDirectoryCoverage['state'],
  extra: Partial<LocalDirectoryCoverage> = {}
): LocalDirectoryCoverage => ({ state, withheldReviewedDetails: 0, ...extra });

describe('readCoverage', () => {
  it('accepts valid shapes and strips extras', () => {
    expect(
      readCoverage({ state: 'partial', withheldReviewedDetails: 2, x: 1 })
    ).toEqual({ state: 'partial', withheldReviewedDetails: 2 });
    expect(
      readCoverage({
        state: 'blocked',
        reason: 'policy-withdrawn',
        withheldReviewedDetails: 0,
      })
    ).toEqual({
      state: 'blocked',
      reason: 'policy-withdrawn',
      withheldReviewedDetails: 0,
    });
  });
  it('rejects malformed values', () => {
    for (const v of [
      null,
      'empty',
      {},
      { state: 'nope', withheldReviewedDetails: 0 },
      { state: 'blocked', withheldReviewedDetails: 0 },
      { state: 'blocked', reason: 'x', withheldReviewedDetails: 0 },
      { state: 'empty', reason: 'town-ineligible', withheldReviewedDetails: 0 },
      { state: 'empty', withheldReviewedDetails: -1 },
      { state: 'empty', withheldReviewedDetails: 0.5 },
      { state: 'empty', withheldReviewedDetails: 1_000_001 },
      { state: 'empty', withheldReviewedDetails: '1' },
    ])
      expect(readCoverage(v)).toBeUndefined();
  });
});

describe('describeCoverage', () => {
  it('empty without filters says nothing is listed yet', () => {
    const v = describeCoverage(cov('empty'), 0, false);
    expect(v.kind).toBe('empty');
    expect(v.message).toBe('No businesses are listed for this town yet.');
  });
  it('empty with filters and no results uses no-match wording', () => {
    const v = describeCoverage(cov('empty'), 0, true);
    expect(v.kind).toBe('no-match');
    expect(v.message).not.toContain('for this town yet');
  });
  it('acquiring', () => {
    const v = describeCoverage(cov('acquiring'), 0, false);
    expect(v.kind).toBe('acquiring');
    expect(v.message).toBe(
      'Business listings for this town are being gathered.'
    );
  });
  it('partial shows a note with or without listings', () => {
    for (const n of [0, 3])
      expect(describeCoverage(cov('partial'), n, false)).toMatchObject({
        kind: 'partial',
        message: 'More listings are still being gathered.',
      });
  });
  it('blocked reasons', () => {
    expect(
      describeCoverage(cov('blocked', { reason: 'town-ineligible' }), 0, false)
        .message
    ).toBe("The business directory isn't available for this town.");
    expect(
      describeCoverage(cov('blocked', { reason: 'policy-withdrawn' }), 0, true)
        .message
    ).toBe('Business listings for this town have been withdrawn.');
  });
  it('unknown or absent coverage with no listings never claims no businesses', () => {
    for (const c of [cov('unknown'), undefined, null]) {
      const v = describeCoverage(c, 0, false);
      expect(v.kind).toBe('unknown');
      expect(v.message).toBe(
        "We can't tell yet whether this town has listings."
      );
      expect(v.message).not.toMatch(/no businesses/i);
    }
  });
  it('shows nothing extra when listings are present and coverage is fine', () => {
    for (const c of [cov('available'), cov('unknown'), undefined])
      expect(describeCoverage(c, 4, false).kind).toBe('none');
    expect(describeCoverage(cov('empty'), 4, false).kind).toBe('none');
  });
  it('withheld note is independent of kind', () => {
    for (const state of ['available', 'partial', 'unknown'] as const)
      expect(
        describeCoverage(cov(state, { withheldReviewedDetails: 2 }), 2, false)
          .withheldNote
      ).toBe(WITHHELD_NOTE);
    expect(WITHHELD_NOTE).not.toMatch(/suspend/i);
    expect(
      describeCoverage(cov('available'), 2, false).withheldNote
    ).toBeNull();
    expect(describeCoverage(undefined, 2, false).withheldNote).toBeNull();
  });
});
