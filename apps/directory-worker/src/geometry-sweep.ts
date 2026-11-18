import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ZipReader } from '@zip.js/zip.js';
import { DataSource } from 'typeorm';
import {
  AutoBoundaryDeps,
  AutoDiscovery,
  AutoSweepResult,
  runAutoBoundarySweep,
  TigerCandidate,
} from '../../directory/src/auto-boundary';
import {
  CENSUS_TIGER_PINS,
  CENSUS_TIGER_VINTAGE,
  censusArchiveUrl,
} from '../../directory/src/census-tiger-pins';
import { DirectoryRecoveryIdentity } from '../../directory/src/register-recovery-authority';
import { storeDiscoveredBoundaryCandidate } from './boundary-review';

/**
 * The bundled census reader (scripts/census-boundary-reader.mjs) imports @zip.js/zip.js at runtime. This type-only
 * reference is what makes the production package.json generator list it as a dependency of the worker image.
 */
export type CensusZipReader = ZipReader<unknown>;

/** The pinned archives are at most 32 MiB; anything larger is refused before it is written. */
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;

export type GeometrySweepConfig = {
  intervalMs: number;
  limit: number;
  retryErrorMs: number;
  retryReviewMs: number;
  cacheDir: string;
};

/** Returns null (sweep disabled) only when DIRECTORY_AUTO_GEOMETRY is explicitly 'off'. */
export function geometrySweepConfig(
  env: NodeJS.ProcessEnv
): GeometrySweepConfig | null {
  const mode = (env.DIRECTORY_AUTO_GEOMETRY ?? 'on').trim().toLowerCase();
  if (mode === 'off') return null;
  if (mode !== 'on') throw Error('Invalid DIRECTORY_AUTO_GEOMETRY');
  const int = (name: string, fallback: number, min: number, max: number) => {
    const value = Number(env[name] || fallback);
    if (!Number.isSafeInteger(value) || value < min || value > max)
      throw Error(`Invalid ${name}`);
    return value;
  };
  return {
    intervalMs: int(
      'DIRECTORY_AUTO_GEOMETRY_INTERVAL_MS',
      60_000,
      1000,
      86_400_000
    ),
    limit: int('DIRECTORY_AUTO_GEOMETRY_LIMIT', 10, 1, 100),
    retryErrorMs: int(
      'DIRECTORY_AUTO_GEOMETRY_RETRY_ERROR_MS',
      900_000,
      1000,
      2_000_000_000
    ),
    retryReviewMs: int(
      'DIRECTORY_AUTO_GEOMETRY_RETRY_REVIEW_MS',
      604_800_000,
      1000,
      2_000_000_000
    ),
    cacheDir: resolve(
      env.DIRECTORY_AUTO_GEOMETRY_CACHE_DIR ||
        join(tmpdir(), 'directory-census')
    ),
  };
}

export type ArchiveFetch = (
  url: string,
  signal: AbortSignal
) => Promise<{ ok: boolean; body: NodeJS.ReadableStream | null }>;

const defaultFetch: ArchiveFetch = async (url, signal) => {
  const response = await fetch(url, { redirect: 'error', signal });
  const body = response.body
    ? (await import('node:stream')).Readable.fromWeb(response.body as never)
    : null;
  return { ok: response.ok, body };
};

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

/**
 * Pinned Census archive store. A file is trusted only after its SHA-256 equals the pin; a mismatch is deleted and
 * refused. Only www2.census.gov over HTTPS is ever contacted, without redirects, with a hard size limit.
 */
export class CensusArchiveStore {
  constructor(
    private readonly dir: string,
    private readonly fetchArchive: ArchiveFetch = defaultFetch,
    private readonly timeoutMs = 120_000
  ) {}

  pinned(stateFips: string): boolean {
    return Object.prototype.hasOwnProperty.call(CENSUS_TIGER_PINS, stateFips);
  }

  async ensure(
    stateFips: string,
    layer: 'place' | 'cousub'
  ): Promise<{ path: string; bytes: number; sha256: string }> {
    if (!this.pinned(stateFips)) throw Error('no_pinned_archive');
    const pin = CENSUS_TIGER_PINS[stateFips][layer];
    const name = `tl_${CENSUS_TIGER_VINTAGE}_${stateFips}_${layer}.zip`,
      path = join(this.dir, name);
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    try {
      const info = await stat(path);
      if (
        info.isFile() &&
        info.size <= MAX_ARCHIVE_BYTES &&
        (await sha256File(path)) === pin
      )
        return { path, bytes: info.size, sha256: pin };
    } catch {
      /* not cached */
    }
    const url = censusArchiveUrl(stateFips, layer);
    const part = `${path}.${process.pid}.part`;
    try {
      const response = await this.fetchArchive(
        url,
        AbortSignal.timeout(this.timeoutMs)
      );
      if (!response.ok || !response.body) throw Error('archive_unavailable');
      const hash = createHash('sha256');
      let size = 0;
      await pipeline(
        response.body,
        new Transform({
          transform(chunk, _encoding, done) {
            size += chunk.length;
            if (size > MAX_ARCHIVE_BYTES)
              return done(Error('archive_too_large'));
            hash.update(chunk);
            done(null, chunk);
          },
        }),
        createWriteStream(part, { mode: 0o600, flags: 'w' })
      );
      if (hash.digest('hex') !== pin) throw Error('archive_digest_mismatch');
      await rename(part, path);
      return { path, bytes: size, sha256: pin };
    } finally {
      await rm(part, { force: true });
    }
  }
}

type CensusReader = {
  readCensusBoundaryCandidate(
    options: Record<string, unknown>
  ): Promise<unknown>;
};
type CensusSocial = {
  states: Record<string, string>;
  discoverPrivateTownBoundary(
    options: Record<string, unknown>
  ): Promise<AutoDiscovery & Record<string, unknown>>;
};
type Duck = { closeSync(): void };
type DuckConnection = Duck & {
  run(sql: string): Promise<unknown>;
};

/** One DuckDB spatial connection per sweep, opened only when a town needs it. */
export class SpatialSession {
  private duck?: Duck;
  private conn?: DuckConnection;
  async connection(): Promise<DuckConnection> {
    if (this.conn) return this.conn;
    const { DuckDBInstance } = await import('@duckdb/node-api');
    const duck = await DuckDBInstance.create(':memory:');
    this.duck = duck as unknown as Duck;
    const connection = (await duck.connect()) as unknown as DuckConnection;
    await connection.run('SET autoinstall_known_extensions=false');
    await connection.run('SET autoload_known_extensions=false');
    await connection.run('LOAD spatial');
    this.conn = connection;
    return connection;
  }
  close(): void {
    try {
      this.conn?.closeSync();
    } finally {
      this.duck?.closeSync();
      this.conn = undefined;
      this.duck = undefined;
    }
  }
}

export interface GeometrySweepRuntime {
  db: DataSource;
  identity: DirectoryRecoveryIdentity;
  delivery: {
    geography: (
      identity: {
        sourceEpoch: string;
        activationId: string;
        socialGeneration: string;
      },
      communityId: string
    ) => Promise<{
      status: string;
      changeToken?: string;
      geography?: {
        adminArea?: string | null;
        referencePoint?: [number, number] | null;
      } | null;
    }>;
  };
}

/** The production wiring of one sweep over the existing reader, candidate store and install primitive. */
export function createGeometrySweepRunner(
  config: GeometrySweepConfig,
  runtime: () => GeometrySweepRuntime,
  store: CensusArchiveStore = new CensusArchiveStore(config.cacheDir)
): (signal?: AbortSignal) => Promise<AutoSweepResult> {
  return async (signal) => {
    const { db, identity, delivery } = runtime();
    const source = {
      sourceEpoch: identity.sourceEpoch,
      activationId: identity.activationId,
      socialGeneration: identity.socialGeneration,
    };
    // Loaded here, not at module scope: the ESM readers and the native spatial engine are only needed when a sweep has work.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const reader =
      require('../../../scripts/census-boundary-reader.mjs') as CensusReader;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const social =
      require('../../../scripts/census-boundary-social.mjs') as CensusSocial;
    const spatial = new SpatialSession();
    const deps: AutoBoundaryDeps = {
      db,
      identity,
      read: (communityId) => () => delivery.geography(source, communityId),
      discover: async (communityId) => {
        const current = await delivery.geography(source, communityId);
        const area =
          current.status === 'current' &&
          typeof current.geography?.adminArea === 'string'
            ? current.geography.adminArea.trim().toUpperCase()
            : '';
        const stateFips = social.states[area];
        let archives: Array<Record<string, unknown>> = [];
        if (stateFips) {
          if (!store.pinned(stateFips))
            return { status: 'pending', reason: 'no_pinned_archive' };
          archives = await Promise.all(
            (['place', 'cousub'] as const).map(async (layer) => {
              const a = await store.ensure(stateFips, layer);
              return {
                layer,
                archivePath: a.path,
                archiveSha256: a.sha256,
                archiveBytes: a.bytes,
              };
            })
          );
        }
        return social.discoverPrivateTownBoundary({
          delivery,
          identity: source,
          communityId,
          archives,
          vintage: CENSUS_TIGER_VINTAGE,
          connection: archives.length ? await spatial.connection() : undefined,
        });
      },
      storeCandidate: (_communityId, found, candidate: TigerCandidate) =>
        storeDiscoveredBoundaryCandidate(
          db,
          identity,
          { ...found, status: 'candidate', candidates: [candidate] } as never,
          delivery as never
        ),
      load: async (decision, geography) => {
        const layer = decision['layer'] as 'place' | 'cousub',
          stateFips = decision['stateFips'] as string;
        const archive = await store.ensure(stateFips, layer);
        return (await reader.readCensusBoundaryCandidate({
          connection: await spatial.connection(),
          archivePath: archive.path,
          archiveBytes: archive.bytes,
          archiveSha256: decision['archiveSha256'],
          vintage: decision['vintage'],
          stateFips,
          layer,
          geoid: decision['geoid'],
          referencePoint: (geography as { referencePoint: unknown })
            .referencePoint,
        })) as never;
      },
    };
    try {
      return await runAutoBoundarySweep(deps, {
        limit: config.limit,
        retryErrorMs: config.retryErrorMs,
        retryReviewMs: config.retryReviewMs,
        signal,
      });
    } finally {
      spatial.close();
    }
  };
}

export type GeometrySweepSnapshot = {
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: 'ok' | 'paused' | 'error' | null;
  examined: number;
  installed: number;
  queued: number;
  errors: number;
};

export class GeometrySweepStatus {
  private value: GeometrySweepSnapshot;
  constructor(enabled: boolean) {
    this.value = {
      enabled,
      lastRunAt: null,
      lastStatus: null,
      examined: 0,
      installed: 0,
      queued: 0,
      errors: 0,
    };
  }
  record(status: 'ok' | 'paused' | 'error', run?: AutoSweepResult): void {
    this.value = {
      enabled: this.value.enabled,
      lastRunAt: new Date().toISOString(),
      lastStatus: status,
      examined: run?.examined ?? 0,
      installed: run?.installed ?? 0,
      queued: run?.queued ?? 0,
      errors: run?.errors ?? 0,
    };
  }
  snapshot(): GeometrySweepSnapshot {
    return this.value;
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolveDelay) => {
    if (signal.aborted) return resolveDelay();
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolveDelay();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

/**
 * Sequential by construction. A sweep that finds work runs again after a short pause so a backlog drains at the
 * bounded per-sweep rate; an idle or paused sweep waits the full interval. Never throws.
 */
export async function runGeometrySweepLoop(options: {
  signal: AbortSignal;
  intervalMs: number;
  run: (signal: AbortSignal) => Promise<AutoSweepResult>;
  status: GeometrySweepStatus;
  pause?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}): Promise<void> {
  const log = options.log ?? ((m: string) => console.error(m));
  const pause = options.pause ?? ((ms: number) => delay(ms, options.signal));
  while (!options.signal.aborted) {
    let wait = options.intervalMs;
    try {
      const run = await options.run(options.signal);
      options.status.record(run.status, run);
      if (run.examined > 0)
        log(
          `geometry sweep: examined=${run.examined} installed=${run.installed} queued=${run.queued} errors=${run.errors}`
        );
      if (run.examined > 0 && run.errors < run.examined)
        wait = Math.min(wait, 2000);
    } catch {
      options.status.record('error');
      log('geometry sweep failed');
    }
    if (!options.signal.aborted) await pause(wait);
  }
}
