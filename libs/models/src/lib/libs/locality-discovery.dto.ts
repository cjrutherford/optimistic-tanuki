export type LocalityDiscoveryLabelSource = 'community-metadata' | 'coordinates';

export interface LocalityDiscoveryLabelDto {
  primary: string;
  secondary?: string;
  formatted: string;
  city?: string;
  adminArea?: string;
  countryCode?: string;
  timezone?: string;
  source: LocalityDiscoveryLabelSource;
}

export interface NearbyCommunityDiscoveryDto {
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
  distanceMeters: number;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface NearbyBusinessDiscoveryDto {
  id: string;
  communityId: string;
  communitySlug?: string | null;
  ownerId?: string | null;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  subscriptionStatus?: string;
  siteSlug?: string | null;
  sitePath?: string | null;
  distanceMeters: number;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface NearbyChannelDiscoveryDto {
  id: string;
  communityId: string;
  communitySlug?: string | null;
  name: string;
  description?: string | null;
  isPublic?: boolean;
  memberCount?: number;
  timezone?: string | null;
  distanceMeters: number;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface LocalityDiscoveryResultDto {
  anchor: {
    lat: number;
    lng: number;
  };
  radiusMeters: number;
  locality: LocalityDiscoveryLabelDto;
  communities: NearbyCommunityDiscoveryDto[];
  businesses: NearbyBusinessDiscoveryDto[];
  channels: NearbyChannelDiscoveryDto[];
}
