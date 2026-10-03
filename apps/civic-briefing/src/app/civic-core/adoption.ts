import {
  matchTenants,
  type CivicCoreClient,
} from '@optimistic-tanuki/civic-adapters';
import type {
  LocalityConfig,
  SourcingDecision,
} from '@optimistic-tanuki/civic-core';

/** The adapter's source key for a tenant. */
export const civicCoreSourceKey = (tenantId: string): string =>
  `civic-core-${tenantId}`;

export interface CivicCoreAdoption {
  /** Decisions to adopt and log: the town's matched tenant, and refusals that concern the town. */
  decisions: SourcingDecision[];
  /** Set when Civic Core could not be read; the caller logs it and carries on. */
  unreachable?: string;
}

/**
 * Which Civic Core tenant, if any, is this town's own record. Every tenant is
 * matched against the edition localities (name, state and kind; see
 * matchTenants), so a namesake elsewhere cannot claim the town, and the match
 * is the same whichever town asks. A matched tenant for this town becomes an
 * adopted source; a refusal is returned as a refused decision only where it
 * concerns this town (an ambiguity or namesake involving it), so the log does
 * not repeat every unrelated tenant for every town.
 */
export async function civicCoreDecisions(
  client: CivicCoreClient,
  town: LocalityConfig,
  localities: readonly LocalityConfig[]
): Promise<CivicCoreAdoption> {
  let tenants;
  try {
    tenants = await client.tenants();
  } catch (error) {
    return {
      decisions: [],
      unreachable: error instanceof Error ? error.message : String(error),
    };
  }
  const existing = new Set(town.sources.map((source) => source.sourceKey));
  const decisions: SourcingDecision[] = [];
  for (const match of matchTenants(tenants, localities)) {
    const tenant = tenants.find((entry) => entry.id === match.tenantId);
    if (!tenant) continue;
    const source = {
      adapter: 'civic-core',
      sourceKey: civicCoreSourceKey(tenant.id),
      url: `civic-core:${tenant.id}`,
      kind: 'meeting' as const,
      desk: 'government' as const,
      coverage: 'all' as const,
      config: { tenantId: tenant.id },
      name: tenant.displayName,
      ownerSlug: town.slug,
    };
    if ('refused' in match) {
      if (!match.related.includes(town.slug)) continue;
      decisions.push({
        source,
        official: true,
        ownerSlug: town.slug,
        via: 'civic-core tenant match',
        adopted: false,
        reasons: [match.refused],
        evidence: [],
      });
      continue;
    }
    if (match.localitySlug !== town.slug) continue;
    // Already adopted, or hand-written: nothing to decide again.
    if (existing.has(source.sourceKey)) continue;
    decisions.push({
      source,
      official: true,
      ownerSlug: town.slug,
      via: 'civic-core tenant match',
      adopted: true,
      reasons: [
        "the town's own Civic Core tenant (name, state and kind match)",
      ],
      evidence: match.evidence,
    });
  }
  return { decisions };
}
