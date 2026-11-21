import { TAXONOMY_MAPPINGS } from './taxonomy-mapping-data';
import { classifyListing, loadedFromFile } from './taxonomy-mapping';

/**
 * The shared normalize stage (owner decision D27). Every provider (Overture, AllThePlaces, Geoapify) is cleaned by this
 * one deterministic module, after acquisition and before matching, duplicate detection and publication. It never
 * replaces a source value: the raw `names.primary` and the source address stay as they were, and the normalised
 * display value, match key and validity state are stored beside them.
 *
 * Bump NORMALIZER_VERSION whenever any output below can change for the same input. A scan records the version it was
 * normalised with (`directory_scan_normalization`); a scan on an older version is re-normalised from its stored rows by
 * `renormalizeScan` without re-acquiring anything.
 */
export const NORMALIZER_VERSION = 'normalize-v1';

const collapse = (v: string): string =>
  v
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex -- Control characters are matched on purpose.
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/* --------------------------------- names --------------------------------- */

/**
 * The base match key, character for character what Directory matched on before the shared stage existed
 * (`normalizeName` in alltheplaces.ts delegates here): lower case, accents and punctuation gone, `&` as "and".
 */
export const baseNameKey = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const LEGAL_SUFFIX = new Set([
  'llc',
  'inc',
  'incorporated',
  'corp',
  'corporation',
  'co',
  'company',
  'ltd',
  'limited',
  'llp',
  'lp',
  'pllc',
  'pc',
  'plc',
]);
const SMALL_WORDS = new Set(['and', 'of', 'the', 'at', 'in', 'on', 'for', 'a']);

const UPPER_SUFFIX = new Set(['llc', 'llp', 'lp', 'pllc', 'pc', 'plc']);

function titleToken(token: string, first: boolean): string {
  const lower = token.toLowerCase();
  if (!first && SMALL_WORDS.has(lower)) return lower;
  if (UPPER_SUFFIX.has(lower.replace(/\./g, ''))) return token.toUpperCase();
  return lower
    .replace(/(^|[-/])([a-z])/g, (_m, a, b) => a + b.toUpperCase())
    .replace(
      /^([a-z])'([a-z]{2,})/,
      (_m, a, b) => `${a.toUpperCase()}'${b[0].toUpperCase()}${b.slice(1)}`
    );
}

/**
 * Display form: whitespace collapsed; a name that is all upper case or all lower case becomes title case (short
 * all-capital tokens such as KFC or CVS are kept as acronyms in an all-capital name); a mixed-case name is left alone,
 * because the owner's own casing ("McDonald's", "iFixit") beats any rule. Legal suffixes stay in the display name.
 */
export function normalizeNameDisplay(raw: string): string {
  const text = collapse(raw);
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length < 4) return text;
  const upper = letters === letters.toUpperCase();
  const lowerOnly = letters === letters.toLowerCase();
  if (!upper && !lowerOnly) return text;
  return text
    .split(' ')
    .map((word, i) =>
      upper &&
      /^[A-Z]{2,3}$/.test(word) &&
      !LEGAL_SUFFIX.has(word.toLowerCase())
        ? word
        : titleToken(word, i === 0)
    )
    .join(' ');
}

/** The match key: the base key with a leading "the" and trailing legal suffixes removed (never down to nothing). */
export function nameMatchKey(raw: string): string {
  let tokens = baseNameKey(raw).split(' ').filter(Boolean);
  if (tokens.length > 1 && tokens[0] === 'the') tokens = tokens.slice(1);
  while (tokens.length > 1 && LEGAL_SUFFIX.has(tokens[tokens.length - 1]))
    tokens = tokens.slice(0, -1);
  // "l l c" written with spaces collapses to the same suffix.
  const tail = tokens.slice(-3).join(' ');
  if (tokens.length > 3 && tail === 'l l c') tokens = tokens.slice(0, -3);
  return tokens.join(' ');
}

/* -------------------------------- addresses ------------------------------- */

const SUFFIX: Record<string, string> = {
  street: 'ST',
  st: 'ST',
  avenue: 'AVE',
  ave: 'AVE',
  av: 'AVE',
  road: 'RD',
  rd: 'RD',
  drive: 'DR',
  dr: 'DR',
  lane: 'LN',
  ln: 'LN',
  boulevard: 'BLVD',
  blvd: 'BLVD',
  court: 'CT',
  ct: 'CT',
  circle: 'CIR',
  cir: 'CIR',
  highway: 'HWY',
  hwy: 'HWY',
  parkway: 'PKWY',
  pkwy: 'PKWY',
  place: 'PL',
  pl: 'PL',
  square: 'SQ',
  sq: 'SQ',
  terrace: 'TER',
  ter: 'TER',
  trail: 'TRL',
  trl: 'TRL',
  way: 'WAY',
  alley: 'ALY',
  aly: 'ALY',
  plaza: 'PLZ',
  plz: 'PLZ',
  pike: 'PIKE',
  turnpike: 'TPKE',
  tpke: 'TPKE',
  route: 'RTE',
  rte: 'RTE',
  center: 'CTR',
  ctr: 'CTR',
  crossing: 'XING',
  xing: 'XING',
  expressway: 'EXPY',
  expy: 'EXPY',
  freeway: 'FWY',
  fwy: 'FWY',
};
const DIRECTION: Record<string, string> = {
  north: 'N',
  n: 'N',
  south: 'S',
  s: 'S',
  east: 'E',
  e: 'E',
  west: 'W',
  w: 'W',
  northeast: 'NE',
  ne: 'NE',
  northwest: 'NW',
  nw: 'NW',
  southeast: 'SE',
  se: 'SE',
  southwest: 'SW',
  sw: 'SW',
};
const UNIT_WORD: Record<string, string> = {
  apartment: 'APT',
  apt: 'APT',
  suite: 'STE',
  ste: 'STE',
  unit: 'UNIT',
  floor: 'FL',
  fl: 'FL',
  room: 'RM',
  rm: 'RM',
  building: 'BLDG',
  bldg: 'BLDG',
  space: 'SPC',
  spc: 'SPC',
  lot: 'LOT',
  trlr: 'TRLR',
};
const STATE: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  'district of columbia': 'DC',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
};
const STATE_CODES = new Set(Object.values(STATE));

export type FieldState = 'absent' | 'valid' | 'invalid';
export interface NormalizedAddress {
  state: FieldState;
  /** USPS-style upper-case display, for example "123 N MAIN ST APT 4, ANYTOWN, CT 06001". */
  display?: string;
  /** Match key: house number and street only (no unit, city or ZIP), so the same building matches across providers. */
  key?: string;
  unit?: string;
  zip5?: string;
  region?: string;
}
export interface AddressInput {
  freeform?: unknown;
  locality?: unknown;
  region?: unknown;
  postcode?: unknown;
}

const text = (v: unknown, max = 300): string | undefined =>
  typeof v === 'string' && collapse(v) ? collapse(v).slice(0, max) : undefined;

function streetTokens(line: string): { street: string[]; unit?: string } {
  const raw = line
    .replace(/[.,]/g, ' ')
    .replace(/#\s*/g, ' # ')
    .split(/\s+/)
    .filter(Boolean);
  const street: string[] = [];
  let unit: string | undefined;
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    const lw = w.toLowerCase();
    if (w === '#' || UNIT_WORD[lw]) {
      const word = w === '#' ? '#' : UNIT_WORD[lw];
      const id = raw[i + 1];
      if (
        id &&
        /^[A-Za-z0-9-]{1,10}$/.test(id) &&
        !UNIT_WORD[id.toLowerCase()]
      ) {
        unit = `${word === '#' ? 'UNIT' : word} ${id.toUpperCase()}`;
        i++;
        continue;
      }
      // A unit word with no id after it ("Suite") carries nothing.
      continue;
    }
    if (DIRECTION[lw] && (street.length === 1 || i === raw.length - 1))
      street.push(DIRECTION[lw]);
    else if (SUFFIX[lw] && street.length >= 2) street.push(SUFFIX[lw]);
    else street.push(w.toUpperCase());
  }
  return { street, unit };
}

/** One address, freeform or structured (Overture's `addresses[0]`). */
export function normalizeAddress(input: unknown): NormalizedAddress {
  const a: AddressInput =
    typeof input === 'string'
      ? { freeform: input }
      : input && typeof input === 'object'
      ? (input as AddressInput)
      : {};
  let free = text(a.freeform);
  let postcode = text(a.postcode, 16);
  let region = text(a.region, 40);
  const locality = text(a.locality, 80);
  if (!free && !postcode && !locality) return { state: 'absent' };
  if (!free) return { state: 'invalid' };
  // A freeform line often carries ", City, ST 12345": peel the ZIP and state off the end.
  const zipTail = free.match(/[,\s]+(\d{5})(?:-\d{4})?\s*$/);
  if (zipTail) {
    postcode = postcode ?? zipTail[1];
    free = free.slice(0, zipTail.index).trim();
  }
  const parts = free
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  let line = parts[0] ?? '';
  let cityFromLine: string | undefined;
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const code = last.toUpperCase();
    if (STATE_CODES.has(code)) region = region ?? code;
    else if (STATE[last.toLowerCase()])
      region = region ?? STATE[last.toLowerCase()];
    if (parts.length >= 3 || (!region && parts.length === 2))
      cityFromLine = parts[1];
    else if (parts.length === 2 && region) cityFromLine = undefined;
  }
  const { street, unit } = streetTokens(line);
  const zip5 = postcode?.match(/^(\d{5})(?:-\d{4})?$/)?.[1];
  const state2 = region
    ? STATE_CODES.has(region.toUpperCase())
      ? region.toUpperCase()
      : STATE[region.toLowerCase()]
    : undefined;
  const hasNumber = /^\d+[A-Za-z]?(?:-\d+)?$/.test(street[0] ?? '');
  const hasStreetWord = street.slice(1).some((t) => /[A-Z]{2,}/.test(t));
  const poBox = /^P\s?O\s+BOX\s+\d+/.test(street.join(' ').replace(/\./g, ''));
  const badZip = postcode !== undefined && !zip5;
  const badRegion = region !== undefined && !state2;
  if (!((hasNumber && hasStreetWord) || poBox) || badZip || badRegion)
    return { state: 'invalid' };
  const city = (locality ?? cityFromLine)?.toUpperCase();
  const base = street.join(' ');
  return {
    state: 'valid',
    display: [
      [base, unit].filter(Boolean).join(' '),
      city,
      [state2, zip5].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(', '),
    key: base,
    ...(unit ? { unit } : {}),
    ...(zip5 ? { zip5 } : {}),
    ...(state2 ? { region: state2 } : {}),
  };
}

/* --------------------------------- phones --------------------------------- */

export interface NormalizedPhone {
  state: FieldState;
  /** E.164, US numbers only (+1NXXNXXXXXX). */
  e164?: string;
}

export function normalizePhone(input: unknown): NormalizedPhone {
  const raw = text(input, 64);
  if (!raw) return { state: 'absent' };
  const body = raw.replace(/\s*(?:x|ext\.?|extension)\s*\d+\s*$/i, '');
  const digits = body.replace(/\D/g, '');
  const national =
    digits.length === 11 && digits.startsWith('1')
      ? digits.slice(1)
      : digits.length === 10
      ? digits
      : '';
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) return { state: 'invalid' };
  return { state: 'valid', e164: `+1${national}` };
}

/* -------------------------------- websites -------------------------------- */

export interface NormalizedWebsite {
  state: FieldState;
  /** https/http URL, lower-case host, default port, fragment and tracking parameters removed. */
  url?: string;
  host?: string;
}
const TRACKING =
  /^(utm_[a-z0-9_]+|fbclid|gclid|dclid|msclkid|yclid|igshid|mc_cid|mc_eid|_hsenc|_hsmi|ref|ref_src|ref_url|srsltid)$/i;

export function normalizeWebsite(input: unknown): NormalizedWebsite {
  let raw = text(input, 2048);
  if (!raw) return { state: 'absent' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    if (
      /^[a-z][a-z0-9+.-]*:/i.test(raw) &&
      !/^[^/]+\.[a-z]{2,}(:\d+)?(\/|$)/i.test(raw)
    )
      return { state: 'invalid' };
    raw = `https://${raw}`;
  }
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password)
      return { state: 'invalid' };
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname))
      return { state: 'invalid' };
    u.hash = '';
    for (const k of [...u.searchParams.keys()])
      if (TRACKING.test(k)) u.searchParams.delete(k);
    let out = u.toString();
    if (u.pathname === '/' && !u.search) out = out.replace(/\/$/, '');
    return { state: 'valid', url: out, host: u.hostname.replace(/^www\./, '') };
  } catch {
    return { state: 'invalid' };
  }
}

/* ---------------------------------- hours --------------------------------- */

export interface NormalizedHours {
  state: FieldState;
  /** OSM-style opening hours with one space after each `;` and no stray whitespace. */
  value?: string;
}
export function normalizeHours(input: unknown): NormalizedHours {
  const raw = text(input, 500);
  if (!raw) return { state: 'absent' };
  const value = raw
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s*-\s*/g, '-')
    .replace(/;\s*$/, '');
  return /\d|24\/7|\boff\b/i.test(value)
    ? { state: 'valid', value }
    : { state: 'invalid' };
}

/* -------------------------------- categories ------------------------------- */

const MAPPING = loadedFromFile(TAXONOMY_MAPPINGS[0]);

/** The directory taxonomy category for a provider category, or null when the mapping excludes it or does not know it (the Overture basic category AllThePlaces also maps onto). */
export function directoryCategory(
  basicCategory: unknown,
  taxonomyPath?: readonly string[]
): string | null {
  const c = classifyListing(MAPPING, {
    category: typeof basicCategory === 'string' ? basicCategory : null,
    taxonomyPath: taxonomyPath ?? null,
  });
  return c.excluded || c.basis === 'legacy' ? null : c.categoryId;
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
const TOURISM: Record<string, string> = { hotel: 'hotel', motel: 'hotel' };
const hasOwn = (o: object, k: string) =>
  Object.prototype.hasOwnProperty.call(o, k);

/** The provider-category step for AllThePlaces: OSM tags to a basic category, or null when none is mapped. */
export function osmBasicCategory(
  props: Record<string, unknown>
): string | null {
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

/* --------------------------------- records -------------------------------- */

export type NormalizeProvider = 'overture' | 'alltheplaces' | 'geoapify';

export interface NormalizedRecord {
  v: typeof NORMALIZER_VERSION;
  nameDisplay: string;
  nameKey: string;
  /** Directory taxonomy category, or null when the mapping excludes or does not know the provider category. */
  category: string | null;
  address: NormalizedAddress;
  phone: NormalizedPhone;
  website: NormalizedWebsite;
  hours: NormalizedHours;
}

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

/**
 * Normalise one source record. `source` is what the extractor hands the projection: Overture's row (`names.primary`,
 * `addresses[]`, `phones[]`, `websites[]`, `basic_category`, `taxonomy`) or AllThePlaces' (`address` string). Pure and
 * deterministic: the same record and NORMALIZER_VERSION always give the same output.
 */
export function normalizeRecord(
  _provider: NormalizeProvider,
  source: Record<string, unknown>
): NormalizedRecord {
  const rawName = (source['names'] as { primary?: unknown } | undefined)
    ?.primary;
  const name = typeof rawName === 'string' ? rawName : '';
  const taxonomy = source['taxonomy'] as { hierarchy?: unknown } | undefined;
  const path = Array.isArray(taxonomy?.hierarchy)
    ? (taxonomy?.hierarchy as unknown[]).filter(
        (x): x is string => typeof x === 'string'
      )
    : undefined;
  return {
    v: NORMALIZER_VERSION,
    nameDisplay: normalizeNameDisplay(name),
    nameKey: nameMatchKey(name),
    category: directoryCategory(source['basic_category'], path),
    address: normalizeAddress(first(source['addresses']) ?? source['address']),
    phone: normalizePhone(first(source['phones']) ?? source['phone']),
    website: normalizeWebsite(first(source['websites']) ?? source['website']),
    hours: normalizeHours(source['hours'] ?? source['opening_hours']),
  };
}

/** The Geoapify private details, cleaned by the same functions. Raw values stay in `details`; these sit beside them. */
export function normalizeGeoapifyDetails(d: {
  openingHours?: string;
  phone?: string;
  website?: string;
}) {
  return {
    v: NORMALIZER_VERSION,
    phone: normalizePhone(d.phone),
    website: normalizeWebsite(d.website),
    hours: normalizeHours(d.openingHours),
  };
}

/* ------------------------- the stored (listing) form ------------------------ */

/** What `listing.normalized` holds: derived keys and validity states, and, for retained contact fields only, values. */
export interface StoredNormalized {
  v: string;
  nameDisplay: string;
  nameKey: string;
  category: string | null;
  address: FieldState;
  phone: FieldState;
  website: FieldState;
  hours: FieldState;
  /** Normalised contact values. Only stored when the listing itself retains the raw contact fields. */
  contact?: {
    address?: string;
    addressKey?: string;
    phone?: string;
    website?: string;
    hours?: string;
  };
}

/** Whitespace collapse and trim: the one text cleanup every provider's display fields share. */
export const cleanText = collapse;

export function toStored(n: NormalizedRecord): StoredNormalized {
  const contact: NonNullable<StoredNormalized['contact']> = {};
  if (n.address.display) contact.address = n.address.display;
  if (n.address.key) contact.addressKey = n.address.key;
  if (n.phone.e164) contact.phone = n.phone.e164;
  if (n.website.url) contact.website = n.website.url;
  if (n.hours.value) contact.hours = n.hours.value;
  return {
    v: n.v,
    nameDisplay: n.nameDisplay,
    nameKey: n.nameKey,
    category: n.category,
    address: n.address.state,
    phone: n.phone.state,
    website: n.website.state,
    hours: n.hours.state,
    ...(Object.keys(contact).length ? { contact } : {}),
  };
}

const STATES = new Set<string>(['absent', 'valid', 'invalid']);
const bounded = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

/** Validates a stored block and drops anything it does not know; contact values go unless `keepContact`. */
export function sanitizeStored(
  value: unknown,
  keepContact: boolean
): StoredNormalized | undefined {
  const n = value as Partial<StoredNormalized> | null | undefined;
  if (
    !n ||
    typeof n !== 'object' ||
    !bounded(n.v, 32) ||
    typeof n.nameDisplay !== 'string' ||
    n.nameDisplay.length > 400 ||
    typeof n.nameKey !== 'string' ||
    n.nameKey.length > 400 ||
    !(n.category === null || bounded(n.category, 64)) ||
    !STATES.has(n.address as string) ||
    !STATES.has(n.phone as string) ||
    !STATES.has(n.website as string) ||
    !STATES.has(n.hours as string)
  )
    throw Error('Invalid normalized block');
  const c = n.contact;
  const contact: NonNullable<StoredNormalized['contact']> = {};
  if (keepContact && c && typeof c === 'object')
    for (const [k, max] of [
      ['address', 300],
      ['addressKey', 300],
      ['phone', 16],
      ['website', 2048],
      ['hours', 500],
    ] as const) {
      const x = (c as Record<string, unknown>)[k];
      if (x !== undefined) {
        if (!bounded(x, max)) throw Error('Invalid normalized contact');
        contact[k] = x;
      }
    }
  return {
    v: n.v,
    nameDisplay: n.nameDisplay,
    nameKey: n.nameKey,
    category: n.category ?? null,
    address: n.address as FieldState,
    phone: n.phone as FieldState,
    website: n.website as FieldState,
    hours: n.hours as FieldState,
    ...(Object.keys(contact).length ? { contact } : {}),
  };
}
