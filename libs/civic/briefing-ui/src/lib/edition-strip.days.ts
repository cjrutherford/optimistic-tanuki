import {
  addDays,
  dayOfMonth,
  longDate,
  shortDate,
  weekdayInitial,
} from './dates';

/** Four weeks: long enough to show a pattern of gaps, short enough to fit a reading column. */
export const STRIP_DAYS = 28;

export interface StripDay {
  day: string;
  label: string;
  initial: string;
  date: number;
  /** The first day shown, or the first of a month: where a month name belongs. */
  month: string | null;
  published: boolean;
  current: boolean;
}

export function stripDays(
  published: readonly string[],
  end: string,
  current: string | null,
  days = STRIP_DAYS
): StripDay[] {
  const have = new Set(published);
  const strip: StripDay[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = addDays(end, -offset);
    const date = dayOfMonth(day);
    strip.push({
      day,
      label: longDate(day),
      initial: weekdayInitial(day),
      date,
      month:
        strip.length === 0 || date === 1
          ? shortDate(day).split(' ')[0] ?? null
          : null,
      published: have.has(day),
      current: day === current,
    });
  }
  return strip;
}
