import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Raw } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  SearchHistory,
  SearchType,
} from '../../entities/search-history.entity';
import { Post } from '../../entities/post.entity';
import { Community } from '../../entities/community.entity';
import { ServiceTokens, ProfileCommands } from '@optimistic-tanuki/constants';
import FollowService from './follow.service';
import { PrivacyService } from './privacy.service';
import {
  applyVisiblePostScope,
  PostVisibilityScope,
  visiblePostWhere,
} from '../common/post-visibility.util';

interface Profile {
  id: string;
  profileName: string;
  bio: string;
  profilePic: string;
}

export interface SearchResult {
  type: 'user' | 'post' | 'community';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  highlight?: string;
}

export interface SearchResponse {
  users: SearchResult[];
  posts: SearchResult[];
  communities: SearchResult[];
  total: number;
}

export interface SearchOptions {
  type?: SearchType;
  limit?: number;
  offset?: number;
}

interface SearchHistoryProfileState {
  generation: number;
  activeSearches: number;
  clearing: number;
  writes: Set<Promise<unknown>>;
}

const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_HISTORY_PROFILES_PER_CLEAR = 10_000;

@Injectable()
export class SearchService {
  private readonly historyProfileStates = new Map<
    string,
    SearchHistoryProfileState
  >();
  constructor(
    @InjectRepository(SearchHistory)
    private readonly searchHistoryRepo: Repository<SearchHistory>,
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(Community)
    private readonly communityRepo: Repository<Community>,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    private readonly followService: FollowService,
    private readonly privacyService: PrivacyService
  ) {}

  /**
   * Builds the visibility scope for a viewer: their followed authors plus the
   * union of authors they blocked and authors who blocked them. Anonymous
   * (no viewer) reads resolve to an empty, public-only scope.
   */
  private async buildVisibilityScope(
    viewerProfileId?: string
  ): Promise<PostVisibilityScope> {
    if (!viewerProfileId) {
      return {
        viewerProfileId: undefined,
        followedProfileIds: [],
        blockedProfileIds: [],
      };
    }

    const [following, blocked, blockers] = await Promise.all([
      this.followService.getFollowing(viewerProfileId),
      this.privacyService.getBlockedUsers(viewerProfileId),
      this.privacyService.getBlockersOf(viewerProfileId),
    ]);
    const profile = await firstValueFrom(
      this.profileClient
        .send({ cmd: ProfileCommands.Get }, { id: viewerProfileId })
        .pipe(timeout(3000))
    ).catch(() => null);

    return {
      viewerProfileId,
      viewerAccountId:
        profile?.id === viewerProfileId ? profile.userId : undefined,
      followedProfileIds: (following || []).map((f) => f.followeeId),
      blockedProfileIds: [
        ...(blocked || []).map((b) => b.blockedId),
        ...(blockers || []).map((b) => b.blockerId),
      ],
    };
  }

  async search(
    query: string,
    options: SearchOptions = {},
    profileId?: string
  ): Promise<SearchResponse> {
    if (profileId && CANONICAL_UUID.test(profileId))
      profileId = profileId.toLowerCase();
    const historyState = profileId
      ? this.getHistoryProfileState(profileId)
      : undefined;
    const capturedGeneration = historyState?.generation;
    const historyEligible = !!historyState && !historyState.clearing;
    const historyTracked = historyEligible && !!historyState;
    if (historyTracked) historyState.activeSearches += 1;
    try {
      const { type = 'all', limit = 20, offset = 0 } = options;
      const results: SearchResponse = {
        users: [],
        posts: [],
        communities: [],
        total: 0,
      };

      if (type === 'all' || type === 'users') {
        const matchedUsers = await firstValueFrom(
          this.profileClient.send<Profile[]>(
            { cmd: ProfileCommands.Search },
            { query, limit, offset }
          )
        );
        results.users = matchedUsers.map((u) => ({
          type: 'user' as const,
          id: u.id,
          title: u.profileName,
          subtitle: u.bio,
          imageUrl: u.profilePic,
        }));
      }

      if (type === 'all' || type === 'posts') {
        const scope = await this.buildVisibilityScope(profileId);
        const posts = await this.postRepo.find({
          where: [
            ...visiblePostWhere(scope, { title: ILike(`%${query}%`) }),
            ...visiblePostWhere(scope, { content: ILike(`%${query}%`) }),
          ],
          take: limit,
          skip: offset,
        });
        results.posts = posts.map((p) => ({
          type: 'post' as const,
          id: p.id,
          title: p.title,
          subtitle: p.profileId,
          highlight: p.content?.substring(0, 100),
        }));
      }

      if (type === 'all' || type === 'communities') {
        const communities = await this.communityRepo.find({
          where: [
            { name: ILike(`%${query}%`), isPrivate: false },
            { description: ILike(`%${query}%`), isPrivate: false },
          ],
          take: limit,
          skip: offset,
        });
        results.communities = communities.map((c) => ({
          type: 'community' as const,
          id: c.id,
          title: c.name,
          subtitle: c.description,
          imageUrl: c.logoAssetId,
        }));
      }

      results.total =
        results.users.length +
        results.posts.length +
        results.communities.length;

      if (
        profileId &&
        historyEligible &&
        historyState &&
        historyState.generation === capturedGeneration &&
        !historyState.clearing
      ) {
        await this.writeSearchHistory(
          historyState,
          profileId,
          query,
          type,
          results.total
        );
      }

      return results;
    } finally {
      if (historyTracked && historyState) {
        historyState.activeSearches -= 1;
        this.releaseHistoryProfileState(profileId!, historyState);
      }
    }
  }

  private getHistoryProfileState(profileId: string): SearchHistoryProfileState {
    let state = this.historyProfileStates.get(profileId);
    if (!state) {
      state = {
        generation: 0,
        activeSearches: 0,
        clearing: 0,
        writes: new Set(),
      };
      this.historyProfileStates.set(profileId, state);
    }
    return state;
  }

  private releaseHistoryProfileState(
    profileId: string,
    state: SearchHistoryProfileState
  ): void {
    if (
      !state.clearing &&
      state.activeSearches === 0 &&
      state.writes.size === 0 &&
      this.historyProfileStates.get(profileId) === state
    ) {
      this.historyProfileStates.delete(profileId);
    }
  }

  private async writeSearchHistory(
    state: SearchHistoryProfileState,
    profileId: string,
    query: string,
    searchType: SearchType,
    resultCount: number
  ): Promise<void> {
    if (state.clearing) return;
    const write = this.saveSearchHistory(
      profileId,
      query,
      searchType,
      resultCount
    );
    state.writes.add(write);
    try {
      await write;
    } finally {
      state.writes.delete(write);
      this.releaseHistoryProfileState(profileId, state);
    }
  }

  /** Internal store cleanup: caller must prove the supplied account-owned profiles.
   * Temporary work-item fences do not implement permanent account deletion.
   */
  async clearSearchHistoryForProfiles(profileIds: string[]): Promise<void> {
    if (
      !Array.isArray(profileIds) ||
      profileIds.length > MAX_HISTORY_PROFILES_PER_CLEAR
    ) {
      throw new Error('Invalid search history profile selection.');
    }
    const normalized: string[] = [];
    for (const profileId of profileIds) {
      if (typeof profileId !== 'string' || !CANONICAL_UUID.test(profileId)) {
        throw new Error('Invalid search history profile selection.');
      }
      const id = profileId.toLowerCase();
      if (!normalized.includes(id)) normalized.push(id);
    }
    if (normalized.length > MAX_HISTORY_PROFILES_PER_CLEAR) {
      throw new Error('Invalid search history profile selection.');
    }
    if (!normalized.length) return;

    const states = normalized.map((id) => {
      const state = this.getHistoryProfileState(id);
      state.generation += 1;
      state.clearing += 1;
      return [id, state] as const;
    });
    try {
      await Promise.allSettled(
        states.flatMap(([, state]) => [...state.writes])
      );
      await this.searchHistoryRepo.delete({
        profileId: Raw((alias) => `LOWER(${alias}) IN (:...profileIds)`, {
          profileIds: normalized,
        }),
      });
    } finally {
      for (const [id, state] of states) {
        state.clearing -= 1;
        this.releaseHistoryProfileState(id, state);
      }
    }
  }

  async getTrending(
    limit: number = 10,
    profileId?: string
  ): Promise<SearchResult[]> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const scope = await this.buildVisibilityScope(profileId);
    const qb = this.postRepo
      .createQueryBuilder('post')
      .leftJoin('post.votes', 'votes')
      .leftJoin('post.comments', 'comments')
      .where('post.createdAt >= :date', { date: oneDayAgo });
    applyVisiblePostScope(qb, scope, 'post');
    const posts = await qb
      .groupBy('post.id')
      .orderBy('COUNT(DISTINCT votes.id) + COUNT(DISTINCT comments.id)', 'DESC')
      .limit(limit)
      .getMany();

    return posts.map((p) => ({
      type: 'post' as const,
      id: p.id,
      title: p.title,
      subtitle: p.profileId,
      highlight: p.content?.substring(0, 100),
    }));
  }

  async getSuggestedUsers(
    limit: number = 10,
    profileId: string
  ): Promise<SearchResult[]> {
    const following = await this.followService.getFollowing(profileId);
    const excludeIds = [profileId, ...following.map((f) => f.followeeId)];

    const users = await firstValueFrom(
      this.profileClient.send<Profile[]>(
        { cmd: ProfileCommands.Search },
        { excludeIds, limit }
      )
    );

    return users.map((u) => ({
      type: 'user' as const,
      id: u.id,
      title: u.profileName,
      subtitle: u.bio,
      imageUrl: u.profilePic,
    }));
  }

  async getSuggestedCommunities(limit: number = 10): Promise<SearchResult[]> {
    const communities = await this.communityRepo.find({
      where: { isPrivate: false },
      take: limit,
      order: { memberCount: 'DESC' },
    });

    return communities.map((c) => ({
      type: 'community' as const,
      id: c.id,
      title: c.name,
      subtitle: c.description,
      imageUrl: c.logoAssetId,
    }));
  }

  private async saveSearchHistory(
    profileId: string,
    query: string,
    searchType: SearchType,
    resultCount: number
  ): Promise<void> {
    const history = this.searchHistoryRepo.create({
      profileId,
      query,
      searchType,
      resultCount,
    });
    await this.searchHistoryRepo.save(history);
  }

  async getSearchHistory(
    profileId: string,
    limit: number = 10
  ): Promise<SearchHistory[]> {
    return this.searchHistoryRepo.find({
      where: { profileId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
