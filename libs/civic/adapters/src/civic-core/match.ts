import type { LocalityConfig } from '@optimistic-tanuki/civic-core';
import type { CivicTenantKind, CivicTenantRecord } from './client.js';

/**
 * Matches Civic Core tenants to edition localities by name and state, never by
 * guess (ADR: civic-briefing and Civic Core). A tenant is used only when it
 * fits exactly one local-government locality; otherwise it is refused, with
 * the reason, so an operator sees why.
 */
export type TenantMatch =
  | { tenantId: string; localitySlug: string; evidence: string[] }
  | {
      tenantId: string;
      refused: string;
      /** Localities that share the tenant's normalised name or fit it in part, so the town concerned can be told why. */
      related: string[];
    };

/** Local governments a tenant can stand for. */
const LOCAL_KINDS = new Set(['town', 'city', 'village', 'county']);

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

const PREFIX = /^(city|town|village|borough) of /u;

const STATE_CODE = /^[A-Z]{2}$/u;

/** The name without a leading "City of" and without a trailing state ("Adel, GA"). */
function bareName(name: string, state: string): string {
  const stripped = normalize(name).replace(PREFIX, '');
  const suffix = ` ${normalize(state)}`;
  return stripped.endsWith(suffix) && stripped.length > suffix.length
    ? stripped.slice(0, -suffix.length).trim()
    : stripped;
}

function kindsAgree(
  tenant: CivicTenantKind,
  locality: LocalityConfig['kind']
): boolean {
  if (tenant === 'county') return locality === 'county';
  return locality === 'city' || locality === 'town' || locality === 'village';
}

export function matchTenants(
  tenants: readonly CivicTenantRecord[],
  localities: readonly LocalityConfig[]
): TenantMatch[] {
  const candidates = localities.filter((place) => LOCAL_KINDS.has(place.kind));
  return tenants.map((tenant): TenantMatch => {
    const state = (tenant.state ?? '').trim();
    if (!STATE_CODE.test(state))
      return {
        tenantId: tenant.id,
        refused: `tenant state "${
          tenant.state ?? ''
        }" is not a two-letter code`,
        related: [],
      };
    const name = bareName(tenant.townName ?? '', state);
    if (!name)
      return {
        tenantId: tenant.id,
        refused: 'tenant has no town name',
        related: [],
      };
    const sameName = candidates.filter(
      (place) => bareName(place.name, place.state) === name
    );
    const found = candidates.filter(
      (place) =>
        place.state === state &&
        bareName(place.name, state) === name &&
        kindsAgree(tenant.kind, place.kind)
    );
    if (found.length === 0)
      return {
        tenantId: tenant.id,
        refused: `no ${tenant.kind} named "${tenant.townName}" in ${state} among the edition localities`,
        related: sameName.map((place) => place.slug),
      };
    if (found.length > 1)
      return {
        tenantId: tenant.id,
        refused: `ambiguous: "${tenant.townName}", ${state} (${
          tenant.kind
        }) matches ${found.map((place) => place.slug).join(', ')}`,
        related: found.map((place) => place.slug),
      };
    const place = found[0] as LocalityConfig;
    return {
      tenantId: tenant.id,
      localitySlug: place.slug,
      evidence: [
        `tenant "${tenant.townName}" (${tenant.kind}, ${state}) matches locality ${place.slug} ("${place.name}", ${place.kind}, ${place.state}) by state, normalised name and kind`,
      ],
    };
  });
}
