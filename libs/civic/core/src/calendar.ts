import type { Cadence } from './types.js';

function parts(
  value: Date,
  timezone: string
): { year: number; month: number; day: number } {
  const fields = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(value)
      .map((part) => [part.type, part.value])
  );
  return {
    year: Number(fields['year']),
    month: Number(fields['month']),
    day: Number(fields['day']),
  };
}

export function localDate(value: Date, timezone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('invalid date');
  const { year, month, day } = parts(date, timezone);
  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function shiftLocalDate(
  value: Date,
  days: number,
  timezone: string
): string {
  if (!Number.isInteger(days))
    throw new Error('calendar day shift must be an integer');
  const [year, month, day] = localDate(value, timezone).split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function periodFor(
  value: Date,
  cadence: Cadence,
  timezone: string
): { start: string; end: string; since: string } {
  const end = localDate(value, timezone);
  const start = shiftLocalDate(value, cadence === 'weekly' ? -7 : -1, timezone);
  return { start, end, since: start };
}

/** The exact previous local calendar day used by a daily edition. */
export function dailyPeriod(
  value: Date | string,
  timezone: string
): { start: string; end: string } {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return { start: backfillSince(value, 1), end: value };
  }
  const date = value instanceof Date ? value : new Date(value);
  const end = localDate(date, timezone);
  return { start: shiftLocalDate(date, -1, timezone), end };
}

/** Return the local-calendar start of a backfill ending at an exclusive day. */
export function backfillSince(
  periodEnd: string | Date,
  days = 30,
  timezone = 'UTC'
): string {
  if (!Number.isInteger(days) || days < 0)
    throw new Error('backfill days must be a non-negative integer');
  if (periodEnd instanceof Date) periodEnd = localDate(periodEnd, timezone);
  const [year, month, day] = periodEnd.split('-').map(Number);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(periodEnd) || !year || !month || !day)
    throw new Error(`invalid local date: ${periodEnd}`);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.toISOString().slice(0, 10) !== periodEnd)
    throw new Error(`invalid local date: ${periodEnd}`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

/** @deprecated Use localDate. Kept for callers compiled against the POC API. */
export function localCalendarDate(
  value: Date | string,
  timezone: string
): string {
  return localDate(value instanceof Date ? value : new Date(value), timezone);
}

/** @deprecated Use shiftLocalDate. */
export function shiftLocalCalendarDays(
  value: Date | string,
  timezone: string,
  days: number
): string {
  return shiftLocalDate(
    value instanceof Date ? value : new Date(value),
    days,
    timezone
  );
}

/** @deprecated Use periodFor. */
export function periodForLocalCalendar(
  value: Date | string,
  timezone: string,
  cadence: Cadence
): { start: string; end: string } {
  const { start, end } = periodFor(
    value instanceof Date ? value : new Date(value),
    cadence,
    timezone
  );
  return { start, end };
}
