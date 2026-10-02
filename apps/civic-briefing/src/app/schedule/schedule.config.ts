import { resolve } from 'node:path';
import { weekdayNumber } from './plan';

/**
 * The daily pipeline's configuration, from the environment.
 *
 * Everything the schedule writes lives under `data/live/` and `data/sources/`
 * of the working directory by default. The database is not configured here:
 * the schedule uses the app's own connection.
 */
export interface ScheduleConfig {
  /** The artifact root: briefings, stories, blobs. */
  artifacts: string;
  /** The YAML locality registry (CIVIC_LOCALITIES_DIR); null means the schedule does not start. */
  localitiesDir: string | null;
  /** Sources the sourcing engine adopted, one file per locality, and its decision log. */
  discoveredDir: string;
  discoveryLog: string;
  /** Where the official directories (the .gov list, Wikidata answers) are cached. */
  directoriesDir: string;
  /** Community snapshots to quote from; unset means briefings carry no community material. */
  communityDirectory: string | null;
  /** The local time each town's edition is produced, HH:MM in the town's own timezone. */
  dailyAt: string;
  /**
   * A town gets a daily edition while it has at least this many dated local
   * records — its own, those of places inside it, and its county's — in the
   * last `densityDays` days; below it, a weekly edition on `weeklyOn`.
   */
  dailyMinItems: number;
  densityDays: number;
  /** The weekly edition's day, 0 (Sunday) to 6. */
  weeklyOn: number;
  /** How often the schedule checks whether a town is due. */
  tickMs: number;
  /** Days of history a town's first run fetches, and the story context every run reads. */
  historyDays: number;
  /** Days of overlap when a daily run fetches since its last success, so a late-posted item is not missed. */
  overlapDays: number;
  /** How often a town's sources are searched for again. */
  sourcingIntervalDays: number;
  /** Pages the crawler may read per town per search. */
  sourcingPageBudget: number;
  /** Failed attempts at a town's edition before the schedule stops trying until tomorrow. */
  attemptsPerDay: number;
  /**
   * Briefs are written in two stages: the planner lists every relevant matter,
   * the writer writes the article from that plan (the primary stands in if
   * the writer fails). Chosen by the article benchmark of 2026-09-24:
   * qwen3.5:4b-q8_0 planning and gemma4:e4b-it-qat writing cited 57 of 60 news
   * sources against 48 for qwen3.5 alone. LLM_PLANNER_MODEL=none writes in
   * one pass.
   */
  model: {
    /**
     * `prompt-proxy` (default, D5) sends model calls through the platform's
     * prompt-proxy over TCP; `direct` calls LLM_BASE_URL itself, for local
     * development without the proxy.
     */
    transport: 'prompt-proxy' | 'direct';
    promptProxy: { host: string; port: number };
    baseUrl: string | undefined;
    primary: string | undefined;
    fallback: string | undefined;
    planner: string | undefined;
    writer: string | undefined;
  };
}

function positive(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number
): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${key} must be a positive number, got "${raw}"`);
  return value;
}

export function loadScheduleConfig(
  env: NodeJS.ProcessEnv = process.env
): ScheduleConfig {
  const path = (value: string) => resolve(process.cwd(), value);
  const dailyAt = env['PIPELINE_DAILY_AT'] ?? '05:30';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(dailyAt))
    throw new Error(`PIPELINE_DAILY_AT must be HH:MM, got "${dailyAt}"`);
  return {
    artifacts: path(env['PIPELINE_ARTIFACTS'] ?? 'data/live/out'),
    localitiesDir: env['CIVIC_LOCALITIES_DIR']
      ? path(env['CIVIC_LOCALITIES_DIR'])
      : null,
    discoveredDir: path(
      env['CIVIC_DISCOVERED_SOURCES'] ?? 'data/sources/discovered'
    ),
    discoveryLog: path(env['SOURCING_LOG'] ?? 'data/sources/decisions.jsonl'),
    directoriesDir: path(
      env['SOURCING_DIRECTORIES'] ?? 'data/sources/directories'
    ),
    communityDirectory: env['PROMOTION_DIRECTORY']
      ? path(env['PROMOTION_DIRECTORY'])
      : null,
    dailyAt,
    dailyMinItems: positive(env, 'PIPELINE_DAILY_MIN_ITEMS', 12),
    densityDays: positive(env, 'PIPELINE_DENSITY_DAYS', 28),
    weeklyOn: weekdayNumber(env['PIPELINE_WEEKLY_ON'] ?? 'monday'),
    tickMs: positive(env, 'PIPELINE_TICK_MS', 10 * 60 * 1000),
    historyDays: positive(env, 'PIPELINE_HISTORY_DAYS', 180),
    overlapDays: positive(env, 'PIPELINE_OVERLAP_DAYS', 3),
    sourcingIntervalDays: positive(env, 'SOURCING_INTERVAL_DAYS', 7),
    sourcingPageBudget: positive(env, 'SOURCING_PAGE_BUDGET', 150),
    attemptsPerDay: positive(env, 'PIPELINE_ATTEMPTS_PER_DAY', 3),
    model: {
      transport: env['LLM_TRANSPORT'] === 'direct' ? 'direct' : 'prompt-proxy',
      promptProxy: {
        host: env['PROMPT_PROXY_HOST'] || 'prompt-proxy',
        port: positive(env, 'PROMPT_PROXY_PORT', 3009),
      },
      baseUrl: env['LLM_BASE_URL'],
      primary: env['LLM_PRIMARY_MODEL'],
      fallback: env['LLM_FALLBACK_MODEL'],
      planner:
        env['LLM_PLANNER_MODEL'] === 'none'
          ? undefined
          : env['LLM_PLANNER_MODEL'] || 'qwen3.5:4b-q8_0',
      writer: env['LLM_WRITER_MODEL'] || 'gemma4:e4b-it-qat',
    },
  };
}
