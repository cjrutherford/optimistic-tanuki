import type { OvertureRightsPolicy } from './overture-rights';

/**
 * Standalone AllThePlaces provider (owner decision D3), separate from the AllThePlaces copy Overture carries inside its
 * release. The data is CC0-1.0 and comes from one pinned run of the official AllThePlaces output archive; the run id,
 * archive URL, size and SHA-256 live in the rights policy entry beside Overture's, so a different archive is never read
 * under this approval.
 */
export const ATP_PROVIDER = 'alltheplaces';
export const ATP_ATTRIBUTION = 'AllThePlaces contributors, CC0';
export const ATP_DATASET = 'AllThePlaces';
export const ATP_LICENSE = 'CC0-1.0';
export const ATP_ARCHIVE_HOST = 'alltheplaces-data.openaddresses.io';
/** Bump when the feature-to-row mapping or the screen changes: it is part of the scan identity. */
export const ATP_PROJECTION_VERSION = 'alltheplaces-projection-v1';
export const ATP_SCOPE = 'auto-acquisition-alltheplaces-v1';

export interface AtpArchivePin {
  runId: string;
  url: string;
  sizeBytes: number;
  sha256: string;
}
export type AtpRightsPolicy = OvertureRightsPolicy & {
  archive: AtpArchivePin;
};

const SHA = /^[0-9a-f]{64}$/;

/** The archive URL must be the official output.zip of the pinned run, on the official host. */
export function validAtpArchive(pin: unknown): pin is AtpArchivePin {
  const p = pin as AtpArchivePin | undefined;
  if (
    !p ||
    typeof p.runId !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(p.runId) ||
    typeof p.url !== 'string' ||
    !Number.isSafeInteger(p.sizeBytes) ||
    p.sizeBytes < 1 ||
    typeof p.sha256 !== 'string' ||
    !SHA.test(p.sha256)
  )
    return false;
  try {
    const url = new URL(p.url);
    return (
      url.protocol === 'https:' &&
      url.hostname === ATP_ARCHIVE_HOST &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === `/runs/${p.runId}/output.zip`
    );
  } catch {
    return false;
  }
}

/** The standalone AllThePlaces policy entry: the one carrying a valid `archive` pin and a CC0 AllThePlaces term. */
export function selectAtpPolicy(parsed: unknown): AtpRightsPolicy | null {
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  for (const e of entries as Array<Partial<AtpRightsPolicy> | null>) {
    if (!e || !validAtpArchive(e.archive) || typeof e.releaseId !== 'string')
      continue;
    const term = (e.terms ?? []).find(
      (t) => t.dataset === ATP_DATASET && t.license === ATP_LICENSE
    );
    if (term && term.attribution === ATP_ATTRIBUTION)
      return e as AtpRightsPolicy;
  }
  return null;
}

/** OSM-style tags AllThePlaces emits, mapped to the low-risk Overture basic categories the local screen allows. */
const AMENITY: Record<string, string> = {
  restaurant: 'restaurant',
  fast_food: 'fast_food_restaurant',
  cafe: 'casual_eatery',
  fuel: 'gas_station',
};
const SHOP: Record<string, string> = {
  convenience: 'convenience_store',
  supermarket: 'food_and_beverage_store',
  grocery: 'food_and_beverage_store',
  bakery: 'food_and_beverage_store',
  butcher: 'food_and_beverage_store',
  greengrocer: 'food_and_beverage_store',
  variety_store: 'discount_store',
  department_store: 'discount_store',
  second_hand: 'second_hand_store',
  hardware: 'hardware_home_and_garden_store',
  doityourself: 'hardware_home_and_garden_store',
  garden_centre: 'hardware_home_and_garden_store',
  electronics: 'electronics_store',
  computer: 'electronics_store',
  mobile_phone: 'electronics_store',
  clothes: 'fashion_and_apparel_store',
  shoes: 'fashion_and_apparel_store',
  florist: 'flowers_and_gifts_store',
  gift: 'flowers_and_gifts_store',
  car: 'auto_dealer',
  car_parts: 'vehicle_parts_store',
};
const TOURISM: Record<string, string> = {
  hotel: 'hotel',
  motel: 'hotel',
};
const hasOwn = (o: object, k: string) =>
  Object.prototype.hasOwnProperty.call(o, k);

export function atpCategory(props: Record<string, unknown>): string | null {
  const pick = (table: Record<string, string>, key: string) => {
    const v = props[key];
    return typeof v === 'string' && hasOwn(table, v) ? table[v] : null;
  };
  return (
    pick(AMENITY, 'amenity') ??
    pick(SHOP, 'shop') ??
    pick(TOURISM, 'tourism') ??
    null
  );
}

export interface AtpRow {
  id?: string;
  names: { primary: string };
  basic_category: string;
  taxonomy: { primary: string; hierarchy: string[] };
  lon: number;
  lat: number;
  address: string | null;
}

/**
 * One AllThePlaces GeoJSON feature as the row the local screen reads, or null when it cannot be one (not a point, no
 * name, no mapped low-risk category). The spider id and `ref` only ever form `id` for the keyed identity hash; they are
 * not part of any listing field.
 */
export function atpFeatureToRow(
  feature: unknown,
  spider: string
): AtpRow | null {
  const f = feature as {
    properties?: Record<string, unknown>;
    geometry?: { type?: unknown; coordinates?: unknown };
  } | null;
  const props = f?.properties;
  const c = f?.geometry?.coordinates;
  if (
    !props ||
    typeof props !== 'object' ||
    f?.geometry?.type !== 'Point' ||
    !Array.isArray(c) ||
    c.length !== 2 ||
    !c.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
    Math.abs(c[0]) > 180 ||
    Math.abs(c[1]) > 90
  )
    return null;
  const category = atpCategory(props);
  const rawName = [props['name'], props['brand']].find(
    (v) => typeof v === 'string' && v.trim()
  ) as string | undefined;
  if (!category || !rawName) return null;
  const ref = props['ref'];
  const address = ['addr:full', 'addr:street_address']
    .map((k) => props[k])
    .find((v) => typeof v === 'string' && (v as string).trim()) as
    | string
    | undefined;
  return {
    ...(typeof ref === 'string' && ref && spider
      ? { id: `${spider}:${ref}` }
      : {}),
    names: { primary: rawName.trim() },
    basic_category: category,
    taxonomy: { primary: category, hierarchy: [category] },
    lon: c[0],
    lat: c[1],
    address: address ? address.trim().slice(0, 300) : null,
  };
}

/** The source record the rights evaluator reads for every standalone row: the whole record, CC0. */
export const ATP_SOURCES = Object.freeze([
  { dataset: ATP_DATASET, license: ATP_LICENSE },
]);

/* --------------------------- dedupe against Overture --------------------------- */

export const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function distanceMeters(
  a: [number, number],
  b: [number, number]
): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface StagedPlace {
  name: string;
  coordinates: [number, number];
  /** True when the staged Overture row retained a source record naming AllThePlaces. */
  carriesAtpSource: boolean;
}
export type DedupeReason =
  | 'overture_atp_source_same_place'
  | 'overture_same_place';
export const DEDUPE_RADIUS_METERS = 150;

/**
 * The town's already-staged Overture places, indexed on a 0.002 degree grid. An AllThePlaces row that is the same name
 * within 150 m of one of them is the same place, so it is not listed a second time. A staged row that carries an
 * AllThePlaces source record is the exact case the owner called out; it is reported separately.
 */
export class OvertureDedupeIndex {
  private readonly cells = new Map<string, StagedPlace[]>();
  private static key(x: number, y: number) {
    return `${Math.floor(x / 0.002)}:${Math.floor(y / 0.002)}`;
  }
  constructor(places: readonly StagedPlace[]) {
    for (const p of places) {
      const k = OvertureDedupeIndex.key(p.coordinates[0], p.coordinates[1]);
      (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push({
        ...p,
        name: normalizeName(p.name),
      });
    }
  }
  match(name: string, coordinates: [number, number]): DedupeReason | null {
    const n = normalizeName(name);
    if (!n) return null;
    const cx = Math.floor(coordinates[0] / 0.002);
    const cy = Math.floor(coordinates[1] / 0.002);
    let found: DedupeReason | null = null;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const p of this.cells.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (
            p.name === n &&
            distanceMeters(p.coordinates, coordinates) <= DEDUPE_RADIUS_METERS
          ) {
            if (p.carriesAtpSource) return 'overture_atp_source_same_place';
            found = 'overture_same_place';
          }
        }
    return found;
  }
}
