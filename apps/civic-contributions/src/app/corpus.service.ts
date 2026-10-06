import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
  CorpusIndex,
  type CorpusDocument,
  type PrimaryRecord,
  type SubjectOption,
} from '@optimistic-tanuki/civic-community';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';

/**
 * What the pipeline has published, asked of civic-briefing over TCP: the news
 * articles a contribution must not copy, and the meetings and stories a
 * contribution can attach to. civic-contributions keeps no copy of the
 * corpus beyond the copying index, which is rebuilt from the briefing
 * service hourly.
 *
 * `available` says whether the last refresh succeeded. A failed refresh
 * keeps the previous index, so a briefing outage never empties it; but with
 * no successful refresh at all, intake says copying cannot be checked
 * rather than passing everything.
 */

/** The desk a subject belongs to when its source does not say. */
export const DEFAULT_TOPIC = 'government';
/** How often the index is rebuilt, as the pipeline publishes. */
export const REFRESH_MS = 60 * 60 * 1000;
/** The news corpus is the one large reply, so it is given room. */
const NEWS_TIMEOUT_MS = 60_000;
const QUERY_TIMEOUT_MS = 15_000;

export const CIVIC_BRIEFING_CLIENT = 'CIVIC_BRIEFING_CLIENT';

export type BriefingClient = Pick<ClientProxy, 'send'> &
  Partial<Pick<ClientProxy, 'close'>>;

@Injectable()
export class CorpusService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(CorpusService.name);
  private index = new CorpusIndex([]);
  private lastRefreshSucceeded = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(CIVIC_BRIEFING_CLIENT) private readonly briefing: BriefingClient
  ) {}

  async onModuleInit(): Promise<void> {
    // Startup does not wait on, or fail with, civic-briefing.
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.briefing.close?.();
  }

  /** Whether copying can be checked: the last refresh from civic-briefing succeeded. */
  get available(): boolean {
    return this.lastRefreshSucceeded;
  }

  get indexed(): number {
    return this.index.size;
  }

  /** Rebuilds the copying index. A failure is logged and the previous index kept. */
  async refresh(): Promise<void> {
    try {
      const documents = await this.ask<CorpusDocument[]>(
        CivicBriefingCommands.CORPUS_NEWS,
        {},
        NEWS_TIMEOUT_MS
      );
      this.index = new CorpusIndex(documents);
      this.lastRefreshSucceeded = true;
      this.logger.log(`copying index holds ${this.index.size} articles`);
    } catch (error) {
      this.lastRefreshSucceeded = false;
      this.logger.error(
        `corpus refresh failed, keeping the previous index of ${
          this.index.size
        } articles: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  check(text: string) {
    return this.index.check(text);
  }

  /** Recent meetings and current stories in a town, for a contribution to attach to. */
  async subjects(localitySlug: string): Promise<SubjectOption[]> {
    return await this.ask<SubjectOption[]>(CivicBriefingCommands.SUBJECTS, {
      localitySlug,
    });
  }

  async subjectExists(
    localitySlug: string,
    kind: 'meeting' | 'story',
    ref: string
  ): Promise<boolean> {
    return (await this.subjects(localitySlug)).some(
      (option) => option.kind === kind && option.ref === ref
    );
  }

  /**
   * The subject area a contribution belongs to, from the desk of what it is
   * about. Standing is earned per topic, so this decides where being right
   * counts. A subject with no desk behind it belongs to government.
   */
  async topicFor(
    localitySlug: string,
    subject: { kind: string; ref: string | null }
  ): Promise<string> {
    return (
      (await this.ask<string | null>(CivicBriefingCommands.TOPIC_FOR, {
        localitySlug,
        subject,
      })) || DEFAULT_TOPIC
    );
  }

  /**
   * What the town's sources published on or after a day: the paperwork and
   * the local reporting a contribution can be checked against.
   */
  async recordsSince(
    localitySlug: string,
    day: string,
    limit = 200
  ): Promise<PrimaryRecord[]> {
    return await this.ask<PrimaryRecord[]>(
      CivicBriefingCommands.RECORDS_SINCE,
      { localitySlug, day, limit }
    );
  }

  private async ask<T>(
    cmd: string,
    payload: unknown,
    timeoutMs = QUERY_TIMEOUT_MS
  ): Promise<T> {
    return await firstValueFrom(
      this.briefing.send<T>({ cmd }, payload).pipe(timeout(timeoutMs))
    );
  }
}
