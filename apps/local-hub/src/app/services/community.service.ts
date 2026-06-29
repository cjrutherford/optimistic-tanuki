import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  API_BASE_URL,
  AnchorPoint,
  buildFallbackLocalityHighlights,
  buildFallbackLocalityImageUrl,
  CommunityTag,
  RadiusScope,
  ResolvedLocalityLabel,
  getDefaultLocalityRadiusMeters,
} from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';
import { LocalityResolutionService } from './locality-resolution.service';

export interface CityHighlight {
  headline: string;
  link: string;
  imageUrl: string;
}

export interface LocalCommunity {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  description: string;
  joinPolicy?: string | null;
  localityType: 'city' | 'town' | 'neighborhood' | 'county' | 'region';
  countryCode: string;
  adminArea: string;
  city: string;
  memberCount: number;
  createdAt: string;
  lat?: number | null;
  lng?: number | null;
  population?: number | null;
  imageUrl?: string;
  bannerUrl?: string;
  logoUrl?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  highlights?: CityHighlight[];
  events?: string[];
  tags?: CommunityTag[];
  /** IANA timezone identifier, e.g. "America/New_York". */
  timezone?: string | null;
  /** ID of the currently elected community manager (localities only). */
  managerId?: string | null;
  /** Display name of the currently elected community manager. */
  managerName?: string | null;
  /** ISO timestamp when the current manager was elected. */
  managerElectedAt?: string | null;
  /** ISO timestamp when the current manager's term ends. */
  managerTermEndsAt?: string | null;
  /** Whether this community is system-managed (no individual owner). */
  isSystemCommunity?: boolean;
  ownerId?: string;
  ownerProfileId?: string;
}

export interface RoleAssignmentSummary {
  targetId?: string | null;
  role?: {
    id?: string;
    name?: string;
  };
}

/** Represents the currently elected manager of a locality. */
export interface CommunityManager {
  userId: string;
  profileId: string;
  name: string;
  electedAt: string;
  termEndsAt: string;
}

/** A candidate in an open community manager election. */
export interface ElectionCandidate {
  userId: string;
  profileId: string;
  name: string;
  nominatedAt: string;
  votes: number;
}

/** An active or recently concluded community manager election. */
export interface CommunityElection {
  id: string;
  communityId: string;
  status: 'open' | 'closed' | 'pending';
  candidates: ElectionCandidate[];
  startedAt: string;
  endsAt: string;
  /** The candidateUserId the current user has already voted for, if any. */
  myVote?: string | null;
}

export interface LocalitySummary {
  id: string;
  name: string;
  slug: string;
  localityType: LocalCommunity['localityType'];
  countryCode: string;
  adminArea: string;
  description: string;
  imageUrl: string;
  coordinates: AnchorPoint;
  label: ResolvedLocalityLabel;
  scope: RadiusScope;
  population: number;
  timezone: string;
  highlights: CityHighlight[];
  communities: number;
  externalInfo?: {
    source: 'api';
    articleUrl?: string;
  };
}

export type City = LocalitySummary;

export interface CityPost {
  id: string;
  communityId: string;
  communitySlug: string;
  communityName: string;
  title: string;
  content: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  likes: number;
  comments: number;
}

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private http = inject(HttpClient);
  private apiBaseUrl = inject(API_BASE_URL);
  private localityResolution = inject(LocalityResolutionService);
  private baseUrl = `${this.apiBaseUrl}/communities`;
  private socialBaseUrl = `${this.apiBaseUrl}/social/community`;

  private isRootLocality(
    community: LocalCommunity | null | undefined
  ): boolean {
    return (
      !!community &&
      !community.parentId &&
      community.localityType !== 'neighborhood'
    );
  }

  private normalizeCommunity(community: LocalCommunity): LocalCommunity {
    return {
      ...community,
      coordinates: {
        lat: Number(community.coordinates?.lat) || Number(community.lat) || 0,
        lng: Number(community.coordinates?.lng) || Number(community.lng) || 0,
      },
    };
  }

  private toRootLocalityCard(
    community: LocalCommunity,
    communitiesCount: number
  ): LocalitySummary {
    const coordinates = {
      lat: community.coordinates?.lat || community.lat || 0,
      lng: community.coordinates?.lng || community.lng || 0,
    };

    return {
      id: community.id,
      name: community.city || community.name,
      slug: community.slug,
      localityType: community.localityType,
      countryCode: community.countryCode || 'US',
      adminArea: community.adminArea || '',
      description: community.description || '',
      imageUrl:
        community.imageUrl ||
        buildFallbackLocalityImageUrl(community.slug || community.id),
      coordinates,
      label: this.localityResolution.resolveFromCommunity({
        name: community.name,
        city: community.city,
        adminArea: community.adminArea,
        countryCode: community.countryCode,
        timezone: community.timezone,
        coordinates,
      }),
      scope: {
        anchor: coordinates,
        radiusMeters: getDefaultLocalityRadiusMeters(community.localityType),
      },
      population: community.population || 0,
      timezone: community.timezone || '',
      highlights:
        community.highlights && community.highlights.length > 0
          ? community.highlights
          : buildFallbackLocalityHighlights({
              slug: community.slug || community.id,
              localityName: community.city || community.name,
            }),
      communities: communitiesCount,
    };
  }

  getCommunities(): Promise<LocalCommunity[]> {
    return firstValueFrom(this.http.get<LocalCommunity[]>(this.baseUrl)).then(
      (communities) => {
        if (!Array.isArray(communities)) {
          console.error('API returned non-array for communities:', communities);
          return [];
        }
        return communities.map(this.normalizeCommunity);
      }
    );
  }

  getCommunityBySlug(slug: string): Promise<LocalCommunity> {
    return firstValueFrom(
      this.http.get<LocalCommunity>(`${this.baseUrl}/slug/${slug}`)
    ).then(this.normalizeCommunity);
  }

  getSubCommunities(parentId: string): Promise<LocalCommunity[]> {
    return firstValueFrom(
      this.http.get<LocalCommunity[]>(
        `${this.baseUrl}/${parentId}/sub-communities`
      )
    ).then((communities) => {
      if (!Array.isArray(communities)) {
        console.error(
          'API returned non-array for sub-communities:',
          communities
        );
        return [];
      }
      return communities.map(this.normalizeCommunity);
    });
  }

  joinCommunity(communityId: string): Promise<{ status?: string }> {
    return firstValueFrom(
      this.http.post<{ status?: string }>(
        `${this.baseUrl}/${communityId}/join`,
        {}
      )
    );
  }

  leaveCommunity(communityId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${communityId}/membership`)
    );
  }

  ensureCommunityChatRoom(
    communityId: string,
    ownerId: string,
    name: string
  ): Promise<{ id: string }> {
    return firstValueFrom(
      this.http.post<{ id: string }>(
        `${this.baseUrl}/${communityId}/chat-room`,
        {
          ownerId,
          name,
        }
      )
    );
  }

  /**
   * Create a new LOCAL INTEREST COMMUNITY connected to a locality.
   * `parentId` is required — root localities are system-managed and cannot be
   * created by regular users.
   */
  createCommunity(data: {
    name: string;
    description: string;
    parentId: string;
    localityType: 'neighborhood' | 'county' | 'region';
    isBusiness?: boolean;
    isPrivate?: boolean;
    joinPolicy?: string;
    tags?: string[];
    bannerAssetId?: string;
    logoAssetId?: string;
  }): Promise<LocalCommunity> {
    return firstValueFrom(
      this.http.post<LocalCommunity>(this.socialBaseUrl, {
        ...data,
        createChatRoom: true,
      })
    );
  }

  isMember(communityId: string): Promise<boolean> {
    return firstValueFrom(
      this.http.get<boolean>(`${this.baseUrl}/${communityId}/membership`)
    );
  }

  getMyMemberships(): Promise<LocalCommunity[]> {
    return firstValueFrom(
      this.http.get<LocalCommunity[]>(`${this.socialBaseUrl}/user/communities`)
    ).then((communities) => {
      if (!Array.isArray(communities)) return [];
      return communities.map(this.normalizeCommunity);
    });
  }

  getUserRoles(
    profileId: string,
    appScope = 'global'
  ): Promise<RoleAssignmentSummary[]> {
    return firstValueFrom(
      this.http.get<RoleAssignmentSummary[]>(
        `${this.apiBaseUrl}/permissions/user-roles/${encodeURIComponent(
          profileId
        )}?appScope=${encodeURIComponent(appScope)}`
      )
    ).catch(() => []);
  }

  // ── Community Manager & Election ────────────────────────────────────────────

  /**
   * Fetch the currently elected community manager for a locality.
   * Returns `null` when the locality has no elected manager yet.
   */
  async getCommunityManager(
    communityId: string
  ): Promise<CommunityManager | null> {
    try {
      return await firstValueFrom(
        this.http.get<CommunityManager | null>(
          `${this.baseUrl}/${communityId}/manager`
        )
      );
    } catch {
      return null;
    }
  }

  /**
   * Fetch the active (or most recent) election for a locality.
   * Returns `null` when no election is in progress.
   */
  async getActiveElection(
    communityId: string
  ): Promise<CommunityElection | null> {
    try {
      return await firstValueFrom(
        this.http.get<CommunityElection | null>(
          `${this.baseUrl}/${communityId}/election`
        )
      );
    } catch {
      return null;
    }
  }

  /**
   * Nominate a user as a candidate in the active election.
   * Pass `nomineeId` to nominate another user, or omit to self-nominate.
   */
  nominateForManager(
    communityId: string,
    nomineeId?: string
  ): Promise<ElectionCandidate> {
    return firstValueFrom(
      this.http.post<ElectionCandidate>(
        `${this.baseUrl}/${communityId}/election/nominate`,
        nomineeId ? { nomineeId } : {}
      )
    );
  }

  /**
   * Cast a vote for a candidate in the active election.
   */
  voteForManager(
    communityId: string,
    candidateUserId: string
  ): Promise<CommunityElection> {
    return firstValueFrom(
      this.http.post<CommunityElection>(
        `${this.baseUrl}/${communityId}/election/vote`,
        { candidateUserId }
      )
    );
  }

  // ── Cities ───────────────────────────────────────────────────────────────────

  /**
   * Derive `City[]` from an already-fetched list of `LocalCommunity[]`.
   * This is a pure, synchronous operation — use it when you already have the
   * communities list to avoid a redundant HTTP call.
   */
  getLocalitiesFromCommunities(
    communities: LocalCommunity[]
  ): LocalitySummary[] {
    const rootLocalities = communities.filter(
      (community) => this.isRootLocality(community) && !!community.slug
    );
    const directChildrenCount = communities.reduce<Map<string, number>>(
      (counts, community) => {
        if (community.parentId) {
          counts.set(
            community.parentId,
            (counts.get(community.parentId) || 0) + 1
          );
        }
        return counts;
      },
      new Map<string, number>()
    );

    return rootLocalities
      .map((community) =>
        this.toRootLocalityCard(
          community,
          1 + (directChildrenCount.get(community.id) || 0)
        )
      )
      .sort((left, right) => {
        const byName = left.name.localeCompare(right.name);
        if (byName !== 0) {
          return byName;
        }

        return left.adminArea.localeCompare(right.adminArea);
      });
  }

  getCitiesFromCommunities(communities: LocalCommunity[]): City[] {
    return this.getLocalitiesFromCommunities(communities);
  }

  async getCities(): Promise<City[]> {
    try {
      const communities = await this.getCommunities();
      return this.getLocalitiesFromCommunities(communities);
    } catch (error) {
      console.error('Failed to fetch cities:', error);
      return [];
    }
  }

  async getLocalities(): Promise<LocalitySummary[]> {
    return this.getCities();
  }

  async getLocalityBySlug(slug: string): Promise<LocalitySummary | undefined> {
    try {
      const community = await this.getCommunityBySlug(slug);

      if (!this.isRootLocality(community)) {
        return undefined;
      }

      const allCommunities = await this.getCommunities();
      const directChildrenCount = allCommunities.filter(
        (c) => c.parentId === community.id
      ).length;

      return this.toRootLocalityCard(community, 1 + directChildrenCount);
    } catch (error) {
      console.error('Failed to fetch locality:', error);
      return undefined;
    }
  }

  async getCityBySlug(slug: string): Promise<City | undefined> {
    return this.getLocalityBySlug(slug);
  }

  async getCitySlugForCommunity(communitySlug: string): Promise<string | null> {
    try {
      const community = await this.getCommunityBySlug(communitySlug);
      if (!community) return null;

      if (this.isRootLocality(community)) {
        return community.slug;
      }

      const allCommunities = await this.getCommunities();
      const parentCommunity = community.parentId
        ? allCommunities.find(
            (c) => c.id === community.parentId && this.isRootLocality(c)
          )
        : undefined;
      if (parentCommunity?.slug) {
        return parentCommunity.slug;
      }

      const rootLocality = allCommunities.find(
        (c) => c.city === community.city && this.isRootLocality(c) && c.slug
      );

      return rootLocality?.slug || null;
    } catch {
      return null;
    }
  }

  async getLocalitySlugForCommunity(
    communitySlug: string
  ): Promise<string | null> {
    return this.getCitySlugForCommunity(communitySlug);
  }

  /**
   * Get all communities for a city page — includes the city community itself
   * and its sub-communities fetched via the parent-child API.
   */
  async getCommunitiesForCity(citySlug: string): Promise<LocalCommunity[]> {
    try {
      const cityCommunity = await this.getCommunityBySlug(citySlug);
      if (!cityCommunity) return [];

      // Fetch sub-communities registered with this city as parent
      const subCommunities = await this.getSubCommunities(cityCommunity.id);

      // Also fetch any communities sharing the same city name without parentId
      // (legacy data compatibility)
      const allCommunities = await this.getCommunities();
      const legacyChildren = allCommunities.filter((c) => {
        if (c.id === cityCommunity.id) return false;
        if (c.parentId) return false; // already handled via parentId path
        const communityCity = (c.city || '').toLowerCase().replace(/\s+/g, '-');
        return communityCity === citySlug;
      });

      const combined = [cityCommunity, ...subCommunities, ...legacyChildren];
      // Deduplicate by id
      const seen = new Set<string>();
      return combined.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    } catch (error) {
      console.error('Failed to fetch communities for city:', error);
      return [];
    }
  }

  async getPostsForCity(citySlug: string): Promise<CityPost[]> {
    try {
      // Fetch all communities for this city to filter posts by any community in the city
      const communities = await this.getCommunitiesForCity(citySlug);
      if (communities.length === 0) {
        return [];
      }

      const communityIds = communities.map((c) => c.id);
      const communityMap = new Map(communities.map((c) => [c.id, c]));

      const posts = await firstValueFrom(
        this.http.post<
          {
            id: string;
            title: string;
            content: string;
            profileId: string;
            userId: string;
            createdAt: string | Date;
            communityId?: string;
          }[]
        >(`${this.apiBaseUrl}/social/post/find`, {
          criteria: { communityIds, appScope: 'local-hub' },
        })
      );

      return (posts ?? []).map((p) => {
        const comm = p.communityId
          ? communityMap.get(p.communityId)
          : undefined;
        return {
          id: p.id,
          communityId: p.communityId || communityIds[0],
          communitySlug: comm?.slug || citySlug,
          communityName: comm?.name || communities[0]?.name || '',
          title: p.title,
          content: p.content,
          authorName: 'Community Member',
          createdAt:
            typeof p.createdAt === 'string'
              ? p.createdAt
              : (p.createdAt as Date).toISOString(),
          likes: 0,
          comments: 0,
        };
      });
    } catch (error) {
      console.error('Failed to fetch city posts:', error);
      return [];
    }
  }

  async getPostsForRootCommunity(citySlug: string): Promise<CityPost[]> {
    try {
      const communities = await this.getCommunitiesForCity(citySlug);
      const rootLocality = communities.find((c) => this.isRootLocality(c));
      if (!rootLocality) {
        return [];
      }

      const posts = await firstValueFrom(
        this.http.post<
          {
            id: string;
            title: string;
            content: string;
            profileId: string;
            userId: string;
            createdAt: string | Date;
            communityId?: string;
          }[]
        >(`${this.apiBaseUrl}/social/post/find`, {
          criteria: { communityId: rootLocality.id, appScope: 'local-hub' },
        })
      );

      return (posts ?? []).map((p) => ({
        id: p.id,
        communityId: rootLocality.id,
        communitySlug: citySlug,
        communityName: rootLocality.name,
        title: p.title,
        content: p.content,
        authorName: 'Community Member',
        createdAt:
          typeof p.createdAt === 'string'
            ? p.createdAt
            : (p.createdAt as Date).toISOString(),
        likes: 0,
        comments: 0,
      }));
    } catch (error) {
      console.error('Failed to fetch root community posts:', error);
      return [];
    }
  }

  async getPostsForCommunity(communitySlug: string): Promise<CityPost[]> {
    try {
      const community = await this.getCommunityBySlug(communitySlug);
      if (!community?.id) {
        return [];
      }

      const posts = await firstValueFrom(
        this.http.post<
          {
            id: string;
            title: string;
            content: string;
            profileId: string;
            userId: string;
            createdAt: string | Date;
            communityId?: string;
          }[]
        >(`${this.apiBaseUrl}/social/post/find`, {
          criteria: { communityId: community.id, appScope: 'local-hub' },
        })
      );

      return (posts ?? []).map((p) => ({
        id: p.id,
        communityId: community.id,
        communitySlug,
        communityName: community.name,
        title: p.title,
        content: p.content,
        authorName: 'Community Member',
        createdAt:
          typeof p.createdAt === 'string'
            ? p.createdAt
            : (p.createdAt as Date).toISOString(),
        likes: 0,
        comments: 0,
      }));
    } catch (error) {
      console.error('Failed to fetch community posts:', error);
      return [];
    }
  }

  /**
   * Create a new community post via the social microservice.
   * Returns the created post mapped to a `CityPost` so the caller can
   * prepend it to the local feed signal without a round-trip.
   */
  async createPost(
    communityId: string,
    communitySlug: string,
    communityName: string,
    payload: { title: string; content: string; profileId: string }
  ): Promise<CityPost> {
    const created = await firstValueFrom(
      this.http.post<{
        id: string;
        title: string;
        content: string;
        profileId: string;
        userId: string;
        createdAt: string | Date;
      }>(`${this.apiBaseUrl}/social/post`, {
        title: payload.title,
        content: payload.content,
        profileId: payload.profileId,
        communityId,
        appScope: 'local-hub',
      })
    );

    return {
      id: created.id,
      communityId,
      communitySlug,
      communityName,
      title: created.title,
      content: created.content,
      authorName: 'You',
      createdAt:
        typeof created.createdAt === 'string'
          ? created.createdAt
          : (created.createdAt as Date).toISOString(),
      likes: 0,
      comments: 0,
    };
  }
}
