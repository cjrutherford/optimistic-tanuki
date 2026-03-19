export type BusinessTierType = 'basic' | 'pro' | 'enterprise';

export interface BusinessTierFeature {
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  features: string[];
  notIncluded: string[];
  maxLocalities: number;
  hasAnalytics: boolean;
  hasCustomBranding: boolean;
  hasPrioritySupport: boolean;
  hasApiAccess: boolean;
  defaultPlacement:
    | 'hero'
    | 'featured-carousel'
    | 'sidebar'
    | 'top-list'
    | null;
}

export const BUSINESS_TIER_FEATURES: Record<
  BusinessTierType,
  BusinessTierFeature
> = {
  basic: {
    name: 'Basic',
    price: 0,
    priceLabel: 'Free',
    description:
      'Get your business listed and discovered by the local community.',
    features: [
      'Business listing with name & description',
      'Logo & contact information',
      'Website link',
      'Phone & email display',
      'Address with map link',
      'Visible in city business listings',
    ],
    notIncluded: [
      'Featured placement',
      'Featured carousel position',
      'Sidebar presence',
      'Analytics dashboard',
      'Custom branding',
      'Multiple localities',
      'API access',
      'Priority support',
    ],
    maxLocalities: 1,
    hasAnalytics: false,
    hasCustomBranding: false,
    hasPrioritySupport: false,
    hasApiAccess: false,
    defaultPlacement: null,
  },
  pro: {
    name: 'Pro',
    price: 29,
    priceLabel: '$29/mo',
    description:
      'Stand out with featured placement and gain insights with analytics.',
    features: [
      'Everything in Basic',
      'Featured carousel position',
      'Top of list priority',
      'Analytics dashboard',
      'Basic insights (views, clicks)',
      'Priority support',
    ],
    notIncluded: [
      'Hero spotlight',
      'Sidebar featured placement',
      'Custom branding',
      'Multiple localities',
      'API access',
    ],
    maxLocalities: 1,
    hasAnalytics: true,
    hasCustomBranding: false,
    hasPrioritySupport: true,
    hasApiAccess: false,
    defaultPlacement: 'featured-carousel',
  },
  enterprise: {
    name: 'Enterprise',
    price: 99,
    priceLabel: '$99/mo',
    description:
      'Full control with custom branding, multiple localities, and premium placement.',
    features: [
      'Everything in Pro',
      'Hero spotlight placement',
      'Sidebar featured placement',
      'Custom branding (colors & personality)',
      'Multiple localities (up to 5)',
      'API access',
      'Dedicated account manager',
      'Priority support',
      'Custom spotlight content',
    ],
    notIncluded: [],
    maxLocalities: 5,
    hasAnalytics: true,
    hasCustomBranding: true,
    hasPrioritySupport: true,
    hasApiAccess: true,
    defaultPlacement: 'hero',
  },
};

export const getTierFromPrice = (price: number): BusinessTierType => {
  if (price === 0) return 'basic';
  if (price === 29) return 'pro';
  if (price === 99) return 'enterprise';
  return 'basic';
};
