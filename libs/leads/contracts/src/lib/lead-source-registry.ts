import { LeadDiscoverySource, LeadTopicDiscoveryIntent } from './leads.types';

/**
 * One declarative descriptor per discovery source.
 *
 * Before this existed, whether a source was legal to use, needed a key, was
 * rate limited, or owed attribution lived only in the head of whoever wrote the
 * provider. Both the backend wiring and the topics UI now read from here, so a
 * source cannot be offered in the UI while being unusable in practice.
 *
 * This file deliberately lives in the entity-free contracts lib: it is a
 * runtime value, and importing one from the models barrel drags TypeORM
 * entities into the browser bundle.
 */

export type LeadSourceLegalBasis =
  /** Documented public API, no key required. */
  | 'public-api'
  /** Publisher's own RSS/XML feed. */
  | 'published-feed'
  /** Official API that requires a key, usually billable past a free tier. */
  | 'keyed-api'
  /** Derived by querying a search engine and filtering by domain. */
  | 'search-derived';

export type LeadSourceStatus =
  /** Selectable for new topics. */
  | 'active'
  /** Kept so historical leads keep their provenance, but not selectable. */
  | 'retired';

export interface LeadDiscoverySourceDescriptor {
  id: LeadDiscoverySource;
  label: string;
  status: LeadSourceStatus;
  legalBasis: LeadSourceLegalBasis;
  requiresApiKey: boolean;
  /** The source's terms require visible credit on displayed results. */
  attributionRequired: boolean;
  attributionNote?: string;
  /** Which discovery intents this source can actually serve. */
  intents: LeadTopicDiscoveryIntent[];
  /** Hit by the source health check; absent when there is nothing cheap to probe. */
  healthProbeUrl?: string;
  rateLimitNote?: string;
  /** Present only on retired sources; shown to users whose topics referenced them. */
  retiredReason?: string;
  /**
   * Watches specific employers the user names, rather than broadcasting across
   * a board. Useless until the user supplies a company list, and presented as a
   * long-shot rather than a steady stream.
   */
  aspirational?: boolean;
  /** The source cannot run at all until the user names at least one company. */
  requiresCompanyList?: boolean;
}

export const LEAD_DISCOVERY_SOURCE_REGISTRY: Record<
  LeadDiscoverySource,
  LeadDiscoverySourceDescriptor
> = {
  [LeadDiscoverySource.REMOTE_OK]: {
    id: LeadDiscoverySource.REMOTE_OK,
    label: 'Remote OK',
    status: 'active',
    legalBasis: 'public-api',
    requiresApiKey: false,
    attributionRequired: true,
    attributionNote:
      'Remote OK terms require a followed link back to the original posting.',
    intents: [LeadTopicDiscoveryIntent.JOB_OPENINGS],
    healthProbeUrl: 'https://remoteok.com/api',
  },
  [LeadDiscoverySource.HIMALAYAS]: {
    id: LeadDiscoverySource.HIMALAYAS,
    label: 'Himalayas',
    status: 'active',
    legalBasis: 'public-api',
    requiresApiKey: false,
    attributionRequired: false,
    intents: [LeadTopicDiscoveryIntent.JOB_OPENINGS],
    healthProbeUrl: 'https://himalayas.app/jobs/api?limit=1',
  },
  [LeadDiscoverySource.WE_WORK_REMOTELY]: {
    id: LeadDiscoverySource.WE_WORK_REMOTELY,
    label: 'We Work Remotely',
    status: 'active',
    legalBasis: 'published-feed',
    requiresApiKey: false,
    attributionRequired: false,
    intents: [LeadTopicDiscoveryIntent.JOB_OPENINGS],
    healthProbeUrl: 'https://weworkremotely.com/remote-jobs.rss',
  },
  [LeadDiscoverySource.JOBICY]: {
    id: LeadDiscoverySource.JOBICY,
    label: 'Jobicy',
    status: 'active',
    legalBasis: 'public-api',
    requiresApiKey: false,
    attributionRequired: true,
    attributionNote:
      'Jobicy asks for credit on displayed listings in its API response notice.',
    intents: [LeadTopicDiscoveryIntent.JOB_OPENINGS],
    healthProbeUrl: 'https://jobicy.com/api/v2/remote-jobs?count=1',
  },
  [LeadDiscoverySource.JUST_REMOTE]: {
    id: LeadDiscoverySource.JUST_REMOTE,
    label: 'JustRemote',
    status: 'retired',
    legalBasis: 'published-feed',
    requiresApiKey: false,
    attributionRequired: false,
    intents: [LeadTopicDiscoveryIntent.JOB_OPENINGS],
    healthProbeUrl: 'https://justremote.co/jobs.xml',
    retiredReason:
      'The jobs.xml feed no longer exists — the URL now returns an HTML page, so the provider silently returned nothing.',
  },
  [LeadDiscoverySource.GOOGLE_MAPS]: {
    id: LeadDiscoverySource.GOOGLE_MAPS,
    label: 'Google Maps',
    status: 'active',
    legalBasis: 'keyed-api',
    requiresApiKey: true,
    attributionRequired: true,
    attributionNote: 'Google Places results must be attributed to Google.',
    intents: [LeadTopicDiscoveryIntent.SERVICE_BUYERS],
    rateLimitNote: 'Billable past the free tier; needs GOOGLE_MAPS_API_KEY.',
  },
  [LeadDiscoverySource.FUNDING_NEWS]: {
    id: LeadDiscoverySource.FUNDING_NEWS,
    label: 'Funding news',
    status: 'active',
    legalBasis: 'published-feed',
    requiresApiKey: false,
    attributionRequired: false,
    intents: [LeadTopicDiscoveryIntent.SERVICE_BUYERS],
    healthProbeUrl:
      'https://news.google.com/rss/search?q=series+a+funding&hl=en-US&gl=US&ceid=US:en',
    rateLimitNote:
      'Google News RSS; unauthenticated and best-effort, so treat gaps as normal.',
  },
  [LeadDiscoverySource.ARBEITNOW]: {
    id: LeadDiscoverySource.ARBEITNOW,
    label: 'Arbeitnow',
    status: 'active',
    legalBasis: 'public-api',
    requiresApiKey: false,
    attributionRequired: false,
    intents: [LeadTopicDiscoveryIntent.JOB_OPENINGS],
    healthProbeUrl: 'https://www.arbeitnow.com/api/job-board-api',
    rateLimitNote: 'Returns one large page; no key and no documented quota.',
  },
  [LeadDiscoverySource.REMOTIVE]: {
    id: LeadDiscoverySource.REMOTIVE,
    label: 'Remotive',
    status: 'active',
    legalBasis: 'public-api',
    requiresApiKey: false,
    attributionRequired: true,
    attributionNote:
      'Remotive asks that listings link back to the posting on remotive.com.',
    intents: [LeadTopicDiscoveryIntent.JOB_OPENINGS],
    healthProbeUrl: 'https://remotive.com/api/remote-jobs?limit=1',
  },
  [LeadDiscoverySource.THE_MUSE]: {
    id: LeadDiscoverySource.THE_MUSE,
    label: 'The Muse',
    status: 'active',
    legalBasis: 'public-api',
    requiresApiKey: false,
    attributionRequired: false,
    intents: [LeadTopicDiscoveryIntent.JOB_OPENINGS],
    healthProbeUrl: 'https://www.themuse.com/api/public/jobs?page=1',
    rateLimitNote:
      'Unkeyed access is rate limited; an optional API key raises the ceiling.',
  },
  [LeadDiscoverySource.HACKER_NEWS]: {
    id: LeadDiscoverySource.HACKER_NEWS,
    label: 'HN Who Is Hiring',
    status: 'active',
    legalBasis: 'public-api',
    requiresApiKey: false,
    attributionRequired: false,
    intents: [LeadTopicDiscoveryIntent.JOB_OPENINGS],
    healthProbeUrl:
      'https://hn.algolia.com/api/v1/search?tags=story&query=Ask%20HN%20Who%20is%20hiring&hitsPerPage=1',
    rateLimitNote:
      'Algolia HN index; posts come from the current monthly thread only.',
  },
  [LeadDiscoverySource.OVERPASS]: {
    id: LeadDiscoverySource.OVERPASS,
    label: 'OpenStreetMap',
    status: 'active',
    legalBasis: 'public-api',
    requiresApiKey: false,
    attributionRequired: true,
    attributionNote: '© OpenStreetMap contributors (ODbL).',
    intents: [LeadTopicDiscoveryIntent.SERVICE_BUYERS],
    healthProbeUrl:
      'https://overpass-api.de/api/interpreter?data=[out:json];out%20count;',
    rateLimitNote:
      'Shared community endpoint — keep queries area-scoped and infrequent.',
  },
  [LeadDiscoverySource.GREENHOUSE]: {
    id: LeadDiscoverySource.GREENHOUSE,
    label: 'Greenhouse (dream companies)',
    status: 'active',
    legalBasis: 'public-api',
    requiresApiKey: false,
    attributionRequired: false,
    aspirational: true,
    requiresCompanyList: true,
    intents: [LeadTopicDiscoveryIntent.JOB_OPENINGS],
    healthProbeUrl: 'https://boards-api.greenhouse.io/v1/boards/figma/jobs',
    rateLimitNote:
      'One request per company per run; only the companies you name are checked.',
  },
  [LeadDiscoverySource.LEVER]: {
    id: LeadDiscoverySource.LEVER,
    label: 'Lever (dream companies)',
    status: 'active',
    legalBasis: 'public-api',
    requiresApiKey: false,
    attributionRequired: false,
    aspirational: true,
    requiresCompanyList: true,
    intents: [LeadTopicDiscoveryIntent.JOB_OPENINGS],
    healthProbeUrl: 'https://api.lever.co/v0/postings/leverdemo?mode=json',
    rateLimitNote:
      'One request per company per run; only the companies you name are checked.',
  },
  [LeadDiscoverySource.CRUNCHBASE]: {
    id: LeadDiscoverySource.CRUNCHBASE,
    label: 'Crunchbase (retired label)',
    status: 'retired',
    legalBasis: 'search-derived',
    requiresApiKey: false,
    attributionRequired: false,
    intents: [LeadTopicDiscoveryIntent.SERVICE_BUYERS],
    retiredReason:
      'Never fetched Crunchbase data — it queried Google News and filtered by domain. Renamed to "Funding news" so the label matches the data.',
  },
  [LeadDiscoverySource.CLUTCH]: {
    id: LeadDiscoverySource.CLUTCH,
    label: 'Clutch',
    status: 'retired',
    legalBasis: 'search-derived',
    requiresApiKey: false,
    attributionRequired: false,
    intents: [LeadTopicDiscoveryIntent.SERVICE_BUYERS],
    healthProbeUrl: 'https://clutch.co/web-developers',
    retiredReason:
      'clutch.co answers server requests with an HTTP 403 Cloudflare challenge, so listings could never be read. There is no public API.',
  },
  [LeadDiscoverySource.INDEED]: {
    id: LeadDiscoverySource.INDEED,
    label: 'Indeed',
    status: 'retired',
    legalBasis: 'search-derived',
    requiresApiKey: false,
    attributionRequired: false,
    intents: [LeadTopicDiscoveryIntent.JOB_OPENINGS],
    healthProbeUrl: 'https://www.indeed.com/jobs?q=react',
    retiredReason:
      'indeed.com answers server requests with HTTP 403, the Publisher API is discontinued, and scraping breaches their terms.',
  },
};

export const ALL_LEAD_DISCOVERY_SOURCES = Object.values(
  LEAD_DISCOVERY_SOURCE_REGISTRY
);

/** The only sources a new topic may be configured with. */
export const ACTIVE_LEAD_DISCOVERY_SOURCES: LeadDiscoverySource[] =
  ALL_LEAD_DISCOVERY_SOURCES.filter(
    (descriptor) => descriptor.status === 'active'
  ).map((descriptor) => descriptor.id);

export const RETIRED_LEAD_DISCOVERY_SOURCES: LeadDiscoverySource[] =
  ALL_LEAD_DISCOVERY_SOURCES.filter(
    (descriptor) => descriptor.status === 'retired'
  ).map((descriptor) => descriptor.id);

export function getLeadSourceDescriptor(
  source: LeadDiscoverySource
): LeadDiscoverySourceDescriptor | undefined {
  return LEAD_DISCOVERY_SOURCE_REGISTRY[source];
}

export function isRetiredLeadSource(source: LeadDiscoverySource): boolean {
  return getLeadSourceDescriptor(source)?.status === 'retired';
}

export function getLeadSourceLabel(source: LeadDiscoverySource): string {
  return getLeadSourceDescriptor(source)?.label || String(source);
}

/** Active sources that can serve a given discovery intent. */
export function getSourcesForIntent(
  intent: LeadTopicDiscoveryIntent
): LeadDiscoverySource[] {
  return ALL_LEAD_DISCOVERY_SOURCES.filter(
    (descriptor) =>
      descriptor.status === 'active' && descriptor.intents.includes(intent)
  ).map((descriptor) => descriptor.id);
}

/** Sources whose terms require visible credit wherever their results are shown. */
export function getAttributionRequiredSources(): LeadDiscoverySourceDescriptor[] {
  return ALL_LEAD_DISCOVERY_SOURCES.filter(
    (descriptor) => descriptor.attributionRequired
  );
}

/**
 * Strips retired sources from a stored topic and substitutes sensible active
 * ones when that would otherwise leave it with nothing to search.
 */
export function migrateTopicSources(
  sources: LeadDiscoverySource[] | undefined,
  intent: LeadTopicDiscoveryIntent
): LeadDiscoverySource[] {
  const kept = (sources || []).filter((source) => !isRetiredLeadSource(source));
  if (kept.length) {
    return Array.from(new Set(kept));
  }
  return getSourcesForIntent(intent);
}

// Guards against a source being added to the enum but not described here.
const _registryIsExhaustive: Record<
  LeadDiscoverySource,
  LeadDiscoverySourceDescriptor
> = LEAD_DISCOVERY_SOURCE_REGISTRY;
void _registryIsExhaustive;

/**
 * Which ATS hosts a company's job board. Both expose a public, keyless postings
 * endpoint keyed by a board token.
 */
export type AspirationalAtsProvider = 'greenhouse' | 'lever';

/**
 * A company the user specifically wants to work for.
 *
 * Unlike every other source, these do not broadcast — they watch a named
 * employer's own board. The token is stored only after it has been verified
 * against the live API, because a company's name is frequently not its board
 * token ("Clean Harbors" is not `cleanharbors`) and an unverified guess would
 * 404 silently forever.
 */
export interface AspirationalCompany {
  provider: AspirationalAtsProvider;
  /** The verified board token, e.g. `figma`. */
  token: string;
  /** What the user calls the company, for display. */
  label: string;
}

export const ASPIRATIONAL_SOURCES: LeadDiscoverySource[] = [
  LeadDiscoverySource.GREENHOUSE,
  LeadDiscoverySource.LEVER,
];

export const isAspirationalSource = (source: LeadDiscoverySource): boolean =>
  ASPIRATIONAL_SOURCES.includes(source);
