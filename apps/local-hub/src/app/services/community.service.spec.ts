import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { CommunityService, LocalCommunity } from './community.service';

describe('CommunityService', () => {
    let service: CommunityService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [CommunityService, { provide: API_BASE_URL, useValue: '/api' }],
        });

        service = TestBed.inject(CommunityService);
    });

    it('derives cities from communities in alphabetical order', () => {
        const communities: LocalCommunity[] = [
            {
                id: 'savannah',
                name: 'Savannah, GA',
                slug: 'savannah-ga',
                description: 'Savannah',
                localityType: 'city',
                countryCode: 'US',
                adminArea: 'GA',
                city: 'Savannah',
                memberCount: 5,
                createdAt: '2024-01-01T00:00:00.000Z',
                lat: 32.08,
                lng: -81.09,
                population: 147088,
                imageUrl: 'https://example.com/savannah.jpg',
                timezone: 'America/New_York',
            },
            {
                id: 'augusta',
                name: 'Augusta, GA',
                slug: 'augusta-ga',
                description: 'Augusta',
                localityType: 'city',
                countryCode: 'US',
                adminArea: 'GA',
                city: 'Augusta',
                memberCount: 5,
                createdAt: '2024-01-01T00:00:00.000Z',
                coordinates: {
                    lat: 33.44,
                    lng: -81.96,
                },
                population: 197166,
                imageUrl: 'https://example.com/augusta.jpg',
                timezone: 'America/New_York',
            },
            {
                id: 'makers',
                name: 'Starland Makers',
                slug: 'starland-makers',
                description: 'Neighborhood',
                localityType: 'neighborhood',
                countryCode: 'US',
                adminArea: 'GA',
                city: 'Savannah',
                memberCount: 12,
                createdAt: '2024-01-01T00:00:00.000Z',
            },
        ];

        expect(service.getCitiesFromCommunities(communities)).toEqual([
            {
                id: 'augusta',
                name: 'Augusta',
                slug: 'augusta-ga',
                countryCode: 'US',
                adminArea: 'GA',
                description: 'Augusta',
                imageUrl: 'https://example.com/augusta.jpg',
                coordinates: {
                    lat: 33.44,
                    lng: -81.96,
                },
                population: 197166,
                timezone: 'America/New_York',
                highlights: [],
                communities: 1,
            },
            {
                id: 'savannah',
                name: 'Savannah',
                slug: 'savannah-ga',
                countryCode: 'US',
                adminArea: 'GA',
                description: 'Savannah',
                imageUrl: 'https://example.com/savannah.jpg',
                coordinates: {
                    lat: 32.08,
                    lng: -81.09,
                },
                population: 147088,
                timezone: 'America/New_York',
                highlights: [],
                communities: 1,
            },
        ]);
    });
});