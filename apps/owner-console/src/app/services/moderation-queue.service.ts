import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { ListingReportReviewItem } from '@optimistic-tanuki/social-contracts';
import {
  Observable,
  catchError,
  from,
  map,
  mergeMap,
  of,
  throwError,
  toArray,
} from 'rxjs';
import { DirectoryAdminService } from './directory-admin.service';
import { ForumModerationReport, ForumService } from './forum.service';
import {
  ModerationReport,
  SocialGovernanceService,
} from './social-governance.service';
import { TownContextService } from './town-context.service';

export type ModerationSource = 'social' | 'forum' | 'directory' | 'daylight';

export const MODERATION_SOURCES: readonly ModerationSource[] = [
  'social',
  'forum',
  'directory',
  'daylight',
];

export const SOURCE_LABELS: Record<ModerationSource, string> = {
  social: 'Social',
  forum: 'Forum',
  directory: 'Directory listing',
  daylight: 'Daylight takedown',
};

/** Directory list calls running at once, across towns. */
export const DIRECTORY_CONCURRENCY = 4;
/** The directory service returns at most this many reports per call. */
export const DIRECTORY_PAGE_LIMIT = 100;

export const TAKEDOWN_NOTICES_URL =
  '/api/local-hub/operations/takedown-notices';

export type ModerationActionId = 'dismiss' | 'decline' | 'uphold';

export interface ModerationLink {
  commands: string[];
  queryParams: Record<string, string>;
}

/** One report from any source, in one shape. */
export interface ModerationItem {
  /** Unique across sources. */
  key: string;
  id: string;
  source: ModerationSource;
  sourceLabel: string;
  townId: string | null;
  townName: string;
  subject: string;
  reason: string;
  reportedAt: string | null;
  status: string;
  statusLabel: string;
  /** Still waiting on the owner. */
  open: boolean;
  /** Existing page that shows this item; null where none exists. */
  link: ModerationLink | null;
}

export interface SourceState {
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  error?: string;
  /** Lists were cut off at the service's page size, so more may exist. */
  capped: boolean;
  /** Towns whose directory reports could not be read. */
  failedTowns: string[];
}

export interface ModerationLoadOptions {
  /** One town, or null for every town (directory reports only). */
  townId: string | null;
  /** Also fetch handled directory reports (social, forum, takedowns always return all). */
  includeClosed: boolean;
}

interface SourceResult {
  items: ModerationItem[];
  capped?: boolean;
  failedTowns?: string[];
}

const idle = (): SourceState => ({
  status: 'idle',
  capped: false,
  failedTowns: [],
});

const emptyBySource = (): Record<ModerationSource, ModerationItem[]> => ({
  social: [],
  forum: [],
  directory: [],
  daylight: [],
});

const asDate = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  const time = new Date(value as string).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

const titleCase = (value: string): string =>
  value
    ? (value.charAt(0).toUpperCase() + value.slice(1)).replace(/[-_]/g, ' ')
    : '';

const shorten = (value: string, max = 80): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const rowsOf = <T>(body: unknown): T[] => {
  if (!Array.isArray(body)) throw new Error('Unexpected reply');
  return body as T[];
};

const CONTENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  reviewed: 'Reviewed',
  actioned: 'Actioned',
  dismissed: 'Dismissed',
};

const DIRECTORY_STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  under_review: 'Under review',
  resolved: 'Resolved',
  declined: 'Declined',
};

const TAKEDOWN_STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  upheld: 'Upheld',
  declined: 'Declined',
};

export function normaliseContentReport(
  source: 'social' | 'forum',
  report: ModerationReport | ForumModerationReport
): ModerationItem {
  const detail = report.description?.trim();
  const base = `${titleCase(report.contentType)} ${report.contentId}`;
  return {
    key: `${source}:${report.id}`,
    id: report.id,
    source,
    sourceLabel: SOURCE_LABELS[source],
    townId: null,
    townName: '',
    subject: detail ? `${base}: ${shorten(detail)}` : base,
    reason: titleCase(report.reason ?? ''),
    reportedAt: asDate(report.createdAt),
    status: report.status,
    statusLabel:
      CONTENT_STATUS_LABELS[report.status] ?? titleCase(report.status),
    open: report.status === 'pending',
    link: {
      commands: [
        source === 'social'
          ? '/dashboard/social-governance'
          : '/dashboard/forum-governance',
      ],
      queryParams: { focus: report.id },
    },
  };
}

export function normaliseDirectoryReport(
  report: ListingReportReviewItem,
  town: { id: string; name: string }
): ModerationItem {
  const open = report.status === 'received' || report.status === 'under_review';
  return {
    key: `directory:${town.id}:${report.reportId}`,
    id: report.reportId,
    source: 'directory',
    sourceLabel: SOURCE_LABELS.directory,
    townId: town.id,
    townName: town.name,
    subject: report.listingName || 'Unnamed listing',
    reason: titleCase(report.reasonCode ?? ''),
    reportedAt: asDate(report.createdAt),
    status: report.status,
    statusLabel: DIRECTORY_STATUS_LABELS[report.status] ?? report.status,
    open,
    link: {
      commands: ['/dashboard/towns', town.id, 'directory-listing-reports'],
      // The page lists open reports unless told which status to show.
      queryParams: open
        ? { focus: report.reportId }
        : { focus: report.reportId, status: report.status },
    },
  };
}

interface TakedownNotice {
  id: string;
  claimantName?: string;
  work?: string;
  state: string;
  receivedAt?: string;
}

export function normaliseTakedown(notice: TakedownNotice): ModerationItem {
  return {
    key: `daylight:${notice.id}`,
    id: notice.id,
    source: 'daylight',
    sourceLabel: SOURCE_LABELS.daylight,
    townId: null,
    townName: '',
    subject: shorten(notice.work?.trim() || 'Copyright notice'),
    reason: notice.claimantName
      ? `Copyright notice from ${notice.claimantName}`
      : 'Copyright notice',
    reportedAt: asDate(notice.receivedAt),
    status: notice.state,
    statusLabel:
      TAKEDOWN_STATUS_LABELS[notice.state] ?? titleCase(notice.state),
    open: notice.state === 'received',
    // Notices are not tied to a town, so open Daylight for every town.
    link: { commands: ['/dashboard/daylight'], queryParams: {} },
  };
}

/** Oldest open item first; handled items follow, oldest first. */
export function sortModerationItems(
  items: readonly ModerationItem[]
): ModerationItem[] {
  const time = (item: ModerationItem) =>
    item.reportedAt ? new Date(item.reportedAt).getTime() : Infinity;
  return [...items].sort((a, b) => {
    if (a.open !== b.open) return a.open ? -1 : 1;
    return time(a) - time(b);
  });
}

export interface ModerationFilters {
  /** Empty means every source. */
  sources: readonly ModerationSource[];
  /** Null means every town; social, forum and takedowns have no town. */
  townId: string | null;
  status: 'open' | 'all';
  text: string;
}

export function filterModerationItems(
  items: readonly ModerationItem[],
  filters: ModerationFilters
): ModerationItem[] {
  const text = filters.text.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.sources.length && !filters.sources.includes(item.source))
      return false;
    if (filters.townId && item.townId && item.townId !== filters.townId)
      return false;
    if (filters.townId && item.townId === null && item.source === 'directory')
      return false;
    if (filters.status === 'open' && !item.open) return false;
    if (text) {
      const haystack =
        `${item.sourceLabel} ${item.townName} ${item.subject} ${item.reason} ${item.statusLabel}`.toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    return true;
  });
}

/** Quick actions offered on a row; only those with an existing endpoint. */
export function actionsFor(
  item: ModerationItem
): { id: ModerationActionId; label: string }[] {
  if (!item.open) return [];
  switch (item.source) {
    case 'social':
    case 'forum':
      return [{ id: 'dismiss', label: 'Dismiss' }];
    case 'directory':
      return [{ id: 'decline', label: 'Decline' }];
    case 'daylight':
      return [
        { id: 'decline', label: 'Decline' },
        { id: 'uphold', label: 'Uphold' },
      ];
  }
}

/**
 * Every moderation source in one list. Each source is fetched on its own, so
 * one that fails is marked unavailable while the others still show. A failure
 * is never turned into an empty list.
 */
@Injectable({ providedIn: 'root' })
export class ModerationQueueService {
  private readonly http = inject(HttpClient);
  private readonly social = inject(SocialGovernanceService);
  private readonly forum = inject(ForumService);
  private readonly directory = inject(DirectoryAdminService);
  private readonly towns = inject(TownContextService);

  private readonly bySource = signal(emptyBySource());
  readonly states = signal<Record<ModerationSource, SourceState>>({
    social: idle(),
    forum: idle(),
    directory: idle(),
    daylight: idle(),
  });
  readonly items = computed(() =>
    MODERATION_SOURCES.flatMap((source) => this.bySource()[source])
  );
  /** False until every source has answered once, one way or the other. */
  readonly settled = computed(() =>
    MODERATION_SOURCES.every((source) => {
      const status = this.states()[source].status;
      return status === 'ready' || status === 'unavailable';
    })
  );

  private options: ModerationLoadOptions = {
    townId: null,
    includeClosed: false,
  };
  private generation: Record<ModerationSource, number> = {
    social: 0,
    forum: 0,
    directory: 0,
    daylight: 0,
  };

  load(options: ModerationLoadOptions): void {
    this.options = options;
    for (const source of MODERATION_SOURCES) this.loadSource(source);
  }

  retry(source: ModerationSource): void {
    this.loadSource(source);
  }

  loadSource(source: ModerationSource): void {
    const run = ++this.generation[source];
    this.setState(source, { ...this.states()[source], status: 'loading' });
    this.fetch(source).subscribe({
      next: (result) => {
        if (run !== this.generation[source]) return;
        this.bySource.update((all) => ({ ...all, [source]: result.items }));
        const failed = result.failedTowns ?? [];
        this.setState(source, {
          status: failed.length ? 'unavailable' : 'ready',
          error: failed.length
            ? `${failed.length} ${
                failed.length === 1 ? 'town' : 'towns'
              } could not be read`
            : undefined,
          capped: !!result.capped,
          failedTowns: failed,
        });
      },
      error: (error: unknown) => {
        if (run !== this.generation[source]) return;
        // Keep what was loaded before; show the source as unavailable, not empty.
        this.setState(source, {
          status: 'unavailable',
          error: error instanceof Error ? error.message : 'Could not be loaded',
          capped: false,
          failedTowns: [],
        });
      },
    });
  }

  /** Apply a quick action, then reflect it in the list. */
  act(
    item: ModerationItem,
    action: ModerationActionId,
    note?: string
  ): Observable<unknown> {
    let call: Observable<unknown>;
    let status: string;
    switch (item.source) {
      case 'social':
        status = 'dismissed';
        call = this.social.updateReport(item.id, { status: 'dismissed' });
        break;
      case 'forum':
        status = 'dismissed';
        call = this.forum.updateReport(item.id, { status: 'dismissed' });
        break;
      case 'directory':
        status = 'declined';
        call = this.directory.actOnListingReport(
          item.townId ?? '',
          item.id,
          'decline',
          { note: note ?? '' }
        );
        break;
      case 'daylight':
        status = action === 'uphold' ? 'upheld' : 'declined';
        call = this.http.post(`${TAKEDOWN_NOTICES_URL}/${item.id}/act`, {
          action: status,
          note: note ?? '',
        });
        break;
    }
    return call.pipe(
      map((result) => {
        this.markHandled(item, status);
        return result;
      })
    );
  }

  private markHandled(item: ModerationItem, status: string): void {
    const labels: Record<ModerationSource, Record<string, string>> = {
      social: CONTENT_STATUS_LABELS,
      forum: CONTENT_STATUS_LABELS,
      directory: DIRECTORY_STATUS_LABELS,
      daylight: TAKEDOWN_STATUS_LABELS,
    };
    this.bySource.update((all) => ({
      ...all,
      [item.source]: all[item.source].map((existing) =>
        existing.key === item.key
          ? {
              ...existing,
              status,
              statusLabel: labels[item.source][status] ?? titleCase(status),
              open: false,
            }
          : existing
      ),
    }));
  }

  private setState(source: ModerationSource, state: SourceState): void {
    this.states.update((all) => ({ ...all, [source]: state }));
  }

  private fetch(source: ModerationSource): Observable<SourceResult> {
    switch (source) {
      case 'social':
        return this.social.getReports().pipe(
          map((body) => ({
            items: rowsOf<ModerationReport>(body).map((report) =>
              normaliseContentReport('social', report)
            ),
          }))
        );
      case 'forum':
        return this.forum.getReports().pipe(
          map((body) => ({
            items: rowsOf<ForumModerationReport>(body).map((report) =>
              normaliseContentReport('forum', report)
            ),
          }))
        );
      case 'daylight':
        return this.http.get<{ data?: unknown }>(TAKEDOWN_NOTICES_URL).pipe(
          map((body) => ({
            items: rowsOf<TakedownNotice>(body?.data).map(normaliseTakedown),
          }))
        );
      case 'directory':
        return this.fetchDirectory();
    }
  }

  private fetchDirectory(): Observable<SourceResult> {
    const { townId, includeClosed } = this.options;
    const known = this.towns.towns();
    let targets: { id: string; name: string }[];
    if (townId) {
      targets = [
        known.find((town) => town.id === townId) ?? {
          id: townId,
          name: townId,
        },
      ];
    } else if (this.towns.status() === 'ready') {
      targets = known;
    } else {
      return throwError(() => new Error('Towns could not be loaded'));
    }
    const statuses = includeClosed
      ? ['open', 'resolved', 'declined']
      : ['open'];
    const calls = targets.flatMap((town) =>
      statuses.map((status) => ({ town, status }))
    );
    if (!calls.length) return of({ items: [] });

    return from(calls).pipe(
      mergeMap(
        ({ town, status }) =>
          this.directory
            .listListingReports<{ reports?: ListingReportReviewItem[] }>(
              town.id,
              status
            )
            .pipe(
              map((body) => {
                const reports = body?.reports;
                if (!Array.isArray(reports))
                  throw new Error('Unexpected reply');
                return {
                  ok: true as const,
                  town,
                  reports,
                };
              }),
              catchError(() => of({ ok: false as const, town }))
            ),
        DIRECTORY_CONCURRENCY
      ),
      toArray(),
      map((results) => {
        const items: ModerationItem[] = [];
        const failed = new Set<string>();
        let capped = false;
        const seen = new Set<string>();
        for (const result of results) {
          if (!result.ok) {
            failed.add(result.town.id);
            continue;
          }
          if (result.reports.length >= DIRECTORY_PAGE_LIMIT) capped = true;
          for (const report of result.reports) {
            const item = normaliseDirectoryReport(report, result.town);
            if (seen.has(item.key)) continue;
            seen.add(item.key);
            items.push(item);
          }
        }
        return { items, capped, failedTowns: [...failed] };
      })
    );
  }
}
