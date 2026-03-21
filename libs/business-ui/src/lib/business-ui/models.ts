export interface BusinessPageDto {
    id: string;
    userId: string;
    ownerId?: string;
    localityId?: string;
    communityId: string;
    name: string;
    description?: string;
    logoUrl?: string;
    website?: string;
    phone?: string;
    email?: string;
    address?: string;
    tier: 'basic' | 'pro' | 'enterprise';
    status: 'active' | 'past-due' | 'canceled' | 'trial';
    subscriptionStatus?: 'active' | 'inactive' | 'cancelled' | 'past-due';
    locations: string[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateBusinessPageDto {
    name: string;
    description?: string;
    website?: string;
    phone?: string;
    email?: string;
    address?: string;
    tier: 'basic' | 'pro' | 'enterprise';
    localityId: string;
}

export interface UpdateBusinessPageDto {
    name?: string;
    description?: string;
    website?: string;
    phone?: string;
    email?: string;
    address?: string;
    logoUrl?: string;
}
