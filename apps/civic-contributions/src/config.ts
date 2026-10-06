import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import 'pg';
import { DEFAULT_STANDING } from '@optimistic-tanuki/civic-community';
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_PRIMARY_MODEL,
} from '@optimistic-tanuki/civic-llm';

/**
 * civic-contributions' configuration: config.yaml for the listen port and
 * the database, the environment for everything else (and over the yaml).
 */

export type LlmTransport = 'prompt-proxy' | 'direct';

export declare type CivicContributionsConfigType = {
  listenPort: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name?: string;
    database?: string;
  };
  /** civic-briefing, which serves the corpus over TCP (CIVIC_BRIEFING_HOST/PORT). */
  civicBriefing: { host: string; port: number };
  /** Where uploads are kept once scanned (ARTIFACT_ROOT). */
  artifactRoot: string;
  maxUploadBytes: number;
  /**
   * The review model. `llmTransport` is 'prompt-proxy' (the default: calls go
   * through the platform's prompt-proxy) or 'direct' (straight to `baseUrl`).
   */
  model: { baseUrl: string; model: string; timeoutMs: number };
  llmTransport: LlmTransport;
  promptProxy: { host: string; port: number };
  /** The locality files (CIVIC_LOCALITIES_DIR); null leaves the registry empty. */
  localitiesDir: string | null;
  /** Contributions per contributor per hour. */
  hourlyLimit: number;
  /** Upheld copyright notices before an account is suspended. */
  strikeLimit: number;
  /**
   * What an account needs before its word can corroborate another's: a
   * verified address (from the session), this many days since it first
   * contributed, and one earlier contribution that cleared review.
   */
  floor: { minAgeDays: number };
  /**
   * The trust-mass gate. Starting values are assumptions until real
   * contributions exist: a report is corroborated when independent weight
   * reaches `threshold`; no one account supplies more than `cap`; an account
   * past the floor weighs `base`, plus `artifact` when it attaches a
   * document, photograph or recording.
   */
  gate: {
    threshold: number;
    cap: number;
    base: number;
    artifact: number;
    clusterMinutes: number;
  };
  /** How often contributions held because review could not run are reviewed again. */
  rereviewIntervalMs: number;
  /**
   * Standing, earned when a later record bears a report out: a confirmation
   * adds `confirmed`, a contradiction takes away `contradicted`, standing
   * halves every `halfLifeDays`, and no account holds more than `ceiling`
   * on one topic.
   */
  standing: {
    confirmed: number;
    contradicted: number;
    halfLifeDays: number;
    ceiling: number;
  };
  /** How often contributions are compared against the records published since. */
  outcomeSweepIntervalMs: number;
  /** Where snapshots of quotable community material are written for the pipeline to read. */
  promotionDirectory: string | null;
  promotionIntervalMs: number;
  /** Where the weekly contributor-density reports are written. */
  densityDirectory: string | null;
  densityIntervalMs: number;
  /** Days the hashed network and client of a submission are kept for the independence test. */
  originRetentionDays: number;
};

/** What the services inject. */
export type CommunityConfig = CivicContributionsConfigType;
export const COMMUNITY_CONFIG = Symbol('COMMUNITY_CONFIG');

function integer(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number
): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer, got "${raw}"`);
  }
  return value;
}

function decimal(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number
): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be a positive number, got "${raw}"`);
  }
  return value;
}

function transport(env: NodeJS.ProcessEnv): LlmTransport {
  const raw = env['LLM_TRANSPORT'];
  if (raw === undefined || raw === '') return 'prompt-proxy';
  if (raw !== 'prompt-proxy' && raw !== 'direct') {
    throw new Error(
      `LLM_TRANSPORT must be prompt-proxy or direct, got "${raw}"`
    );
  }
  return raw;
}

const loadConfig = (
  env: NodeJS.ProcessEnv = process.env
): CivicContributionsConfigType => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as CivicContributionsConfigType;
  const databaseName =
    env['POSTGRES_DB'] ||
    configData.database.database ||
    configData.database.name;
  const fromCwd = (value: string | undefined, fallback: string): string =>
    path.resolve(process.cwd(), value || fallback);

  return {
    ...configData,
    listenPort: integer(env, 'LISTEN_PORT', configData.listenPort ?? 3029),
    database: {
      ...configData.database,
      host: env['POSTGRES_HOST'] || configData.database.host,
      port: integer(env, 'POSTGRES_PORT', configData.database.port),
      database: databaseName,
      name: databaseName,
      password: env['POSTGRES_PASSWORD'] || configData.database.password,
      username: env['POSTGRES_USER'] || configData.database.username,
    },
    civicBriefing: {
      host: env['CIVIC_BRIEFING_HOST'] || 'civic-briefing',
      port: integer(env, 'CIVIC_BRIEFING_PORT', 3028),
    },
    artifactRoot: fromCwd(env['ARTIFACT_ROOT'], 'data/community-artifacts'),
    maxUploadBytes: integer(env, 'MAX_UPLOAD_BYTES', 20 * 1024 * 1024),
    model: {
      baseUrl:
        env['REVIEW_MODEL_BASE_URL'] ||
        env['LLM_BASE_URL'] ||
        DEFAULT_OLLAMA_BASE_URL,
      model: env['REVIEW_MODEL'] || DEFAULT_PRIMARY_MODEL,
      timeoutMs: integer(env, 'REVIEW_MODEL_TIMEOUT_MS', 90_000),
    },
    llmTransport: transport(env),
    promptProxy: {
      host: env['PROMPT_PROXY_HOST'] || 'prompt-proxy',
      port: integer(env, 'PROMPT_PROXY_PORT', 3009),
    },
    localitiesDir: env['CIVIC_LOCALITIES_DIR']
      ? path.resolve(process.cwd(), env['CIVIC_LOCALITIES_DIR'])
      : null,
    hourlyLimit: integer(env, 'CONTRIBUTIONS_PER_HOUR', 12),
    strikeLimit: integer(env, 'COPYRIGHT_STRIKE_LIMIT', 3),
    floor: { minAgeDays: integer(env, 'CORROBORATION_MIN_AGE_DAYS', 7) },
    gate: {
      threshold: decimal(env, 'GATE_THRESHOLD', 1),
      cap: decimal(env, 'GATE_ACCOUNT_CAP', 0.5),
      base: decimal(env, 'GATE_BASE_WEIGHT', 0.3),
      artifact: decimal(env, 'GATE_ARTIFACT_WEIGHT', 0.2),
      clusterMinutes: integer(env, 'GATE_CLUSTER_MINUTES', 5),
    },
    rereviewIntervalMs: integer(env, 'REREVIEW_INTERVAL_MS', 15 * 60 * 1000),
    standing: {
      confirmed: decimal(env, 'STANDING_CONFIRMED', DEFAULT_STANDING.confirmed),
      // Given as how much is lost, and held negative here.
      contradicted: -decimal(
        env,
        'STANDING_CONTRADICTED',
        -DEFAULT_STANDING.contradicted
      ),
      halfLifeDays: integer(
        env,
        'STANDING_HALF_LIFE_DAYS',
        DEFAULT_STANDING.halfLifeDays
      ),
      ceiling: decimal(env, 'STANDING_CEILING', DEFAULT_STANDING.ceiling),
    },
    outcomeSweepIntervalMs: integer(
      env,
      'OUTCOME_SWEEP_INTERVAL_MS',
      6 * 60 * 60 * 1000
    ),
    promotionDirectory: fromCwd(
      env['PROMOTION_DIRECTORY'],
      'data/community-promotions'
    ),
    promotionIntervalMs: integer(env, 'PROMOTION_INTERVAL_MS', 60 * 60 * 1000),
    densityDirectory: fromCwd(
      env['DENSITY_DIRECTORY'],
      'data/community-density'
    ),
    densityIntervalMs: integer(
      env,
      'DENSITY_INTERVAL_MS',
      7 * 24 * 60 * 60 * 1000
    ),
    originRetentionDays: integer(env, 'ORIGIN_RETENTION_DAYS', 180),
  };
};

export default loadConfig;
