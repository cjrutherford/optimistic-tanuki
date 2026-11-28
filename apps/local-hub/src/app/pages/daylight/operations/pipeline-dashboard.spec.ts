import type { PipelineTrendDay } from '@optimistic-tanuki/civic-briefing-data-access';
import { needsAttention, RUN_SERIES, trendChart } from './pipeline-dashboard';

const day = (
  date: string,
  overrides: Partial<PipelineTrendDay> = {}
): PipelineTrendDay => ({
  day: date,
  runsSucceeded: 0,
  runsPartial: 0,
  runsFailed: 0,
  callsSuccessful: 0,
  callsUnavailable: 0,
  callsRejected: 0,
  ...overrides,
});

describe('trendChart', () => {
  it('scales stacks to the busiest day, bottom up in series order', () => {
    const chart = trendChart(
      [
        day('2026-11-27', { runsSucceeded: 2, runsFailed: 2 }),
        day('2026-11-28', { runsSucceeded: 1 }),
      ],
      RUN_SERIES
    );
    expect(chart.max).toBe(4);
    const [busy, quiet] = chart.columns;
    expect(busy.segments.map((s) => s.label)).toEqual(['Published', 'Failed']);
    // Published fills the bottom half, less the gap between segments.
    expect(busy.segments[0]).toMatchObject({ y: 62, height: 58 });
    expect(busy.segments[1]).toMatchObject({ y: 2, height: 58 });
    expect(quiet.segments).toHaveLength(1);
    expect(busy.axis).toBe('Fri 27');
    expect(busy.summary).toBe(
      '2026-11-27: 2 published, 0 published with gaps, 2 failed'
    );
  });

  it('draws nothing but the axis for an empty week', () => {
    const chart = trendChart([day('2026-11-28')], RUN_SERIES);
    expect(chart.columns[0].segments).toEqual([]);
    expect(chart.max).toBe(1);
  });
});

describe('needsAttention', () => {
  const town = { slug: 'a', name: 'A', lastRun: null, problems: [] };

  it('flags failed runs, problem sources and towns without sources', () => {
    expect(needsAttention(town)).toBe(false);
    expect(needsAttention({ ...town, noSources: true })).toBe(true);
    expect(
      needsAttention({
        ...town,
        lastRun: {
          runId: 1,
          status: 'blocked',
          cadence: 'daily',
          startedAt: '',
          completedAt: null,
          currentStage: null,
          error: null,
        },
      })
    ).toBe(true);
  });
});
