import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { matchTenants } from '@optimistic-tanuki/civic-adapters';
import type { LocalityRegistry } from '@optimistic-tanuki/civic-core';
import type { DataSource } from 'typeorm';
import type { CivicTownOfficials } from '../civic-core/civic-core.client';
import {
  type OfficialCandidateRow,
  OfficialCandidateSchema,
} from './official-candidate.schema';
import { normalizeOfficialName } from './normalize-name';

/** What the puller needs of Civic Core. */
export interface OfficialsSource {
  officials(): Promise<CivicTownOfficials[]>;
}

/** What the registry refresh needs of the puller. */
export interface OfficialCandidatePull {
  pull(registry: LocalityRegistry): Promise<void>;
}

/**
 * Pulls the names Civic Core read from agendas into `official_candidates`
 * (D33). A Civic Core tenant is matched to a locality with `matchTenants`
 * (state, normalised name and kind, exactly one locality or refused), the same
 * rule the Civic Core adapter uses. Names already in the town's
 * `officials.roster` are skipped; a pending candidate has its role and
 * lastSeen refreshed; an accepted or rejected one is left alone, so a
 * rejection sticks and an acceptance is never duplicated.
 */
export class OfficialCandidatePuller implements OfficialCandidatePull {
  private readonly logger = new Logger('OfficialCandidates');

  constructor(
    private readonly dataSource: DataSource,
    private readonly civic: OfficialsSource
  ) {}

  /** Never throws: Civic Core being down changes nothing. */
  async pull(registry: LocalityRegistry): Promise<void> {
    let towns: CivicTownOfficials[];
    try {
      towns = await this.civic.officials();
    } catch (error) {
      this.logger.warn(
        `Civic Core officials unavailable, candidates unchanged: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return;
    }
    try {
      await this.apply(towns, registry);
    } catch (error) {
      this.logger.warn(
        `official candidates not updated: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async apply(
    towns: CivicTownOfficials[],
    registry: LocalityRegistry
  ): Promise<void> {
    const places = registry.all();
    const matches = matchTenants(
      towns.map((town) => ({
        id: town.tenantId,
        displayName: town.townName,
        townName: town.townName,
        state: town.state,
        kind: town.kind,
      })),
      places
    );
    const repo = this.dataSource.getRepository<OfficialCandidateRow>(
      OfficialCandidateSchema
    );
    let added = 0;
    let refreshed = 0;
    for (const town of towns) {
      const match = matches.find((m) => m.tenantId === town.tenantId);
      if (!match || !('localitySlug' in match)) {
        this.logger.debug(
          `tenant ${town.tenantId} not matched to a locality: ${
            match && 'refused' in match ? match.refused : 'no match'
          }`
        );
        continue;
      }
      const slug = match.localitySlug;
      const rostered = new Set(
        (places.find((p) => p.slug === slug)?.officials?.roster ?? []).map(
          (entry) => normalizeOfficialName(entry.name)
        )
      );
      for (const official of town.officials) {
        const normalizedName = normalizeOfficialName(official.name);
        if (!normalizedName || rostered.has(normalizedName)) continue;
        const existing = await repo.findOneBy({ slug, normalizedName });
        if (existing) {
          if (existing.status !== 'pending') continue;
          await repo.update(
            { id: existing.id },
            {
              role: official.role,
              lastSeen: new Date(official.lastSeen),
              sourceAgendaId: official.sourceAgendaId,
            }
          );
          refreshed += 1;
          continue;
        }
        try {
          await repo.insert({
            id: randomUUID(),
            slug,
            name: official.name,
            normalizedName,
            role: official.role,
            civicTenantId: town.tenantId,
            sourceAgendaId: official.sourceAgendaId,
            firstSeen: new Date(official.firstSeen),
            lastSeen: new Date(official.lastSeen),
            status: 'pending',
          });
          added += 1;
        } catch (error) {
          // A concurrent pull won the unique (slug, normalizedName).
          if ((error as { code?: string }).code !== '23505') throw error;
        }
      }
    }
    if (added || refreshed)
      this.logger.log(
        `official candidates: ${added} new, ${refreshed} refreshed`
      );
  }
}
