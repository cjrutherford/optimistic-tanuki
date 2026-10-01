import { promotionOf, type PromotionCandidate } from '../src/promotion.js';

const candidate = (
  overrides: Partial<PromotionCandidate> = {}
): PromotionCandidate => ({
  state: 'accepted',
  officialStanding: null,
  corroborated: false,
  confirmedByRecord: false,
  artifact: null,
  disclosedInterest: null,
  ...overrides,
});

describe('the path from a contribution to a briefing', () => {
  it('lets an official through, labeled as the record', () => {
    const verdict = promotionOf(
      candidate({ officialStanding: 'official-record' })
    );
    expect(verdict.path).toBe('official-record');
    expect(verdict.reasons[0]!).toMatch(/confirmed by a call/u);
  });

  it('keeps out an official account that was never confirmed by callback', () => {
    expect(
      promotionOf(candidate({ officialStanding: 'submitting-official' }))
        .promoted
    ).toBe(false);
  });

  it('needs both corroboration and a record for a resident report', () => {
    expect(promotionOf(candidate({ corroborated: true })).promoted).toBe(false);
    expect(promotionOf(candidate({ confirmedByRecord: true })).promoted).toBe(
      false
    );
    expect(
      promotionOf(candidate({ corroborated: true, confirmedByRecord: true }))
        .path
    ).toBe('confirmed');
  });

  it('says what a report is still waiting for', () => {
    const verdict = promotionOf(candidate({ corroborated: true }));
    expect(verdict.reasons[0]!).toMatch(/a later record bearing it out/u);
    expect(verdict.reasons[0]!).not.toMatch(/independent corroboration/u);
  });

  it('keeps out a report from someone with an interest in the matter, however supported', () => {
    const interested = candidate({
      corroborated: true,
      confirmedByRecord: true,
      disclosedInterest: 'I applied for the permit',
    });
    expect(promotionOf(interested).promoted).toBe(false);
    // An official speaking about their own office is the point, and stays in.
    expect(
      promotionOf({ ...interested, officialStanding: 'official-record' })
        .promoted
    ).toBe(true);
  });

  it('keeps out an attachment whose provenance was never established', () => {
    expect(
      promotionOf(candidate({ artifact: { authenticated: false } })).promoted
    ).toBe(false);
    expect(
      promotionOf(candidate({ artifact: { authenticated: true } })).path
    ).toBe('authenticated-artifact');
  });

  it('quotes nothing that did not clear review', () => {
    for (const state of ['held', 'rejected', 'withdrawn', 'taken-down']) {
      expect(
        promotionOf(candidate({ state, officialStanding: 'official-record' }))
          .promoted
      ).toBe(false);
    }
  });
});
