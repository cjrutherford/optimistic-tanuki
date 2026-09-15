import { ClassifiedAdDto } from './index';

/** Sample listings for Storybook stories. */
export const sampleClassifiedAd: ClassifiedAdDto = {
  id: 'ad-1',
  communityId: 'community-1',
  profileId: 'profile-1',
  userId: 'user-1',
  sellerProfileName: 'Ari Stone',
  sellerProfilePic: 'https://placehold.co/96x96/0f172a/e2e8f0?text=AS',
  title: 'Solid oak dining table',
  description:
    'Seats six. A few surface scratches, otherwise sturdy and ready for a new home.',
  price: 180,
  currency: 'USD',
  category: 'Furniture',
  condition: 'Good',
  imageUrls: ['https://placehold.co/640x400/334155/e2e8f0?text=Dining+Table'],
  status: 'active',
  isFeatured: false,
  featuredUntil: null,
  appScope: 'local-hub',
  createdAt: '2026-09-01T15:00:00Z',
  updatedAt: '2026-09-01T15:00:00Z',
  expiresAt: '2026-10-01T15:00:00Z',
};

export const sampleClassifiedAds: ClassifiedAdDto[] = [
  sampleClassifiedAd,
  {
    ...sampleClassifiedAd,
    id: 'ad-2',
    title: 'Road bike, 54cm frame',
    description: 'Aluminium frame, new tyres this spring. Tuned and ready.',
    price: 420,
    category: 'Sports',
    condition: 'Like New',
    imageUrls: ['https://placehold.co/640x400/1e293b/e2e8f0?text=Road+Bike'],
    isFeatured: true,
    featuredUntil: '2026-09-20T15:00:00Z',
  },
  {
    ...sampleClassifiedAd,
    id: 'ad-3',
    title: 'Garden tools bundle',
    description: 'Rake, spade, hoe, and pruning shears. Free to a good home.',
    price: 0,
    category: 'Free',
    condition: 'Fair',
    imageUrls: null,
  },
];
