import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import type {
  GeocodeEvidence,
  OfficialEvidence,
} from './address-review';

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
  return typeof value === 'string'
    ? value.replace(/\D/g, '').slice(-10)
    : '';
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
  const allow = rules.allow.filter(matches).sort((a, b) => b.length - a.length)[0];
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
  return [object, ...(Array.isArray(object['@graph']) ? object['@graph'].flatMap(flattenJsonLd) : [])];
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
    .filter(
      (token) => token.length > 2 && !NAME_STOPWORDS.has(token)
    );
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
      const host = (value: string) =>
        value.toLowerCase().replace(/^www\./, '');
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
    /(?:^|\.)(localhost|local|internal)$/.test(
      parsed.hostname.toLowerCase()
    )
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
    const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
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
