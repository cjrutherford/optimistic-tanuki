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
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly auth: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE) private readonly profile: ClientProxy
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
      'post-link-urls-omitted',
      'social-poll-vote-history-uncovered',
      'poll-post-association-unverified',
      'social-account-profile-selection-ambiguous',
      'social-legacy-guardian-ownership-unverified',
      'attachment-file-references-omitted',
      'portable-media-bytes-not-included',
      'social-follow-entity-uncovered',
      'social-activity-uncovered',
      'social-saved-item-uncovered',
      'social-search-history-uncovered',
      'social-user-presence-uncovered',
      'social-profile-view-uncovered',
      'social-user-block-uncovered',
      'social-user-mute-uncovered',
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
      comments: commentsOut,
      reactions: reactionsOut,
      votes: votesOut,
      attachments: attachmentsOut,
      polls: pollsOut,
      portableMediaBytesIncluded: false,
    };
    if (Date.now() - startedAt > READ_BUDGET_MS)
      uncovered.add('social-read-time-budget-exceeded');
    if (hasOversizedString(data)) {
      uncovered.add('social-preview-string-limit-exceeded');
      return this.snapshot(accountId, uncovered, {
        posts: [],
        comments: [],
        reactions: [],
        votes: [],
        attachments: [],
        polls: [],
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
