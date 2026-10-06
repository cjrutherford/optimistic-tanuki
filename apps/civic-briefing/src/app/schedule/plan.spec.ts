import {
  cadenceNow,
  localClock,
  planFor,
  shiftDate,
  sourcingDue,
  weekdayNumber,
  weekdayOf,
} from './plan';

const settings = {
  dailyAt: '05:30',
  overlapDays: 3,
  attemptsPerDay: 3,
  dailyMinItems: 12,
  densityDays: 28,
  weeklyOn: 1,
};
// 2026-09-21 is a Monday.
const at = (
  localDate: string,
  state: Partial<Parameters<typeof planFor>[0]> = {}
) =>
  planFor(
    {
      localDate,
      localTime: '06:00',
      lastSuccess: shiftDate(localDate, -1),
      lastCadence: 'daily',
      failuresToday: 0,
      recentItems: 40,
      ...state,
    },
    settings
  );

describe('the daily schedule', () => {
  it('fills an empty database at once, reading the whole history window', () => {
    const plan = planFor(
      {
        localDate: '2026-09-22',
        localTime: '01:10',
        lastSuccess: null,
        failuresToday: 0,
      },
      settings
    );
    expect(plan.due).toBe(true);
    expect(plan.fresh).toBe(true);
    expect(plan.gatherSince).toBe(undefined);
    expect(plan.cadence).toBe('weekly');
  });

  it("waits for the town's hour once it has editions, then reads since the last one with overlap", () => {
    const early = planFor(
      {
        localDate: '2026-09-22',
        localTime: '05:10',
        lastSuccess: '2026-09-21',
        failuresToday: 0,
      },
      settings
    );
    expect(early.due).toBe(false);
    const due = planFor(
      {
        localDate: '2026-09-22',
        localTime: '05:31',
        lastSuccess: '2026-09-21',
        failuresToday: 0,
      },
      settings
    );
    expect(due.due).toBe(true);
    expect(due.gatherSince).toBe('2026-09-18');
  });

  it('catches up after downtime, reading from before the last edition it has', () => {
    const plan = planFor(
      {
        localDate: '2026-09-22',
        localTime: '09:00',
        lastSuccess: '2026-09-10',
        failuresToday: 0,
      },
      settings
    );
    expect(plan.due).toBe(true);
    expect(plan.gatherSince).toBe('2026-09-07');
  });

  it("does nothing once today's edition exists", () => {
    expect(
      planFor(
        {
          localDate: '2026-09-22',
          localTime: '12:00',
          lastSuccess: '2026-09-22',
          failuresToday: 0,
        },
        settings
      ).due
    ).toBe(false);
  });

  it('stops retrying for the day after a few failures', () => {
    const plan = planFor(
      {
        localDate: '2026-09-22',
        localTime: '12:00',
        lastSuccess: '2026-09-21',
        failuresToday: 3,
      },
      settings
    );
    expect(plan.due).toBe(false);
    expect(plan.reason).toMatch(/trying again tomorrow/u);
  });

  it('searches for sources on a fresh install and weekly after', () => {
    expect(sourcingDue(null, '2026-09-22', 7)).toBe(true);
    expect(sourcingDue('2026-09-20', '2026-09-22', 7)).toBe(false);
    expect(sourcingDue('2026-09-15', '2026-09-22', 7)).toBe(true);
  });

  it("reads each town's own clock", () => {
    const instant = new Date('2026-09-22T09:40:00Z');
    expect(localClock(instant, 'America/New_York')).toStrictEqual({
      localDate: '2026-09-22',
      localTime: '05:40',
    });
    expect(localClock(instant, 'America/Chicago')).toStrictEqual({
      localDate: '2026-09-22',
      localTime: '04:40',
    });
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('keeps a busy town daily', () => {
    const plan = at('2026-09-23');
    expect([plan.due, plan.cadence]).toStrictEqual([true, 'daily']);
    expect(at('2026-09-21').cadence).toBe('daily');
  });

  it('moves a light town to a weekly edition on the weekly day, covering the whole week', () => {
    const wednesday = at('2026-09-23', { recentItems: 3 });
    expect(wednesday.due).toBe(false);
    expect(wednesday.reason).toMatch(
      /too light .*3 dated local record.*weekly from Monday/u
    );
    const monday = at('2026-09-28', {
      lastSuccess: '2026-09-22',
      recentItems: 3,
    });
    expect([monday.due, monday.cadence, monday.gatherSince]).toStrictEqual([
      true,
      'weekly',
      '2026-09-19',
    ]);
  });

  it('keeps a weekly town weekly while it stays light, and between its editions', () => {
    const thursday = at('2026-09-24', {
      lastSuccess: '2026-09-21',
      lastCadence: 'weekly',
      recentItems: 5,
    });
    expect(thursday.due).toBe(false);
    expect(thursday.reason).toMatch(/weekly town: next edition Monday/u);
    expect(
      at('2026-09-28', {
        lastSuccess: '2026-09-21',
        lastCadence: 'weekly',
        recentItems: 5,
      }).cadence
    ).toBe('weekly');
    // Busy again, but only the day after a weekly may start the dailies, so none of the week falls between editions.
    expect(
      at('2026-09-24', {
        lastSuccess: '2026-09-21',
        lastCadence: 'weekly',
        recentItems: 30,
      }).due
    ).toBe(false);
    const monday = at('2026-09-28', {
      lastSuccess: '2026-09-21',
      lastCadence: 'weekly',
      recentItems: 30,
    });
    expect([monday.due, monday.cadence]).toStrictEqual([true, 'weekly']);
  });

  it('returns a town to daily editions the day after a weekly, once it picks up', () => {
    const tuesday = at('2026-09-22', {
      lastSuccess: '2026-09-21',
      lastCadence: 'weekly',
      recentItems: 30,
    });
    expect([tuesday.due, tuesday.cadence, tuesday.gatherSince]).toStrictEqual([
      true,
      'daily',
      '2026-09-18',
    ]);
    expect(tuesday.reason).toMatch(/back to daily/u);
  });

  it("lets a fresh town's first weekly edition lead straight into dailies when the town is busy", () => {
    expect(
      at('2026-09-25', {
        lastSuccess: '2026-09-24',
        lastCadence: 'weekly',
        recentItems: 30,
      }).cadence
    ).toBe('daily');
    expect(
      at('2026-09-25', {
        lastSuccess: '2026-09-24',
        lastCadence: 'weekly',
        recentItems: 4,
      }).due
    ).toBe(false);
  });

  it("runs an operator's request in the cadence the town is in", () => {
    expect(
      cadenceNow({ lastSuccess: null, recentItems: undefined }, settings)
    ).toBe('weekly');
    expect(
      cadenceNow({ lastSuccess: '2026-09-21', recentItems: 3 }, settings)
    ).toBe('weekly');
    expect(
      cadenceNow({ lastSuccess: '2026-09-21', recentItems: 12 }, settings)
    ).toBe('daily');
  });

  it('names the weekly day', () => {
    expect(weekdayOf('2026-09-21')).toBe(1);
    expect(weekdayNumber('Monday')).toBe(1);
    expect(weekdayNumber('sun')).toBe(0);
    expect(() => weekdayNumber('someday')).toThrow();
  });
});
