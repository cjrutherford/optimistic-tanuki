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
        communities: 2,
      },
      {
        id: 'statesboro',
        name: 'Statesboro',
        slug: 'statesboro-ga',
        countryCode: 'US',
        adminArea: 'GA',
        description: 'Statesboro',
        imageUrl: 'https://example.com/statesboro.jpg',
        coordinates: {
          lat: 32.4488,
          lng: -81.7832,
        },
        population: 33813,
        timezone: 'America/New_York',
        highlights: [],
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

  describe('http-backed operations', () => {
    // Lets a pending `await` inside the service continue before the next
    // request is asserted on. Real timers only — no fake timers in this suite.
    const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    const makeCommunity = (
      overrides: Partial<LocalCommunity> = {}
    ): LocalCommunity => ({
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
      ...overrides,
    });

    let consoleError: jest.SpyInstance;

    beforeEach(() => {
      consoleError = jest.spyOn(console, 'error').mockImplementation(() => {
        /* keep test output quiet */
      });
    });

    afterEach(() => {
      consoleError.mockRestore();
    });

    it('normalizes flat lat/lng into coordinates when listing communities', async () => {
      const promise = service.getCommunities();

      httpMock
        .expectOne('/api/communities')
        .flush([makeCommunity({ lat: 32.08, lng: -81.09 })]);

      const communities = await promise;
      expect(communities[0].coordinates).toEqual({ lat: 32.08, lng: -81.09 });
    });

    it('falls back to an empty list when the communities API returns a non-array', async () => {
      const promise = service.getCommunities();

      httpMock.expectOne('/api/communities').flush({ message: 'unauthorized' });

      await expect(promise).resolves.toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(
        'API returned non-array for communities:',
        { message: 'unauthorized' }
      );
    });

    it('normalizes sub-communities and defaults missing coordinates to zero', async () => {
      const promise = service.getSubCommunities('savannah');

      httpMock
        .expectOne('/api/communities/savannah/sub-communities')
        .flush([makeCommunity({ id: 'makers', slug: 'starland-makers' })]);

      const subs = await promise;
      expect(subs[0].coordinates).toEqual({ lat: 0, lng: 0 });
    });

    it('falls back to an empty list when the sub-communities API returns a non-array', async () => {
      const promise = service.getSubCommunities('savannah');

      httpMock
        .expectOne('/api/communities/savannah/sub-communities')
        .flush(null);

      await expect(promise).resolves.toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(
        'API returned non-array for sub-communities:',
        null
      );
    });

    it('joins a community with an empty body', async () => {
      const promise = service.joinCommunity('community-1');

      const request = httpMock.expectOne('/api/communities/community-1/join');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({});
      request.flush({ status: 'joined' });

      await expect(promise).resolves.toEqual({ status: 'joined' });
    });

    it('leaves a community by deleting the membership', async () => {
      const promise = service.leaveCommunity('community-1');

      const request = httpMock.expectOne(
        '/api/communities/community-1/membership'
      );
      expect(request.request.method).toBe('DELETE');
      request.flush(null);

      await expect(promise).resolves.toBeNull();
    });

    it('reports membership status', async () => {
      const promise = service.isMember('community-1');

      const request = httpMock.expectOne(
        '/api/communities/community-1/membership'
      );
      expect(request.request.method).toBe('GET');
      request.flush(true);

      await expect(promise).resolves.toBe(true);
    });

    it('normalizes my memberships', async () => {
      const promise = service.getMyMemberships();

      httpMock
        .expectOne('/api/social/community/user/communities')
        .flush([makeCommunity({ lat: 1, lng: 2 })]);

      const memberships = await promise;
      expect(memberships[0].coordinates).toEqual({ lat: 1, lng: 2 });
    });

    it('returns an empty membership list when the API returns a non-array', async () => {
      const promise = service.getMyMemberships();

      httpMock
        .expectOne('/api/social/community/user/communities')
        .flush({ error: 'nope' });

      await expect(promise).resolves.toEqual([]);
    });

    it('encodes profile id and app scope when fetching user roles', async () => {
      const promise = service.getUserRoles('profile/1', 'local hub');

      const request = httpMock.expectOne(
        '/api/permissions/user-roles/profile%2F1?appScope=local%20hub'
      );
      request.flush([{ targetId: 'c1', role: { name: 'ADMIN' } }]);

      await expect(promise).resolves.toEqual([
        { targetId: 'c1', role: { name: 'ADMIN' } },
      ]);
    });

    it('swallows user-role lookup failures', async () => {
      const promise = service.getUserRoles('profile-1');

      httpMock
        .expectOne('/api/permissions/user-roles/profile-1?appScope=global')
        .flush('boom', { status: 500, statusText: 'Server Error' });

      await expect(promise).resolves.toEqual([]);
    });

    it('fetches the elected community manager', async () => {
      const promise = service.getCommunityManager('community-1');

      httpMock.expectOne('/api/communities/community-1/manager').flush({
        userId: 'u1',
        profileId: 'p1',
        name: 'Ada',
        electedAt: '2024-01-01T00:00:00.000Z',
        termEndsAt: '2025-01-01T00:00:00.000Z',
      });

      await expect(promise).resolves.toMatchObject({ name: 'Ada' });
    });

    it('returns null when the manager lookup fails', async () => {
      const promise = service.getCommunityManager('community-1');

      httpMock
        .expectOne('/api/communities/community-1/manager')
        .flush('boom', { status: 404, statusText: 'Not Found' });

      await expect(promise).resolves.toBeNull();
    });

    it('fetches the active election', async () => {
      const promise = service.getActiveElection('community-1');

      httpMock.expectOne('/api/communities/community-1/election').flush({
        id: 'e1',
        communityId: 'community-1',
        status: 'open',
        candidates: [],
        startedAt: '2024-01-01T00:00:00.000Z',
        endsAt: '2024-02-01T00:00:00.000Z',
      });

      await expect(promise).resolves.toMatchObject({ id: 'e1' });
    });

    it('returns null when the election lookup fails', async () => {
      const promise = service.getActiveElection('community-1');

      httpMock
        .expectOne('/api/communities/community-1/election')
        .flush('boom', { status: 500, statusText: 'Server Error' });

      await expect(promise).resolves.toBeNull();
    });

    it('self-nominates with an empty body when no nominee is supplied', async () => {
      const promise = service.nominateForManager('community-1');

      const request = httpMock.expectOne(
        '/api/communities/community-1/election/nominate'
      );
      expect(request.request.body).toEqual({});
      request.flush({
        userId: 'u1',
        profileId: 'p1',
        name: 'Ada',
        nominatedAt: '2024-01-01T00:00:00.000Z',
        votes: 0,
      });

      await expect(promise).resolves.toMatchObject({ userId: 'u1' });
    });

    it('nominates another user when a nominee id is supplied', async () => {
      const promise = service.nominateForManager('community-1', 'u2');

      const request = httpMock.expectOne(
        '/api/communities/community-1/election/nominate'
      );
      expect(request.request.body).toEqual({ nomineeId: 'u2' });
      request.flush({
        userId: 'u2',
        profileId: 'p2',
        name: 'Grace',
        nominatedAt: '2024-01-01T00:00:00.000Z',
        votes: 0,
      });

      await expect(promise).resolves.toMatchObject({ userId: 'u2' });
    });

    it('casts a vote for a candidate', async () => {
      const promise = service.voteForManager('community-1', 'u2');

      const request = httpMock.expectOne(
        '/api/communities/community-1/election/vote'
      );
      expect(request.request.body).toEqual({ candidateUserId: 'u2' });
      request.flush({
        id: 'e1',
        communityId: 'community-1',
        status: 'open',
        candidates: [],
        startedAt: '2024-01-01T00:00:00.000Z',
        endsAt: '2024-02-01T00:00:00.000Z',
        myVote: 'u2',
      });

      await expect(promise).resolves.toMatchObject({ myVote: 'u2' });
    });

    it('derives cities via the communities endpoint', async () => {
      const promise = service.getCities();

      httpMock
        .expectOne('/api/communities')
        .flush([makeCommunity({ lat: 32.08, lng: -81.09 })]);

      const cities = await promise;
      expect(cities).toHaveLength(1);
      expect(cities[0]).toMatchObject({ name: 'Savannah', communities: 1 });
    });

    it('returns an empty city list when the fetch fails', async () => {
      const promise = service.getCities();

      httpMock
        .expectOne('/api/communities')
        .flush('boom', { status: 500, statusText: 'Server Error' });

      await expect(promise).resolves.toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to fetch cities:',
        expect.anything()
      );
    });

    it('builds a city card for a root locality including child count', async () => {
      const promise = service.getCityBySlug('savannah-ga');

      httpMock
        .expectOne('/api/communities/slug/savannah-ga')
        .flush(makeCommunity());
      await tick();

      httpMock.expectOne('/api/communities').flush([
        makeCommunity(),
        makeCommunity({
          id: 'makers',
          slug: 'starland-makers',
          parentId: 'savannah',
          localityType: 'neighborhood',
        }),
      ]);

      await expect(promise).resolves.toMatchObject({
        id: 'savannah',
        name: 'Savannah',
        communities: 2,
      });
    });

    it('returns undefined when the slug does not belong to a root locality', async () => {
      const promise = service.getCityBySlug('starland-makers');

      httpMock.expectOne('/api/communities/slug/starland-makers').flush(
        makeCommunity({
          id: 'makers',
          slug: 'starland-makers',
          parentId: 'savannah',
          localityType: 'neighborhood',
        })
      );

      await expect(promise).resolves.toBeUndefined();
    });

    it('returns undefined when the city lookup fails', async () => {
      const promise = service.getCityBySlug('savannah-ga');

      httpMock
        .expectOne('/api/communities/slug/savannah-ga')
        .flush('boom', { status: 500, statusText: 'Server Error' });

      await expect(promise).resolves.toBeUndefined();
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to fetch city:',
        expect.anything()
      );
    });

    it('returns the community slug itself when it is already a root locality', async () => {
      const promise = service.getCitySlugForCommunity('savannah-ga');

      httpMock
        .expectOne('/api/communities/slug/savannah-ga')
        .flush(makeCommunity());

      await expect(promise).resolves.toBe('savannah-ga');
    });

    it('falls back to a root locality sharing the same city name', async () => {
      const promise = service.getCitySlugForCommunity('starland-makers');

      httpMock.expectOne('/api/communities/slug/starland-makers').flush(
        makeCommunity({
          id: 'makers',
          slug: 'starland-makers',
          localityType: 'neighborhood',
          parentId: 'missing-parent',
        })
      );
      await tick();

      httpMock.expectOne('/api/communities').flush([makeCommunity()]);

      await expect(promise).resolves.toBe('savannah-ga');
    });

    it('returns null when no root locality can be resolved', async () => {
      const promise = service.getCitySlugForCommunity('starland-makers');

      httpMock.expectOne('/api/communities/slug/starland-makers').flush(
        makeCommunity({
          id: 'makers',
          slug: 'starland-makers',
          city: 'Atlanta',
          localityType: 'neighborhood',
          parentId: 'missing-parent',
        })
      );
      await tick();

      httpMock.expectOne('/api/communities').flush([makeCommunity()]);

      await expect(promise).resolves.toBeNull();
    });

    it('returns null when the community slug lookup fails', async () => {
      const promise = service.getCitySlugForCommunity('nope');

      httpMock
        .expectOne('/api/communities/slug/nope')
        .flush('boom', { status: 404, statusText: 'Not Found' });

      await expect(promise).resolves.toBeNull();
    });

    it('combines sub-communities and legacy children, deduplicated by id', async () => {
      const promise = service.getCommunitiesForCity('savannah-ga');

      httpMock
        .expectOne('/api/communities/slug/savannah-ga')
        .flush(makeCommunity());
      await tick();

      httpMock.expectOne('/api/communities/savannah/sub-communities').flush([
        makeCommunity({
          id: 'makers',
          slug: 'starland-makers',
          parentId: 'savannah',
          localityType: 'neighborhood',
        }),
      ]);
      await tick();

      httpMock.expectOne('/api/communities').flush([
        // the city itself — must be skipped
        makeCommunity(),
        // already covered by the parentId path — must be skipped
        makeCommunity({
          id: 'makers',
          slug: 'starland-makers',
          parentId: 'savannah',
        }),
        // legacy child: no parentId but the city name slugifies to the city slug
        makeCommunity({
          id: 'legacy',
          slug: 'legacy-group',
          city: 'savannah ga',
          localityType: 'neighborhood',
        }),
        // different city — excluded
        makeCommunity({ id: 'other', slug: 'other', city: 'Atlanta' }),
      ]);

      const combined = await promise;
      expect(combined.map((c) => c.id)).toEqual([
        'savannah',
        'makers',
        'legacy',
      ]);
    });

    it('returns an empty community list for a city when the lookup fails', async () => {
      const promise = service.getCommunitiesForCity('savannah-ga');

      httpMock
        .expectOne('/api/communities/slug/savannah-ga')
        .flush('boom', { status: 500, statusText: 'Server Error' });

      await expect(promise).resolves.toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to fetch communities for city:',
        expect.anything()
      );
    });

    it('maps city posts and resolves each post to its own community', async () => {
      jest.spyOn(service, 'getCommunitiesForCity').mockResolvedValue([
        makeCommunity(),
        makeCommunity({
          id: 'makers',
          slug: 'starland-makers',
          name: 'Starland Makers',
        }),
      ]);

      const promise = service.getPostsForCity('savannah-ga');
      await tick();

      const request = httpMock.expectOne('/api/social/post/find');
      expect(request.request.body).toEqual({
        criteria: {
          communityIds: ['savannah', 'makers'],
          appScope: 'local-hub',
        },
      });
      request.flush([
        {
          id: 'p1',
          title: 'Hello',
          content: 'World',
          profileId: 'pr1',
          userId: 'u1',
          createdAt: new Date('2024-05-01T00:00:00.000Z'),
          communityId: 'makers',
        },
        {
          id: 'p2',
          title: 'Orphan',
          content: 'No community',
          profileId: 'pr1',
          userId: 'u1',
          createdAt: '2024-05-02T00:00:00.000Z',
        },
      ]);

      const posts = await promise;
      expect(posts[0]).toMatchObject({
        id: 'p1',
        communityId: 'makers',
        communitySlug: 'starland-makers',
        communityName: 'Starland Makers',
        authorName: 'Community Member',
        createdAt: '2024-05-01T00:00:00.000Z',
      });
      expect(posts[1]).toMatchObject({
        id: 'p2',
        communityId: 'savannah',
        communitySlug: 'savannah-ga',
        communityName: 'Savannah, GA',
        createdAt: '2024-05-02T00:00:00.000Z',
      });
    });

    it('skips the post query entirely when a city has no communities', async () => {
      jest.spyOn(service, 'getCommunitiesForCity').mockResolvedValue([]);

      await expect(service.getPostsForCity('savannah-ga')).resolves.toEqual([]);
    });

    it('returns an empty city post list when the post query fails', async () => {
      jest
        .spyOn(service, 'getCommunitiesForCity')
        .mockResolvedValue([makeCommunity()]);

      const promise = service.getPostsForCity('savannah-ga');
      await tick();

      httpMock
        .expectOne('/api/social/post/find')
        .flush('boom', { status: 500, statusText: 'Server Error' });

      await expect(promise).resolves.toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to fetch city posts:',
        expect.anything()
      );
    });

    it('queries only the root locality for root community posts', async () => {
      jest.spyOn(service, 'getCommunitiesForCity').mockResolvedValue([
        makeCommunity({
          id: 'makers',
          parentId: 'savannah',
          localityType: 'neighborhood',
        }),
        makeCommunity(),
      ]);

      const promise = service.getPostsForRootCommunity('savannah-ga');
      await tick();

      const request = httpMock.expectOne('/api/social/post/find');
      expect(request.request.body).toEqual({
        criteria: { communityId: 'savannah', appScope: 'local-hub' },
      });
      request.flush([
        {
          id: 'p1',
          title: 'Hello',
          content: 'World',
          profileId: 'pr1',
          userId: 'u1',
          createdAt: new Date('2024-05-01T00:00:00.000Z'),
        },
      ]);

      await expect(promise).resolves.toEqual([
        {
          id: 'p1',
          communityId: 'savannah',
          communitySlug: 'savannah-ga',
          communityName: 'Savannah, GA',
          title: 'Hello',
          content: 'World',
          authorName: 'Community Member',
          createdAt: '2024-05-01T00:00:00.000Z',
          likes: 0,
          comments: 0,
        },
      ]);
    });

    it('returns no root community posts when the city has no root locality', async () => {
      jest
        .spyOn(service, 'getCommunitiesForCity')
        .mockResolvedValue([
          makeCommunity({ id: 'makers', parentId: 'savannah' }),
        ]);

      await expect(
        service.getPostsForRootCommunity('savannah-ga')
      ).resolves.toEqual([]);
    });

    it('returns an empty root post list when the query fails', async () => {
      jest
        .spyOn(service, 'getCommunitiesForCity')
        .mockResolvedValue([makeCommunity()]);

      const promise = service.getPostsForRootCommunity('savannah-ga');
      await tick();

      httpMock
        .expectOne('/api/social/post/find')
        .flush('boom', { status: 500, statusText: 'Server Error' });

      await expect(promise).resolves.toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to fetch root community posts:',
        expect.anything()
      );
    });

    it('maps posts for a single community', async () => {
      const promise = service.getPostsForCommunity('starland-makers');

      httpMock.expectOne('/api/communities/slug/starland-makers').flush(
        makeCommunity({
          id: 'makers',
          slug: 'starland-makers',
          name: 'Starland Makers',
        })
      );
      await tick();

      const request = httpMock.expectOne('/api/social/post/find');
      expect(request.request.body).toEqual({
        criteria: { communityId: 'makers', appScope: 'local-hub' },
      });
      request.flush(null);

      // A null payload is coalesced to an empty array rather than throwing.
      await expect(promise).resolves.toEqual([]);
    });

    it('returns no community posts when the community has no id', async () => {
      const promise = service.getPostsForCommunity('starland-makers');

      httpMock
        .expectOne('/api/communities/slug/starland-makers')
        .flush({ slug: 'starland-makers' });

      await expect(promise).resolves.toEqual([]);
    });

    it('returns an empty community post list when the query fails', async () => {
      const promise = service.getPostsForCommunity('starland-makers');

      httpMock
        .expectOne('/api/communities/slug/starland-makers')
        .flush('boom', { status: 500, statusText: 'Server Error' });

      await expect(promise).resolves.toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to fetch community posts:',
        expect.anything()
      );
    });

    it('creates a post and maps it into the local feed shape', async () => {
      const promise = service.createPost(
        'makers',
        'starland-makers',
        'Starland Makers',
        { title: 'Hi', content: 'There', profileId: 'pr1' }
      );

      const request = httpMock.expectOne('/api/social/post');
      expect(request.request.body).toEqual({
        title: 'Hi',
        content: 'There',
        profileId: 'pr1',
        communityId: 'makers',
        appScope: 'local-hub',
      });
      request.flush({
        id: 'p9',
        title: 'Hi',
        content: 'There',
        profileId: 'pr1',
        userId: 'u1',
        createdAt: new Date('2024-06-01T00:00:00.000Z'),
      });

      await expect(promise).resolves.toEqual({
        id: 'p9',
        communityId: 'makers',
        communitySlug: 'starland-makers',
        communityName: 'Starland Makers',
        title: 'Hi',
        content: 'There',
        authorName: 'You',
        createdAt: '2024-06-01T00:00:00.000Z',
        likes: 0,
        comments: 0,
      });
    });

    it('preserves a string createdAt when creating a post', async () => {
      const promise = service.createPost('makers', 'slug', 'Name', {
        title: 'Hi',
        content: 'There',
        profileId: 'pr1',
      });

      httpMock.expectOne('/api/social/post').flush({
        id: 'p9',
        title: 'Hi',
        content: 'There',
        profileId: 'pr1',
        userId: 'u1',
        createdAt: '2024-06-01T00:00:00.000Z',
      });

      await expect(promise).resolves.toMatchObject({
        createdAt: '2024-06-01T00:00:00.000Z',
      });
    });
  });
});
