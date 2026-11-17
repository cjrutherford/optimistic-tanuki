import { describeSourceFreshness } from './source-freshness';

describe('describeSourceFreshness', () => {
  const t = { freshDays: 90, staleDays: 120 };
  it('returns null when absent', () => {
    expect(describeSourceFreshness(undefined)).toBeNull();
  });
  it('does not invent a date when the timestamp is missing or invalid', () => {
    for (const sourcePublishedAt of [null, 'garbage']) {
      expect(
        describeSourceFreshness({
          state: 'fresh',
          releaseId: 'r',
          sourcePublishedAt,
          acquiredAt: null,
          thresholds: t,
        })
      ).toBe('Source date unknown');
    }
  });
  it('omits the release when none is given', () => {
    expect(
      describeSourceFreshness({
        state: 'fresh',
        releaseId: null,
        sourcePublishedAt: '2026-10-22T00:00:00Z',
        acquiredAt: null,
        thresholds: t,
      })
    ).toBe('Source data: updated 2026-10-22');
  });
});
