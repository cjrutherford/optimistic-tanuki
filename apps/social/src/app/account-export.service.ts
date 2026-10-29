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
  SocialCommands,
} from '@optimistic-tanuki/constants';
import type { OwnedAccountProfileIdPage } from '@optimistic-tanuki/profile-contracts';
import validator from 'validator';
import { In, MoreThan, Repository } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { Post } from '../entities/post.entity';
import { Comment } from '../entities/comment.entity';
import { Reaction } from '../entities/reaction.entity';
import { Vote } from '../entities/vote.entity';
import { Attachment, AttachmentType } from '../entities/attachment.entity';
import { Poll } from '../entities/poll.entity';
import { SavedItem } from '../entities/saved-item.entity';
import { SearchHistory } from '../entities/search-history.entity';
import FollowEntity from '../entities/Follow.entity';
import { UserBlock } from '../entities/user-block.entity';
import { UserMute } from '../entities/user-mute.entity';

const RPC_TIMEOUT_MS = 3000;
const MAX_IDS = 1000;
const ID_PAGE_SIZE = 100;
const MAX_ROWS = 1000;
const READ_BUDGET_MS = 15000;
const MAX_STRING = ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxStringFieldCharacters;
const MAX_BYTES = ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxParticipantSerializedBytes;
const validUuid = (value: unknown): value is string =>
  typeof value === 'string' && validator.isUUID(value, 4);

@Injectable()
export class SocialAccountExportService {
  constructor(
    @Inject(getRepositoryToken(Post)) private readonly posts: Repository<Post>,
    @Inject(getRepositoryToken(Comment))
    private readonly comments: Repository<Comment>,
    @Inject(getRepositoryToken(Reaction))
    private readonly reactions: Repository<Reaction>,
    @Inject(getRepositoryToken(Vote)) private readonly votes: Repository<Vote>,
    @Inject(getRepositoryToken(Attachment))
    private readonly attachments: Repository<Attachment>,
    @Inject(getRepositoryToken(Poll)) private readonly polls: Repository<Poll>,
    @Inject(getRepositoryToken(SavedItem))
    private readonly savedItems: Repository<SavedItem>,
    @Inject(getRepositoryToken(SearchHistory))
    private readonly searchHistory: Repository<SearchHistory>,
    @Inject(getRepositoryToken(FollowEntity))
    private readonly follows: Repository<FollowEntity>,
    @Inject(getRepositoryToken(UserBlock))
    private readonly blocks: Repository<UserBlock>,
    @Inject(getRepositoryToken(UserMute))
    private readonly mutes: Repository<UserMute>,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly auth: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profile: ClientProxy
  ) {}

  async getAccountExportSnapshot(
    accountId: unknown,
    session: { token?: unknown; appId?: unknown }
  ): Promise<AccountExportParticipantSnapshot<Record<string, unknown>>> {
    if (!validUuid(accountId))
      throw new RpcException('Invalid account export subject');
    if (
      typeof session?.token !== 'string' ||
      !session.token.trim() ||
      typeof session?.appId !== 'string' ||
      !session.appId.trim()
    )
      throw new RpcException('Invalid account export session');

    let validation: any;
    try {
      validation = await firstValueFrom(
        this.auth
          .send(
            { cmd: AuthCommands.Validate },
            { token: session.token, userId: accountId, appId: session.appId }
          )
          .pipe(timeout({ first: RPC_TIMEOUT_MS }))
      );
    } catch {
      throw new RpcException('Invalid account export session');
    }
    if (validation?.isValid !== true || validation?.data?.userId !== accountId)
      throw new RpcException('Invalid account export session');

    const startedAt = Date.now();
    const uncovered = new Set<string>([
      'social-preview-unfenced',
      'social-components-unreviewed',
      'social-poll-vote-history-uncovered',
      'poll-post-association-unverified',
      'social-account-profile-selection-ambiguous',
      'social-legacy-guardian-ownership-unverified',
      'attachment-file-references-omitted',
      'portable-media-bytes-not-included',
      'social-activity-uncovered',
      'social-user-presence-uncovered',
      'social-profile-view-uncovered',
      'social-notification-uncovered',
      'social-post-share-uncovered',
      'social-event-uncovered',
      'social-community-uncovered',
      'social-community-member-uncovered',
      'social-community-invite-uncovered',
      'social-community-membership-audit-uncovered',
      'social-community-election-uncovered',
      'social-election-candidate-uncovered',
      'social-election-vote-uncovered',
      'social-business-page-content-uncovered',
      'social-business-theme-content-uncovered',
      'social-community-sponsorship-content-uncovered',
      'social-guardian-content-audit-uncovered',
      'social-guardian-published-asset-grant-uncovered',
      'social-content-report-uncovered',
      'social-content-moderation-action-uncovered',
    ]);
    const ids: string[] = [];
    const seenProfileIds = new Set<string>();
    let cursor: string | undefined;
    let identityFailed = false;
    try {
      let resolvingProfiles = true;
      while (resolvingProfiles) {
        if (Date.now() - startedAt > READ_BUDGET_MS) throw new Error('budget');
        const remainingTime = READ_BUDGET_MS - (Date.now() - startedAt);
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
            .pipe(timeout({ first: Math.min(RPC_TIMEOUT_MS, remainingTime) }))
        )) as OwnedAccountProfileIdPage;
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
        let previousId = cursor;
        for (const profileId of page.profileIds) {
          if (
            (previousId && profileId <= previousId) ||
            seenProfileIds.has(profileId)
          )
            throw new Error('unordered or repeated profile ID');
          previousId = profileId;
        }
        page.profileIds.forEach((profileId) => seenProfileIds.add(profileId));
        ids.push(...page.profileIds);
        if (ids.length > MAX_IDS) {
          ids.length = MAX_IDS;
          uncovered.add('profile-id-preview-limit-exceeded');
          break;
        }
        if (page.hasMore && ids.length >= MAX_IDS) {
          uncovered.add('profile-id-preview-limit-exceeded');
          break;
        }
        cursor = page.nextCursor ?? undefined;
        if (!page.hasMore) resolvingProfiles = false;
      }
    } catch {
      identityFailed = true;
      uncovered.add('profile-id-resolution-failed');
      if (Date.now() - startedAt >= READ_BUDGET_MS)
        uncovered.add('social-read-time-budget-exceeded');
    }
    if (identityFailed) {
      return this.snapshot(accountId, uncovered, {
        posts: [],
        comments: [],
        reactions: [],
        votes: [],
        attachments: [],
        polls: [],
        savedItems: [],
        searchHistory: [],
        follows: [],
        blocks: [],
        mutes: [],
        portableMediaBytesIncluded: false,
      });
    }

    const profileSet = new Set(ids);
    const read = async <T>(
      label: string,
      fn: () => Promise<T[]>
    ): Promise<T[]> => {
      const remainingTime = READ_BUDGET_MS - (Date.now() - startedAt);
      if (remainingTime <= 0) {
        uncovered.add('social-read-time-budget-exceeded');
        return [];
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const rows = await Promise.race([
          fn(),
          new Promise<T[]>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Social preview read budget exceeded')),
              remainingTime
            );
          }),
        ]);
        if (!Array.isArray(rows)) throw new Error('malformed result');
        if (rows.length > MAX_ROWS)
          uncovered.add(`${label}-preview-limit-exceeded`);
        return rows.slice(0, MAX_ROWS);
      } catch {
        uncovered.add(
          Date.now() - startedAt >= READ_BUDGET_MS
            ? 'social-read-time-budget-exceeded'
            : `${label}-read-failed`
        );
        return [];
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
    const ownerRows = async <
      T extends { id: any; userId: string; profileId: string }
    >(
      label: string,
      repository: Repository<T>,
      select: string[] | Record<string, unknown>,
      relations?: string[]
    ): Promise<T[]> => {
      const accepted: T[] = [];
      const seen = new Set<string>();
      for (let offset = 0; offset < ids.length; offset += ID_PAGE_SIZE) {
        const ownedPage = ids.slice(offset, offset + ID_PAGE_SIZE);
        let cursor: string | number | undefined;
        while (true) {
          const remaining = MAX_ROWS - accepted.length;
          if (remaining <= 0) {
            uncovered.add(`${label}-preview-limit-exceeded`);
            break;
          }
          const pageSize = Math.min(100, remaining + 1);
          const rows = await read(label, () =>
            repository.find({
              where: {
                userId: accountId,
                profileId: In(ownedPage),
                ...(cursor === undefined ? {} : { id: MoreThan(cursor) }),
              } as any,
              select: select as any,
              ...(relations ? { relations } : {}),
              order: { id: 'ASC' } as any,
              take: pageSize,
            })
          );
          if (rows.length > remaining)
            uncovered.add(`${label}-preview-limit-exceeded`);
          if (rows.length > pageSize)
            uncovered.add(`${label}-preview-limit-exceeded`);
          let previous = cursor;
          let repeatedOrUnordered = false;
          for (const row of rows.slice(0, Math.min(remaining, pageSize))) {
            if (row.userId !== accountId || !profileSet.has(row.profileId)) {
              uncovered.add(`${label}-owner-mismatch`);
              continue;
            }
            const key = String(row.id);
            const validId =
              label === 'votes'
                ? Number.isInteger(row.id) && row.id > 0
                : validUuid(key);
            const ordered =
              label === 'votes'
                ? previous === undefined || row.id > previous
                : previous === undefined || key > previous;
            if (!validId || !ordered || seen.has(key)) {
              uncovered.add(`${label}-malformed-or-duplicate-row`);
              repeatedOrUnordered = true;
              continue;
            }
            seen.add(key);
            accepted.push(row);
            previous = label === 'votes' ? row.id : key;
          }
          if (rows.length > remaining || accepted.length >= MAX_ROWS) break;
          if (repeatedOrUnordered) break;
          if (rows.length < pageSize) break;
          const next = rows.at(-1)?.id;
          if (next === undefined || next === cursor) {
            uncovered.add(`${label}-repeated-cursor`);
            break;
          }
          cursor = next;
        }
        if (accepted.length >= MAX_ROWS) break;
      }
      if (accepted.length > MAX_ROWS) accepted.length = MAX_ROWS;
      return accepted;
    };

    const actorRows = async <T extends { id: string }>(
      label: string,
      repository: Repository<T>,
      actorField: 'profileId' | 'followerId' | 'blockerId' | 'muterId',
      select: string[]
    ): Promise<T[]> => {
      const accepted: T[] = [];
      const seen = new Set<string>();
      let scannedRows = 0;
      let limitReached = false;
      for (let offset = 0; offset < ids.length; offset += ID_PAGE_SIZE) {
        const ownedPage = ids.slice(offset, offset + ID_PAGE_SIZE);
        const ownedPageSet = new Set(ownedPage);
        let cursor: string | undefined;
        while (true) {
          const remaining = MAX_ROWS - scannedRows;
          const pageSize = Math.min(100, remaining + 1);
          const rows = await read(label, () =>
            repository.find({
              where: {
                [actorField]: In(ownedPage),
                ...(cursor === undefined ? {} : { id: MoreThan(cursor) }),
              } as any,
              select: select as any,
              order: { id: 'ASC' } as any,
              take: pageSize,
            })
          );
          scannedRows += Math.min(rows.length, remaining);
          let previous = cursor;
          for (const row of rows.slice(0, remaining)) {
            const key = row.id;
            if (
              !validUuid(key) ||
              (previous !== undefined && key <= previous) ||
              seen.has(key)
            ) {
              uncovered.add(`${label}-malformed-or-duplicate-row`);
              continue;
            }
            previous = key;
            seen.add(key);
            if (!ownedPageSet.has((row as any)[actorField])) {
              uncovered.add(`${label}-owner-mismatch`);
              continue;
            }
            accepted.push(row);
          }
          if (rows.length > remaining) {
            uncovered.add(`${label}-preview-limit-exceeded`);
            limitReached = true;
            break;
          }
          if (rows.length < pageSize) break;
          const next = rows.at(-1)?.id;
          if (!validUuid(next) || next === cursor) {
            uncovered.add(`${label}-repeated-cursor`);
            break;
          }
          cursor = next;
        }
        if (limitReached) break;
      }
      return accepted;
    };

    const postRows = await ownerRows('posts', this.posts, [
      'id',
      'userId',
      'profileId',
      'appScope',
      'title',
      'content',
      'createdAt',
      'updatedAt',
      'visibility',
      'publicAudienceExplicit',
      'communityId',
      'scheduledAt',
      'isScheduled',
    ]);
    const postIds = new Set(postRows.map((row) => row.id));
    const postLinksOut: Array<{
      postId: string;
      linkId: number;
      url?: string;
      appScope: string;
      assetId?: string;
      referenceOnly?: true;
    }> = [];
    const seenPostLinks = new Set<string>();
    for (
      let offset = 0;
      offset < postRows.length && postLinksOut.length < MAX_ROWS;
      offset += ID_PAGE_SIZE
    ) {
      const ids = postRows
        .slice(offset, offset + ID_PAGE_SIZE)
        .map((row) => row.id);
      const rows = await read('post-links', () =>
        this.posts.manager
          .createQueryBuilder()
          .select('post.id', 'postId')
          .addSelect('link.id', 'linkId')
          .addSelect('link.url', 'url')
          .addSelect('link.appScope', 'linkAppScope')
          .addSelect('post.appScope', 'appScope')
          .from(Post, 'post')
          .innerJoin('post.links', 'link')
          .where('post.id IN (:...ids)', { ids })
          .orderBy('post.id', 'ASC')
          .addOrderBy('link.id', 'ASC')
          .limit(MAX_ROWS - postLinksOut.length + 1)
          .getRawMany()
      );
      for (const row of rows) {
        try {
          const linkId = Number(row.linkId);
          if (
            typeof row.postId !== 'string' ||
            !validUuid(row.postId) ||
            !postIds.has(row.postId) ||
            !Number.isSafeInteger(linkId) ||
            linkId <= 0 ||
            typeof row.appScope !== 'string' ||
            row.appScope.length === 0 ||
            row.appScope.length > MAX_STRING ||
            row.linkAppScope !== row.appScope ||
            typeof row.url !== 'string' ||
            row.url.length === 0 ||
            row.url.length > 2048
          ) {
            uncovered.add('post-links-malformed-or-unowned-row');
            continue;
          }
          const associationKey = `${row.postId}:${linkId}`;
          if (seenPostLinks.has(associationKey)) {
            uncovered.add('post-links-malformed-or-unowned-row');
            continue;
          }
          const url = new URL(row.url);
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.username ||
            url.password
          ) {
            uncovered.add('post-links-malformed-or-unowned-row');
            continue;
          }
          const asset = /\/(?:api\/)?asset\/([0-9a-f-]{36})(?:[/?#]|$)/i.exec(
            row.url
          );
          if (asset && !validUuid(asset[1])) {
            uncovered.add('post-links-malformed-or-unowned-row');
            continue;
          }
          const item: any = {
            postId: row.postId,
            linkId,
            appScope: row.appScope,
          };
          seenPostLinks.add(associationKey);
          if (asset) {
            item.assetId = asset[1].toLowerCase();
            item.referenceOnly = true;
          } else item.url = url.toString();
          postLinksOut.push(item);
          if (postLinksOut.length > MAX_ROWS) {
            postLinksOut.length = MAX_ROWS;
            uncovered.add('post-links-preview-limit-exceeded');
            break;
          }
        } catch {
          uncovered.add('post-links-malformed-or-unowned-row');
        }
      }
    }
    if (postLinksOut.length >= MAX_ROWS) {
      uncovered.add('post-links-preview-limit-exceeded');
    }
    const commentRows = await ownerRows(
      'comments',
      this.comments,
      {
        id: true,
        userId: true,
        profileId: true,
        content: true,
        appScope: true,
        createdAt: true,
        updatedAt: true,
        post: { id: true },
        parent: { id: true },
      },
      ['post', 'parent']
    );
    const reactionRows = await ownerRows(
      'reactions',
      this.reactions,
      {
        id: true,
        userId: true,
        profileId: true,
        value: true,
        appScope: true,
        createdAt: true,
        post: { id: true },
        comment: { id: true },
      },
      ['post', 'comment']
    );
    const voteRows = await ownerRows(
      'votes',
      this.votes,
      {
        id: true,
        userId: true,
        profileId: true,
        value: true,
        appScope: true,
        post: { id: true },
        comment: { id: true },
      },
      ['post', 'comment']
    );
    const ownedComments = new Set(commentRows.map((row) => row.id));
    const commentsOut = commentRows.flatMap((row) => {
      const postTarget = (row.post as any)?.id;
      if (!validUuid(postTarget)) {
        uncovered.add('comments-orphan-or-malformed-relation');
        return [];
      }
      if (row.parent && !ownedComments.has((row.parent as any).id))
        uncovered.add('foreign-parent-comment-reference-omitted');
      return [
        {
          id: row.id,
          profileId: row.profileId,
          postId: postTarget,
          content: row.content,
          appScope: row.appScope,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          ...(row.parent && ownedComments.has((row.parent as any).id)
            ? { parentId: (row.parent as any).id }
            : {}),
        },
      ];
    });
    const verifiedTargets = async (
      rows: any[],
      targetName: 'post' | 'comment',
      repo: Repository<any>
    ) => {
      const targetIds = [
        ...new Set(rows.map((row) => row[targetName]?.id).filter(validUuid)),
      ];
      if (!targetIds.length) return new Set<string>();
      const found = await read(`${targetName}-target-existence`, () =>
        repo.find({
          where: { id: In(targetIds) },
          select: ['id'],
          take: targetIds.length + 1,
        })
      );
      return new Set(
        found.filter((row) => validUuid(row.id)).map((row) => row.id)
      );
    };
    const reactionPostIds = await verifiedTargets(
      reactionRows,
      'post',
      this.posts
    );
    const reactionCommentIds = await verifiedTargets(
      reactionRows,
      'comment',
      this.comments
    );
    const votePostIds = await verifiedTargets(voteRows, 'post', this.posts);
    const voteCommentIds = await verifiedTargets(
      voteRows,
      'comment',
      this.comments
    );
    const projectTargets = (
      rows: any[],
      existsPost: Set<string>,
      existsComment: Set<string>,
      label: string
    ) =>
      rows.flatMap((row) => {
        const p = row.post?.id;
        const c = row.comment?.id;
        if ((p && c) || (!p && !c)) {
          uncovered.add(`${label}-ambiguous-or-orphan-target`);
          return [];
        }
        const targetId = p || c;
        if (!(p ? existsPost.has(p) : existsComment.has(c))) {
          uncovered.add(`${label}-orphan-target`);
          return [];
        }
        if (
          !validUuid(targetId) ||
          !(label === 'votes'
            ? Number.isInteger(row.id) && row.id > 0
            : validUuid(row.id)) ||
          !profileSet.has(row.profileId) ||
          row.userId !== accountId
        ) {
          uncovered.add(`${label}-owner-or-target-mismatch`);
          return [];
        }
        return [
          {
            id: row.id,
            profileId: row.profileId,
            value: row.value,
            appScope: row.appScope,
            ...(row.createdAt ? { createdAt: row.createdAt } : {}),
            targetType: p ? 'post' : 'comment',
            targetId,
          },
        ];
      });
    const reactionsOut = projectTargets(
      reactionRows,
      reactionPostIds,
      reactionCommentIds,
      'reactions'
    );
    const votesOut = projectTargets(
      voteRows,
      votePostIds,
      voteCommentIds,
      'votes'
    );
    const readSidecars = async <T extends { id: string }>(
      label: string,
      repository: Repository<T>,
      select: Record<string, unknown>
    ): Promise<T[]> => {
      const rows: T[] = [];
      const seen = new Set<string>();
      let cursor: string | undefined;
      while (postIds.size > 0) {
        const remaining = MAX_ROWS - rows.length;
        if (remaining <= 0) {
          uncovered.add(`${label}-preview-limit-exceeded`);
          break;
        }
        const pageSize = Math.min(100, remaining + 1);
        const page = await read(label, () =>
          repository.find({
            where: {
              post: { id: In([...postIds]) },
              ...(cursor ? { id: MoreThan(cursor) } : {}),
            } as any,
            select: select as any,
            relations: ['post'],
            order: { id: 'ASC' } as any,
            take: pageSize,
          })
        );
        if (page.length > remaining)
          uncovered.add(`${label}-preview-limit-exceeded`);
        if (page.length > pageSize)
          uncovered.add(`${label}-preview-limit-exceeded`);
        let previous = cursor;
        for (const row of page.slice(0, Math.min(remaining, pageSize))) {
          if (
            !validUuid(row.id) ||
            (previous && row.id <= previous) ||
            seen.has(row.id)
          ) {
            uncovered.add(`${label}-owner-or-row-malformed`);
            continue;
          }
          seen.add(row.id);
          rows.push(row);
          previous = row.id;
        }
        if (page.length > remaining || rows.length >= MAX_ROWS) break;
        if (page.length < pageSize) break;
        const next = page.at(-1)?.id;
        if (!next || next === cursor) {
          uncovered.add(`${label}-repeated-cursor`);
          break;
        }
        cursor = next;
      }
      return rows;
    };
    const attachmentRows = await readSidecars('attachments', this.attachments, {
      id: true,
      name: true,
      type: true,
      appScope: true,
      post: { id: true },
    });
    const attachmentsOut = attachmentRows.flatMap((row: any) => {
      if (
        !postIds.has(row.post?.id) ||
        !validUuid(row.id) ||
        typeof row.name !== 'string' ||
        !Object.values(AttachmentType).includes(row.type as AttachmentType)
      ) {
        uncovered.add('attachments-owner-or-row-malformed');
        return [];
      }
      return [
        { id: row.id, name: row.name, type: row.type, appScope: row.appScope },
      ];
    });
    const pollRows = await ownerRows('polls', this.polls, {
      id: true,
      userId: true,
      profileId: true,
      question: true,
      options: true,
      isMultipleChoice: true,
      endsAt: true,
      showResultsBeforeVote: true,
      isAnonymous: true,
      createdAt: true,
    });
    const pollsOut = pollRows.flatMap((row: any) => {
      if (
        !validUuid(row.id) ||
        row.userId !== accountId ||
        !profileSet.has(row.profileId) ||
        !Array.isArray(row.options)
      ) {
        uncovered.add('poll-owner-or-row-malformed');
        return [];
      }
      if (
        [row.question, ...row.options].some(
          (value) => typeof value !== 'string' || value.length > MAX_STRING
        )
      ) {
        uncovered.add('social-preview-string-limit-exceeded');
        return [];
      }
      return [
        {
          id: row.id,
          profileId: row.profileId,
          question: row.question,
          options: row.options,
          isMultipleChoice: row.isMultipleChoice,
          endsAt: row.endsAt ?? null,
          showResultsBeforeVote: row.showResultsBeforeVote,
          isAnonymous: row.isAnonymous,
          createdAt: row.createdAt,
        },
      ];
    });
    const savedItemRows = await actorRows(
      'saved-items',
      this.savedItems,
      'profileId',
      ['id', 'profileId', 'itemType', 'itemId', 'savedAt']
    );
    const savedItemsOut = savedItemRows.flatMap((row: SavedItem) => {
      if (
        !validUuid(row.profileId) ||
        !validUuid(row.itemId) ||
        !['post', 'comment'].includes(row.itemType) ||
        !(row.savedAt instanceof Date) ||
        !Number.isFinite(row.savedAt.getTime())
      ) {
        uncovered.add('saved-items-malformed-or-duplicate-row');
        return [];
      }
      return [
        {
          id: row.id,
          profileId: row.profileId,
          itemType: row.itemType,
          itemId: row.itemId,
          savedAt: row.savedAt,
        },
      ];
    });
    const searchRows = await actorRows(
      'search-history',
      this.searchHistory,
      'profileId',
      ['id', 'profileId', 'query', 'searchType', 'createdAt']
    );
    const searchHistoryOut = searchRows.flatMap((row: SearchHistory) => {
      if (
        !validUuid(row.profileId) ||
        typeof row.query !== 'string' ||
        row.query.length > MAX_STRING ||
        !['all', 'users', 'posts', 'communities'].includes(row.searchType) ||
        !(row.createdAt instanceof Date) ||
        !Number.isFinite(row.createdAt.getTime())
      ) {
        uncovered.add(
          typeof row.query === 'string' && row.query.length > MAX_STRING
            ? 'social-preview-string-limit-exceeded'
            : 'search-history-malformed-or-duplicate-row'
        );
        return [];
      }
      return [
        {
          id: row.id,
          profileId: row.profileId,
          query: row.query,
          searchType: row.searchType,
          createdAt: row.createdAt,
        },
      ];
    });
    const followRows = await actorRows('follows', this.follows, 'followerId', [
      'id',
      'followerId',
      'followeeId',
      'appScope',
      'createdAt',
      'updatedAt',
    ]);
    const followsOut = followRows.flatMap((row: FollowEntity) => {
      if (
        !validUuid(row.followerId) ||
        !validUuid(row.followeeId) ||
        row.followerId === row.followeeId ||
        typeof row.appScope !== 'string' ||
        !row.appScope.trim() ||
        row.appScope.length > MAX_STRING ||
        !(row.createdAt instanceof Date) ||
        !Number.isFinite(row.createdAt.getTime()) ||
        !(row.updatedAt instanceof Date) ||
        !Number.isFinite(row.updatedAt.getTime())
      ) {
        uncovered.add('follows-malformed-or-duplicate-row');
        return [];
      }
      return [
        {
          id: row.id,
          followerId: row.followerId,
          followeeId: row.followeeId,
          appScope: row.appScope,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      ];
    });
    const blockRows = await actorRows('blocks', this.blocks, 'blockerId', [
      'id',
      'blockerId',
      'blockedId',
      'reason',
      'createdAt',
    ]);
    const blocksOut = blockRows.flatMap((row: UserBlock) => {
      if (
        !validUuid(row.blockerId) ||
        !validUuid(row.blockedId) ||
        row.blockerId === row.blockedId ||
        (row.reason !== null &&
          (typeof row.reason !== 'string' || row.reason.length > MAX_STRING)) ||
        !(row.createdAt instanceof Date) ||
        !Number.isFinite(row.createdAt.getTime())
      ) {
        uncovered.add(
          typeof row.reason === 'string' && row.reason.length > MAX_STRING
            ? 'social-preview-string-limit-exceeded'
            : 'blocks-malformed-or-duplicate-row'
        );
        return [];
      }
      return [
        {
          id: row.id,
          blockerId: row.blockerId,
          blockedId: row.blockedId,
          reason: row.reason ?? null,
          createdAt: row.createdAt,
        },
      ];
    });
    const muteRows = await actorRows('mutes', this.mutes, 'muterId', [
      'id',
      'muterId',
      'mutedId',
      'duration',
      'createdAt',
    ]);
    const mutesOut = muteRows.flatMap((row: UserMute) => {
      if (
        !validUuid(row.muterId) ||
        !validUuid(row.mutedId) ||
        row.muterId === row.mutedId ||
        (row.duration !== null &&
          (!Number.isSafeInteger(row.duration) ||
            row.duration <= 0 ||
            row.duration > 31536000)) ||
        !(row.createdAt instanceof Date) ||
        !Number.isFinite(row.createdAt.getTime())
      ) {
        uncovered.add('mutes-malformed-or-duplicate-row');
        return [];
      }
      return [
        {
          id: row.id,
          muterId: row.muterId,
          mutedId: row.mutedId,
          duration: row.duration ?? null,
          createdAt: row.createdAt,
        },
      ];
    });
    const postsOut = postRows.flatMap((row) => {
      if (!['public', 'followers', 'community'].includes(row.visibility)) {
        uncovered.add('posts-malformed-or-duplicate-row');
        return [];
      }
      const projection = {
        id: row.id,
        profileId: row.profileId,
        appScope: row.appScope,
        title: row.title,
        content: row.content,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        visibility: row.visibility,
        publicAudienceExplicit: row.publicAudienceExplicit,
        communityId: row.communityId ?? null,
        scheduledAt: row.scheduledAt ?? null,
        isScheduled: row.isScheduled,
      };
      if (
        Object.values(projection).some(
          (v) => typeof v === 'string' && v.length > MAX_STRING
        )
      ) {
        uncovered.add('social-preview-string-limit-exceeded');
        return [];
      }
      return [projection];
    });
    const data = {
      posts: postsOut,
      postLinks: postLinksOut,
      comments: commentsOut,
      reactions: reactionsOut,
      votes: votesOut,
      attachments: attachmentsOut,
      polls: pollsOut,
      savedItems: savedItemsOut,
      searchHistory: searchHistoryOut,
      follows: followsOut,
      blocks: blocksOut,
      mutes: mutesOut,
      portableMediaBytesIncluded: false,
    };
    if (Date.now() - startedAt > READ_BUDGET_MS)
      uncovered.add('social-read-time-budget-exceeded');
    if (hasOversizedString(data)) {
      uncovered.add('social-preview-string-limit-exceeded');
      return this.snapshot(accountId, uncovered, {
        posts: [],
        postLinks: [],
        comments: [],
        reactions: [],
        votes: [],
        attachments: [],
        polls: [],
        savedItems: [],
        searchHistory: [],
        follows: [],
        blocks: [],
        mutes: [],
        portableMediaBytesIncluded: false,
      });
    }
    if (
      Buffer.byteLength(
        JSON.stringify({
          contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
          participantId: 'social',
          accountId,
          status: 'partial',
          uncovered: [...uncovered],
          data,
        }),
        'utf8'
      ) > MAX_BYTES
    ) {
      uncovered.add('social-preview-response-budget-exceeded');
      return this.snapshot(accountId, uncovered, {
        posts: [],
        comments: [],
        reactions: [],
        votes: [],
        attachments: [],
        polls: [],
        savedItems: [],
        searchHistory: [],
        follows: [],
        blocks: [],
        mutes: [],
        portableMediaBytesIncluded: false,
      });
    }
    return this.snapshot(accountId, uncovered, data);
  }

  private snapshot(
    accountId: string,
    uncovered: Set<string>,
    data: Record<string, unknown>
  ): AccountExportParticipantSnapshot<Record<string, unknown>> {
    return {
      contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
      participantId: 'social',
      accountId,
      status: 'partial',
      uncovered: [...uncovered],
      data,
    };
  }
}

function hasOversizedString(value: unknown): boolean {
  if (typeof value === 'string') return value.length > MAX_STRING;
  if (Array.isArray(value)) return value.some(hasOversizedString);
  if (value && typeof value === 'object' && !(value instanceof Date))
    return Object.values(value).some(hasOversizedString);
  return false;
}
