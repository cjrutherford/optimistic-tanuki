import { BusinessPageDto } from './models';

/** Sample business pages for Storybook stories. */
export const sampleBusiness: BusinessPageDto = {
  id: 'business-1',
  userId: 'user-1',
  ownerId: 'user-1',
  localityId: 'locality-1',
  communityId: 'community-1',
  name: 'Riverside Bike Works',
  description:
    'Repairs, tune-ups, and refurbished bikes for commuters and weekend riders.',
  logoUrl: 'https://placehold.co/160x160/1e293b/e2e8f0?text=RBW',
  website: 'https://example.com',
  phone: '(912) 555-0142',
  email: 'hello@example.com',
  address: '214 River St, Savannah, GA',
  tier: 'pro',
  status: 'active',
  subscriptionStatus: 'active',
  locations: ['Savannah', 'Tybee Island'],
  createdAt: '2026-06-12T12:00:00Z',
  updatedAt: '2026-09-01T12:00:00Z',
};

export const sampleBusinesses: BusinessPageDto[] = [
  sampleBusiness,
  {
    ...sampleBusiness,
    id: 'business-2',
    name: 'Marsh Hen Bakery',
    description: 'Sourdough, pastries, and a Saturday market stall.',
    logoUrl: undefined,
    tier: 'basic',
    locations: ['Savannah'],
  },
  {
    ...sampleBusiness,
    id: 'business-3',
    name: 'Coastal Ledger Accounting',
    description: 'Bookkeeping and tax preparation for small businesses.',
    tier: 'enterprise',
    status: 'past-due',
    subscriptionStatus: 'past-due',
    locations: ['Savannah', 'Brunswick', 'Hilton Head'],
  },
];
