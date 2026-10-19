import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AccountExportParticipantSnapshot,
  ACCOUNT_EXPORT_CONTRACT_VERSION,
  ACCOUNT_EXPORT_PREVIEW_BUDGETS,
} from '@optimistic-tanuki/models';
import {
  AuthCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import type { OwnedAccountProfileIdPage } from '@optimistic-tanuki/profile-contracts';
import validator from 'validator';
import { In, MoreThan, Repository } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { Topic } from '../entities/topic.entity';
import { Thread } from '../entities/thread.entity';
import { ForumPost } from '../entities/forum-post.entity';

const RPC_TIMEOUT_MS = 3000;
const ID_PAGE_SIZE = 100;
const MAX_PROFILE_PAGES = 10;
const MAX_PROFILE_IDS = 1000;
const MAX_ROWS_PER_TYPE = 1000;
const QUERY_PAGE_SIZE = 100;
const READ_BUDGET_MS = 15000;
const MAX_STRING = ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxStringFieldCharacters;
const MAX_BYTES = ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxParticipantSerializedBytes;
const validUuid = (value: unknown): value is string =>
  typeof value === 'string' && validator.isUUID(value, 4);

function withReadDeadline<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('read budget exceeded')),
      timeoutMs
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

type ForumRow = Record<string, unknown>;
type RowRepository =
  | Repository<Topic>
  | Repository<Thread>
  | Repository<ForumPost>;

const FIELDS = {
  topics: [
    'id',
    'userId',
    'profileId',
    'appScope',
    'title',
    'description',
    'createdAt',
    'updatedAt',
    'visibility',
  ],
  threads: [
    'id',
    'userId',
    'profileId',
    'appScope',
    'title',
    'description',
    'content',
    'topicId',
    'createdAt',
    'updatedAt',
    'visibility',
  ],
  posts: [
    'id',
    'userId',
    'profileId',
    'appScope',
    'content',
    'threadId',
    'createdAt',
    'updatedAt',
  ],
} as const;

@Injectable()
export class ForumAccountExportService {
  constructor(
    @Inject(getRepositoryToken(Topic))
    private readonly topics: Repository<Topic>,
    @Inject(getRepositoryToken(Thread))
    private readonly threads: Repository<Thread>,
    @Inject(getRepositoryToken(ForumPost))
    private readonly posts: Repository<ForumPost>,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly auth: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE) private readonly profile: ClientProxy
  ) {}

  async getAccountExportSnapshot(
    accountId: unknown,
    session: { token?: unknown; appId?: unknown }
  ): Promise<AccountExportParticipantSnapshot<Record<string, ForumRow[]>>> {
    if (!validUuid(accountId))
      throw new RpcException('Invalid account export subject');
    if (
      typeof session?.token !== 'string' ||
      !session.token.trim() ||
      typeof session?.appId !== 'string' ||
      !session.appId.trim()
    )
      throw new RpcException('Invalid account export session');

    const startedAt = Date.now();
    let validation: any;
    try {
      const remaining = READ_BUDGET_MS - (Date.now() - startedAt);
      if (remaining <= 0) throw new Error('read budget exceeded');
      validation = await firstValueFrom(
        this.auth
          .send(
            { cmd: AuthCommands.Validate },
            { token: session.token, userId: accountId, appId: session.appId }
          )
          .pipe(timeout({ first: Math.min(RPC_TIMEOUT_MS, remaining) }))
      );
    } catch {
      throw new RpcException('Invalid account export session');
    }
    if (
      validation?.isValid !== true ||
      validation?.data?.userId !== accountId
    ) {
      throw new RpcException('Invalid account export session');
    }

    const uncovered = new Set<string>([
      'forum-preview-unfenced',
      'forum-links-unreviewed',
      'forum-reports-and-moderation-uncovered',
      'forum-media-references-unresolved',
      'embedded-media-and-link-references-unresolved',
      'forum-legacy-authorship-provenance-unverified',
    ]);
    const data: Record<string, ForumRow[]> = {
      topics: [],
      threads: [],
      posts: [],
    };
    const profileIds: string[] = [];
    const seenProfiles = new Set<string>();
    let cursor: string | undefined;
    let profilePageCount = 0;
    try {
      while (true) {
        if (profilePageCount >= MAX_PROFILE_PAGES) {
          uncovered.add('profile-id-preview-limit-exceeded');
          break;
        }
        const remaining = READ_BUDGET_MS - (Date.now() - startedAt);
        if (remaining <= 0) throw new Error('budget');
        const page = (await firstValueFrom(
          this.profile
            .send(
              { cmd: ProfileCommands.GetOwnedAccountProfileIdPage },
              {
                accountId,
                token: session.token,
                appId: session.appId,
                afterId: cursor,
                limit: ID_PAGE_SIZE,
              }
            )
            .pipe(timeout({ first: Math.min(RPC_TIMEOUT_MS, remaining) }))
        )) as OwnedAccountProfileIdPage;
        profilePageCount += 1;
        if (
          !page ||
          page.accountId !== accountId ||
          page.unfenced !== true ||
          !Array.isArray(page.profileIds) ||
          page.profileIds.length > ID_PAGE_SIZE ||
          typeof page.hasMore !== 'boolean' ||
          (page.nextCursor !== null && !validUuid(page.nextCursor)) ||
          page.profileIds.some((id) => !validUuid(id)) ||
          (page.hasMore &&
            (!page.nextCursor ||
              page.nextCursor === cursor ||
              page.nextCursor !== page.profileIds.at(-1))) ||
          (!page.hasMore && page.nextCursor !== null)
        )
          throw new Error('malformed profile page');
        let previous = cursor;
        for (const id of page.profileIds) {
          if ((previous && id <= previous) || seenProfiles.has(id))
            throw new Error('unordered profile page');
          previous = id;
        }
        for (const id of page.profileIds) {
          if (profileIds.length === MAX_PROFILE_IDS) {
            uncovered.add('profile-id-preview-limit-exceeded');
            break;
          }
          profileIds.push(id);
          seenProfiles.add(id);
        }
        if (profileIds.length >= MAX_PROFILE_IDS && page.hasMore) {
          uncovered.add('profile-id-preview-limit-exceeded');
          break;
        }
        if (profilePageCount >= MAX_PROFILE_PAGES && page.hasMore) {
          uncovered.add('profile-id-preview-limit-exceeded');
          break;
        }
        cursor = page.nextCursor ?? undefined;
        if (!page.hasMore) break;
      }
    } catch {
      uncovered.add('profile-id-resolution-failed');
      if (Date.now() - startedAt >= READ_BUDGET_MS)
        uncovered.add('forum-read-time-budget-exceeded');
      return this.finish(accountId, uncovered, data);
    }

    if (profileIds.length > 0) {
      await this.readRows(
        'topics',
        this.topics,
        FIELDS.topics,
        accountId,
        profileIds,
        startedAt,
        uncovered,
        data
      );
      await this.readRows(
        'threads',
        this.threads,
        FIELDS.threads,
        accountId,
        profileIds,
        startedAt,
        uncovered,
        data
      );
      await this.readRows(
        'posts',
        this.posts,
        FIELDS.posts,
        accountId,
        profileIds,
        startedAt,
        uncovered,
        data
      );
    }
    return this.finish(accountId, uncovered, data);
  }

  private async readRows(
    key: 'topics' | 'threads' | 'posts',
    repository: RowRepository,
    fields: readonly string[],
    accountId: string,
    profileIds: string[],
    startedAt: number,
    uncovered: Set<string>,
    data: Record<string, ForumRow[]>
  ): Promise<void> {
    const rows: ForumRow[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    let scanned = 0;
    while (scanned <= MAX_ROWS_PER_TYPE) {
      const remaining = READ_BUDGET_MS - (Date.now() - startedAt);
      if (remaining <= 0) {
        uncovered.add('forum-read-time-budget-exceeded');
        break;
      }
      const take = Math.min(QUERY_PAGE_SIZE, MAX_ROWS_PER_TYPE + 1 - scanned);
      let page: ForumRow[];
      try {
        page = await withReadDeadline(
          repository.find({
            where: {
              userId: accountId,
              profileId: In(profileIds),
              ...(cursor ? { id: MoreThan(cursor) } : {}),
            },
            order: { id: 'ASC' },
            take,
            select: Object.fromEntries(
              fields.map((field) => [field, true])
            ) as never,
            loadEagerRelations: false,
            relations: [],
          }) as unknown as Promise<ForumRow[]>,
          remaining
        );
      } catch {
        uncovered.add(`${key}-read-failed`);
        if (Date.now() - startedAt >= READ_BUDGET_MS)
          uncovered.add('forum-read-time-budget-exceeded');
        break;
      }
      if (!Array.isArray(page)) {
        uncovered.add(`${key}-malformed-or-duplicate-row`);
        break;
      }
      let previousId = cursor;
      let orderedPage = true;
      for (const row of page) {
        if (
          !row ||
          !validUuid(row.id) ||
          (previousId && row.id <= previousId)
        ) {
          orderedPage = false;
          break;
        }
        previousId = row.id;
      }
      if (!orderedPage) {
        uncovered.add(`${key}-malformed-or-duplicate-row`);
        break;
      }
      const candidates = page.slice(
        0,
        Math.max(0, MAX_ROWS_PER_TYPE - scanned)
      );
      for (const row of candidates) {
        if (!this.isValidRow(row, fields)) {
          uncovered.add(`${key}-malformed-or-duplicate-row`);
          continue;
        }
        if (
          row.userId !== accountId ||
          !profileIds.includes(row.profileId as string)
        ) {
          uncovered.add(`${key}-owner-mismatch`);
          continue;
        }
        const rowId = row.id as string;
        if (seen.has(rowId)) {
          uncovered.add(`${key}-malformed-or-duplicate-row`);
          continue;
        }
        const projected: ForumRow = {};
        for (const field of fields) {
          const value = row[field];
          if (typeof value === 'string' && value.length > MAX_STRING) {
            uncovered.add('forum-preview-string-limit-exceeded');
            continue;
          }
          projected[field] = value;
        }
        if (Object.keys(projected).length !== fields.length) {
          uncovered.add(`${key}-malformed-or-duplicate-row`);
          continue;
        }
        seen.add(rowId);
        rows.push(projected);
      }
      scanned += page.length;
      if (page.length > candidates.length) {
        uncovered.add(`${key}-preview-limit-exceeded`);
        break;
      }
      if (page.length < take) break;
      const last = page.at(-1)?.id;
      if (!validUuid(last) || last === cursor) {
        uncovered.add(`${key}-repeated-cursor`);
        break;
      }
      cursor = last;
      if (scanned > MAX_ROWS_PER_TYPE) {
        uncovered.add(`${key}-preview-limit-exceeded`);
        break;
      }
    }
    data[key] = rows;
  }

  private isValidRow(
    row: ForumRow | null | undefined,
    fields: readonly string[]
  ) {
    if (
      !row ||
      !validUuid(row.id) ||
      !validUuid(row.userId) ||
      !validUuid(row.profileId)
    )
      return false;
    for (const field of fields) {
      const value = row[field];
      if (
        field === 'id' ||
        field === 'userId' ||
        field === 'profileId' ||
        field === 'topicId' ||
        field === 'threadId'
      ) {
        if (!validUuid(value)) return false;
      } else if (field === 'createdAt' || field === 'updatedAt') {
        if (
          !(value instanceof Date && Number.isFinite(value.getTime())) &&
          !(typeof value === 'string' && Number.isFinite(Date.parse(value)))
        )
          return false;
      } else if (field === 'visibility') {
        if (value !== 'public' && value !== 'private') return false;
      } else if (typeof value !== 'string') {
        return false;
      }
    }
    return true;
  }

  private finish(
    accountId: string,
    uncovered: Set<string>,
    data: Record<string, ForumRow[]>
  ): AccountExportParticipantSnapshot<Record<string, ForumRow[]>> {
    const snapshot = {
      contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
      participantId: 'forum',
      accountId,
      status: 'partial' as const,
      uncovered: [...uncovered].sort(),
      data,
    };
    if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > MAX_BYTES) {
      uncovered.add('forum-preview-response-budget-exceeded');
      uncovered.add('forum-preview-data-omitted-for-budget');
      return {
        ...snapshot,
        uncovered: [...uncovered].sort(),
        data: { topics: [], threads: [], posts: [] },
      };
    }
    return snapshot;
  }
}
