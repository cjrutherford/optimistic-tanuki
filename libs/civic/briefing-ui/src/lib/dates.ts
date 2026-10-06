/**
 * Edition dates are calendar days (YYYY-MM-DD) in the town's own time, not
 * instants, so they are read and written in UTC to keep a day from sliding
 * into its neighbour in the reader's timezone.
 */

const DAY_MS = 86_400_000;

export function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function addDays(day: string, days: number): string {
  return new Date(parseDay(day).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** "Thursday, September 17, 2026" */
export function longDate(day: string): string {
  return parseDay(day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Sep 17" */
export function shortDate(day: string): string {
  return parseDay(day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function weekdayInitial(day: string): string {
  return parseDay(day).toLocaleDateString('en-US', {
    weekday: 'narrow',
    timeZone: 'UTC',
  });
}

export function dayOfMonth(day: string): number {
  return parseDay(day).getUTCDate();
}
