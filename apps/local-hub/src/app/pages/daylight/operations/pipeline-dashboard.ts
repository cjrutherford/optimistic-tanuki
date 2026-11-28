import type {
  PipelineDashboard,
  PipelineTrendDay,
  TownPipelineHealth,
} from '@optimistic-tanuki/civic-briefing-data-access';

/** A stacked series: the day's field it reads, its name and the state it shows. */
export interface TrendSeries {
  field: keyof Omit<PipelineTrendDay, 'day'>;
  label: string;
  /** Drives the colour, from the theme's status tokens. */
  tone: 'good' | 'warning' | 'critical';
}

export const RUN_SERIES: readonly TrendSeries[] = [
  { field: 'runsSucceeded', label: 'Published', tone: 'good' },
  { field: 'runsPartial', label: 'Published with gaps', tone: 'warning' },
  { field: 'runsFailed', label: 'Failed', tone: 'critical' },
];

export const CALL_SERIES: readonly TrendSeries[] = [
  { field: 'callsSuccessful', label: 'Accepted', tone: 'good' },
  { field: 'callsRejected', label: 'Rejected by checks', tone: 'warning' },
  { field: 'callsUnavailable', label: 'Never answered', tone: 'critical' },
];

export interface TrendSegment {
  label: string;
  tone: TrendSeries['tone'];
  value: number;
  y: number;
  height: number;
}

export interface TrendColumn {
  day: string;
  /** Short weekday for the axis, e.g. "Sat 28". */
  axis: string;
  x: number;
  total: number;
  segments: TrendSegment[];
  /** The hover text: the day and each series' count. */
  summary: string;
}

export interface TrendChart {
  width: number;
  height: number;
  barWidth: number;
  max: number;
  columns: TrendColumn[];
}

const WIDTH = 336;
const HEIGHT = 120;
/** The surface gap left between stacked segments. */
const GAP = 2;

/** Stacked bars of one week, bottom to top in series order, scaled to the busiest day. */
export function trendChart(
  trend: readonly PipelineTrendDay[],
  series: readonly TrendSeries[]
): TrendChart {
  const slot = WIDTH / Math.max(trend.length, 1);
  const barWidth = Math.min(28, slot * 0.6);
  const totals = trend.map((day) =>
    series.reduce((sum, s) => sum + day[s.field], 0)
  );
  const max = Math.max(1, ...totals);
  const columns = trend.map((day, i) => {
    let top = HEIGHT;
    const segments: TrendSegment[] = [];
    for (const s of series) {
      const value = day[s.field];
      if (!value) continue;
      const full = (value / max) * HEIGHT;
      const height = Math.max(1, full - GAP);
      top -= full;
      segments.push({
        label: s.label,
        tone: s.tone,
        value,
        y: top + GAP,
        height,
      });
    }
    return {
      day: day.day,
      axis: axisLabel(day.day),
      x: i * slot + (slot - barWidth) / 2,
      total: totals[i],
      segments,
      summary: `${day.day}: ${series
        .map((s) => `${day[s.field]} ${s.label.toLowerCase()}`)
        .join(', ')}`,
    };
  });
  return { width: WIDTH, height: HEIGHT, barWidth, max, columns };
}

function axisLabel(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  const weekday = date.toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  });
  return `${weekday} ${date.getUTCDate()}`;
}

export interface Headline {
  label: string;
  value: string;
  detail: string;
  /** Set when the number calls for attention. */
  tone: 'good' | 'warning' | 'critical' | null;
}

/** The last 24 hours in a handful of numbers. */
export function headlines(dashboard: PipelineDashboard): Headline[] {
  const { towns, runs, calls, sources, outageHours } = dashboard.digest;
  const answered = calls.total - calls.unavailable;
  const passRate = answered ? calls.successful / answered : null;
  return [
    {
      label: 'Towns published',
      value: `${towns.succeeded} of ${towns.ran}`,
      detail: towns.failedOnly
        ? `${towns.failedOnly} produced nothing`
        : 'every town that ran published',
      tone: towns.failedOnly ? 'critical' : towns.ran ? 'good' : null,
    },
    {
      label: 'Failed runs',
      value: String(runs.failed),
      detail: `of ${runs.total} run${runs.total === 1 ? '' : 's'}`,
      tone: runs.failed ? 'critical' : null,
    },
    {
      label: 'Model output accepted',
      value: passRate === null ? '—' : `${Math.round(passRate * 100)}%`,
      detail: `${calls.successful} of ${answered} answered call${
        answered === 1 ? '' : 's'
      }`,
      tone:
        passRate === null
          ? null
          : passRate < 0.5
          ? 'critical'
          : passRate < 0.8
          ? 'warning'
          : 'good',
    },
    {
      label: 'Never answered',
      value: String(calls.unavailable),
      detail: outageHours
        ? `${outageHours} hour${outageHours === 1 ? '' : 's'} of outage`
        : 'model calls the service dropped',
      tone: outageHours ? 'critical' : calls.unavailable ? 'warning' : null,
    },
    {
      label: 'Sources failing',
      value: String(sources.failing.length),
      detail: `${sources.stale} quiet in ${sources.staleTowns} town${
        sources.staleTowns === 1 ? '' : 's'
      }`,
      tone: sources.failing.length ? 'warning' : null,
    },
  ];
}

/** A town an operator should look at: its last run failed, a source needs attention, or it has no sources. */
export function needsAttention(town: TownPipelineHealth): boolean {
  return (
    town.problems.length > 0 ||
    !!town.noSources ||
    town.lastRun?.status === 'failed' ||
    town.lastRun?.status === 'blocked'
  );
}

export const VERDICT_WORDS: Record<string, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  outage: 'Outage',
  idle: 'No runs',
};
