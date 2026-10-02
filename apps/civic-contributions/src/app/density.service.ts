import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  ACTIVE_DAYS,
  renderDensityReport,
  type TownDensity,
} from '@optimistic-tanuki/civic-community';
import { type DataSource } from 'typeorm';
import { COMMUNITY_CONFIG, type CommunityConfig } from '../config';
import { CorpusService } from './corpus.service';
import { LOCALITIES, type Localities } from './localities';

/**
 * Phase E: who is watching each town.
 *
 * Counted from what is already recorded — contributions, gate events,
 * outcome matches, official callbacks — against the towns the pipeline
 * publishes for, so a town with nobody in it appears in the report as a town
 * with nobody in it rather than being absent. That is the number the
 * recruiting is for.
 *
 * The weekly report is written to a directory as dated markdown, meant to be
 * kept and compared, and the same numbers are served to the operator page.
 */

const DAY_MS = 86_400_000;

@Injectable()
export class DensityService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DensityService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(COMMUNITY_CONFIG) private readonly config: CommunityConfig,
    @Inject(LOCALITIES) private readonly localities: Localities,
    private readonly corpus: CorpusService
  ) {}

  onModuleInit(): void {
    if (!this.config.densityDirectory) return;
    this.timer = setInterval(
      () =>
        void this.writeReport().catch((error: unknown) =>
          this.logger.error(`density report failed: ${String(error)}`)
        ),
      this.config.densityIntervalMs
    );
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Every town the beta covers, with its numbers. Towns with nobody in them included. */
  async density(now = new Date()): Promise<TownDensity[]> {
    const since = new Date(now.getTime() - ACTIVE_DAYS * DAY_MS);
    const towns = new Map<string, string>();
    for (const slug of await this.coveredTowns())
      towns.set(slug, this.localities.find(slug)?.name ?? slug);
    const rows: TownDensity[] = [];
    for (const [localitySlug, town] of towns) {
      rows.push({
        localitySlug,
        town,
        ...(await this.counts(localitySlug, since)),
        ...(await this.coverage(localitySlug, since)),
      });
    }
    return rows.sort((a, b) => a.town.localeCompare(b.town));
  }

  /** The towns with contributions, and the towns the pipeline publishes for. */
  private async coveredTowns(): Promise<string[]> {
    const contributed = await this.db
      .getRepository('ContributionEntity')
      .createQueryBuilder('c')
      .select('DISTINCT c.localitySlug', 'slug')
      .getRawMany<{ slug: string }>();
    const published = this.localities.editions();
    return [...new Set([...published, ...contributed.map((row) => row.slug)])];
  }

  private async counts(
    localitySlug: string,
    since: Date
  ): Promise<
    Omit<
      TownDensity,
      'localitySlug' | 'town' | 'meetings' | 'meetingsWithContributions'
    >
  > {
    const one = async (sql: string, parameters: unknown[]): Promise<number> => {
      const rows = (await this.db.query(sql, parameters)) as {
        count: string | number;
      }[];
      return Number(rows[0]?.count ?? 0);
    };
    const live = `state in ('accepted', 'held')`;
    return {
      active: await one(
        `select count(distinct "contributorId") as count from contributions where "localitySlug" = $1 and ${live} and "submittedAt" >= $2`,
        [localitySlug, since]
      ),
      everContributed: await one(
        `select count(distinct "contributorId") as count from contributions where "localitySlug" = $1 and ${live}`,
        [localitySlug]
      ),
      reports: await one(
        `select count(*) as count from contributions where "localitySlug" = $1 and ${live} and "subjectKind" <> 'contribution' and "submittedAt" >= $2`,
        [localitySlug, since]
      ),
      corroborations: await one(
        `select count(*) as count from contributions where "localitySlug" = $1 and ${live} and "subjectKind" = 'contribution' and "submittedAt" >= $2`,
        [localitySlug, since]
      ),
      corroborated: await one(
        `select count(distinct g."reportId") as count from gate_events g join contributions c on c.id = g."reportId"
         where c."localitySlug" = $1 and g.status in ('corroborated', 'released')
           and g.id = (select max(id) from gate_events where "reportId" = g."reportId")`,
        [localitySlug]
      ),
      quotable: await one(
        `select count(*) as count from promotion_events p where p."localitySlug" = $1 and p.offered
           and p.id = (select max(id) from promotion_events where "contributionId" = p."contributionId")`,
        [localitySlug]
      ),
      confirmed: await one(
        `select count(*) as count from outcome_matches o join contributions c on c.id = o."contributionId"
         where c."localitySlug" = $1 and o.verdict = 'confirmed'`,
        [localitySlug]
      ),
      contradicted: await one(
        `select count(*) as count from outcome_matches o join contributions c on c.id = o."contributionId"
         where c."localitySlug" = $1 and o.verdict = 'contradicted'`,
        [localitySlug]
      ),
      officials: await one(
        `select count(distinct "contributorId") as count from official_events where "localitySlug" = $1 and kind = 'callback-confirmed'`,
        [localitySlug]
      ),
    };
  }

  /** How much of what the town published anyone wrote about. */
  private async coverage(
    localitySlug: string,
    since: Date
  ): Promise<{ meetings: number; meetingsWithContributions: number }> {
    const day = since.toISOString().slice(0, 10);
    const meetings = (await this.corpus.subjects(localitySlug)).filter(
      (subject) => subject.kind === 'meeting' && (subject.date ?? '9999') >= day
    );
    if (!meetings.length) return { meetings: 0, meetingsWithContributions: 0 };
    const refs = meetings.map((meeting) => meeting.ref);
    const covered = (await this.db.query(
      `select count(distinct "subjectRef") as count from contributions
       where "localitySlug" = $1 and "subjectKind" = 'meeting' and state in ('accepted', 'held') and "subjectRef" = any($2)`,
      [localitySlug, refs]
    )) as { count: string | number }[];
    return {
      meetings: meetings.length,
      meetingsWithContributions: Number(covered[0]?.count ?? 0),
    };
  }

  /** Writes this week's report where it can be kept and compared. */
  async writeReport(
    now = new Date()
  ): Promise<{ week: string; path: string | null; rows: TownDensity[] }> {
    const rows = await this.density(now);
    const week = mondayOf(now);
    const markdown = renderDensityReport(rows, week);
    if (!this.config.densityDirectory) return { week, path: null, rows };
    mkdirSync(this.config.densityDirectory, { recursive: true });
    const path = join(this.config.densityDirectory, `${week}-density.md`);
    writeFileSync(path, `${markdown}\n`);
    this.logger.log(
      `density report for the week of ${week} written to ${path}`
    );
    return { week, path, rows };
  }
}

/** The Monday of a date's week, so a week's report always has one name. */
export function mondayOf(date: Date): string {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const weekday = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - weekday);
  return day.toISOString().slice(0, 10);
}
