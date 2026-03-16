import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL, CommunityTag } from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';

export interface LocalCommunity {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  description: string;
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
  highlights?: string[];
  events?: string[];
  tags?: CommunityTag[];
  /** ID of the currently elected community manager (localities only). */
  managerId?: string | null;
  /** Display name of the currently elected community manager. */
  managerName?: string | null;
  /** ISO timestamp when the current manager was elected. */
  managerElectedAt?: string | null;
  /** ISO timestamp when the current manager's term ends. */
  managerTermEndsAt?: string | null;
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
  coordinates: {
    lat: number;
    lng: number;
  };
  population: number;
  timezone: string;
  highlights: string[];
  communities: number;
}

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
  private baseUrl = `${this.apiBaseUrl}/communities`;
  private socialBaseUrl = `${this.apiBaseUrl}/social/community`;

  getCommunities(): Promise<LocalCommunity[]> {
    return firstValueFrom(this.http.get<LocalCommunity[]>(this.baseUrl)).then(
      (communities) => {
        if (!Array.isArray(communities)) {
          console.error('API returned non-array for communities:', communities);
          return [];
        }
        return communities.map((c) => ({
          ...c,
          coordinates: c.coordinates || {
            lat: c.lat || 0,
            lng: c.lng || 0,
          },
        }));
      }
    );
  }

  getCommunityBySlug(slug: string): Promise<LocalCommunity> {
    return firstValueFrom(
      this.http.get<LocalCommunity>(`${this.baseUrl}/${slug}`)
    ).then((c) => ({
      ...c,
      coordinates: c.coordinates || { lat: c.lat || 0, lng: c.lng || 0 },
    }));
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
      return communities.map((c) => ({
        ...c,
        coordinates: c.coordinates || { lat: c.lat || 0, lng: c.lng || 0 },
      }));
    });
  }

  joinCommunity(communityId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/${communityId}/join`, {})
    );
  }

  leaveCommunity(communityId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${communityId}/membership`)
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
  }): Promise<LocalCommunity> {
    return firstValueFrom(this.http.post<LocalCommunity>(this.baseUrl, data));
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
      return communities.map((c) => ({
        ...c,
        coordinates: c.coordinates || { lat: c.lat || 0, lng: c.lng || 0 },
      }));
    });
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

  async getCities(): Promise<City[]> {
    try {
      const communities = await this.getCommunities();

      const citiesMap = new Map<string, City>();

      for (const community of communities) {
        if (community.localityType === 'city' && community.slug) {
          const key = community.city || community.name;
          if (!citiesMap.has(key)) {
            citiesMap.set(key, {
              id: community.id,
              name: community.city || community.name,
              slug: community.slug,
              countryCode: community.countryCode || 'US',
              adminArea: community.adminArea || '',
              description: community.description || '',
              imageUrl: community.imageUrl || '',
              coordinates: {
                lat: community.coordinates?.lat || community.lat || 0,
                lng: community.coordinates?.lng || community.lng || 0,
              },
              population: community.population || 0,
              timezone: 'America/New_York',
              highlights: community.highlights || [],
              communities: 1,
            });
          }
        }
      }

      const cities = Array.from(citiesMap.values());
      return cities;
    } catch (error) {
      console.error('Failed to fetch cities:', error);
      return [];
    }
  }

  async getCityBySlug(slug: string): Promise<City | undefined> {
    try {
      const community = await this.getCommunityBySlug(slug);

      if (!community || community.localityType !== 'city') {
        return undefined;
      }

      const allCommunities = await this.getCommunities();
      const cityCommunities = allCommunities.filter(
        (c) => c.city === community.city && c.localityType === 'city'
      );

      return {
        id: community.id,
        name: community.city || community.name,
        slug: community.slug,
        countryCode: community.countryCode || 'US',
        adminArea: community.adminArea || '',
        description: community.description || '',
        imageUrl: community.imageUrl || '',
        coordinates: {
          lat: community.coordinates?.lat || community.lat || 0,
          lng: community.coordinates?.lng || community.lng || 0,
        },
        population: community.population || 0,
        timezone: 'America/New_York',
        highlights: community.highlights || [],
        communities: cityCommunities.length,
      };
    } catch (error) {
      console.error('Failed to fetch city:', error);
      return undefined;
    }
  }

  async getCitySlugForCommunity(communitySlug: string): Promise<string | null> {
    try {
      const community = await this.getCommunityBySlug(communitySlug);
      if (!community) return null;

      if (community.localityType === 'city') {
        return community.slug;
      }

      const allCommunities = await this.getCommunities();
      const cityCommunity = allCommunities.find(
        (c) => c.city === community.city && c.localityType === 'city' && c.slug
      );

      return cityCommunity?.slug || null;
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
      const community = await this.getCommunityBySlug(citySlug);
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
        communitySlug: citySlug,
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
      console.error('Failed to fetch city posts:', error);
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
