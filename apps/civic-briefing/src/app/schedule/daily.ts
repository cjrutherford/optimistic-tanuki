import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { Logger } from '@nestjs/common';
import {
  BriefingSchema,
  CivicItemSchema,
  createLlmAttemptRecorder,
  discoverSources,
  discoveredSourcesPath,
  itemEvidenceLocalDate,
  loadLocalityRegistry,
  OfficialDirectories,
  OutboundPolicy,
  runPipeline,
  searchProviderFromEnvironment,
  type Cadence,
  type DiscoveredSourcesFile,
  type LocalityConfig,
  type LocalityRegistry,
  type PipelineStages,
  type SearchProvider,
  type SourcingDecision,
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
} from './plan';
import type { ScheduleConfig } from './schedule.config';

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
 * One town at a time, one tick at a time: the schedule never runs two
 * pipelines at once, and a tick that finds work still running waits for the
 * next. Failures are logged and retried a few times a day, then left for
 * tomorrow rather than hammering a source or a model that is down.
 */

/** The longest a model call may take; prompt-proxy's own limit must exceed it. */
export const MODEL_TIMEOUT_MS = 300_000;
export class DailySchedule {
  private readonly logger = new Logger('DailySchedule');
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly failures = new Map<string, number>();
  private registry: LocalityRegistry;
  private readonly search: SearchProvider | null;

  constructor(
    private readonly config: ScheduleConfig & { localitiesDir: string },
    private readonly dataSource: DataSource,
    private readonly stages: PipelineStages,
    /** Set when model calls go through prompt-proxy rather than LLM_BASE_URL. */
    private readonly modelFetch?: FetchImplementation
  ) {
    this.registry = this.loadRegistry();
    this.search = searchProviderFromEnvironment();
  }

  start(): void {
    this.logger.log(
      `daily editions at ${this.config.dailyAt} local time for ${this.editions()
        .map((town) => town.slug)
        .join(', ')}; ` +
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

  /** One pass over the towns. Returns what it did, for the log and for tests. */
  async tick(now = new Date()): Promise<{ town: string; action: string }[]> {
    if (this.running) return [];
    this.running = true;
    const done: { town: string; action: string }[] = [];
    try {
      for (const town of this.editions()) {
        const clock = localClock(now, town.timezone);
        const failuresToday =
          this.failures.get(`${town.slug}:${clock.localDate}`) ?? 0;
        const last = await this.lastEdition(town.slug);
        if (last?.periodEnd === clock.localDate) continue;
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
        this.logger.log(`${town.slug}: due (${plan.reason})`);
        if (
          plan.fresh ||
          sourcingDue(
            this.lastSearched(town.slug),
            clock.localDate,
            this.config.sourcingIntervalDays
          )
        ) {
          done.push({
            town: town.slug,
            action: await this.source(town, clock.localDate),
          });
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

  private editions(): readonly LocalityConfig[] {
    return this.registry.editions();
  }

  private loadRegistry(): LocalityRegistry {
    return loadLocalityRegistry(
      this.config.localitiesDir,
      this.config.discoveredDir
    );
  }

  /** A town's latest edition, daily or weekly, or null when it has none. */
  private async lastEdition(
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
  private async recentItems(
    town: LocalityConfig,
    localDate: string
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
      return day !== null && day >= since && day < localDate;
    }).length;
  }

  private async run(
    town: LocalityConfig,
    cadence: Cadence,
    gatherSince: string | undefined,
    localDate: string,
    now: Date
  ): Promise<string> {
    const started = Date.now();
    try {
      const result = await runPipeline({
        registry: this.registry,
        localitySlug: town.slug,
        cadence,
        dataSource: this.dataSource,
        stages: this.stages,
        now,
        outputRoot: this.config.artifacts,
        backfillDays: this.config.historyDays,
        ...(gatherSince ? { gatherSince } : {}),
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
          `${town.slug}: ${cadence} ${result.status} in ${seconds}s${
            gatherSince
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
   * written beside the hand-written ones, per owner, and every decision —
   * adopted or refused, with its reasons — is appended to the decision log.
   */
  private async source(
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
      const { decisions, searched, pagesRead } = await discoverSources({
        locality: town,
        ancestors: [...ancestors, ...descendants],
        existing,
        httpClient,
        search: this.search,
        officialSites: directories.sites,
        governmentDomains: directories.governmentDomains,
        pageBudget: this.config.sourcingPageBudget,
      });
      const adopted = decisions.filter((decision) => decision.adopted);
      for (const decision of adopted) this.adopt(decision);
      this.log({
        type: 'search',
        localitySlug: town.slug,
        localDate,
        at: new Date().toISOString(),
        pagesRead,
        searched,
        adopted: adopted.length,
        refused: decisions.length - adopted.length,
        officialSites: directories.sites.map((site) => ({
          url: site.url,
          ownerSlug: site.ownerSlug,
          via: site.via,
        })),
      });
      for (const decision of decisions) {
        this.log({
          type: 'decision',
          localitySlug: town.slug,
          at: new Date().toISOString(),
          adopted: decision.adopted,
          ownerSlug: decision.ownerSlug,
          sourceKey: decision.source.sourceKey,
          adapter: decision.source.adapter,
          url: decision.source.url,
          via: decision.via,
          reasons: decision.reasons,
          evidence: decision.evidence,
        });
      }
      if (adopted.length) this.registry = this.loadRegistry();
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

  private adopt(decision: SourcingDecision): void {
    const path = discoveredSourcesPath(
      this.config.discoveredDir,
      decision.ownerSlug
    );
    const file: DiscoveredSourcesFile = existsSync(path)
      ? (JSON.parse(readFileSync(path, 'utf8')) as DiscoveredSourcesFile)
      : { localitySlug: decision.ownerSlug, sources: [] };
    if (
      file.sources.some(
        (entry) => entry.source.sourceKey === decision.source.sourceKey
      )
    )
      return;
    const { ownerSlug: _owner, ...source } = decision.source;
    file.sources.push({
      source: source as unknown as Record<string, unknown>,
      discoveredAt: new Date().toISOString(),
      via: decision.via,
      evidence: decision.evidence,
    });
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
  }

  private log(entry: Record<string, unknown>): void {
    mkdirSync(dirname(this.config.discoveryLog), { recursive: true });
    appendFileSync(this.config.discoveryLog, `${JSON.stringify(entry)}\n`);
  }

  /** The local date a town's sources were last searched for, from the decision log. */
  private lastSearched(slug: string): string | null {
    if (!existsSync(this.config.discoveryLog)) return null;
    let last: string | null = null;
    for (const line of readFileSync(this.config.discoveryLog, 'utf8').split(
      '\n'
    )) {
      if (
        !line.includes('"type":"search"') ||
        !line.includes(`"localitySlug":"${slug}"`)
      )
        continue;
      try {
        last = (JSON.parse(line) as { localDate: string }).localDate;
      } catch {
        /* a torn line */
      }
    }
    return last;
  }
}
