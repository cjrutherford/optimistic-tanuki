export type ClassifiedAdStatus = 'active' | 'sold' | 'expired' | 'removed';

export interface ClassifiedAdDto {
  id: string;
  communityId: string;
  profileId: string;
  userId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string | null;
  condition: string | null;
  imageUrls: string[] | null;
  status: ClassifiedAdStatus;
  isFeatured: boolean;
  featuredUntil: string | null;
  appScope: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export interface CreateClassifiedAdDto {
  communityId: string;
  title: string;
  description: string;
  price: number;
  currency?: string;
  category?: string;
  condition?: string;
  imageUrls?: string[];
}

export interface UpdateClassifiedAdDto {
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  condition?: string;
  imageUrls?: string[];
}

export interface SearchClassifiedsDto {
  communityId?: string;
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export const CLASSIFIED_CATEGORIES = [
  'Electronics',
  'Furniture',
  'Clothing',
  'Vehicles',
  'Tools',
  'Sports',
  'Garden',
  'Services',
  'Housing',
  'Jobs',
  'Free',
  'Other',
] as const;

export const CLASSIFIED_CONDITIONS = [
  'New',
  'Like New',
  'Good',
  'Fair',
  'Parts Only',
] as const;
