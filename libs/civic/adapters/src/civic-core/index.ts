import type {
  DraftItem,
  FetchResult,
  RawDocumentInput,
  SourceAdapter,
  SourceConfig,
} from '@optimistic-tanuki/civic-core';
import type {
  CivicAgendaRecord,
  CivicBroadcastRecord,
  CivicCoreClient,
  CivicTipProjectRecord,
} from './client.js';

export type {
  CivicAgendaItemRecord,
  CivicAgendaRecord,
  CivicBroadcastRecord,
  CivicCoreClient,
  CivicTenantKind,
  CivicTenantRecord,
  CivicTipProjectRecord,
} from './client.js';

/** Source config for a civic-core source (`SourceConfig.config`). */
export interface CivicCoreSourceConfig {
  tenantId: string;
}

/** Checks `source.config`; returns the usable config or a message saying what is wrong. */
export function parseCivicCoreConfig(
  source: SourceConfig
): { config: CivicCoreSourceConfig } | { error: string } {
  const tenantId = source.config?.['tenantId'];
  if (typeof tenantId !== 'string' || tenantId.trim() === '')
    return { error: 'civic-core source needs config.tenantId: a string' };
  if (/[/\s]/u.test(tenantId.trim()))
    return { error: 'config.tenantId must not contain "/" or whitespace' };
  return { config: { tenantId: tenantId.trim() } };
}

type RecordType = 'agenda' | 'broadcast' | 'tip-project';

const RECORD_TYPES = new Set<string>(['agenda', 'broadcast', 'tip-project']);

function recordUrl(tenantId: string, type: RecordType, id: string): string {
  return `civic-core:${tenantId}/${type}/${encodeURIComponent(id)}`;
}

function recordType(url: string): RecordType | null {
  const type = url.split('/')[1];
  return type && RECORD_TYPES.has(type) ? (type as RecordType) : null;
}

function failed(
  source: SourceConfig,
  url: string,
  message: string,
  retryable: boolean,
  now: Date
): FetchResult {
  return {
    kind: 'failed',
    status: null,
    url,
    requestUrl: source.url,
    contentType: 'application/json',
    fetchedAt: now.toISOString(),
    error: { kind: 'network', message, retryable },
  };
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function validDate(value: string | undefined): string | undefined {
  return value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined;
}

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Civic Core adapter: a municipality's own agendas, emergency broadcasts and
 * TIP projects, read from `apps/civic` through an injected client. Not HTTP, so
 * it is not in ALL_ADAPTERS; the service registers it with its client. Source
 * config: { tenantId: string }.
 *
 * One record per agenda, active broadcast and TIP project, keyed
 * `civic-core:<tenantId>/<type>/<id>` with the record as JSON. Broadcasts past
 * their `expiresAt` are skipped. Each of the three reads fails on its own, so
 * an outage in one does not hide the others.
 */
export function createCivicCoreAdapter(
  client: CivicCoreClient,
  options: { now?: () => Date } = {}
): SourceAdapter {
  const now = options.now ?? (() => new Date());
  return {
    name: 'civic-core',

    async fetch(source: SourceConfig): Promise<FetchResult[]> {
      const clock = now();
      const parsed = parseCivicCoreConfig(source);
      if ('error' in parsed)
        return [failed(source, source.url, parsed.error, false, clock)];
      const { tenantId } = parsed.config;
      const fetchedAt = clock.toISOString();
      const out: FetchResult[] = [];
      const text = (
        type: RecordType,
        id: string,
        record: unknown,
        date: string | undefined
      ): FetchResult => ({
        kind: 'fetched',
        status: 200,
        url: recordUrl(tenantId, type, id),
        requestUrl: source.url,
        contentType: 'application/json',
        payload: { kind: 'text', body: JSON.stringify(record) },
        fetchedAt,
        ...(validDate(date)
          ? { observedDates: [validDate(date) as string] }
          : {}),
      });
      const attempt = async <T>(
        label: string,
        read: () => Promise<T[]>,
        each: (record: T) => void
      ): Promise<void> => {
        try {
          for (const record of await read()) each(record);
        } catch (error) {
          out.push(
            failed(
              source,
              `civic-core:${tenantId}/${label}`,
              `Civic Core ${label} read failed: ${message(error)}`,
              true,
              clock
            )
          );
        }
      };
      await attempt<CivicAgendaRecord>(
        'agenda',
        () => client.agendas(tenantId),
        (agenda) =>
          out.push(text('agenda', agenda.id, agenda, agenda.meetingDate))
      );
      await attempt<CivicBroadcastRecord>(
        'broadcast',
        () => client.broadcasts(tenantId),
        (broadcast) => {
          if (
            broadcast.expiresAt &&
            Date.parse(broadcast.expiresAt) <= clock.getTime()
          )
            return;
          out.push(
            text('broadcast', broadcast.id, broadcast, broadcast.issuedAt)
          );
        }
      );
      await attempt<CivicTipProjectRecord>(
        'tip-project',
        () => client.tipProjects(tenantId),
        (project) =>
          out.push(text('tip-project', project.id, project, undefined))
      );
      return out;
    },

    async parse(
      raw: RawDocumentInput,
      source: SourceConfig
    ): Promise<DraftItem[]> {
      if (raw.payload.kind !== 'text') return [];
      const type = recordType(raw.url);
      if (!type) return [];
      let record: unknown;
      try {
        record = JSON.parse(raw.payload.body);
      } catch {
        return [];
      }
      if (typeof record !== 'object' || record === null) return [];
      // First-party and official: the town's own records, so the source's
      // desk and coverage (government, all) apply as for its own documents.
      const common = { uris: [raw.url], publisher: source.name };
      if (type === 'agenda')
        return [parseAgenda(record as CivicAgendaRecord, common)];
      if (type === 'broadcast')
        return [parseBroadcast(record as CivicBroadcastRecord, common)];
      return [parseTipProject(record as CivicTipProjectRecord, common)];
    },
  };
}

interface Common {
  uris: string[];
  publisher: string;
}

function parseAgenda(agenda: CivicAgendaRecord, common: Common): DraftItem {
  const items = (agenda.items ?? [])
    .map((item) => {
      const heading = [item.itemNumber, item.title].filter(Boolean).join(' ');
      return item.summary ? `${heading}: ${item.summary}` : heading;
    })
    .join('\n');
  const eventDate = validDate(agenda.meetingDate);
  return {
    title: agenda.title,
    body: [
      agenda.meetingBody ? `Meeting body: ${agenda.meetingBody}` : '',
      items,
    ]
      .filter(Boolean)
      .join('\n\n'),
    kind: 'meeting',
    ...(eventDate ? { eventDate, publishedAt: eventDate } : {}),
    ...common,
  };
}

function parseBroadcast(
  broadcast: CivicBroadcastRecord,
  common: Common
): DraftItem {
  const severity = broadcast.severity
    ? broadcast.severity.charAt(0).toUpperCase() + broadcast.severity.slice(1)
    : '';
  const issued = validDate(broadcast.issuedAt);
  return {
    title: severity ? `${severity}: ${broadcast.headline}` : broadcast.headline,
    body: [
      severity ? `Severity: ${severity}` : '',
      broadcast.audience ? `Audience: ${broadcast.audience}` : '',
      broadcast.body,
    ]
      .filter(Boolean)
      .join('\n'),
    kind: 'alert',
    ...(issued ? { publishedAt: issued, eventDate: issued } : {}),
    ...common,
  };
}

/** TIP projects are transportation development stories: the core's 'news' kind fits, with funding and status in the body. */
function parseTipProject(
  project: CivicTipProjectRecord,
  common: Common
): DraftItem {
  return {
    title: project.name,
    body: [
      project.description,
      `Status: ${project.status}`,
      project.milestone ? `Milestone: ${project.milestone}` : '',
      `Funding allocated: ${dollars(
        project.fundingAllocatedCents
      )}; spent: ${dollars(project.fundingSpentCents)}`,
    ]
      .filter(Boolean)
      .join('\n'),
    kind: 'news',
    topics: ['transportation', 'infrastructure'],
    ...common,
  };
}
