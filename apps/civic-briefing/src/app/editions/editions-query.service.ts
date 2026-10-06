import { BriefingSchema, LocalitySchema } from '@optimistic-tanuki/civic-core';
import type {
  BriefingSummary,
  EditionHistory,
  EditionSummary,
  PublishedBriefing,
} from '@optimistic-tanuki/models';
import type { DataSource } from 'typeorm';

/** How many past editions a town's page lists. */
export const EDITION_HISTORY = 60;

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Published briefings, read for the gateway's public routes (ported from the
 * POC gateway's BriefingStore, which opened this database directly).
 */
export class EditionsQueryService {
  constructor(private readonly dataSource: DataSource) {}

  /** Every town with at least one published briefing. */
  async editions(): Promise<EditionSummary[]> {
    const rows = await this.dataSource
      .getRepository(BriefingSchema)
      .createQueryBuilder('b')
      .select('b."localitySlug"', 'slug')
      .addSelect('max(b."periodEnd")', 'latest')
      .groupBy('b."localitySlug"')
      .getRawMany<{ slug: string; latest: string }>();
    const summaries: EditionSummary[] = [];
    for (const row of rows) {
      const locality = await this.locality(row.slug);
      summaries.push({ ...locality, latest: row.latest });
    }
    return summaries.sort(
      (a, b) =>
        a.state.localeCompare(b.state) ||
        a.name.localeCompare(b.name) ||
        a.slug.localeCompare(b.slug)
    );
  }

  /** A town's recent editions, newest first; null when it has none. */
  async history(slug: string): Promise<EditionHistory | null> {
    const rows = await this.dataSource.getRepository(BriefingSchema).find({
      select: { id: true, cadence: true, periodStart: true, periodEnd: true },
      where: { localitySlug: slug },
      order: { periodEnd: 'DESC', id: 'DESC' },
    });
    if (!rows.length) return null;
    // A period can be published more than once; the newest publication stands.
    const seen = new Set<string>();
    const briefings: BriefingSummary[] = [];
    for (const row of rows) {
      const key = `${row.cadence}:${row.periodEnd}`;
      if (seen.has(key)) continue;
      seen.add(key);
      briefings.push({
        cadence: row.cadence,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
      });
      if (briefings.length === EDITION_HISTORY) break;
    }
    return {
      ...(await this.locality(slug)),
      latest: briefings[0]?.periodEnd ?? null,
      briefings,
    };
  }

  /**
   * One briefing: the newest publication for the period ending on
   * `periodEnd`, or the town's newest of all when no date is given.
   */
  async briefing(
    slug: string,
    periodEnd?: string
  ): Promise<PublishedBriefing | null> {
    if (periodEnd !== undefined && !DATE.test(periodEnd)) return null;
    const repository = this.dataSource.getRepository(BriefingSchema);
    const day =
      periodEnd ??
      (
        await repository.findOne({
          select: { id: true, periodEnd: true },
          where: { localitySlug: slug },
          order: { periodEnd: 'DESC', id: 'DESC' },
        })
      )?.periodEnd;
    if (!day) return null;
    const row = await repository.findOne({
      where: { localitySlug: slug, periodEnd: day },
      order: { id: 'DESC' },
    });
    if (!row) return null;
    return {
      ...(await this.locality(slug)),
      cadence: row.cadence,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      createdAt: row.createdAt,
      markdown: row.markdown,
    };
  }

  private async locality(
    slug: string
  ): Promise<{ slug: string; name: string; state: string }> {
    const row = await this.dataSource
      .getRepository(LocalitySchema)
      .findOneBy({ slug });
    return { slug, name: row?.name ?? slug, state: row?.state ?? '' };
  }
}
