import { LocalityType } from './community';

export interface AnchorPoint {
  lat: number;
  lng: number;
}

export interface RadiusScope {
  anchor: AnchorPoint;
  radiusMeters: number;
}

export type LocalityLabelSource =
  | 'reverse-geocode'
  | 'community-metadata'
  | 'coordinates';

export interface ResolvedLocalityLabel {
  primary: string;
  secondary?: string;
  formatted: string;
  city?: string | null;
  adminArea?: string | null;
  countryCode?: string | null;
  timezone?: string | null;
  source: LocalityLabelSource;
}

export interface LocalityPresentationHighlight {
  headline: string;
  link: string;
  imageUrl: string;
}

const METERS_PER_MILE = 1609.34;

const DEFAULT_RADIUS_MILES_BY_TYPE: Record<LocalityType, number> = {
  [LocalityType.NEIGHBORHOOD]: 10,
  [LocalityType.TOWN]: 20,
  [LocalityType.CITY]: 25,
  [LocalityType.COUNTY]: 40,
  [LocalityType.REGION]: 75,
};

function formatCoordinate(value: number): string {
  return value.toFixed(3);
}

function toSeedFragment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function buildCoordinateFallbackLabel(
  anchor: AnchorPoint
): ResolvedLocalityLabel {
  const primary = `Near ${formatCoordinate(anchor.lat)}, ${formatCoordinate(
    anchor.lng
  )}`;

  return {
    primary,
    secondary: 'Anchor coordinates',
    formatted: primary,
    source: 'coordinates',
  };
}

export function buildResolvedLocalityLabel(input: {
  primary?: string | null;
  city?: string | null;
  adminArea?: string | null;
  countryCode?: string | null;
  timezone?: string | null;
  source?: LocalityLabelSource;
}): ResolvedLocalityLabel {
  const primary = (input.primary || input.city || '').trim();
  const secondaryParts = [input.adminArea, input.countryCode].filter(
    (value): value is string => !!value?.trim()
  );
  const secondary = secondaryParts.join(', ');
  const formatted = [primary, secondary].filter(Boolean).join(', ');

  return {
    primary,
    secondary: secondary || undefined,
    formatted: formatted || primary,
    city: input.city?.trim() || undefined,
    adminArea: input.adminArea?.trim() || undefined,
    countryCode: input.countryCode?.trim() || undefined,
    timezone: input.timezone?.trim() || undefined,
    source: input.source ?? 'community-metadata',
  };
}

export function getDefaultLocalityRadiusMeters(
  localityType: LocalityType | `${LocalityType}` | null | undefined
): number {
  const radiusMiles =
    (localityType &&
      DEFAULT_RADIUS_MILES_BY_TYPE[localityType as LocalityType]) ||
    DEFAULT_RADIUS_MILES_BY_TYPE[LocalityType.CITY];

  return Math.round(radiusMiles * METERS_PER_MILE);
}

export function buildFallbackLocalityImageUrl(slug: string): string {
  return `https://picsum.photos/seed/${toSeedFragment(slug)}/1200/800`;
}

export function buildFallbackLocalityHighlights(input: {
  slug: string;
  localityName: string;
}): LocalityPresentationHighlight[] {
  const seedBase = toSeedFragment(input.slug);

  return [
    {
      headline: `${input.localityName} downtown favorites`,
      link: `https://example.com/${seedBase}/downtown`,
      imageUrl: `https://picsum.photos/seed/${seedBase}-downtown/800/600`,
    },
    {
      headline: `${input.localityName} local dining`,
      link: `https://example.com/${seedBase}/food`,
      imageUrl: `https://picsum.photos/seed/${seedBase}-food/800/600`,
    },
    {
      headline: `${input.localityName} parks and outdoors`,
      link: `https://example.com/${seedBase}/outdoors`,
      imageUrl: `https://picsum.photos/seed/${seedBase}-outdoors/800/600`,
    },
  ];
}
