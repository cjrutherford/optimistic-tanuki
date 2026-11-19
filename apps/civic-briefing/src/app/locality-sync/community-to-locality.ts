import type { LocalityRow } from '@optimistic-tanuki/civic-core';
import tzLookup from '@photostructure/tz-lookup';
import {
  NOTABLE_PLACES,
  baseName,
  deriveExcludePhrases,
  type NamedPlace,
} from './exclude-phrases';
import {
  US_ROOT_SLUG,
  resolveState,
  stateRootSlug,
  type UsState,
} from './us-states';

/** The fields of a social community the sync reads. */
export interface SocialCommunity {
  id: string;
  name: string;
  slug?: string | null;
  localitySlug?: string | null;
  localityType?: string | null;
  adminArea?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
}

/** What a synced town gets that social does not carry. */
export interface LocalityDefaults {
  topics: string[];
  cadence: string[];
}

export const DEFAULT_TOPICS = [
  'council',
  'planning',
  'water',
  'roads',
  'weather',
  'schools',
];
export const DEFAULT_CADENCE = ['daily', 'weekly'];

const STATE_ROOT_TOPICS = ['government', 'legislation', 'news', 'weather'];

function list(value: string | undefined, fallback: string[]): string[] {
  const items = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

/** Defaults from LOCALITY_DEFAULT_TOPICS and LOCALITY_DEFAULT_CADENCE (comma-separated). */
export function localityDefaultsFromEnv(
  env: Record<string, string | undefined> = process.env
): LocalityDefaults {
  const cadence = list(env['LOCALITY_DEFAULT_CADENCE'], DEFAULT_CADENCE).filter(
    (item) => item === 'daily' || item === 'weekly'
  );
  return {
    topics: list(env['LOCALITY_DEFAULT_TOPICS'], DEFAULT_TOPICS),
    cadence: cadence.length ? cadence : DEFAULT_CADENCE,
  };
}

/** Context the mapper cannot see in one community alone. */
export interface MapContext {
  /** Other towns in the same sync batch; a namesake in another state yields exclude phrases. */
  peers?: readonly NamedPlace[];
  /** Notable places elsewhere; defaults to the bundled list of the largest US places. */
  notablePlaces?: readonly NamedPlace[];
}

/** Locality types that get editions (D26); everything else is synced without one. */
const EDITION_TYPES = new Set(['city', 'town']);

export function hasEdition(localityType: string | null | undefined): boolean {
  return EDITION_TYPES.has((localityType || 'town').trim().toLowerCase());
}

/**
 * The edition towns of a batch as named places, for use as `MapContext.peers`.
 * Communities that cannot be placed in a US state are left out.
 */
export function batchPeers(
  communities: readonly SocialCommunity[]
): NamedPlace[] {
  const peers: NamedPlace[] = [];
  for (const community of communities) {
    const state = resolveState(community.adminArea);
    const name = (community.name || '').trim();
    if (state && name && hasEdition(community.localityType))
      peers.push({ name, state: state.code });
  }
  return peers;
}

export type MapResult =
  | { ok: true; row: LocalityRow; state: UsState }
  | { ok: false; reason: string };

function coordinate(value: unknown, limit: number): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : undefined;
}

/** The IANA zone at a point, or the state's primary zone when there is no point or the lookup fails. */
export function timezoneFor(
  lat: number | undefined,
  lon: number | undefined,
  state: UsState
): string {
  if (lat === undefined || lon === undefined) return state.timezone;
  try {
    return tzLookup(lat, lon) || state.timezone;
  } catch {
    return state.timezone;
  }
}

/**
 * A social community as a civic-briefing locality row. The slug is the
 * community's `localitySlug` when set, else its own slug (which carries the
 * state, so Nashville GA and Nashville TN stay distinct). Parent is the
 * state root. Cities and towns are editions; neighborhoods, counties and
 * regions are not (D26). An edition town whose name is shared by a place in
 * another state (in the batch or the notable list) gets exclude phrases (D30).
 * Communities that cannot be placed
 * (no slug, no name, an adminArea that is not a US state) are rejected with
 * a reason.
 */
export function communityToLocality(
  community: SocialCommunity,
  defaults: LocalityDefaults,
  context: MapContext = {}
): MapResult {
  const slug = (community.localitySlug || community.slug || '').trim();
  if (!slug) return { ok: false, reason: 'no slug' };
  // Social names carry the state ("Nashville, GA"); mention matching needs the bare place name, as in the fixtures.
  const name = baseName(community.name || '');
  if (!name) return { ok: false, reason: 'no name' };
  const state = resolveState(community.adminArea);
  if (!state) {
    return {
      ok: false,
      reason: `unmappable adminArea ${JSON.stringify(
        community.adminArea ?? null
      )}`,
    };
  }
  const lat = coordinate(community.lat, 90);
  const lon = coordinate(community.lng, 180);
  const hasPoint = lat !== undefined && lon !== undefined;
  const edition = hasEdition(community.localityType);
  const excludePhrases = edition
    ? deriveExcludePhrases(name, state.code, [
        ...(context.peers ?? []),
        ...(context.notablePlaces ?? NOTABLE_PLACES),
      ])
    : [];
  return {
    ok: true,
    state,
    row: {
      slug,
      name,
      state: state.code,
      timezone: timezoneFor(lat, lon, state),
      lat: hasPoint ? lat : state.lat,
      lon: hasPoint ? lon : state.lon,
      kind: community.localityType || 'town',
      parents: JSON.stringify([stateRootSlug(state)]),
      edition,
      communityId: community.id,
      active: true,
      topics: JSON.stringify(defaults.topics),
      cadence: JSON.stringify(defaults.cadence),
      ...(excludePhrases.length && {
        excludePhrases: JSON.stringify(excludePhrases),
      }),
    },
  };
}

/** The `US` root: no parents, no edition. */
export function usRootRow(): LocalityRow {
  return {
    slug: US_ROOT_SLUG,
    name: 'United States',
    state: 'US',
    timezone: 'America/New_York',
    lat: 39.8,
    lon: -98.6,
    kind: 'country',
    parents: JSON.stringify([]),
    edition: false,
    active: true,
  };
}

/** A state root under `US`: no edition. */
export function stateRootRow(state: UsState): LocalityRow {
  return {
    slug: stateRootSlug(state),
    name: state.name,
    state: state.code,
    timezone: state.timezone,
    lat: state.lat,
    lon: state.lon,
    kind: 'state',
    parents: JSON.stringify([US_ROOT_SLUG]),
    edition: false,
    active: true,
    topics: JSON.stringify(STATE_ROOT_TOPICS),
  };
}
