import type { Cadence } from '@optimistic-tanuki/civic-core';

/**
 * When a town is due, which edition it gets, and how far back its run reads.
 * Pure, so the schedule's decisions can be tested without a clock or a network.
 *
 * A town is due once its local time passes the daily hour and it has no
 * successful edition for its local date. That rule catches up by itself after
 * downtime, and is idempotent: a second check the same day finds the edition
 * and does nothing.
 *
 * Daily is the default. A town whose recent record is too light for daily news
 * — fewer dated local records in the last four weeks than the daily minimum —
 * gets a weekly edition instead, on the weekly day, until it picks up. The
 * switches are placed so no news falls between editions: a daily town that
 * goes light is silent until the weekly day, whose edition covers the whole
 * week; a weekly town returns to daily only the day after a weekly edition,
 * so the first daily starts where the weekly ended.
 *
 * A town with no successful run at all is a fresh install — an empty
 * database, or a town just added — and its first run reads the whole history
 * window. Its first edition is weekly: a first edition reports the past week
 * anyway, and how busy the town is cannot be known before it has been read.
 * After that a run reads from a few days before its last success.
 */

export interface TownState {
  /** The town's current local date and time, YYYY-MM-DD and HH:MM. */
  localDate: string;
  localTime: string;
  /** The local date of its last successful edition, of either cadence, or null when it has never had one. */
  lastSuccess: string | null;
  /** That edition's cadence. */
  lastCadence?: Cadence | null;
  /** Failed attempts at today's edition. */
  failuresToday: number;
  /** Dated local records in the last `densityDays` days; undefined when not counted, which reads as busy enough. */
  recentItems?: number;
}

export interface PlanSettings {
  dailyAt: string;
  overlapDays: number;
  attemptsPerDay: number;
  /** Dated local records over `densityDays` a town needs for a daily edition. */
  dailyMinItems?: number;
  densityDays?: number;
  /** The weekly edition's day, 0 (Sunday) to 6. */
  weeklyOn?: number;
}

export interface RunPlan {
  due: boolean;
  /** Why, for the log. */
  reason: string;
  fresh: boolean;
  cadence: Cadence;
  /** How far back sources are read; undefined means the whole history window. */
  gatherSince?: string;
}

export function planFor(state: TownState, settings: PlanSettings): RunPlan {
  const fresh = state.lastSuccess === null;
  const weeklyOn = settings.weeklyOn ?? 1;
  const light = isLight(state.recentItems, settings.dailyMinItems);
  const weekly = state.lastCadence === 'weekly';
  // Between editions a town keeps the cadence it has.
  const idle = (reason: string): RunPlan => ({
    due: false,
    reason,
    fresh,
    cadence: weekly || light ? 'weekly' : 'daily',
  });
  if (state.lastSuccess === state.localDate)
    return idle("today's edition is published");
  if (state.failuresToday >= settings.attemptsPerDay)
    return idle(
      `${state.failuresToday} failed attempts today; trying again tomorrow`
    );
  // A fresh town does not wait for the hour: an empty database should fill as soon as it starts.
  if (fresh)
    return {
      due: true,
      reason:
        'no edition yet: reading the full history window for a first edition covering the past week',
      fresh,
      cadence: 'weekly',
    };
  if (state.localTime < settings.dailyAt)
    return idle(`not yet ${settings.dailyAt} locally`);
  const gatherSince = shiftDate(state.lastSuccess!, -settings.overlapDays);
  const density = `${state.recentItems} dated local record(s) in ${
    settings.densityDays ?? 28
  } days`;
  if (weekdayOf(state.localDate) === weeklyOn && (light || weekly)) {
    return {
      due: true,
      reason: `weekly edition (${density}); last edition ${state.lastSuccess}`,
      fresh,
      cadence: 'weekly',
      gatherSince,
    };
  }
  if (weekly) {
    if (!light && state.lastSuccess === shiftDate(state.localDate, -1)) {
      return {
        due: true,
        reason: `back to daily editions (${density})`,
        fresh,
        cadence: 'daily',
        gatherSince,
      };
    }
    return idle(
      `weekly town: next edition ${WEEKDAYS[weeklyOn]}${
        light ? ` (${density})` : ''
      }`
    );
  }
  if (light)
    return idle(
      `too light for a daily edition (${density}); weekly from ${WEEKDAYS[weeklyOn]}`
    );
  return {
    due: true,
    reason: `last edition ${state.lastSuccess}`,
    fresh,
    cadence: 'daily',
    gatherSince,
  };
}

/** The cadence a town is in now, for a run an operator asks for out of hours. */
export function cadenceNow(
  state: Pick<TownState, 'lastSuccess' | 'recentItems'>,
  settings: Pick<PlanSettings, 'dailyMinItems'>
): Cadence {
  return state.lastSuccess === null ||
    isLight(state.recentItems, settings.dailyMinItems)
    ? 'weekly'
    : 'daily';
}

function isLight(
  recentItems: number | undefined,
  dailyMinItems: number | undefined
): boolean {
  return recentItems !== undefined && recentItems < (dailyMinItems ?? 12);
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

/** A weekday's number from its name or its first three letters. */
export function weekdayNumber(name: string): number {
  const index = WEEKDAYS.findIndex(
    (day) =>
      day.toLowerCase().startsWith(name.trim().toLowerCase().slice(0, 3)) &&
      name.trim().length >= 3
  );
  if (index < 0) throw new Error(`not a weekday: "${name}"`);
  return index;
}

/** Whether a town's sources should be searched for again. */
export function sourcingDue(
  lastSearched: string | null,
  localDate: string,
  intervalDays: number
): boolean {
  if (!lastSearched) return true;
  return shiftDate(lastSearched, intervalDays) <= localDate;
}

export function shiftDate(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A time zone's local date and time for an instant. */
export function localClock(
  now: Date,
  timezone: string
): { localDate: string; localTime: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  return {
    localDate: `${parts['year']}-${parts['month']}-${parts['day']}`,
    localTime: `${parts['hour']}:${parts['minute']}`,
  };
}
