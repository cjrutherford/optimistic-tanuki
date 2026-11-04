import { Logger } from '@nestjs/common';
import {
  createLocalityRegistry,
  FoundationSourceSchema,
  loadLocalityRegistry,
  LocalitySchema,
  renderLocalityRegistry,
  SourceSchema,
  writeLocalityRegistry,
  type LocalityRegistry,
  type LocalityRow,
  type SourceRow,
} from '@optimistic-tanuki/civic-core';
import type { DataSource } from 'typeorm';
import type { LocalitySyncService } from '../locality-sync/locality-sync.service';
import { LocalityRegistrySource } from './locality-registry.source';

/** The slice of the sync this source needs; tests hand it a fake. */
export type LocalitySyncer = Pick<LocalitySyncService, 'sync'>;

/** How many excluded rows are quoted in the log, the rest are counted. */
const EXCLUDED_LOGGED = 5;
/** Pause before the one retry of a load that hit another writer's rename gap. */
const RENAME_GAP_RETRY_MS = 100;

/**
 * The registry, built from the database (D25/D29): sync from social, read the
 * active `localities` and their `sources`, render YAML into the generated
 * directory, load it with the unchanged loader.
 *
 * Failure behaviour: a social outage is logged and the registry is rebuilt
 * from what the database already holds, so briefings go on. With nothing in
 * the database either, `current()` is an empty registry, never a crash. A
 * failure after the sync (database, disk, a bad document) rejects `refresh()`
 * and leaves the last good registry in place.
 */
export class DbLocalityRegistrySource extends LocalityRegistrySource {
  private readonly logger = new Logger('LocalityRegistry');
  private registry: LocalityRegistry = createLocalityRegistry([]);
  private inFlight: {
    sync: boolean;
    promise: Promise<LocalityRegistry>;
  } | null = null;
  /** A full refresh waiting for an in-flight no-sync one to finish; full callers in the meantime share it. */
  private queuedFull: Promise<LocalityRegistry> | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly sync: LocalitySyncer,
    /** Where the rendered YAML goes; disposable, rebuilt on every refresh. */
    private readonly generatedDir: string,
    private readonly retryDelayMs = RENAME_GAP_RETRY_MS
  ) {
    super();
  }

  /** Empty until the first refresh succeeds (or when there is nothing to load). */
  current(): LocalityRegistry {
    return this.registry;
  }

  /**
   * `sync: false` skips the social sync and renders from the database. A
   * no-sync call may join any refresh in flight, since either re-renders from
   * the database. A full call joins only an in-flight full one: it must not be
   * satisfied by a no-sync refresh, so behind one it queues a full refresh.
   */
  refresh(options: { sync?: boolean } = {}): Promise<LocalityRegistry> {
    const sync = options.sync ?? true;
    const current = this.inFlight;
    if (current && (!sync || current.sync)) return current.promise;
    if (current) {
      this.queuedFull ??= current.promise
        .catch(() => undefined)
        .then(() => this.begin(true))
        .finally(() => {
          this.queuedFull = null;
        });
      return this.queuedFull;
    }
    return this.begin(sync);
  }

  private begin(sync: boolean): Promise<LocalityRegistry> {
    const promise = this.run(sync).finally(() => {
      if (this.inFlight?.promise === promise) this.inFlight = null;
    });
    this.inFlight = { sync, promise };
    return promise;
  }

  /**
   * Refreshes now and then every `intervalMs`. One timer for the sync, render
   * and load; resolves once the first refresh has finished, failed or not, so
   * callers can start work on whatever the database held.
   */
  async start(intervalMs: number): Promise<void> {
    if (!this.timer) {
      this.timer = setInterval(() => void this.safeRefresh(), intervalMs);
      this.timer.unref?.();
    }
    await this.safeRefresh();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async safeRefresh(): Promise<void> {
    try {
      await this.refresh();
    } catch (error) {
      this.logger.error(
        `registry refresh failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async run(sync: boolean): Promise<LocalityRegistry> {
    if (sync) await this.syncFromSocial();
    const localities = await this.dataSource
      .getRepository<LocalityRow>(LocalitySchema)
      .find();
    const sources = await this.dataSource
      .getRepository<SourceRow>(
        this.dataSource.hasMetadata(FoundationSourceSchema)
          ? FoundationSourceSchema
          : SourceSchema
      )
      .find();
    const { files, excluded } = renderLocalityRegistry(localities, sources);
    if (excluded.length)
      this.logger.warn(
        `${excluded.length} row(s) left out of the registry: ${excluded
          .slice(0, EXCLUDED_LOGGED)
          .map((row) => `${row.kind} ${row.key} (${row.reason})`)
          .join('; ')}${excluded.length > EXCLUDED_LOGGED ? '; …' : ''}`
      );
    writeLocalityRegistry(this.generatedDir, files);
    const registry = await this.load();
    this.registry = registry;
    this.logger.log(
      `registry loaded: ${files.length} localities, ${
        registry.editions().length
      } editions`
    );
    return registry;
  }

  private async syncFromSocial(): Promise<void> {
    try {
      const summary = await this.sync.sync();
      this.logger.log(
        `synced from social: ${summary.created} created, ${summary.updated} updated, ${summary.deactivated} deactivated, ${summary.skipped.length} skipped`
      );
    } catch (error) {
      this.logger.warn(
        `social sync failed, using the localities already in the database: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * writeLocalityRegistry swaps directories in two renames, so another process
   * writing the same directory (a CLI one-shot beside the service) can leave a
   * moment with no directory. Our own writes finish before we load, so the
   * gap is only ever another writer's: retry once after a short pause rather
   * than loading in-process, because the loader reads a directory.
   */
  private async load(): Promise<LocalityRegistry> {
    try {
      return loadLocalityRegistry(this.generatedDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      return loadLocalityRegistry(this.generatedDir);
    }
  }
}
