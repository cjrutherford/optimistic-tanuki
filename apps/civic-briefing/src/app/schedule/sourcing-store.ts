import {
  FoundationSourceSchema,
  normalizedAddress,
  SourceSchema,
  type SourceConfig,
  type SourceRow,
  type SourcingDecision,
} from '@optimistic-tanuki/civic-core';
import type { DataSource } from 'typeorm';
import {
  type SourcingDecisionRow,
  SourcingDecisionSchema,
} from './sourcing-decision.schema';

/** The run summary kept on a `searched` row. */
export interface SearchSummary {
  pagesRead: number;
  searched: string | null;
  adopted: number;
  refused: number;
  officialSites: { url: string; ownerSlug: string; via: string }[];
}

/**
 * Where the sourcing engine keeps what it found and decided: adopted sources
 * in `sources` (`origin: 'discovered'`) and every judgement, plus one
 * "searched" record per town per run, in `sourcing_decisions`. This replaces
 * the discovered-sources JSON files and `decisions.jsonl` (D28).
 */
export class SourcingStore {
  constructor(private readonly dataSource: DataSource) {}

  private get sources() {
    return this.dataSource.getRepository<SourceRow>(
      this.dataSource.hasMetadata(FoundationSourceSchema)
        ? FoundationSourceSchema
        : SourceSchema
    );
  }

  private get decisions() {
    return this.dataSource.getRepository<SourcingDecisionRow>(
      SourcingDecisionSchema
    );
  }

  /**
   * Writes an adopted source, once. Returns whether a row was added.
   *
   * Mirrors how the registry treated discovered sources: a source that is
   * already stored under the same key is left alone (so an operator's
   * `enabled: false` sticks, and an `origin: 'override'` row is never
   * touched), and a source whose address is already held by a hand-kept
   * source, whether stored without a discovered origin or listed in
   * `configured` (the registry's own sources), is not adopted.
   */
  async adopt(
    decision: SourcingDecision,
    configured: readonly SourceConfig[] = []
  ): Promise<boolean> {
    const { source } = decision;
    const key = source.sourceKey;
    if (await this.sources.findOneBy({ sourceKey: key })) return false;
    const address = normalizedAddress(source.url);
    if (
      configured.some(
        (other) =>
          other.sourceKey === key || normalizedAddress(other.url) === address
      )
    )
      return false;
    const held = (await this.sources.find()).some(
      (row) =>
        row.origin !== 'discovered' && normalizedAddress(row.url) === address
    );
    if (held) return false;
    await this.sources.insert({
      id: key,
      sourceKey: key,
      ownerSlug: source.ownerSlug,
      ...(this.dataSource.hasMetadata(FoundationSourceSchema)
        ? {}
        : { localitySlug: source.ownerSlug }),
      coverage: source.coverage,
      adapter: source.adapter,
      name: source.name,
      url: source.url,
      kind: source.kind,
      config:
        source.config === undefined ? null : JSON.stringify(source.config),
      enabled: source.enabled !== false,
      desk: source.desk ?? null,
      accessMode: source.accessMode ?? null,
      accessRestrictionReason: source.accessRestrictionReason ?? null,
      restrictionPolicyUrl: source.restrictionPolicyUrl ?? null,
      aggregateDiscovery: source.aggregateDiscovery ?? null,
      aggregateUrl: source.aggregateUrl ?? null,
      coverageCapabilities:
        source.coverageCapabilities === undefined
          ? null
          : JSON.stringify(source.coverageCapabilities),
      observedAt: null,
      origin: 'discovered',
    });
    return true;
  }

  /** Records one candidate judged for a town, adopted or refused. */
  async recordDecision(
    slug: string,
    decision: SourcingDecision,
    decidedAt = new Date()
  ): Promise<void> {
    await this.decisions.insert({
      slug,
      ownerSlug: decision.ownerSlug,
      sourceKey: decision.source.sourceKey,
      adapter: decision.source.adapter,
      url: decision.source.url,
      decision: decision.adopted ? 'adopted' : 'refused',
      via: decision.via,
      reason: decision.reasons.join('\n'),
      evidence: JSON.stringify(decision.evidence),
      decidedAt,
    });
  }

  /** Records that a town's sources were searched for `localDate`. */
  async recordSearch(
    slug: string,
    localDate: string,
    detail: SearchSummary,
    decidedAt = new Date()
  ): Promise<void> {
    await this.decisions.insert({
      slug,
      decision: 'searched',
      localDate,
      detail: JSON.stringify(detail),
      decidedAt,
    });
  }

  /** The latest local date a town was searched for, or null if never. */
  async lastSearched(slug: string): Promise<string | null> {
    const row = await this.decisions
      .createQueryBuilder('d')
      .select('MAX(d.localDate)', 'last')
      .where('d.slug = :slug', { slug })
      .andWhere("d.decision = 'searched'")
      .getRawOne<{ last: string | null }>();
    return row?.last ?? null;
  }
}
