import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
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

@Injectable()
export class SearchService {
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

    return {
      viewerProfileId,
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
          { name: ILike(`%${query}%`) },
          { description: ILike(`%${query}%`) },
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
      results.users.length + results.posts.length + results.communities.length;

    if (profileId) {
      await this.saveSearchHistory(profileId, query, type, results.total);
    }

    return results;
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
