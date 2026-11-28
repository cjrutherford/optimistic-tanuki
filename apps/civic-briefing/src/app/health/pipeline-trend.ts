import type { PipelineTrendDay } from '@optimistic-tanuki/models';
import type { DataSource } from 'typeorm';
import { TIMEOUT_PATTERN, UNAVAILABLE_PATTERN } from './failure-cause';

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of an instant in a timezone. */
export function localDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** The local days ending today, oldest first. */
export function trendDays(now: Date, days: number, timeZone: string): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = localDay(new Date(now.getTime() - i * DAY_MS), timeZone);
    if (!out.includes(day)) out.push(day);
  }
  return out;
}

interface RunDayRow {
  day: string;
  succeeded: string;
  partial: string;
  failed: string;
}

interface CallDayRow {
  day: string;
  successful: string;
  unavailable: string;
  rejected: string;
}

/**
 * Runs and model calls per local day over the last `days` days, counted in
 * Postgres so a week of rows is never loaded. Timestamps are ISO text.
 */
export async function loadTrend(
  ds: DataSource,
  now: Date,
  days: number,
  timeZone: string
): Promise<PipelineTrendDay[]> {
  const labels = trendDays(now, days, timeZone);
  const from = new Date(now.getTime() - (days + 1) * DAY_MS).toISOString();
  const day = (column: string) =>
    `to_char((${column})::timestamptz AT TIME ZONE $2, 'YYYY-MM-DD')`;
  const unanswered = `(error ~* $3 OR error ~* $4)`;

  const runs: RunDayRow[] = await ds.query(
    `SELECT ${day('"startedAt"')} AS day,
            count(*) FILTER (WHERE status = 'succeeded') AS succeeded,
            count(*) FILTER (WHERE status = 'partial_success') AS partial,
            count(*) FILTER (WHERE status IN ('failed', 'blocked')) AS failed
       FROM pipeline_runs
      WHERE "startedAt" >= $1
      GROUP BY 1`,
    [from, timeZone]
  );
  const calls: CallDayRow[] = await ds.query(
    `SELECT ${day('"generatedAt"')} AS day,
            count(*) FILTER (WHERE status = 'successful') AS successful,
            count(*) FILTER (WHERE status <> 'successful' AND ${unanswered}) AS unavailable,
            count(*) FILTER (WHERE status <> 'successful' AND NOT coalesce(${unanswered}, false)) AS rejected
       FROM llm_generations
      WHERE "generatedAt" >= $1
      GROUP BY 1`,
    [from, timeZone, UNAVAILABLE_PATTERN, TIMEOUT_PATTERN]
  );

  const runsByDay = new Map(runs.map((r) => [r.day, r]));
  const callsByDay = new Map(calls.map((c) => [c.day, c]));
  return labels.map((label) => {
    const r = runsByDay.get(label);
    const c = callsByDay.get(label);
    return {
      day: label,
      runsSucceeded: Number(r?.succeeded ?? 0),
      runsPartial: Number(r?.partial ?? 0),
      runsFailed: Number(r?.failed ?? 0),
      callsSuccessful: Number(c?.successful ?? 0),
      callsUnavailable: Number(c?.unavailable ?? 0),
      callsRejected: Number(c?.rejected ?? 0),
    };
  });
}
