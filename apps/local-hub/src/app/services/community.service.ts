import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL, CommunityTag } from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';
import { readSourceFreshness } from './source-freshness';
import { readCoverage } from './coverage';
import type { LocalDirectoryPage } from '@optimistic-tanuki/social-contracts';
export type { LocalDirectoryListing } from '@optimistic-tanuki/social-contracts';

export type DirectoryBoundaryGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: unknown[];
};
export type DirectoryBoundary =
  | { status: 'pending' | 'unavailable' }
  | { status: 'ready'; geometry: DirectoryBoundaryGeometry };

export interface CityHighlight {
  headline: string;
  link: string;
  imageUrl: string;
}

export interface LocalCommunity {
  id: string;
  name: string;
  slug: string;
  /** Slug of the town that absorbed this locality; set only on a merged locality (S10 D19-D25). */
  mergedIntoSlug?: string | null;
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
  /** The civic-briefing locality this town page shows briefings for. */
  localitySlug?: string | null;
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

export interface City {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  adminArea: string;
  description: string;
  imageUrl: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  population: number;
  timezone: string;
  highlights: CityHighlight[];
  communities: number;
  /** The civic-briefing locality, when this town has briefings. */
  localitySlug?: string | null;
}

export interface CityPost {
  id: string;
  communityId: string;
  communitySlug: string;
  communityName: string;
  title: string;
  content: string;
  authorProfileId?: string;
  authorUserId?: string;
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
  private baseUrl = `${this.apiBaseUrl}/communities`;
  private socialBaseUrl = `${this.apiBaseUrl}/social/community`;

  async getLocalDirectoryListings(
    communityId: string,
    offset = 0,
    search = '',
    adult = false
  ): Promise<LocalDirectoryPage> {
    const result = await firstValueFrom(
      this.http.get<LocalDirectoryPage>(
        `${this.apiBaseUrl}/directory/towns/${encodeURIComponent(
          communityId
        )}/local-evaluation-listings?offset=${offset}${
          search ? '&q=' + encodeURIComponent(search) : ''
        }${adult ? '&adult=1' : ''}&identities=1`
      )
    );
    if (
      !result ||
      !Array.isArray(result.listings) ||
      typeof result.hasMore !== 'boolean'
    )
      throw Error('Directory unavailable');
    return {
      listings: result.listings.map(
        ({
          id,
          name,
          category,
          attribution,
          notices,
          termsUrls,
          website,
          phone,
          address,
          coordinates,
        }) => ({
          name,
          category,
          attribution,
          notices,
          ...(id &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
            id
          )
            ? { id }
            : {}),
          ...(termsUrls ? { termsUrls } : {}),
          ...(website ? { website } : {}),
          ...(phone ? { phone } : {}),
          ...(address ? { address } : {}),
          ...(coordinates ? { coordinates } : {}),
        })
      ),
      hasMore: result.hasMore,
      ...(readSourceFreshness(result.sourceFreshness)
        ? { sourceFreshness: readSourceFreshness(result.sourceFreshness) }
        : {}),
      ...(readCoverage(result.coverage)
        ? { coverage: readCoverage(result.coverage) }
        : {}),
    };
  }

  async getDirectoryBusinessLink(
    townId: string,
    listingId: string,
    adult = false
  ): Promise<{ communityId: string; slug: string; name: string } | null> {
    const url = `${this.apiBaseUrl}/directory/towns/${encodeURIComponent(
      townId
    )}/local-evaluation-listings/${encodeURIComponent(
      listingId
    )}/business-link${adult ? '?adult=1' : ''}`;
    const result = await firstValueFrom(
      this.http.get<{
        link: { communityId: string; slug: string; name: string } | null;
      }>(url)
    );
    if (result?.link === null) return null;
    const link = result?.link;
    if (
      !link ||
      typeof link.communityId !== 'string' ||
      typeof link.name !== 'string' ||
      !link.name.trim() ||
      typeof link.slug !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(link.slug)
    )
      throw Error('Business page unavailable');
    return { communityId: link.communityId, slug: link.slug, name: link.name };
  }

  async getMyDirectoryBusinessLinks(
    townId: string,
    listingId: string
  ): Promise<
    Array<{
      requestId: string;
      businessCommunityId: string;
      status: 'pending' | 'approved';
    }>
  > {
    const url = `${this.apiBaseUrl}/directory/towns/${encodeURIComponent(
      townId
    )}/local-evaluation-listings/${encodeURIComponent(
      listingId
    )}/business-link/mine`;
    const result = await firstValueFrom(
      this.http.get<{
        requests: Array<{
          requestId: string;
          businessCommunityId: string;
          status: 'pending' | 'approved';
        }>;
      }>(url)
    );
    if (
      !Array.isArray(result?.requests) ||
      result.requests.length > 100 ||
      result.requests.some(
        (x) =>
          !x ||
          typeof x.requestId !== 'string' ||
          typeof x.businessCommunityId !== 'string' ||
          !['pending', 'approved'].includes(x.status)
      )
    )
      throw Error('Business page requests unavailable');
    return result.requests.map(
      ({ requestId, businessCommunityId, status }) => ({
        requestId,
        businessCommunityId,
        status,
      })
    );
  }

  async revokeDirectoryBusinessLink(
    townId: string,
    listingId: string,
    requestId: string
  ): Promise<void> {
    const url = `${this.apiBaseUrl}/directory/towns/${encodeURIComponent(
      townId
    )}/local-evaluation-listings/${encodeURIComponent(
      listingId
    )}/business-link/revoke`;
    const result = await firstValueFrom(
      this.http.post<{ recorded: boolean }>(url, { requestId })
    );
    if (result?.recorded !== true)
      throw Error('Business page request unavailable');
  }

  async requestDirectoryBusinessLink(
    townId: string,
    listingId: string,
    businessSlug: string,
    requestId: string,
    adult = false
  ): Promise<void> {
    const url = `${this.apiBaseUrl}/directory/towns/${encodeURIComponent(
      townId
    )}/local-evaluation-listings/${encodeURIComponent(
      listingId
    )}/business-link/requests`;
    const result = await firstValueFrom(
      this.http.post<{ recorded: boolean }>(url, {
        businessSlug,
        requestId,
        adult,
      })
    );
    if (result?.recorded !== true)
      throw Error('Business page request unavailable');
  }

  async getDirectoryBoundary(communityId: string): Promise<DirectoryBoundary> {
    try {
      const result = await firstValueFrom(
        this.http.get<{ status?: unknown; geometry?: unknown }>(
          `${this.apiBaseUrl}/directory/towns/${encodeURIComponent(
            communityId
          )}/boundary`
        )
      );
      if (result?.status === 'pending') return { status: 'pending' };
      const geometry = result?.geometry as
        | DirectoryBoundaryGeometry
        | undefined;
      if (
        result?.status === 'ready' &&
        geometry &&
        ['Polygon', 'MultiPolygon'].includes(geometry.type) &&
        Array.isArray(geometry.coordinates)
      )
        return { status: 'ready', geometry };
      return { status: 'unavailable' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  private isRootLocality(
    community: LocalCommunity | null | undefined
  ): boolean {
    return (
      !!community &&
      !community.parentId &&
      community.localityType !== 'neighborhood'
    );
  }

  private coordinatesFor(
    community: LocalCommunity
  ): { lat: number; lng: number } | undefined {
    const valid = (lat: unknown, lng: unknown) => {
      const number = (value: unknown) =>
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim()
          ? Number(value)
          : NaN;
      const a = number(lat),
        b = number(lng);
      return Number.isFinite(a) &&
        Number.isFinite(b) &&
        Math.abs(a) <= 90 &&
        Math.abs(b) <= 180
        ? { lat: a, lng: b }
        : undefined;
    };
    return (
      valid(community.coordinates?.lat, community.coordinates?.lng) ??
      valid(community.lat, community.lng)
    );
  }

  private normalizeCommunity = (community: LocalCommunity): LocalCommunity => {
    return { ...community, coordinates: this.coordinatesFor(community) };
  };

  private toRootLocalityCard(
    community: LocalCommunity,
    communitiesCount: number
  ): City {
    return {
      id: community.id,
      name: community.city || community.name,
      slug: community.slug,
      countryCode: community.countryCode || 'US',
      adminArea: community.adminArea || '',
      description: community.description || '',
      imageUrl: community.imageUrl || '',
      coordinates: this.coordinatesFor(community),
      population: community.population || 0,
      timezone: community.timezone || '',
      highlights: community.highlights || [],
      communities: communitiesCount,
      localitySlug: community.localitySlug ?? null,
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
      this.http.get<LocalCommunity>(`${this.socialBaseUrl}/slug/${slug}`)
    ).then(this.normalizeCommunity);
  }

  getSubCommunities(parentId: string): Promise<LocalCommunity[]> {
    return firstValueFrom(
      this.http.get<LocalCommunity[]>(
        `${this.socialBaseUrl}/${parentId}/sub-communities`
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
        `${this.socialBaseUrl}/${communityId}/join`,
        {}
      )
    );
  }

  leaveCommunity(communityId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.socialBaseUrl}/${communityId}/leave`, {})
    );
  }

  ensureCommunityChatRoom(
    communityId: string,
    ownerId: string,
    name: string
  ): Promise<{ id: string }> {
    return firstValueFrom(
      this.http.post<{ id: string }>(
        `${this.socialBaseUrl}/${communityId}/chat-room`,
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
      this.http.get<boolean>(`${this.socialBaseUrl}/${communityId}/membership`)
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
          `${this.socialBaseUrl}/${communityId}/manager`
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
          `${this.socialBaseUrl}/${communityId}/election`
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
        `${this.socialBaseUrl}/${communityId}/election/nominate`,
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
        `${this.socialBaseUrl}/${communityId}/election/vote`,
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
  getCitiesFromCommunities(communities: LocalCommunity[]): City[] {
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

  async getCities(): Promise<City[]> {
    try {
      const communities = await this.getCommunities();
      return this.getCitiesFromCommunities(communities);
    } catch (error) {
      console.error('Failed to fetch cities:', error);
      return [];
    }
  }

  async getCityBySlug(slug: string): Promise<City | undefined> {
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
      console.error('Failed to fetch city:', error);
      return undefined;
    }
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
          authorProfileId: p.profileId,
          authorUserId: p.userId,
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
        authorProfileId: p.profileId,
        authorUserId: p.userId,
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
        authorProfileId: p.profileId,
        authorUserId: p.userId,
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
      authorProfileId: created.profileId || payload.profileId,
      authorUserId: created.userId,
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
