export type FeaturedSpotType =
  | 'hero'
  | 'featured-carousel'
  | 'sidebar'
  | 'top-list';

export interface BusinessPlacement {
  id: FeaturedSpotType;
  name: string;
  description: string;
  availableForTiers: ('basic' | 'pro' | 'enterprise')[];
}

export const BUSINESS_PLACEMENTS: BusinessPlacement[] = [
  {
    id: 'hero',
    name: 'Hero Spotlight',
    description:
      'Premium banner at the top of the city page with custom branding',
    availableForTiers: ['enterprise'],
  },
  {
    id: 'featured-carousel',
    name: 'Featured Carousel',
    description: 'Showcase your business in the featured businesses carousel',
    availableForTiers: ['pro', 'enterprise'],
  },
  {
    id: 'sidebar',
    name: 'Sidebar Featured',
    description: 'Persistent presence in the sidebar area',
    availableForTiers: ['pro', 'enterprise'],
  },
  {
    id: 'top-list',
    name: 'Top of List',
    description: 'Always appear at the top of the business listings',
    availableForTiers: ['pro', 'enterprise'],
  },
];

export const getPlacementForTier = (
  tier: 'basic' | 'pro' | 'enterprise'
): BusinessPlacement[] => {
  return BUSINESS_PLACEMENTS.filter((p) => p.availableForTiers.includes(tier));
};

export const getDefaultPlacementForTier = (
  tier: 'basic' | 'pro' | 'enterprise'
): FeaturedSpotType | null => {
  switch (tier) {
    case 'enterprise':
      return 'hero';
    case 'pro':
      return 'featured-carousel';
    default:
      return null;
  }
};
