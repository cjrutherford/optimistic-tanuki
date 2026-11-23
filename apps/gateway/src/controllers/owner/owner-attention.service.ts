import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { CommunityCommands as CivicCommunityCommands } from '@optimistic-tanuki/civic-community';
import {
  AppointmentCommands,
  CommunityCommands,
  ForumModerationCommands,
  LeadCommands,
  OrderCommands,
  PrivacyCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';

/** One source gets this long before it is reported as unavailable. */
export const SOURCE_TIMEOUT_MS = 3000;
/** The whole sweep stops starting new town checks after this long. */
export const SWEEP_BUDGET_MS = 20000;
/** Most towns checked per sweep. */
export const MAX_TOWNS = 100;
/** Directory list endpoints are asked for this many rows; more is `capped`. */
export const PAGE_LIMIT = 100;
const TOWN_CONCURRENCY = 8;

export type AttentionStatus = 'ok' | 'unavailable';

export interface AttentionItem {
  /** Stable key: the console maps it to nav badges. */
  source: string;
  label: string;
  townId?: string;
  /** Null when the source could not be read. Never 0 for a failure. */
  count: number | null;
  /** True when `count` is a lower bound (the service returned a full page). */
  capped?: boolean;
  oldest: string | null;
  link: string;
  status: AttentionStatus;
  error?: string;
}

export interface AttentionReport {
  generatedAt: string;
  items: AttentionItem[];
}

interface Reading {
  count: number;
  oldest: string | null;
  capped?: boolean;
}

/** A failure whose text is safe to show the owner. */
class SourceError extends Error {}

class TimedOut extends SourceError {
  constructor() {
    super(`Timed out after ${SOURCE_TIMEOUT_MS / 1000}s`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DIRECTORY_NOT_CONFIGURED = 'Directory is not configured';

export interface AttentionActor {
  userId?: string;
  profileId?: string;
}

interface DirectoryQueue {
  source: string;
  label: string;
  page: string;
  /** Which secret authorises the internal route. */
  secret:
    | 'DIRECTORY_LOCAL_EVALUATION_SECRET'
    | 'DIRECTORY_BUSINESS_LINK_SECRET';
  read: (body: unknown) => Reading;
}

const earliest = (values: unknown[]): string | null => {
  let best: number | null = null;
  for (const value of values) {
    const time = new Date(value as string).getTime();
    if (Number.isFinite(time) && (best === null || time < best)) best = time;
  }
  return best === null ? null : new Date(best).toISOString();
};

const rows = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) throw new SourceError('Unexpected reply');
  return value as Record<string, unknown>[];
};

const asCount = (value: unknown): number => {
  if (!Number.isInteger(value) || (value as number) < 0)
    throw new SourceError('Unexpected reply');
  return value as number;
};

const lowered = (value: unknown): string =>
  typeof value === 'string' ? value.toLowerCase() : '';

/** From a page of rows: the count, or a lower bound when the page is full. */
const pageReading = (
  list: Record<string, unknown>[],
  dateKeys: string[],
  total?: unknown
): Reading => {
  const oldest = earliest(
    list.map((row) => dateKeys.map((key) => row[key]).find(Boolean))
  );
  if (Number.isInteger(total) && (total as number) >= list.length) {
    return { count: total as number, oldest };
  }
  return {
    count: list.length,
    oldest,
    ...(list.length >= PAGE_LIMIT ? { capped: true } : {}),
  };
};

const DIRECTORY_QUEUES: DirectoryQueue[] = [
  {
    source: 'directory.address',
    label: 'Address review',
    page: 'directory-address-review',
    secret: 'DIRECTORY_LOCAL_EVALUATION_SECRET',
    read: (body) =>
      pageReading(rows((body as { candidates?: unknown })?.candidates), [
        'createdAt',
      ]),
  },
  {
    source: 'directory.identity',
    label: 'Identity review',
    page: 'directory-identity-review',
    secret: 'DIRECTORY_LOCAL_EVALUATION_SECRET',
    read: (body) => {
      const health = (body as { health?: Record<string, unknown> })?.health;
      if (!health || typeof health !== 'object')
        throw new SourceError('Unexpected reply');
      return {
        count:
          asCount(health['unresolved']) +
          asCount(health['awaitingOwner']) +
          asCount(health['carriedUnbound']),
        oldest: null,
      };
    },
  },
  {
    source: 'directory.links',
    label: 'Link review',
    page: 'directory-link-review',
    secret: 'DIRECTORY_BUSINESS_LINK_SECRET',
    read: (body) => {
      const result = body as { requests?: unknown; nextCursor?: unknown };
      const reading = pageReading(rows(result?.requests), [
        'createdAt',
        'requestedAt',
      ]);
      // The service pages by cursor and gives no total.
      return result?.nextCursor ? { ...reading, capped: true } : reading;
    },
  },
  {
    source: 'directory.duplicates',
    label: 'Duplicate review',
    page: 'directory-duplicates',
    secret: 'DIRECTORY_LOCAL_EVALUATION_SECRET',
    read: (body) => {
      const result = body as { cases?: unknown; total?: unknown };
      return pageReading(rows(result?.cases), ['createdAt'], result?.total);
    },
  },
  {
    source: 'directory.reports',
    label: 'Listing reports',
    page: 'directory-listing-reports',
    secret: 'DIRECTORY_LOCAL_EVALUATION_SECRET',
    read: (body) =>
      pageReading(rows((body as { reports?: unknown })?.reports), [
        'createdAt',
      ]),
  },
  {
    source: 'directory.suppressions',
    label: 'Listing suppressions',
    page: 'directory-listing-suppressions',
    secret: 'DIRECTORY_LOCAL_EVALUATION_SECRET',
    read: (body) => {
      // Not a work queue: counts the suppressions still in force.
      const active = rows(
        (body as { suppressions?: unknown })?.suppressions
      ).filter((row) => !row['liftedAt']);
      return pageReading(active, ['createdAt']);
    },
  },
];

/** Query string per queue, kept apart so the table above stays readable. */
const DIRECTORY_PATHS: Record<string, (town: string) => string> = {
  'directory.address': (town) =>
    `/internal/local-evaluation/towns/${town}/address-review-candidates?status=needs_human&limit=${PAGE_LIMIT}`,
  'directory.identity': (town) =>
    `/internal/local-evaluation/towns/${town}/business-identity-review`,
  'directory.links': (town) =>
    `/internal/local-evaluation/towns/${town}/business-link-requests`,
  'directory.duplicates': (town) =>
    `/internal/local-evaluation/towns/${town}/duplicate-cases?state=queued&limit=${PAGE_LIMIT}`,
  'directory.reports': (town) =>
    `/internal/local-evaluation/towns/${town}/listing-reports?status=open`,
  'directory.suppressions': (town) =>
    `/internal/local-evaluation/towns/${town}/listing-suppressions`,
};

/**
 * What needs the owner's attention, gathered live. Every source runs on its
 * own with a timeout; one that fails is reported as unavailable with a short,
 * non-secret reason, never as zero.
 */
@Injectable()
export class OwnerAttentionService {
  private readonly logger = new Logger(OwnerAttentionService.name);

  constructor(
    @Inject(ServiceTokens.STORE_SERVICE) private readonly store: ClientProxy,
    @Inject(ServiceTokens.SOCIAL_SERVICE) private readonly social: ClientProxy,
    @Inject(ServiceTokens.FORUM_SERVICE) private readonly forum: ClientProxy,
    @Inject(ServiceTokens.LEAD_SERVICE) private readonly leads: ClientProxy,
    @Inject(ServiceTokens.CIVIC_CONTRIBUTIONS_SERVICE)
    private readonly civicContributions: ClientProxy
  ) {}

  async collect(actor: AttentionActor): Promise<AttentionReport> {
    const deadline = Date.now() + SWEEP_BUDGET_MS;
    const groups = await Promise.all([
      this.singles(actor),
      this.directoryTowns(deadline),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      items: groups.flat(),
    };
  }

  // ---- sources that are not per town ---------------------------------------

  private singles(actor: AttentionActor): Promise<AttentionItem[]> {
    const run = (
      source: string,
      label: string,
      link: string,
      read: () => Promise<Reading>
    ) => this.run({ source, label, link }, read);
    return Promise.all([
      run(
        'moderation.social',
        'Social reports awaiting review',
        '/dashboard/social-governance',
        () => this.reports(this.social, PrivacyCommands.GET_ALL_REPORTS, true)
      ),
      run(
        'moderation.forum',
        'Forum reports awaiting review',
        '/dashboard/forum-governance',
        () =>
          this.reports(
            this.forum,
            ForumModerationCommands.GET_ALL_REPORTS,
            false
          )
      ),
      run(
        'commerce.orders',
        'Orders awaiting action',
        '/dashboard/store/orders',
        () => this.orders()
      ),
      run(
        'commerce.appointments',
        'Appointments pending approval',
        '/dashboard/store/appointments',
        () => this.appointments()
      ),
      run('leads.new', 'New leads', '/dashboard/contacts', () =>
        this.newLeads(actor)
      ),
      run(
        'directory.runs.failed',
        'Failed acquisition runs',
        '/dashboard/directory-runs',
        () => this.failedAcquisitionRuns()
      ),
      run(
        'directory.taxonomy.failed',
        'Failed taxonomy runs',
        '/dashboard/directory-taxonomy-runs',
        () => this.failedTaxonomyRuns()
      ),
      run(
        'daylight.takedowns',
        'Daylight takedown notices received',
        '/dashboard/daylight',
        () => this.takedowns()
      ),
    ]);
  }

  private async ask<T>(
    client: ClientProxy,
    command: string | { cmd: string },
    payload: unknown
  ) {
    const pattern = typeof command === 'string' ? { cmd: command } : command;
    try {
      return await firstValueFrom(
        client.send<T>(pattern, payload).pipe(timeout(SOURCE_TIMEOUT_MS))
      );
    } catch (error) {
      if ((error as { name?: string })?.name === 'TimeoutError')
        throw new TimedOut();
      throw new SourceError('Service unreachable');
    }
  }

  /** Pending reports across the app scopes that raise them. */
  private async reports(
    client: ClientProxy,
    cmd: string,
    workspaceWide: boolean
  ): Promise<Reading> {
    const scopes = ['owner-console', 'local-hub', 'client-interface'];
    const lists = await Promise.all(
      scopes.map((appScope) =>
        this.ask<unknown>(
          client,
          cmd,
          workspaceWide ? { appScope, workspaceId: undefined } : { appScope }
        )
      )
    );
    const pending = lists
      .flatMap((list) => rows(list))
      .filter((report) => report['status'] === 'pending');
    return {
      count: pending.length,
      oldest: earliest(pending.map((r) => r['createdAt'])),
    };
  }

  private async orders(): Promise<Reading> {
    const orders = rows(
      await this.ask<unknown>(this.store, OrderCommands.FIND_ALL_ORDERS, {})
    );
    const open = orders.filter(
      (order) =>
        !['complete', 'completed', 'fulfilled', 'cancelled'].includes(
          lowered(order['status'])
        )
    );
    return {
      count: open.length,
      oldest: earliest(open.map((o) => o['createdAt'])),
    };
  }

  private async appointments(): Promise<Reading> {
    const all = rows(
      await this.ask<unknown>(
        this.store,
        AppointmentCommands.FIND_ALL_APPOINTMENTS,
        {}
      )
    );
    const pending = all.filter((appointment) =>
      ['pending', 'requested', 'awaiting_approval'].includes(
        lowered(appointment['status'])
      )
    );
    return {
      count: pending.length,
      oldest: earliest(pending.map((a) => a['createdAt'] ?? a['startTime'])),
    };
  }

  private async newLeads(actor: AttentionActor): Promise<Reading> {
    if (!actor.profileId) throw new SourceError('No active leads profile');
    const leads = rows(
      await this.ask<unknown>(this.leads, LeadCommands.FIND_ALL, {
        status: 'new',
        userId: actor.userId,
        profileId: actor.profileId,
        appScope: 'owner-console',
      })
    );
    return {
      count: leads.length,
      oldest: earliest(leads.map((l) => l['createdAt'])),
    };
  }

  private async takedowns(): Promise<Reading> {
    const notices = rows(
      await this.ask<unknown>(
        this.civicContributions,
        CivicCommunityCommands.ListTakedownNotices,
        { state: 'received' }
      )
    );
    return {
      count: notices.length,
      oldest: earliest(notices.map((n) => n['receivedAt'])),
    };
  }

  private async failedAcquisitionRuns(): Promise<Reading> {
    const bodies = await Promise.all(
      ['failed_permanent', 'failed_retryable'].map((status) =>
        this.directory(
          `/internal/acquisition/runs?status=${status}&limit=${PAGE_LIMIT}`,
          'DIRECTORY_LOCAL_EVALUATION_SECRET'
        )
      )
    );
    const readings = bodies.map((body) => {
      const result = body as { runs?: unknown; total?: unknown };
      return pageReading(
        rows(result?.runs),
        ['startedAt', 'createdAt', 'queuedAt'],
        result?.total
      );
    });
    return {
      count: readings.reduce((sum, r) => sum + r.count, 0),
      oldest: earliest(readings.map((r) => r.oldest)),
      ...(readings.some((r) => r.capped) ? { capped: true } : {}),
    };
  }

  private async failedTaxonomyRuns(): Promise<Reading> {
    const body = await this.directory(
      `/internal/taxonomy/runs?limit=${PAGE_LIMIT}`,
      'DIRECTORY_LOCAL_EVALUATION_SECRET'
    );
    const all = rows((body as { runs?: unknown })?.runs);
    const failed = all.filter((run) => run['status'] === 'failed');
    return {
      ...pageReading(failed, ['updatedAt', 'createdAt', 'startedAt']),
      // Only the newest page of runs is read; older failures may sit beyond it.
      ...(all.length >= PAGE_LIMIT ? { capped: true } : {}),
    };
  }

  // ---- directory ------------------------------------------------------------

  private directoryConfig(secretName: DirectoryQueue['secret']) {
    const base = process.env['DIRECTORY_INTERNAL_URL'];
    const secret = process.env[secretName];
    if (
      process.env['DIRECTORY_LOCAL_EVALUATION'] !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    )
      throw new SourceError(DIRECTORY_NOT_CONFIGURED);
    return { base: base.replace(/\/$/, ''), secret };
  }

  private async directory(
    path: string,
    secretName: DirectoryQueue['secret']
  ): Promise<unknown> {
    const { base, secret } = this.directoryConfig(secretName);
    try {
      const response = await fetch(`${base}${path}`, {
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
        redirect: 'error',
      });
      if (!response.ok)
        throw new SourceError(`Directory answered ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error instanceof SourceError) throw error;
      if ((error as { name?: string })?.name === 'TimeoutError')
        throw new TimedOut();
      throw new SourceError('Directory unreachable');
    }
  }

  private async directoryTowns(deadline: number): Promise<AttentionItem[]> {
    const everyQueue = (error: string): AttentionItem[] =>
      DIRECTORY_QUEUES.map((queue) => ({
        source: queue.source,
        label: queue.label,
        count: null,
        oldest: null,
        link: '/dashboard/towns',
        status: 'unavailable',
        error,
      }));

    try {
      this.directoryConfig('DIRECTORY_LOCAL_EVALUATION_SECRET');
    } catch (error) {
      return everyQueue((error as Error).message);
    }

    let towns: { id: string; name: string }[];
    try {
      const list = rows(
        await this.ask<unknown>(this.social, CommunityCommands.LIST_LOCALITY, {
          appScope: undefined,
          localityType: 'city',
        })
      );
      towns = list
        .filter(
          (town) => typeof town['id'] === 'string' && UUID.test(town['id'])
        )
        .slice(0, MAX_TOWNS)
        .map((town) => ({
          id: town['id'] as string,
          name: typeof town['name'] === 'string' ? town['name'] : 'Town',
        }));
    } catch (error) {
      return everyQueue(
        error instanceof SourceError
          ? `Towns: ${error.message}`
          : 'Towns unavailable'
      );
    }

    const tasks = towns.flatMap((town) =>
      DIRECTORY_QUEUES.map((queue) => ({ town, queue }))
    );
    const out: AttentionItem[] = [];
    const skipped = new Set<string>();
    let next = 0;
    const worker = async () => {
      while (next < tasks.length) {
        const { town, queue } = tasks[next++];
        if (Date.now() > deadline) {
          skipped.add(queue.source);
          continue;
        }
        const item = await this.run(
          {
            source: queue.source,
            label: `${queue.label} (${town.name})`,
            townId: town.id,
            link: `/dashboard/towns/${town.id}/${queue.page}`,
          },
          async () =>
            queue.read(
              await this.directory(
                DIRECTORY_PATHS[queue.source](town.id),
                queue.secret
              )
            )
        );
        // A town with nothing waiting adds no row; a failure always does.
        if (item.status === 'unavailable' || item.count !== 0) out.push(item);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(TOWN_CONCURRENCY, tasks.length) }, worker)
    );
    for (const source of skipped) {
      const queue = DIRECTORY_QUEUES.find((q) => q.source === source)!;
      out.push({
        source,
        label: queue.label,
        count: null,
        oldest: null,
        link: '/dashboard/towns',
        status: 'unavailable',
        error: 'Some towns were not checked in time',
      });
    }
    return out;
  }

  // ---- plumbing --------------------------------------------------------------

  private async run(
    base: Pick<AttentionItem, 'source' | 'label' | 'link' | 'townId'>,
    read: () => Promise<Reading>
  ): Promise<AttentionItem> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const reading = await Promise.race([
        read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new TimedOut()),
            SOURCE_TIMEOUT_MS + 500
          );
        }),
      ]);
      return {
        ...base,
        count: reading.count,
        ...(reading.capped ? { capped: true } : {}),
        oldest: reading.oldest,
        status: 'ok',
      };
    } catch (error) {
      if (!(error instanceof SourceError)) {
        this.logger.warn(`attention source ${base.source} failed`);
      }
      return {
        ...base,
        count: null,
        oldest: null,
        status: 'unavailable',
        error:
          error instanceof SourceError ? error.message : 'Source unavailable',
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
