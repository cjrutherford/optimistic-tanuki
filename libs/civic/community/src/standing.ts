/**
 * Standing: what a contributor has been right about, lately.
 *
 * Standing is not a score of good behaviour and cannot be earned by posting,
 * by being endorsed, or by agreeing with anyone. It moves only when a record
 * settles one of their reports, and it decays, so it is re-earned rather than
 * owned. It is per topic, because being right about the school budget says
 * nothing about policing.
 *
 * It falls faster than it rises. A confirmation is one record agreeing; a
 * contradiction is a record saying the report was wrong, which is the more
 * informative event, and a civic service that publishes on trust cannot let
 * a long run of small confirmations outweigh it.
 *
 * Standing is never shown as a number, to contributors or to readers. It
 * enters the gate as weight and nowhere else.
 */

export interface ReputationEvent {
  /** The subject area, as the pipeline desks it: government, schools, public-safety, local-reporting. */
  topic: string;
  delta: number;
  at: Date;
}

export interface StandingSettings {
  /** Added when a record bears a report out. */
  confirmed: number;
  /** Taken away when a record says otherwise. */
  contradicted: number;
  /** Days for standing to halve. */
  halfLifeDays: number;
  /** The most standing one account can hold on one topic, so nobody accumulates their way past the gate. */
  ceiling: number;
}

export const DEFAULT_STANDING: StandingSettings = {
  confirmed: 0.1,
  contradicted: -0.3,
  halfLifeDays: 180,
  ceiling: 0.3,
};

/**
 * How much a confirmation from this kind of record is worth. The town's own
 * paperwork and a confirmed official's material are the record itself. A
 * newspaper reporting the same thing is a weaker check — it may rest on the
 * same account the report did — so it is worth half.
 */
export const RECORD_CREDIT: Record<string, number> = {
  record: 1,
  'official-channel': 1,
  news: 0.5,
};

const DAY_MS = 86_400_000;

/** The delta a verdict writes, before decay; zero when the verdict settles nothing. */
export function deltaFor(
  verdict: string,
  recordKind: string,
  settings: StandingSettings = DEFAULT_STANDING
): number {
  const credit = RECORD_CREDIT[recordKind] ?? 0;
  if (verdict === 'confirmed')
    return Math.round(settings.confirmed * credit * 1000) / 1000;
  // A contradiction counts in full whoever noticed it: being wrong in the paper is being wrong.
  if (verdict === 'contradicted') return settings.contradicted;
  return 0;
}

/**
 * Standing on one topic, now: every event decayed by its age and summed,
 * then held under the ceiling. It can be negative, and the gate reads a
 * negative as no standing rather than as a penalty — a contributor who has
 * been wrong loses what they earned, but never drags down the people who
 * corroborate alongside them.
 */
export function standingOf(
  events: readonly ReputationEvent[],
  topic: string,
  now: Date,
  settings: StandingSettings = DEFAULT_STANDING
): number {
  let total = 0;
  for (const event of events) {
    if (event.topic !== topic) continue;
    const ageDays = Math.max(0, (now.getTime() - event.at.getTime()) / DAY_MS);
    total += event.delta * 0.5 ** (ageDays / settings.halfLifeDays);
  }
  return Math.round(Math.min(settings.ceiling, total) * 1000) / 1000;
}

/** What a contributor's page shows: counts, never a score. */
export interface ContributorHistory {
  confirmed: number;
  contradicted: number;
  pending: number;
}
