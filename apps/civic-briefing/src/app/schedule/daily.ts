import { Logger } from '@nestjs/common';
import {
  BriefingSchema,
  CivicItemSchema,
  createLlmAttemptRecorder,
  discoverSources,
  itemEvidenceLocalDate,
  itemLocalDate,
  OfficialDirectories,
  OutboundPolicy,
  runPipeline,
  searchProviderFromEnvironment,
  type Cadence,
  type LocalityConfig,
  type LocalityRegistry,
  type PipelineStages,
  type SearchProvider,
  type SourcingDecision,
  type BlobStore,
} from '@optimistic-tanuki/civic-core';
import {
  GatewaySummarizer,
  type FetchImplementation,
} from '@optimistic-tanuki/civic-llm';
import { In, type DataSource } from 'typeorm';
import {
  cadenceNow,
  localClock,
  planFor,
  shiftDate,
  sourcingDue,
  type RunPlan,
} from './plan';
import type { ScheduleConfig } from './schedule.config';
import type { CivicCoreClient } from '@optimistic-tanuki/civic-adapters';
import { civicCoreDecisions } from '../civic-core/adoption';
import { townSources } from '../registry/town-sources';
import { SourcingStore } from './sourcing-store';
import type { LocalityRegistrySource } from '../registry/locality-registry.source';

/**
 * The daily pipeline: every edition town, every day, without anyone running it.
 *
 * Each tick asks, town by town, whether today's edition exists yet (see
 * plan.ts). When it does not and the town's hour has passed — or the town has
 * never had one — the schedule first looks for new sources if a week has
 * passed since it last looked, then runs the pipeline: gather, parse,
 * extract, project, collate, brief, with the model, into the live database.
 *
 * A town's first run reads six months back, so an empty database — a fresh
 * install, or production's first day — fills itself. After that a run reads
 * from a few days before its last success, while stories still draw on six
 * months of what is stored.
 *
 * A town whose recent record is too light for daily news gets a weekly
 * edition instead, until it picks up (see plan.ts).
 *
 * One tick at a time: a tick that finds work still running waits for the
 * next. Within a tick, with hundreds of towns (D26), the due towns are ordered
 * least recently published first and the tick takes at most
 * `maxTownsPerTick` of them, `concurrency` at a time (one by default; each
 * town has its own run lease, so towns do not contend). Source discovery is
 * a crawl, so at most `sourcingMaxPerTick` towns start one per tick; a town
 * that has never run and has to wait for its discovery waits for a later
 * tick rather than running with no sources. Failures are logged and retried a
 * few times a day, then left for tomorrow rather than hammering a source or a
 * model that is down.
 */

/** The longest a model call may take; prompt-proxy's own limit must exceed it. */
export const MODEL_TIMEOUT_MS = 300_000;
export class DailySchedule {
  private readonly logger = new Logger('DailySchedule');
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly failures = new Map<string, number>();
  /** Towns already logged as having no sources, so each is said once until it gains some. */
  private readonly noSourcesLogged = new Set<string>();
  private readonly search: SearchProvider | null;
  private readonly store: SourcingStore;

  constructor(
    private readonly config: ScheduleConfig,
    private readonly dataSource: DataSource,
    private readonly stages: PipelineStages,
    /** Where the town registry comes from: the database, via sync, render and load. */
    private readonly registrySource: LocalityRegistrySource,
    /** Set when model calls go through prompt-proxy rather than LLM_BASE_URL. */
    private readonly modelFetch?: FetchImplementation,
    /** The platform's virus-scanning blob store (D22); runs never use another. */
    private readonly blobStore?: BlobStore,
    /** Civic Core, when this deployment reads it: a matched tenant is adopted as the town's own source. */
    private readonly civicCore?: CivicCoreClient
  ) {
    this.store = new SourcingStore(dataSource);
    this.search = searchProviderFromEnvironment();
  }

  start(): void {
    if (!this.config.scheduleEnabled) {
      this.logger.warn(
        'DAYLIGHT_SCHEDULE_ENABLED is off; no editions will be scheduled'
      );
      return;
    }
    this.logger.log(
      `daily editions at ${this.config.dailyAt} local time for ${
        this.editions().length
      } town(s), at most ${this.config.maxTownsPerTick} per tick (${
        this.config.concurrency
      } at a time, ${this.config.sourcingMaxPerTick} new source searches); ` +
        `weekly instead below ${
          this.config.dailyMinItems
        } dated local records in ${this.config.densityDays} days; history ${
          this.config.historyDays
        } days; search ${
          this.search
            ? this.search.name
            : 'not configured (official sites only)'
        }`
    );
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.config.tickMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * One pass over the towns. Returns what it did, for the log and for tests.
   * Does nothing when the kill switch is off (DAYLIGHT_SCHEDULE_ENABLED).
   */
  async tick(now = new Date()): Promise<{ town: string; action: string }[]> {
    if (!this.config.scheduleEnabled) return [];
    if (this.running) return [];
    this.running = true;
    const done: { town: string; action: string }[] = [];
    try {
      const batch = await this.dueTowns(now);
      const queue = [...batch];
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const { town, clock, plan, needsSourcing } = next;
          if (needsSourcing)
            done.push({
              town: town.slug,
              action: await this.source(town, clock.localDate),
            });
          if (await this.hasNoSources(town)) {
            done.push({ town: town.slug, action: 'no sources' });
            continue;
          }
          done.push({
            town: town.slug,
            action: await this.run(
              town,
              plan.cadence,
              plan.gatherSince,
              clock.localDate,
              now
            ),
          });
        }
      };
      await Promise.all(
        Array.from(
          {
            length: Math.max(
              1,
              Math.min(this.config.concurrency, batch.length)
            ),
          },
          worker
        )
      );
    } catch (error) {
      this.logger.error(
        `tick failed: ${
          error instanceof Error ? error.stack ?? error.message : String(error)
        }`
      );
    } finally {
      this.running = false;
    }
    return done;
  }

  /**
   * The towns this tick will work on: the due ones, least recently published
   * first (towns with no edition at all lead; ties by slug), cut off at
   * `maxTownsPerTick`. Towns are planned in that order and planning stops
   * once the batch is full, so a tick does not count records for towns it
   * will not run. A town that needs source discovery takes one of the tick's
   * `sourcingMaxPerTick` slots; when none is left, a town with no run yet
   * waits for a later tick and an established town runs on what it has.
   */
  private async dueTowns(now: Date): Promise<TickItem[]> {
    const candidates: {
      town: LocalityConfig;
      clock: ReturnType<typeof localClock>;
      last: { periodEnd: string; cadence: Cadence } | null;
    }[] = [];
    for (const town of this.editions()) {
      const clock = localClock(now, town.timezone);
      const last = await this.lastEdition(town.slug);
      if (last?.periodEnd === clock.localDate) continue;
      candidates.push({ town, clock, last });
    }
    candidates.sort(
      (a, b) =>
        (a.last?.periodEnd ?? '').localeCompare(b.last?.periodEnd ?? '') ||
        a.town.slug.localeCompare(b.town.slug)
    );
    const batch: TickItem[] = [];
    let sourcing = 0;
    let waiting = 0;
    for (const { town, clock, last } of candidates) {
      if (batch.length >= this.config.maxTownsPerTick) break;
      const failuresToday =
        this.failures.get(`${town.slug}:${clock.localDate}`) ?? 0;
      const recentItems = last
        ? await this.recentItems(town, clock.localDate)
        : undefined;
      const plan = planFor(
        {
          ...clock,
          lastSuccess: last?.periodEnd ?? null,
          lastCadence: last?.cadence ?? null,
          failuresToday,
          recentItems,
        },
        this.config
      );
      if (!plan.due) continue;
      const searched = await this.lastSearched(town.slug);
      const sourceless = searched !== null && this.sourceless(town);
      // A town searched and left with no sources is searched again on the
      // interval, not on every tick, and has nothing to run in between (D32).
      const needsSourcing =
        (plan.fresh && !sourceless) ||
        sourcingDue(
          searched,
          clock.localDate,
          this.config.sourcingIntervalDays
        );
      if (sourceless && !needsSourcing) {
        this.noSources(town);
        continue;
      }
      if (needsSourcing && sourcing >= this.config.sourcingMaxPerTick) {
        if (plan.fresh) {
          waiting += 1;
          continue;
        }
        if (sourceless) {
          this.noSources(town);
          continue;
        }
        this.logger.log(`${town.slug}: due (${plan.reason})`);
        batch.push({ town, clock, plan, needsSourcing: false });
        continue;
      }
      if (needsSourcing) sourcing += 1;
      this.logger.log(`${town.slug}: due (${plan.reason})`);
      batch.push({ town, clock, plan, needsSourcing });
    }
    if (waiting)
      this.logger.log(
        `${waiting} new town(s) wait for source discovery in a later tick (at most ${this.config.sourcingMaxPerTick} per tick)`
      );
    return batch;
  }

  /** Whether the registry holds no enabled source serving the town. */
  private sourceless(town: LocalityConfig): boolean {
    const none = townSources(this.registry, town).length === 0;
    if (!none) this.noSourcesLogged.delete(town.slug);
    return none;
  }

  /** After sourcing has run: the town was searched and still has no sources. */
  private async hasNoSources(town: LocalityConfig): Promise<boolean> {
    if (!this.sourceless(town) || (await this.lastSearched(town.slug)) === null)
      return false;
    this.noSources(town);
    return true;
  }

  /** Says once that a town has no sources; it is skipped, not failed (D32). */
  private noSources(town: LocalityConfig): void {
    if (this.noSourcesLogged.has(town.slug)) return;
    this.noSourcesLogged.add(town.slug);
    this.logger.log(`${town.slug}: no sources`);
  }

  /** Searches for sources now, for the named towns or every edition, without running the pipeline. */
  async sourceNow(
    slugs: readonly string[] = [],
    now = new Date()
  ): Promise<{ town: string; action: string }[]> {
    const towns = this.editions().filter(
      (town) => !slugs.length || slugs.includes(town.slug)
    );
    const done: { town: string; action: string }[] = [];
    for (const town of towns)
      done.push({
        town: town.slug,
        action: await this.source(
          town,
          localClock(now, town.timezone).localDate
        ),
      });
    return done;
  }

  /**
   * Runs the named towns now (or every edition), whatever the hour or day:
   * reading since the last edition as a scheduled run would, or the whole
   * history window for a town with none, in the cadence the town is in. For
   * an operator who has just added a source.
   */
  async runNow(
    slugs: readonly string[] = [],
    now = new Date()
  ): Promise<{ town: string; action: string }[]> {
    const towns = this.editions().filter(
      (town) => !slugs.length || slugs.includes(town.slug)
    );
    const done: { town: string; action: string }[] = [];
    for (const town of towns) {
      const clock = localClock(now, town.timezone);
      const last = (await this.lastEdition(town.slug))?.periodEnd ?? null;
      const recentItems = last
        ? await this.recentItems(town, clock.localDate)
        : undefined;
      const cadence = cadenceNow(
        { lastSuccess: last, recentItems },
        this.config
      );
      const since = last === clock.localDate ? shiftDate(last, -1) : last;
      done.push({
        town: town.slug,
        action: await this.run(
          town,
          cadence,
          since ? shiftDate(since, -this.config.overlapDays) : undefined,
          clock.localDate,
          now
        ),
      });
    }
    return done;
  }

  /**
   * Searches for the named towns' sources (or every edition's), then fetches
   * and parses their whole history window without writing an edition (D31).
   * The first half of a backfill.
   */
  async pullNow(
    slugs: readonly string[] = [],
    now = new Date()
  ): Promise<{ town: string; action: string }[]> {
    const done: { town: string; action: string }[] = [];
    for (const town of this.towns(slugs)) {
      const { localDate } = localClock(now, town.timezone);
      done.push({
        town: town.slug,
        action: await this.source(town, localDate),
      });
      done.push({
        town: town.slug,
        action: await this.run(town, 'daily', undefined, localDate, now, {
          pullOnly: true,
        }),
      });
    }
    return done;
  }

  /**
   * Writes the editions the schedule would have written over the last `days`
   * days, up to and including today, from what a pull stored (D31). Each day
   * is planned as the schedule would have planned it, in the town's own
   * cadence, and each edition reads only what had been published by its day.
   * Days that already have an edition are kept. A town stops after three
   * failures in a row, so a model that is down is not asked 180 times.
   */
  async backfill(
    slugs: readonly string[] = [],
    days = this.config.historyDays,
    now = new Date()
  ): Promise<{ town: string; action: string }[]> {
    const done: { town: string; action: string }[] = [];
    for (const town of this.towns(slugs)) {
      const today = localClock(now, town.timezone).localDate;
      const existing = new Map(
        (
          await this.dataSource.getRepository(BriefingSchema).find({
            where: { localitySlug: town.slug },
            select: { periodEnd: true, cadence: true },
          })
        ).map((row) => [row.periodEnd, row.cadence as Cadence])
      );
      let last: { periodEnd: string; cadence: Cadence } | null = null;
      for (const [periodEnd, cadence] of existing)
        if (
          periodEnd < shiftDate(today, -days) &&
          periodEnd > (last?.periodEnd ?? '')
        )
          last = { periodEnd, cadence };
      let written = 0;
      let failures = 0;
      for (
        let day = shiftDate(today, -days);
        day <= today;
        day = shiftDate(day, 1)
      ) {
        const kept = existing.get(day);
        if (kept) {
          last = { periodEnd: day, cadence: kept };
          continue;
        }
        const plan: RunPlan = planFor(
          {
            localDate: day,
            localTime: this.config.dailyAt,
            lastSuccess: last?.periodEnd ?? null,
            lastCadence: last?.cadence ?? null,
            failuresToday: 0,
            recentItems: last
              ? await this.recentItems(town, day, true)
              : undefined,
          },
          this.config
        );
        if (!plan.due) continue;
        const status = await this.run(
          town,
          plan.cadence,
          undefined,
          day,
          new Date(`${day}T12:00:00Z`),
          { periodEnd: day }
        );
        if (status === 'succeeded' || status === 'partial_success') {
          last = { periodEnd: day, cadence: plan.cadence };
          written += 1;
          failures = 0;
        } else if (++failures >= 3) {
          done.push({
            town: town.slug,
            action: `backfill stopped at ${day} after 3 failures in a row; ${written} edition(s) written`,
          });
          break;
        }
      }
      if (failures < 3)
        done.push({
          town: town.slug,
          action: `backfill of ${days} days: ${written} edition(s) written`,
        });
    }
    return done;
  }

  /** The scheduled towns' slugs. */
  townSlugs(): string[] {
    return this.editions().map((town) => town.slug);
  }

  /**
   * Runs `work` while the schedule's own ticks wait, so an operator's
   * backfill and a scheduled run never overlap. Refuses while a tick runs.
   */
  async exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (this.running)
      throw new Error('A scheduled run is in progress; try again shortly.');
    this.running = true;
    try {
      return await work();
    } finally {
      this.running = false;
    }
  }

  private towns(slugs: readonly string[]): readonly LocalityConfig[] {
    return this.editions().filter(
      (town) => !slugs.length || slugs.includes(town.slug)
    );
  }

  /** The current registry: always the latest the source has loaded. A run keeps the one it started with. */
  private get registry(): LocalityRegistry {
    return this.registrySource.current();
  }

  private editions(): readonly LocalityConfig[] {
    return this.registry.editions();
  }

  /**
   * Makes the schedule see what the database now holds, after sources were
   * adopted: the registry source renders from the database and reloads, without
   * another social sync (only our own rows changed).
   */
  protected async refreshRegistry(): Promise<void> {
    await this.registrySource.refresh({ sync: false });
  }

  protected lastSearched(slug: string): Promise<string | null> {
    return this.store.lastSearched(slug);
  }

  /** A town's latest edition, daily or weekly, or null when it has none. */
  protected async lastEdition(
    slug: string
  ): Promise<{ periodEnd: string; cadence: Cadence } | null> {
    const latest = await this.dataSource.getRepository(BriefingSchema).findOne({
      where: { localitySlug: slug },
      order: { periodEnd: 'DESC', id: 'DESC' },
    });
    return latest
      ? { periodEnd: latest.periodEnd, cadence: latest.cadence as Cadence }
      : null;
  }

  /**
   * Dated records from the town itself, the places inside it and its county
   * in the last `densityDays` days before today: how busy its public record
   * is. Regional and state records are left out — every town shares them.
   */
  protected async recentItems(
    town: LocalityConfig,
    localDate: string,
    /** Count only what had been published before `localDate` (a backfill, D31). */
    knownBefore = false
  ): Promise<number> {
    const slugs = [
      town.slug,
      ...this.registry.descendants(town.slug).map((place) => place.slug),
      ...this.registry
        .ancestors(town.slug)
        .filter((place) => place.kind === 'county')
        .map((place) => place.slug),
    ];
    const since = shiftDate(localDate, -this.config.densityDays);
    const rows = await this.dataSource.getRepository(CivicItemSchema).find({
      select: { eventDate: true, publishedAt: true, observedAt: true },
      where: { localitySlug: In(slugs) },
    });
    return rows.filter((row) => {
      const day = itemEvidenceLocalDate(row, town.timezone);
      if (day === null || day < since || day >= localDate) return false;
      if (!knownBefore) return true;
      const published = itemLocalDate(
        { eventDate: null, publishedAt: row.publishedAt },
        town.timezone
      );
      return published === null || published < localDate;
    }).length;
  }

  protected async run(
    town: LocalityConfig,
    cadence: Cadence,
    gatherSince: string | undefined,
    localDate: string,
    now: Date,
    mode: RunMode = {}
  ): Promise<string> {
    const started = Date.now();
    try {
      const result = await runPipeline({
        ...(this.blobStore ? { blobStore: this.blobStore } : {}),
        registry: this.registry,
        localitySlug: town.slug,
        cadence,
        dataSource: this.dataSource,
        stages: this.stages,
        now,
        outputRoot: this.config.artifacts,
        backfillDays: this.config.historyDays,
        ...(gatherSince ? { gatherSince } : {}),
        ...(mode.pullOnly ? { pullOnly: true } : {}),
        ...(mode.periodEnd
          ? {
              fromStored: true,
              periodStart: shiftDate(
                mode.periodEnd,
                cadence === 'weekly' ? -7 : -1
              ),
              periodEnd: mode.periodEnd,
            }
          : {}),
        ...(this.config.communityDirectory
          ? { communityDirectory: this.config.communityDirectory }
          : {}),
        summarizerFactory: ({ runId, dataSource }) => {
          const recorder = createLlmAttemptRecorder(dataSource, {
            runId,
            localitySlug: town.slug,
          });
          return new GatewaySummarizer({
            strict: true,
            runId: String(runId),
            ...(this.config.model.baseUrl
              ? { baseUrl: this.config.model.baseUrl }
              : {}),
            ...(this.config.model.primary
              ? { primary: this.config.model.primary }
              : {}),
            ...(this.config.model.fallback
              ? { fallback: this.config.model.fallback }
              : {}),
            ...(this.config.model.planner
              ? { planner: this.config.model.planner }
              : {}),
            ...(this.config.model.planner && this.config.model.writer
              ? { writer: this.config.model.writer }
              : {}),
            // prompt-proxy forwards Ollama's native /api/chat request as is.
            ...(this.modelFetch
              ? { api: 'ollama' as const, fetchImpl: this.modelFetch }
              : {}),
            timeoutMs: MODEL_TIMEOUT_MS,
            recordAttempt: async (attempt) => {
              await recorder.record(attempt);
            },
          });
        },
      });
      const seconds = Math.round((Date.now() - started) / 1000);
      const gaps = result.coverageGaps.length
        ? `; ${
            result.coverageGaps.length
          } coverage gap(s): ${result.coverageGaps
            .map((gap) => `${gap.sourceKey} (${gap.reason})`)
            .join(', ')}`
        : '';
      if (
        result.status === 'succeeded' ||
        result.status === 'partial_success'
      ) {
        this.logger.log(
          `${town.slug}: ${
            mode.pullOnly
              ? 'pull'
              : mode.periodEnd
              ? `${cadence} for ${mode.periodEnd} (backfill)`
              : cadence
          } ${result.status} in ${seconds}s${
            mode.periodEnd
              ? ''
              : gatherSince
              ? ` reading since ${gatherSince}`
              : ` reading ${this.config.historyDays} days`
          }${gaps}`
        );
        return result.status;
      }
      this.failed(town.slug, localDate);
      this.logger.warn(
        `${town.slug}: ${result.status}${
          result.blockedReason ? ` (${result.blockedReason})` : ''
        } in ${seconds}s${gaps}`
      );
      return result.status;
    } catch (error) {
      this.failed(town.slug, localDate);
      this.logger.error(
        `${town.slug}: run failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 'failed';
    }
  }

  private failed(slug: string, localDate: string): void {
    const key = `${slug}:${localDate}`;
    this.failures.set(key, (this.failures.get(key) ?? 0) + 1);
  }

  /**
   * Looks for a town's sources and adopts what passes. Adopted sources are
   * written to the database as discovered sources, and every decision —
   * adopted or refused, with its reasons — is recorded beside a "searched"
   * record that tells the schedule when the town was last looked at.
   */
  protected async source(
    town: LocalityConfig,
    localDate: string
  ): Promise<string> {
    const started = Date.now();
    try {
      const ancestors = this.registry.ancestors(town.slug);
      const descendants = this.registry.descendants(town.slug);
      const existing = [town, ...ancestors, ...descendants].flatMap(
        (place) => place.sources
      );
      const httpClient = new OutboundPolicy();
      // The directories are asked about the town, the governments containing
      // it, and those inside it (the City of Groton within the Town).
      const directories = await new OfficialDirectories(
        this.config.directoriesDir,
        httpClient
      ).sitesFor([town, ...ancestors, ...descendants]);
      for (const note of directories.notes)
        this.logger.warn(`${town.slug}: ${note}`);
      const discovery = await discoverSources({
        locality: town,
        ancestors: [...ancestors, ...descendants],
        existing,
        httpClient,
        search: this.search,
        officialSites: directories.sites,
        governmentDomains: directories.governmentDomains,
        pageBudget: this.config.sourcingPageBudget,
      });
      const { searched, pagesRead } = discovery;
      const decisions = [...discovery.decisions];
      if (this.civicCore) {
        const civic = await civicCoreDecisions(
          this.civicCore,
          town,
          this.registry.all()
        );
        if (civic.unreachable)
          this.logger.warn(
            `${town.slug}: Civic Core unreachable, skipped: ${civic.unreachable}`
          );
        decisions.push(...civic.decisions);
      }
      const adopted = decisions.filter((decision) => decision.adopted);
      const configured = this.registry.all().flatMap((place) => place.sources);
      let added = 0;
      for (const decision of adopted)
        if (await this.store.adopt(decision, configured)) added++;
      const at = new Date();
      await this.store.recordSearch(
        town.slug,
        localDate,
        {
          pagesRead,
          searched,
          adopted: adopted.length,
          refused: decisions.length - adopted.length,
          officialSites: directories.sites.map((site) => ({
            url: site.url,
            ownerSlug: site.ownerSlug,
            via: site.via,
          })),
        },
        at
      );
      for (const decision of decisions)
        await this.store.recordDecision(town.slug, decision, at);
      if (added) await this.refreshRegistry();
      const seconds = Math.round((Date.now() - started) / 1000);
      const summary = `sourcing started from ${
        directories.sites.length
      } directory-listed site(s), read ${pagesRead} page(s)${
        searched ? ` and searched with ${searched}` : ''
      }: ${adopted.length} adopted, ${
        decisions.length - adopted.length
      } refused in ${seconds}s`;
      this.logger.log(
        `${town.slug}: ${summary}${
          adopted.length
            ? ` — ${adopted.map((decision) => decision.source.name).join('; ')}`
            : ''
        }`
      );
      return summary;
    } catch (error) {
      this.logger.error(
        `${town.slug}: sourcing failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 'sourcing failed';
    }
  }
}

/** A town the tick has decided to work on. */
interface TickItem {
  town: LocalityConfig;
  clock: ReturnType<typeof localClock>;
  plan: RunPlan;
  needsSourcing: boolean;
}

/** How a run differs from a scheduled one (D31). */
interface RunMode {
  /** Fetch and parse only; write no edition. */
  pullOnly?: boolean;
  /** Write the edition for this past local date from stored records. */
  periodEnd?: string;
}
