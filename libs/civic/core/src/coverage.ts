import type { CoverageRange, SourceConfig } from './types.js';

type PublisherIdentityItem = Pick<
  import('./schema.js').CivicItemRow,
  'publisher' | 'canonicalUrl' | 'uris'
>;

function normalizePublisherIdentity(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/giu, ' ')
    .trim();
}

function configuredPublisherDomains(
  source: Pick<SourceConfig, 'restrictionPolicyUrl' | 'config'>
): string[] {
  const config = source.config ?? {};
  const configured = [
    config['publisherDomain'],
    config['publisherDomains'],
    config['publisherUrl'],
    config['directPublisherUrl'],
  ]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === 'string');
  const policy = source.restrictionPolicyUrl
    ? [source.restrictionPolicyUrl]
    : [];
  return [...configured, ...policy].flatMap((value) => {
    try {
      const host = new URL(value).hostname
        .toLocaleLowerCase()
        .replace(/^www\./u, '');
      return host ? [host] : [];
    } catch {
      return [];
    }
  });
}

/**
 * Identifies an item from the configured publisher behind an aggregate
 * discovery source. Locality words in a title are intentionally ignored:
 * aggregate results commonly mention the locality while belonging to a
 * third-party publisher. Publisher names and configured/policy URL domains
 * are the only identity signals accepted here.
 */
export function matchesConfiguredPublisherIdentity(
  item: PublisherIdentityItem,
  source: Pick<SourceConfig, 'name' | 'restrictionPolicyUrl' | 'config'>
): boolean {
  const publisher = normalizePublisherIdentity(item.publisher ?? '');
  // `matchNames` is deliberately excluded: those values are locality search
  // aliases (for example, "Adel" and "Cook"), not publisher identity. A
  // caller may opt into additional explicit publisher names via the separate
  // `publisherNames` configuration key.
  const names = [
    source.name,
    ...(Array.isArray(source.config?.['publisherNames'])
      ? source.config['publisherNames']
      : []),
  ]
    .filter((value): value is string => typeof value === 'string')
    .map(normalizePublisherIdentity)
    .filter((value) => value.length >= 4);
  if (
    publisher &&
    names.some((name) => publisher === name || publisher.includes(name))
  )
    return true;

  const domains = configuredPublisherDomains(source);
  const urls = [item.canonicalUrl, ...parseItemUris(item.uris)].filter(
    (value): value is string => typeof value === 'string'
  );
  return urls.some((value) => {
    try {
      const host = new URL(value).hostname
        .toLocaleLowerCase()
        .replace(/^www\./u, '');
      return domains.some(
        (domain) => host === domain || host.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  });
}

function parseItemUris(value?: string | null): string[] {
  try {
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

const DAY = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;

function parseDay(value: string): number {
  if (!ISO_DAY.test(value))
    throw new Error(`coverage date must be YYYY-MM-DD: ${value}`);
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]!) {
    throw new Error(`coverage date is invalid: ${value}`);
  }
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed))
    throw new Error(`coverage date is invalid: ${value}`);
  return parsed;
}

function dayAt(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function daysBetween(start: number, end: number): string[] {
  const days: string[] = [];
  for (let cursor = start; cursor < end; cursor += DAY)
    days.push(dayAt(cursor));
  return days;
}

export interface CoverageRangeInput {
  requestedStart: string;
  requestedEnd: string;
  /** Accepted item dates, represented as local YYYY-MM-DD dates. */
  observedDates: readonly string[];
  sourceFailed?: boolean;
  capabilitySupported?: boolean;
  /** Source identity/access metadata used for the narrow zero-result rule. */
  source?: Pick<
    SourceConfig,
    'adapter' | 'kind' | 'accessMode' | 'aggregateDiscovery'
  >;
  /** @deprecated Prefer source metadata; retained for callers that pre-classify sources. */
  restrictedAggregateOnly?: boolean;
  /** Number of records returned for this source in the current fetch/context. */
  currentRecordCount?: number;
}

/**
 * Build an honest half-open coverage interval. Dates outside the requested
 * interval are ignored, and an empty/failed/unsupported source remains a gap
 * rather than being represented as content. This helper does not orchestrate
 * any backfill window.
 */
export function buildCoverageRange(input: CoverageRangeInput): CoverageRange {
  const start = parseDay(input.requestedStart);
  const end = parseDay(input.requestedEnd);
  if (end < start)
    throw new Error('coverage requestedEnd must be on or after requestedStart');
  const requestedDays = daysBetween(start, end);
  const accepted = [...new Set(input.observedDates)]
    .filter((date) => {
      const value = parseDay(date);
      return value >= start && value < end;
    })
    .sort();
  const missingDays = requestedDays.filter((day) => !accepted.includes(day));
  let reason: CoverageRange['reason'];
  if (input.sourceFailed) reason = 'source-failed';
  // A restricted aggregate source with no current records has a meaningful
  // no-result diagnostic even when it cannot claim date/pagination coverage.
  // This exception is deliberately narrower than generic empty-source logic.
  else if (
    !accepted.length &&
    (input.restrictedAggregateOnly === true ||
      (input.source?.adapter === 'news-discover' &&
        input.source.kind === 'news' &&
        input.source.accessMode === 'snippet-only' &&
        input.source.aggregateDiscovery === true)) &&
    (input.currentRecordCount ?? 0) === 0
  )
    reason = 'no-dated-items';
  else if (input.capabilitySupported === false)
    reason = 'unsupported-capability';
  else if (!accepted.length) reason = 'no-dated-items';
  else if (missingDays.length) reason = 'partial-range';
  else reason = 'complete';
  return {
    requestedStart: input.requestedStart,
    requestedEnd: input.requestedEnd,
    observedStart: accepted[0] ?? null,
    // observedEnd is exclusive, matching requestedEnd: the day after the
    // latest accepted item, bounded by the requested interval.
    observedEnd: accepted.length
      ? dayAt(Math.min(end, parseDay(accepted[accepted.length - 1]!) + DAY))
      : null,
    missingDays,
    reason,
  };
}

export const coverageRange = buildCoverageRange;
export const calculateCoverageRange = buildCoverageRange;
export const makeCoverageRange = buildCoverageRange;

export interface CoverageGap {
  sourceKey: string;
  reason: string;
}

/** Turn a source range into an explicit diagnostic; complete ranges emit none. */
export function coverageGapForRange(
  sourceKey: string,
  range: CoverageRange
): CoverageGap | null {
  if (range.reason === 'complete') return null;
  const reason =
    range.reason === 'no-dated-items'
      ? 'no recent aggregate result'
      : range.reason === 'source-failed'
      ? 'source fetch failed'
      : range.reason === 'unsupported-capability'
      ? 'source does not document date or pagination coverage capability'
      : `partial range; missing days: ${range.missingDays.join(', ')}`;
  return { sourceKey, reason };
}
