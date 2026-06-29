import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  CommunityCommands,
  PaymentCommands,
  ServiceTokens,
  TrainerConfigCommands,
  VideoCommands,
} from '@optimistic-tanuki/constants';
import {
  LocalityDiscoveryResultDto,
  NearbyBusinessDiscoveryDto,
  NearbyChannelDiscoveryDto,
  NearbyCommunityDiscoveryDto,
} from '@optimistic-tanuki/models';
import { Public } from '../../decorators/public.decorator';

type LocalityCommunityRecord = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string;
  localityType?: string | null;
  city?: string | null;
  adminArea?: string | null;
  countryCode?: string | null;
  timezone?: string | null;
  imageUrl?: string | null;
  memberCount?: number;
  appScope?: string;
  lat?: number | string | null;
  lng?: number | string | null;
};

type BusinessPageRecord = {
  id: string;
  communityId: string;
  ownerId?: string | null;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  subscriptionStatus?: string;
  anchorLat?: number | string | null;
  anchorLng?: number | string | null;
};

type PublicSiteSummaryRecord = {
  slug: string;
  businessName: string;
  ownerUserId?: string;
};

type ChannelRecord = {
  id: string;
  communityId: string;
  communitySlug?: string | null;
  name: string;
  description?: string | null;
  isPublic?: boolean;
  memberCount?: number;
  timezone?: string | null;
  anchorLat?: number | string | null;
  anchorLng?: number | string | null;
};

const DEFAULT_SCOPE = 'local-hub';
const DEFAULT_RADIUS_METERS = 25000;
const DEFAULT_LIMIT = 12;
const EARTH_RADIUS_METERS = 6371000;

@Controller('locality')
export class LocalityDiscoveryController {
  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    @Inject(ServiceTokens.STORE_SERVICE)
    private readonly storeClient: ClientProxy,
    @Inject(ServiceTokens.VIDEOS_SERVICE)
    private readonly videosClient: ClientProxy
  ) {}

  @Public()
  @Get('discovery')
  async discoverNearby(
    @Query('lat') lat: number | string,
    @Query('lng') lng: number | string,
    @Query('radiusMeters') radiusMeters?: number | string,
    @Query('scope') scope?: string,
    @Query('limit') limit?: number | string
  ): Promise<LocalityDiscoveryResultDto> {
    const anchor = {
      lat: this.coerceCoordinate(lat, 'lat'),
      lng: this.coerceCoordinate(lng, 'lng'),
    };
    const normalizedRadius = this.coercePositiveInt(
      radiusMeters,
      DEFAULT_RADIUS_METERS
    );
    const normalizedLimit = this.coercePositiveInt(limit, DEFAULT_LIMIT);
    const communityScope = scope?.trim() || DEFAULT_SCOPE;

    const communities = (await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.LIST_LOCALITY },
        { appScope: communityScope, localityType: undefined }
      )
    )) as LocalityCommunityRecord[];

    const nearbyCommunities = this.findNearbyCommunities(
      communities || [],
      anchor,
      normalizedRadius,
      normalizedLimit
    );

    const [businesses, channels] = await Promise.all([
      this.getNearbyBusinesses(
        communities || [],
        nearbyCommunities,
        anchor,
        normalizedRadius
      ),
      this.getNearbyChannels(
        communities || [],
        nearbyCommunities,
        anchor,
        normalizedRadius
      ),
    ]);

    return {
      anchor,
      radiusMeters: normalizedRadius,
      locality: this.resolveLocalityLabel(nearbyCommunities[0], anchor),
      communities: nearbyCommunities,
      businesses,
      channels,
    };
  }

  private async getNearbyBusinesses(
    allCommunities: LocalityCommunityRecord[],
    communities: NearbyCommunityDiscoveryDto[],
    anchor: { lat: number; lng: number },
    radiusMeters: number
  ): Promise<NearbyBusinessDiscoveryDto[]> {
    const communityById = new Map(
      allCommunities.map((community) => [community.id, community])
    );
    const [businesses, publicSiteSummaries] = await Promise.all([
      firstValueFrom(
        this.storeClient.send(
          { cmd: PaymentCommands.LIST_ACTIVE_BUSINESS_PAGES },
          {}
        )
      ) as Promise<BusinessPageRecord[]>,
      firstValueFrom(
        this.storeClient.send(
          { cmd: TrainerConfigCommands.LIST_PUBLIC_SITE_SUMMARIES },
          {}
        )
      ) as Promise<PublicSiteSummaryRecord[]>,
    ]);
    const siteSlugByOwnerId = new Map<string, string>();
    const siteSlugByBusinessName = new Map<string, string>();

    for (const site of publicSiteSummaries || []) {
      if (site.ownerUserId?.trim()) {
        siteSlugByOwnerId.set(site.ownerUserId.trim(), site.slug);
      }
      if (site.businessName?.trim()) {
        siteSlugByBusinessName.set(
          this.normalizeMatchKey(site.businessName),
          site.slug
        );
      }
    }

    return (businesses || [])
      .map((business) => {
        const community = communityById.get(business.communityId);
        const coordinates = this.resolveEntityCoordinates(business, community);
        if (!coordinates) {
          return null;
        }

        const distanceMeters = Math.round(
          this.calculateDistanceMeters(anchor, coordinates)
        );
        if (distanceMeters > radiusMeters) {
          return null;
        }

        const siteSlug =
          (business.ownerId
            ? siteSlugByOwnerId.get(business.ownerId)
            : undefined) ??
          siteSlugByBusinessName.get(this.normalizeMatchKey(business.name));

        return {
          id: business.id,
          communityId: business.communityId,
          communitySlug: community?.slug ?? null,
          ownerId: business.ownerId ?? null,
          name: business.name,
          description: business.description,
          logoUrl: business.logoUrl,
          address: business.address,
          subscriptionStatus: business.subscriptionStatus,
          siteSlug: siteSlug ?? null,
          sitePath: siteSlug ? `/sites/${siteSlug}` : null,
          distanceMeters,
          coordinates,
        } satisfies NearbyBusinessDiscoveryDto;
      })
      .filter((business) => business !== null)
      .sort(
        (left, right) => left.distanceMeters - right.distanceMeters
      ) as NearbyBusinessDiscoveryDto[];
  }

  private async getNearbyChannels(
    allCommunities: LocalityCommunityRecord[],
    communities: NearbyCommunityDiscoveryDto[],
    anchor: { lat: number; lng: number },
    radiusMeters: number
  ): Promise<NearbyChannelDiscoveryDto[]> {
    const channels = (await firstValueFrom(
      this.videosClient.send({ cmd: VideoCommands.FIND_ALL_CHANNELS }, {})
    )) as ChannelRecord[];
    const nearbyCommunityById = new Map(
      communities.map((community) => [community.id, community])
    );
    const communityById = new Map(
      allCommunities.map((community) => [community.id, community])
    );

    return (channels || [])
      .map((channel) => {
        const nearbyCommunity = nearbyCommunityById.get(channel.communityId);
        const community = communityById.get(channel.communityId);
        const coordinates = this.resolveEntityCoordinates(channel, community);
        if (!coordinates) {
          return null;
        }

        const distanceMeters =
          nearbyCommunity?.distanceMeters ??
          Math.round(this.calculateDistanceMeters(anchor, coordinates));
        if (distanceMeters > radiusMeters) {
          return null;
        }

        return {
          id: channel.id,
          communityId: channel.communityId,
          communitySlug: channel.communitySlug ?? community?.slug ?? null,
          name: channel.name,
          description: channel.description,
          isPublic: channel.isPublic,
          memberCount: channel.memberCount,
          timezone: channel.timezone,
          distanceMeters,
          coordinates,
        } satisfies NearbyChannelDiscoveryDto;
      })
      .filter((channel) => channel !== null)
      .sort((left, right) => left.distanceMeters - right.distanceMeters);
  }

  private findNearbyCommunities(
    communities: LocalityCommunityRecord[],
    anchor: { lat: number; lng: number },
    radiusMeters: number,
    limit: number
  ): NearbyCommunityDiscoveryDto[] {
    return communities
      .map((community) => {
        const coordinates = this.extractCoordinates(community);
        if (!coordinates) {
          return null;
        }

        const distanceMeters = Math.round(
          this.calculateDistanceMeters(anchor, coordinates)
        );

        if (distanceMeters > radiusMeters) {
          return null;
        }

        return {
          id: community.id,
          name: community.name,
          slug: community.slug ?? null,
          description: community.description,
          localityType: community.localityType ?? null,
          city: community.city ?? null,
          adminArea: community.adminArea ?? null,
          countryCode: community.countryCode ?? null,
          timezone: community.timezone ?? null,
          imageUrl: community.imageUrl ?? null,
          memberCount: community.memberCount,
          appScope: community.appScope,
          distanceMeters,
          coordinates,
        } satisfies NearbyCommunityDiscoveryDto;
      })
      .filter((community) => community !== null)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, limit) as NearbyCommunityDiscoveryDto[];
  }

  private resolveLocalityLabel(
    community: NearbyCommunityDiscoveryDto | undefined,
    anchor: { lat: number; lng: number }
  ) {
    if (!community) {
      const primary = `Near ${anchor.lat.toFixed(3)}, ${anchor.lng.toFixed(3)}`;
      return {
        primary,
        secondary: 'Anchor coordinates',
        formatted: primary,
        source: 'coordinates' as const,
      };
    }

    const primary = (community.city || community.name || '').trim();
    const secondary = [community.adminArea, community.countryCode]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(', ');

    return {
      primary,
      secondary: secondary || undefined,
      formatted: [primary, secondary].filter(Boolean).join(', '),
      city: community.city || undefined,
      adminArea: community.adminArea || undefined,
      countryCode: community.countryCode || undefined,
      timezone: community.timezone || undefined,
      source: 'community-metadata' as const,
    };
  }

  private normalizeMatchKey(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private extractCoordinates(community: LocalityCommunityRecord) {
    const lat = this.coerceNullableNumber(community.lat);
    const lng = this.coerceNullableNumber(community.lng);

    if (lat === null || lng === null) {
      return null;
    }

    return { lat, lng };
  }

  private resolveEntityCoordinates(
    entity: {
      anchorLat?: number | string | null;
      anchorLng?: number | string | null;
    },
    community?: LocalityCommunityRecord
  ) {
    const anchorLat = Number(entity.anchorLat);
    const anchorLng = Number(entity.anchorLng);
    if (Number.isFinite(anchorLat) && Number.isFinite(anchorLng)) {
      return { lat: anchorLat, lng: anchorLng };
    }

    return community ? this.extractCoordinates(community) : null;
  }

  private coerceCoordinate(
    value: number | string,
    field: 'lat' | 'lng'
  ): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid ${field} coordinate`);
    }

    return parsed;
  }

  private coercePositiveInt(
    value: number | string | undefined,
    fallback: number
  ): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.round(parsed);
  }

  private coerceNullableNumber(value: number | string | null | undefined) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private calculateDistanceMeters(
    left: { lat: number; lng: number },
    right: { lat: number; lng: number }
  ) {
    const leftLat = this.toRadians(left.lat);
    const rightLat = this.toRadians(right.lat);
    const deltaLat = this.toRadians(right.lat - left.lat);
    const deltaLng = this.toRadians(right.lng - left.lng);

    const haversine =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(leftLat) *
        Math.cos(rightLat) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);

    return (
      2 *
      EARTH_RADIUS_METERS *
      Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
    );
  }

  private toRadians(value: number) {
    return (value * Math.PI) / 180;
  }
}
