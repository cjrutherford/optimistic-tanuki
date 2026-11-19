import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import type { GeocodeEvidence, OfficialEvidence } from './address-review';

export interface SourceAddress {
  freeform?: string;
  locality?: string;
  region?: string;
  postcode?: string;
  country?: string;
}

export interface OfficialSource {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
}

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

const DEFAULT_USER_AGENT =
  'TownSquareDirectoryReview/1.0 (+https://townsquare.local; address review)';
const BOT_PATTERNS = [
  'robot or human',
  'captcha',
  'access denied',
  'unusual traffic',
  'are you a robot',
];
const NAME_STOPWORDS = new Set([
  'the',
  'and',
  'of',
  'at',
  'for',
  'inc',
  'llc',
  'ltd',
  'co',
  'company',
  'corp',
  'corporation',
  'store',
  'shop',
  'center',
  'centre',
]);

export function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
    : '';
}

export function phoneDigits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '').slice(-10) : '';
}

export function evidenceHash(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function censusQuery(address: SourceAddress): string | null {
  const country = (address.country ?? '').trim().toUpperCase();
  if (country && country !== 'US' && country !== 'USA') return null;
  const parts = [
    address.freeform,
    address.locality,
    [address.region, address.postcode].filter(Boolean).join(' '),
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function parseCensusResponse(
  value: unknown,
  checkedAt = new Date().toISOString()
): GeocodeEvidence {
  const matches = (value as any)?.result?.addressMatches;
  if (!Array.isArray(matches)) {
    return { status: 'error', provider: 'census', checkedAt };
  }
  if (matches.length === 0) {
    return { status: 'no_match', provider: 'census', checkedAt };
  }
  if (matches.length > 1) {
    return { status: 'ambiguous', provider: 'census', checkedAt };
  }
  const match = matches[0];
  const matchedAddress = match?.matchedAddress;
  const x = match?.coordinates?.x;
  const y = match?.coordinates?.y;
  if (
    typeof matchedAddress !== 'string' ||
    !matchedAddress.trim() ||
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    Math.abs(x) > 180 ||
    Math.abs(y) > 90
  ) {
    return { status: 'error', provider: 'census', checkedAt };
  }
  return {
    status: 'match',
    normalizedAddress: matchedAddress,
    coordinates: { lat: y, lng: x },
    precision: 'range',
    provider: 'census',
    checkedAt,
  };
}

export const CENSUS_BATCH_URL =
  'https://geocoding.geo.census.gov/geocoder/locations/addressbatch';
/** The Census batch endpoint accepts at most 10,000 records per file. */
export const CENSUS_BATCH_MAX = 10_000;

export interface CensusBatchInput {
  id: string;
  address: string;
  /**
   * Used only when the address carries no trailing "City, ST zip" of its own. The assigned town's city is NOT
   * used as a fallback: assigned towns cover neighbouring places, and a wrong city turns a real address into a
   * no-match. The state alone lets Census find the street; the distance and boundary checks catch a wrong place.
   */
  fallbackState?: string;
}

const csvField = (value: string) =>
  `"${value.replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`;

/**
 * Splits a freeform US address into the street, city, state and ZIP columns the batch endpoint wants. A trailing
 * "ST" or "ST 12345" part is the state; the part before it is the city. A freeform with no state falls back to
 * the state of the town the candidate is assigned to. The geocode-to-source distance and town-boundary checks then guard any
 * mismatch between the fallback town and where the business really is.
 */
export function splitCensusAddress(input: CensusBatchInput): {
  street: string;
  city: string;
  state: string;
  zip: string;
} | null {
  const parts = input.address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const tail = /^([A-Za-z]{2})(?:\s+(\d{5})(?:-\d{4})?)?$/.exec(
    parts[parts.length - 1]
  );
  if (tail && parts.length >= 3) {
    return {
      street: parts.slice(0, -2).join(', '),
      city: parts[parts.length - 2],
      state: tail[1].toUpperCase(),
      zip: tail[2] ?? '',
    };
  }
  if (!input.fallbackState) return null;
  return {
    street: parts.join(', '),
    city: '',
    state: input.fallbackState,
    zip: '',
  };
}

/** Builds the batch CSV (id, street, city, state, zip, no header). Rows with no usable address are returned apart. */
export function buildCensusBatchCsv(rows: readonly CensusBatchInput[]): {
  csv: string;
  sent: string[];
  skipped: string[];
} {
  const lines: string[] = [];
  const sent: string[] = [];
  const skipped: string[] = [];
  for (const row of rows) {
    const parts = splitCensusAddress(row);
    if (!parts || !parts.street) {
      skipped.push(row.id);
      continue;
    }
    sent.push(row.id);
    lines.push(
      [row.id, parts.street, parts.city, parts.state, parts.zip]
        .map(csvField)
        .join(',')
    );
  }
  return { csv: lines.join('\n') + '\n', sent, skipped };
}

/** A small RFC 4180 reader: quoted fields may hold commas and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  const endRecord = () => {
    record.push(field);
    field = '';
    if (record.length > 1 || record[0] !== '') records.push(record);
    record = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      record.push(field);
      field = '';
    } else if (c === '\n') endRecord();
    else if (c !== '\r') field += c;
  }
  if (field !== '' || record.length) endRecord();
  return records;
}

/**
 * Parses the batch response into one geocode per id. Columns: id, input address, Match|No_Match|Tie,
 * Exact|Non_Exact, matched address, "lon,lat", tigerline id, side. Only a single `Exact` match is evidence D12 can
 * release on; a `Non_Exact` match is still recorded as a match, with `matchType: 'non_exact'`, so it holds.
 * Ids that do not appear in the response are absent from the map, so the caller can retry them.
 */
export function parseCensusBatchResponse(
  text: string,
  checkedAt = new Date().toISOString()
): Map<string, GeocodeEvidence> {
  const out = new Map<string, GeocodeEvidence>();
  for (const record of parseCsv(text)) {
    const id = record[0]?.trim();
    if (!id) continue;
    const verdict = (record[2] ?? '').trim().toLowerCase();
    const base = { provider: 'census-batch', checkedAt } as const;
    if (verdict === 'no_match') {
      out.set(id, { status: 'no_match', ...base });
    } else if (verdict === 'tie') {
      out.set(id, { status: 'ambiguous', ...base });
    } else if (verdict === 'match') {
      const [lng, lat] = (record[5] ?? '').split(',').map(Number);
      const matched = (record[4] ?? '').trim();
      const exact = (record[3] ?? '').trim().toLowerCase();
      if (
        !matched ||
        !Number.isFinite(lng) ||
        !Number.isFinite(lat) ||
        Math.abs(lng) > 180 ||
        Math.abs(lat) > 90 ||
        (exact !== 'exact' && exact !== 'non_exact')
      ) {
        out.set(id, { status: 'error', ...base });
      } else {
        out.set(id, {
          status: 'match',
          normalizedAddress: matched,
          matchType: exact,
          coordinates: { lat, lng },
          precision: 'range',
          ...base,
        });
      }
    } else {
      out.set(id, { status: 'error', ...base });
    }
  }
  return out;
}

/** One batch POST with retries and exponential backoff; resolves to the response CSV or throws after the last try. */
export async function geocodeCensusBatch(input: {
  csv: string;
  fetchImpl?: typeof fetch;
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, reason: string) => void;
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const retries = input.retries ?? 4;
  const sleep =
    input.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let reason = 'unknown';
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      input.onRetry?.(attempt, reason);
      await sleep((input.backoffMs ?? 5000) * 2 ** (attempt - 1));
    }
    try {
      const form = new FormData();
      form.append('benchmark', 'Public_AR_Current');
      form.append(
        'addressFile',
        new Blob([input.csv], { type: 'text/csv' }),
        'addresses.csv'
      );
      const response = await fetchImpl(CENSUS_BATCH_URL, {
        method: 'POST',
        body: form,
        headers: { 'user-agent': DEFAULT_USER_AGENT },
        signal: AbortSignal.timeout(input.timeoutMs ?? 600_000),
        redirect: 'error',
      });
      if (response.ok) return await response.text();
      reason = `http ${response.status}`;
    } catch (error) {
      reason = error instanceof Error ? error.name : 'error';
    }
  }
  throw Error(`Census batch failed after ${retries + 1} attempts: ${reason}`);
}

export async function geocodeCensus(input: {
  address: SourceAddress;
  fetchImpl?: typeof fetch;
  now?: Date;
  timeoutMs?: number;
}): Promise<GeocodeEvidence> {
  const query = censusQuery(input.address);
  if (!query) {
    return {
      status: 'error',
      provider: 'census',
      checkedAt: (input.now ?? new Date()).toISOString(),
    };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(
        query
      )}&benchmark=Public_AR_Current&format=json`,
      {
        headers: { 'user-agent': DEFAULT_USER_AGENT },
        signal: AbortSignal.timeout(input.timeoutMs ?? 15000),
        redirect: 'error',
      }
    );
    if (!response.ok) {
      return {
        status: 'error',
        provider: 'census',
        checkedAt: (input.now ?? new Date()).toISOString(),
      };
    }
    return parseCensusResponse(
      await response.json(),
      (input.now ?? new Date()).toISOString()
    );
  } catch {
    return {
      status: 'error',
      provider: 'census',
      checkedAt: (input.now ?? new Date()).toISOString(),
    };
  }
}

export function parseRobots(value: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [] };
  let applies = false;
  for (const raw of value.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [key, ...rest] = line.split(':');
    const field = key.trim().toLowerCase();
    const target = rest.join(':').trim();
    if (field === 'user-agent') {
      applies = target === '*' || target.toLowerCase().includes('townsquare');
    } else if (applies && field === 'allow' && target) {
      rules.allow.push(target);
    } else if (applies && field === 'disallow' && target) {
      rules.disallow.push(target);
    }
  }
  return rules;
}

export function robotsAllowsPath(path: string, rules: RobotsRules): boolean {
  const matches = (rule: string) =>
    rule === '/' || path === rule || path.startsWith(rule);
  const allow = rules.allow
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];
  const disallow = rules.disallow
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];
  if (!disallow) return true;
  if (!allow) return false;
  return allow.length >= disallow.length;
}

export async function robotsAllow(
  url: string,
  options: {
    fetchImpl?: typeof fetch;
    userAgent?: string;
    cache?: Map<string, RobotsRules>;
    timeoutMs?: number;
  } = {}
): Promise<boolean> {
  const parsed = new URL(url);
  const cache = options.cache;
  const origin = parsed.origin;
  let rules = cache?.get(origin);
  if (!rules) {
    const fetchImpl = options.fetchImpl ?? fetch;
    try {
      const response = await fetchImpl(`${origin}/robots.txt`, {
        headers: { 'user-agent': options.userAgent ?? DEFAULT_USER_AGENT },
        signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
        redirect: 'follow',
      });
      if (response.status === 401 || response.status === 403) return false;
      if (response.status === 404) {
        rules = { allow: [], disallow: [] };
      } else if (response.ok) {
        rules = parseRobots(await response.text());
      } else {
        rules = { allow: [], disallow: [] };
      }
      cache?.set(origin, rules);
    } catch {
      return false;
    }
  }
  return robotsAllowsPath(parsed.pathname || '/', rules);
}

export function extractJsonLd(html: string): unknown[] {
  const values: unknown[] = [];
  const pattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) values.push(...parsed);
      else values.push(parsed);
    } catch {
      // Invalid JSON-LD is ignored; it cannot be used as evidence.
    }
  }
  return values;
}

function flattenJsonLd(value: unknown): any[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  const object = value as any;
  return [
    object,
    ...(Array.isArray(object['@graph'])
      ? object['@graph'].flatMap(flattenJsonLd)
      : []),
  ];
}

function jsonLdText(value: unknown): string {
  return flattenJsonLd(value)
    .map((entry) => {
      const address = entry?.address;
      const addressText =
        typeof address === 'string'
          ? address
          : address && typeof address === 'object'
          ? [
              address.streetAddress,
              address.addressLocality,
              address.addressRegion,
              address.postalCode,
            ]
              .filter((part) => typeof part === 'string')
              .join(' ')
          : '';
      const phone = Array.isArray(entry?.telephone)
        ? entry.telephone.join(' ')
        : entry?.telephone;
      return [entry?.name, addressText, phone, entry?.url]
        .filter((part) => typeof part === 'string')
        .join(' ');
    })
    .join(' ');
}

export function pageText(html: string): string {
  return normalizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

export function nameTokens(name: string): string[] {
  return normalizeText(name)
    .split(' ')
    .filter((token) => token.length > 2 && !NAME_STOPWORDS.has(token));
}

export function evaluateOfficialPage(input: {
  url: string;
  finalUrl?: string;
  body: string;
  source: OfficialSource;
}): OfficialEvidence {
  const html = input.body;
  const jsonLd = extractJsonLd(html);
  const text = `${pageText(html)} ${normalizeText(jsonLdText(jsonLd))}`;
  const sourceName = normalizeText(input.source.name);
  const sourceTokens = nameTokens(input.source.name);
  const jsonLdNames = flattenJsonLd(jsonLd)
    .map((entry) => normalizeText(entry?.name))
    .filter(Boolean);
  const nameMatch =
    (!!sourceName &&
      (text.includes(sourceName) ||
        jsonLdNames.some(
          (name) => name.includes(sourceName) || sourceName.includes(name)
        ))) ||
    (sourceTokens.length > 0 &&
      sourceTokens.filter((token) => text.includes(token)).length /
        sourceTokens.length >=
        0.6);

  const sourceAddress = normalizeText(input.source.address);
  const addressParts = sourceAddress.split(' ');
  const addressNumber = addressParts[0];
  const addressStreet = addressParts.slice(1).filter((part) => part.length > 2);
  const addressMatch =
    !!sourceAddress &&
    ((text.includes(sourceAddress) &&
      (!addressNumber || text.includes(addressNumber))) ||
      (!!addressNumber &&
        addressStreet.length > 0 &&
        text.includes(addressNumber) &&
        addressStreet.filter((token) => text.includes(token)).length /
          addressStreet.length >=
          0.6));

  const sourcePhone = phoneDigits(input.source.phone);
  const phoneMatch =
    !sourcePhone || text.replace(/\D/g, '').includes(sourcePhone);

  let websiteMatch = true;
  if (input.source.website) {
    try {
      const source = new URL(input.source.website);
      const finalUrl = new URL(input.finalUrl || input.url);
      const host = (value: string) => value.toLowerCase().replace(/^www\./, '');
      websiteMatch = host(source.hostname) === host(finalUrl.hostname);
    } catch {
      websiteMatch = false;
    }
  }

  return {
    url: input.finalUrl || input.url,
    status: 'fetched',
    nameMatch,
    addressMatch,
    phoneMatch,
    websiteMatch,
    fetchedAt: new Date().toISOString(),
    evidenceHash: evidenceHash(html),
  };
}

export async function fetchOfficialPage(input: {
  url: string;
  source: OfficialSource;
  fetchImpl?: typeof fetch;
  userAgent?: string;
  robotsCache?: Map<string, RobotsRules>;
  timeoutMs?: number;
  maxBytes?: number;
}): Promise<OfficialEvidence> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const userAgent = input.userAgent ?? DEFAULT_USER_AGENT;
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return { url: input.url, status: 'invalid' };
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    isIP(parsed.hostname.replace(/^\[|\]$/g, '')) ||
    /(?:^|\.)(localhost|local|internal)$/.test(parsed.hostname.toLowerCase())
  ) {
    return { url: input.url, status: 'invalid' };
  }
  const transport = parsed.protocol === 'http:' ? 'http' : 'https';
  if (
    !(await robotsAllow(input.url, {
      fetchImpl,
      userAgent,
      cache: input.robotsCache,
      timeoutMs: input.timeoutMs,
    }))
  ) {
    return {
      url: input.url,
      status: 'blocked',
      transport,
      fetchedAt: new Date().toISOString(),
    };
  }
  try {
    const response = await fetchImpl(input.url, {
      headers: { 'user-agent': userAgent },
      signal: AbortSignal.timeout(input.timeoutMs ?? 15000),
      redirect: 'follow',
    });
    if (response.status === 403 || response.status === 429) {
      return {
        url: response.url || input.url,
        status: 'blocked',
        transport,
        httpStatus: response.status,
        fetchedAt: new Date().toISOString(),
      };
    }
    if (!response.ok) {
      return {
        url: response.url || input.url,
        status: 'unavailable',
        transport,
        httpStatus: response.status,
        fetchedAt: new Date().toISOString(),
      };
    }
    const maxBytes = input.maxBytes ?? 512 * 1024;
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          return {
            url: response.url || input.url,
            status: 'unavailable',
            transport,
            httpStatus: response.status,
            fetchedAt: new Date().toISOString(),
          };
        }
        chunks.push(part.value);
      }
    }
    const body = Buffer.concat(
      chunks.map((chunk) => Buffer.from(chunk))
    ).toString('utf8');
    const lower = body.toLowerCase();
    if (BOT_PATTERNS.some((pattern) => lower.includes(pattern))) {
      return {
        url: response.url || input.url,
        status: 'blocked',
        transport,
        httpStatus: response.status,
        fetchedAt: new Date().toISOString(),
        evidenceHash: evidenceHash(body),
      };
    }
    const evaluated = evaluateOfficialPage({
      url: input.url,
      finalUrl: response.url || input.url,
      body,
      source: input.source,
    });
    return { ...evaluated, httpStatus: response.status, transport };
  } catch {
    return {
      url: input.url,
      status: 'unavailable',
      transport,
      fetchedAt: new Date().toISOString(),
    };
  }
}

export function createRateLimiter(delayMs: number): () => Promise<void> {
  let next = 0;
  const delay = Math.max(0, delayMs);
  return async () => {
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + delay;
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  };
}
