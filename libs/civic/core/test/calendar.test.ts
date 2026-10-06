import {
  localDate,
  shiftLocalDate,
  periodFor,
  localCalendarDate,
  shiftLocalCalendarDays,
  periodForLocalCalendar,
} from '../src/calendar.js';

describe('timezone-safe local calendar', () => {
  it('exports the canonical calendar API across spring-forward, fall-back, and local midnight', () => {
    expect(
      localDate(new Date('2026-03-09T04:30:00.000Z'), 'America/New_York')
    ).toBe('2026-03-09');
    expect(
      shiftLocalDate(
        new Date('2026-03-09T04:30:00.000Z'),
        -1,
        'America/New_York'
      )
    ).toBe('2026-03-08');
    expect(
      periodFor(
        new Date('2026-03-09T04:30:00.000Z'),
        'daily',
        'America/New_York'
      )
    ).toStrictEqual({
      start: '2026-03-08',
      end: '2026-03-09',
      since: '2026-03-08',
    });
    expect(
      periodFor(
        new Date('2026-11-02T05:30:00.000Z'),
        'weekly',
        'America/New_York'
      )
    ).toStrictEqual({
      start: '2026-10-26',
      end: '2026-11-02',
      since: '2026-10-26',
    });
    expect(
      localDate(new Date('2026-03-09T03:59:59.000Z'), 'America/New_York')
    ).toBe('2026-03-08');
  });

  it('shifts calendar dates across the New York DST boundary', () => {
    const now = new Date('2026-03-09T04:30:00.000Z');
    expect(localCalendarDate(now, 'America/New_York')).toBe('2026-03-09');
    expect(shiftLocalCalendarDays(now, 'America/New_York', -1)).toBe(
      '2026-03-08'
    );
    expect(
      periodForLocalCalendar(now, 'America/New_York', 'daily')
    ).toStrictEqual({ start: '2026-03-08', end: '2026-03-09' });
  });

  it('uses seven local calendar days for weekly periods', () => {
    const now = new Date('2026-03-09T04:30:00.000Z');
    expect(
      periodForLocalCalendar(now, 'America/New_York', 'weekly')
    ).toStrictEqual({ start: '2026-03-02', end: '2026-03-09' });
  });
});
