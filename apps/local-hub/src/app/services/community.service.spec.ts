import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { CommunityService, LocalCommunity } from './community.service';

describe('CommunityService', () => {
  let service: CommunityService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CommunityService,
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });

    service = TestBed.inject(CommunityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
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
        id: 'statesboro',
        name: 'Statesboro, GA',
        slug: 'statesboro-ga',
        description: 'Statesboro',
        localityType: 'town',
        countryCode: 'US',
        adminArea: 'GA',
        city: 'Statesboro',
        memberCount: 3,
        createdAt: '2024-01-01T00:00:00.000Z',
        lat: 32.4488,
        lng: -81.7832,
        population: 33813,
        imageUrl: 'https://example.com/statesboro.jpg',
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
        parentId: 'savannah',
      },
    ];

    expect(service.getLocalitiesFromCommunities(communities)).toEqual([
      {
        id: 'augusta',
        name: 'Augusta',
        slug: 'augusta-ga',
        localityType: 'city',
        countryCode: 'US',
        adminArea: 'GA',
        description: 'Augusta',
        imageUrl: 'https://example.com/augusta.jpg',
        coordinates: {
          lat: 33.44,
          lng: -81.96,
        },
        label: {
          primary: 'Augusta',
          secondary: 'GA, US',
          formatted: 'Augusta, GA, US',
          city: 'Augusta',
          adminArea: 'GA',
          countryCode: 'US',
          timezone: 'America/New_York',
          source: 'community-metadata',
        },
        scope: {
          anchor: {
            lat: 33.44,
            lng: -81.96,
          },
          radiusMeters: 40234,
        },
        population: 197166,
        timezone: 'America/New_York',
        highlights: [
          {
            headline: 'Augusta downtown favorites',
            link: 'https://example.com/augusta-ga/downtown',
            imageUrl: 'https://picsum.photos/seed/augusta-ga-downtown/800/600',
          },
          {
            headline: 'Augusta local dining',
            link: 'https://example.com/augusta-ga/food',
            imageUrl: 'https://picsum.photos/seed/augusta-ga-food/800/600',
          },
          {
            headline: 'Augusta parks and outdoors',
            link: 'https://example.com/augusta-ga/outdoors',
            imageUrl: 'https://picsum.photos/seed/augusta-ga-outdoors/800/600',
          },
        ],
        communities: 1,
      },
      {
        id: 'savannah',
        name: 'Savannah',
        slug: 'savannah-ga',
        localityType: 'city',
        countryCode: 'US',
        adminArea: 'GA',
        description: 'Savannah',
        imageUrl: 'https://example.com/savannah.jpg',
        coordinates: {
          lat: 32.08,
          lng: -81.09,
        },
        label: {
          primary: 'Savannah',
          secondary: 'GA, US',
          formatted: 'Savannah, GA, US',
          city: 'Savannah',
          adminArea: 'GA',
          countryCode: 'US',
          timezone: 'America/New_York',
          source: 'community-metadata',
        },
        scope: {
          anchor: {
            lat: 32.08,
            lng: -81.09,
          },
          radiusMeters: 40234,
        },
        population: 147088,
        timezone: 'America/New_York',
        highlights: [
          {
            headline: 'Savannah downtown favorites',
            link: 'https://example.com/savannah-ga/downtown',
            imageUrl: 'https://picsum.photos/seed/savannah-ga-downtown/800/600',
          },
          {
            headline: 'Savannah local dining',
            link: 'https://example.com/savannah-ga/food',
            imageUrl: 'https://picsum.photos/seed/savannah-ga-food/800/600',
          },
          {
            headline: 'Savannah parks and outdoors',
            link: 'https://example.com/savannah-ga/outdoors',
            imageUrl: 'https://picsum.photos/seed/savannah-ga-outdoors/800/600',
          },
        ],
        communities: 2,
      },
      {
        id: 'statesboro',
        name: 'Statesboro',
        slug: 'statesboro-ga',
        localityType: 'town',
        countryCode: 'US',
        adminArea: 'GA',
        description: 'Statesboro',
        imageUrl: 'https://example.com/statesboro.jpg',
        coordinates: {
          lat: 32.4488,
          lng: -81.7832,
        },
        label: {
          primary: 'Statesboro',
          secondary: 'GA, US',
          formatted: 'Statesboro, GA, US',
          city: 'Statesboro',
          adminArea: 'GA',
          countryCode: 'US',
          timezone: 'America/New_York',
          source: 'community-metadata',
        },
        scope: {
          anchor: {
            lat: 32.4488,
            lng: -81.7832,
          },
          radiusMeters: 32187,
        },
        population: 33813,
        timezone: 'America/New_York',
        highlights: [
          {
            headline: 'Statesboro downtown favorites',
            link: 'https://example.com/statesboro-ga/downtown',
            imageUrl:
              'https://picsum.photos/seed/statesboro-ga-downtown/800/600',
          },
          {
            headline: 'Statesboro local dining',
            link: 'https://example.com/statesboro-ga/food',
            imageUrl: 'https://picsum.photos/seed/statesboro-ga-food/800/600',
          },
          {
            headline: 'Statesboro parks and outdoors',
            link: 'https://example.com/statesboro-ga/outdoors',
            imageUrl:
              'https://picsum.photos/seed/statesboro-ga-outdoors/800/600',
          },
        ],
        communities: 1,
      },
    ]);
  });

  it('keeps the city-facing API as a compatibility wrapper', () => {
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
      },
    ];

    expect(service.getCitiesFromCommunities(communities)).toEqual(
      service.getLocalitiesFromCommunities(communities)
    );
  });

  it('creates fallback locality presentation when image and highlights are missing', () => {
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
      },
    ];

    expect(service.getLocalitiesFromCommunities(communities)).toEqual([
      {
        id: 'savannah',
        name: 'Savannah',
        slug: 'savannah-ga',
        localityType: 'city',
        countryCode: 'US',
        adminArea: 'GA',
        description: 'Savannah',
        imageUrl: 'https://picsum.photos/seed/savannah-ga/1200/800',
        coordinates: {
          lat: 32.08,
          lng: -81.09,
        },
        label: {
          primary: 'Savannah',
          secondary: 'GA, US',
          formatted: 'Savannah, GA, US',
          city: 'Savannah',
          adminArea: 'GA',
          countryCode: 'US',
          source: 'community-metadata',
        },
        scope: {
          anchor: {
            lat: 32.08,
            lng: -81.09,
          },
          radiusMeters: 40234,
        },
        population: 0,
        timezone: '',
        highlights: [
          {
            headline: 'Savannah downtown favorites',
            link: 'https://example.com/savannah-ga/downtown',
            imageUrl: 'https://picsum.photos/seed/savannah-ga-downtown/800/600',
          },
          {
            headline: 'Savannah local dining',
            link: 'https://example.com/savannah-ga/food',
            imageUrl: 'https://picsum.photos/seed/savannah-ga-food/800/600',
          },
          {
            headline: 'Savannah parks and outdoors',
            link: 'https://example.com/savannah-ga/outdoors',
            imageUrl: 'https://picsum.photos/seed/savannah-ga-outdoors/800/600',
          },
        ],
        communities: 1,
      },
    ]);
  });

  it('returns a root locality slug for child communities', async () => {
    jest.spyOn(service, 'getCommunities').mockResolvedValue([
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
      },
      {
        id: 'makers',
        name: 'Starland Makers',
        slug: 'starland-makers',
        description: 'Neighborhood',
        localityType: 'neighborhood',
        parentId: 'savannah',
        countryCode: 'US',
        adminArea: 'GA',
        city: 'Savannah',
        memberCount: 12,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ]);

    const lookupPromise = service.getCitySlugForCommunity('starland-makers');

    httpMock.expectOne('/api/communities/slug/starland-makers').flush({
      id: 'makers',
      name: 'Starland Makers',
      slug: 'starland-makers',
      description: 'Neighborhood',
      localityType: 'neighborhood',
      parentId: 'savannah',
      countryCode: 'US',
      adminArea: 'GA',
      city: 'Savannah',
      memberCount: 12,
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    await expect(lookupPromise).resolves.toBe('savannah-ga');
  });

  it('provides a locality-first slug lookup alias for child communities', async () => {
    jest.spyOn(service, 'getCommunities').mockResolvedValue([
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
      },
      {
        id: 'makers',
        name: 'Starland Makers',
        slug: 'starland-makers',
        description: 'Neighborhood',
        localityType: 'neighborhood',
        parentId: 'savannah',
        countryCode: 'US',
        adminArea: 'GA',
        city: 'Savannah',
        memberCount: 12,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ]);

    const lookupPromise =
      service.getLocalitySlugForCommunity('starland-makers');

    httpMock.expectOne('/api/communities/slug/starland-makers').flush({
      id: 'makers',
      name: 'Starland Makers',
      slug: 'starland-makers',
      description: 'Neighborhood',
      localityType: 'neighborhood',
      parentId: 'savannah',
      countryCode: 'US',
      adminArea: 'GA',
      city: 'Savannah',
      memberCount: 12,
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    await expect(lookupPromise).resolves.toBe('savannah-ga');
  });

  it('creates communities through the social community endpoint', async () => {
    const createPromise = service.createCommunity({
      name: 'Starland Makers',
      description: 'Neighborhood community',
      parentId: 'city-123',
      localityType: 'neighborhood',
      isPrivate: false,
      joinPolicy: 'public',
      tags: ['makers', 'events'],
      bannerAssetId: 'banner-1',
      logoAssetId: 'logo-1',
    });

    const request = httpMock.expectOne('/api/social/community');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Starland Makers',
      description: 'Neighborhood community',
      parentId: 'city-123',
      localityType: 'neighborhood',
      isPrivate: false,
      joinPolicy: 'public',
      tags: ['makers', 'events'],
      bannerAssetId: 'banner-1',
      logoAssetId: 'logo-1',
      createChatRoom: true,
    });

    request.flush({
      id: 'community-123',
      name: 'Starland Makers',
      slug: 'starland-makers',
      description: 'Neighborhood community',
      parentId: 'city-123',
      localityType: 'neighborhood',
      countryCode: 'US',
      adminArea: 'GA',
      city: 'Savannah',
      memberCount: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    await expect(createPromise).resolves.toMatchObject({
      id: 'community-123',
      slug: 'starland-makers',
    });
  });

  it('repairs or creates a community chat room through the community endpoint', async () => {
    const ensurePromise = service.ensureCommunityChatRoom(
      'community-123',
      'user-123',
      'Starland Makers'
    );

    const request = httpMock.expectOne(
      '/api/communities/community-123/chat-room'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      ownerId: 'user-123',
      name: 'Starland Makers',
    });

    request.flush({ id: 'chat-room-123' });

    await expect(ensurePromise).resolves.toEqual({ id: 'chat-room-123' });
  });
});
