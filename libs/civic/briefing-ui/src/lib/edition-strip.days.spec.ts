import { addDays, longDate, shortDate } from './dates';
import { STRIP_DAYS, stripDays } from './edition-strip.days';

describe('edition dates', () => {
  it("treats edition dates as calendar days, whatever the reader's timezone", () => {
    // Across a daylight-saving change.
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
    expect(longDate('2026-09-17')).toBe('Thursday, September 17, 2026');
    expect(shortDate('2026-09-17')).toBe('Sep 17');
  });
});

describe('edition strip', () => {
  it('shows four weeks ending on the newest edition, gaps included', () => {
    const days = stripDays(
      ['2026-09-15', '2026-09-17'],
      '2026-09-17',
      '2026-09-15'
    );
    expect(days.length).toBe(STRIP_DAYS);
    expect(days[0]?.day).toBe('2026-08-21');
    expect(days.at(-1)?.day).toBe('2026-09-17');
    expect(days.filter((d) => d.published).map((d) => d.day)).toEqual([
      '2026-09-15',
      '2026-09-17',
    ]);
    expect(days.filter((d) => d.current).map((d) => d.day)).toEqual([
      '2026-09-15',
    ]);
    // A missing day is shown, not skipped.
    expect(days.find((d) => d.day === '2026-09-16')?.published).toBe(false);
  });

  it('names the month where the strip starts and where a month begins', () => {
    const days = stripDays([], '2026-09-17', null);
    expect(
      days.filter((d) => d.month).map((d) => `${d.month} ${d.date}`)
    ).toEqual(['Aug 21', 'Sep 1']);
  });
});
