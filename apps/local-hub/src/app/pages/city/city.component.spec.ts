import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { CityComponent } from './city.component';
import {
  CommunityService,
  LocalCommunity,
} from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { PaymentService } from '../../services/payment.service';
import {
  ClassifiedService,
  ClassifiedAdDto,
} from '@optimistic-tanuki/classified-ui';
import { MapComponent } from '../../components/map/map.component';

const cityFixture = {
  id: 'city-1',
  name: 'Savannah',
  slug: 'savannah-ga',
  countryCode: 'US',
  adminArea: 'GA',
  description: 'Coastal city',
  imageUrl: '',
  coordinates: { lat: 32.0809, lng: -81.0912 },
  population: 1,
  timezone: 'America/New_York',
  highlights: [],
  communities: 1,
};

const rootCommunityFixture: LocalCommunity = {
  id: 'city-1',
  name: 'Savannah',
  slug: 'savannah-ga',
  localityType: 'city',
  city: 'Savannah',
  adminArea: 'GA',
  countryCode: 'US',
  description: 'Coastal city',
  memberCount: 1,
  createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  coordinates: { lat: 32.0809, lng: -81.0912 },
};

const communityServiceMock = {
  getCityBySlug: jest.fn().mockResolvedValue(cityFixture),
  getCommunitiesForCity: jest.fn().mockResolvedValue([rootCommunityFixture]),
  getPostsForRootCommunity: jest.fn().mockResolvedValue([]),
  getCommunityManager: jest.fn().mockResolvedValue(null),
  getActiveElection: jest.fn().mockResolvedValue(null),
};

const authStateMock = {
  isAuthenticated$: { pipe: () => ({ subscribe: jest.fn() }) },
  isAuthenticated: false,
};

const paymentServiceMock = {
  getCityBusinesses: jest.fn().mockResolvedValue([]),
  getDonationGoal: jest.fn().mockResolvedValue({
    raised: 0,
    goal: 0,
    donorCount: 0,
  }),
};

const classifiedServiceMock = {
  findByCommunity: jest
    .fn()
    .mockResolvedValue({ data: [] as ClassifiedAdDto[] }),
};

describe('CityComponent', () => {
  describe('rendered view', () => {
    let fixture: ComponentFixture<CityComponent>;
    const geolocation = {
      getCurrentPosition: jest.fn(),
    };

    beforeEach(async () => {
      geolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 32.05,
            longitude: -81.1,
          },
        });
      });
      Object.defineProperty(global.navigator, 'geolocation', {
        configurable: true,
        value: geolocation,
      });

      await TestBed.configureTestingModule({
        imports: [CityComponent, RouterTestingModule, HttpClientTestingModule],
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: CommunityService, useValue: communityServiceMock },
          { provide: AuthStateService, useValue: authStateMock },
          { provide: MessageService, useValue: { addMessage: jest.fn() } },
          { provide: PaymentService, useValue: paymentServiceMock },
          { provide: ClassifiedService, useValue: classifiedServiceMock },
          { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: { get: () => 'savannah-ga' } } },
          },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(CityComponent);
      fixture.detectChanges();
    });

    it('uses single-location mode for the city detail map', async () => {
      await fixture.whenStable();
      fixture.detectChanges();

      const mapComponent = fixture.debugElement.query(
        By.directive(MapComponent)
      )?.componentInstance as MapComponent | undefined;

      expect(mapComponent).toBeDefined();
      expect(mapComponent?.mode).toBe('single-location');
    });

    it('passes browser geolocation to the city detail map', async () => {
      await fixture.whenStable();
      fixture.detectChanges();

      const mapComponent = fixture.debugElement.query(
        By.directive(MapComponent)
      )?.componentInstance as MapComponent | undefined;

      expect(mapComponent?.userLocation).toEqual({ lat: 32.05, lng: -81.1 });
    });
  });

  // These exercise the component class directly. `detectChanges()` is never
  // called, so no child components (and no refresh intervals) are created.
  describe('component behaviour', () => {
    let component: CityComponent;
    let fixture: ComponentFixture<CityComponent>;
    let httpMock: HttpTestingController;
    let router: Router;
    let messages: { addMessage: jest.Mock };
    let community: typeof communityServiceMock & {
      isMember: jest.Mock;
      joinCommunity: jest.Mock;
      createCommunity: jest.Mock;
      nominateForManager: jest.Mock;
      voteForManager: jest.Mock;
    };
    let payments: Record<string, jest.Mock>;
    let classifieds: Record<string, jest.Mock>;
    let authSubject: BehaviorSubject<boolean>;
    let authState: {
      isAuthenticated$: BehaviorSubject<boolean>;
      isAuthenticated: boolean;
    };
    let paramSlug: string;

    const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    /** Waits for a request to appear (FileReader work is asynchronous). */
    const flushRequest = async (
      url: string,
      body: string | number | boolean | object | null
    ) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const matches = httpMock.match(url);
        if (matches.length > 0) {
          matches[0].flush(body);
          return matches[0];
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      throw new Error(`No request was made to ${url}`);
    };

    beforeEach(async () => {
      paramSlug = 'savannah-ga';
      authSubject = new BehaviorSubject<boolean>(false);
      authState = {
        isAuthenticated$: authSubject,
        isAuthenticated: false,
      };
      messages = { addMessage: jest.fn() };
      community = {
        getCityBySlug: jest.fn().mockResolvedValue(cityFixture),
        getCommunitiesForCity: jest
          .fn()
          .mockResolvedValue([rootCommunityFixture]),
        getPostsForRootCommunity: jest.fn().mockResolvedValue([]),
        getCommunityManager: jest.fn().mockResolvedValue(null),
        getActiveElection: jest.fn().mockResolvedValue(null),
        isMember: jest.fn().mockResolvedValue(false),
        joinCommunity: jest.fn().mockResolvedValue({ status: 'approved' }),
        createCommunity: jest
          .fn()
          .mockResolvedValue({ ...rootCommunityFixture, slug: 'new-group' }),
        nominateForManager: jest.fn().mockResolvedValue({}),
        voteForManager: jest.fn().mockResolvedValue({ id: 'election-1' }),
      } as never;
      payments = {
        getCityBusinesses: jest.fn().mockResolvedValue([]),
        getDonationGoal: jest
          .fn()
          .mockResolvedValue({ raised: 0, goal: 0, donorCount: 0 }),
        createBusinessPage: jest
          .fn()
          .mockResolvedValue({ checkoutUrl: 'https://pay.example/checkout' }),
      };
      classifieds = {
        findByCommunity: jest.fn().mockResolvedValue({ data: [] }),
      };

      await TestBed.configureTestingModule({
        imports: [CityComponent, RouterTestingModule, HttpClientTestingModule],
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: CommunityService, useValue: community },
          { provide: AuthStateService, useValue: authState },
          { provide: MessageService, useValue: messages },
          { provide: PaymentService, useValue: payments },
          { provide: ClassifiedService, useValue: classifieds },
          { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: { get: () => paramSlug } } },
          },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(CityComponent);
      component = fixture.componentInstance;
      httpMock = TestBed.inject(HttpTestingController);
      router = TestBed.inject(Router);
      jest.spyOn(router, 'navigate').mockResolvedValue(true);
    });

    afterEach(() => {
      component.ngOnDestroy();
      jest.restoreAllMocks();
    });

    describe('ngOnInit', () => {
      it('mirrors the auth stream into the isAuthenticated signal', async () => {
        Object.defineProperty(global.navigator, 'geolocation', {
          configurable: true,
          value: { getCurrentPosition: jest.fn() },
        });

        await component.ngOnInit();
        expect(component.isAuthenticated()).toBe(false);

        authSubject.next(true);
        expect(component.isAuthenticated()).toBe(true);
      });

      it('stops mirroring auth changes after destroy', async () => {
        Object.defineProperty(global.navigator, 'geolocation', {
          configurable: true,
          value: { getCurrentPosition: jest.fn() },
        });

        await component.ngOnInit();
        component.ngOnDestroy();
        authSubject.next(true);

        expect(component.isAuthenticated()).toBe(false);
      });
    });

    describe('loadUserLocation', () => {
      it('records the browser position when geolocation succeeds', () => {
        Object.defineProperty(global.navigator, 'geolocation', {
          configurable: true,
          value: {
            getCurrentPosition: (success: PositionCallback) =>
              success({
                coords: { latitude: 1, longitude: 2 },
              } as GeolocationPosition),
          },
        });

        component['loadUserLocation']();
        expect(component.userLocation()).toEqual({ lat: 1, lng: 2 });
      });

      it('clears the location when geolocation is denied', () => {
        component.userLocation.set({ lat: 9, lng: 9 });
        Object.defineProperty(global.navigator, 'geolocation', {
          configurable: true,
          value: {
            getCurrentPosition: (
              _success: PositionCallback,
              error: PositionErrorCallback
            ) => error({ code: 1 } as GeolocationPositionError),
          },
        });

        component['loadUserLocation']();
        expect(component.userLocation()).toBeNull();
      });

      it('does nothing when the browser exposes no geolocation API', () => {
        Object.defineProperty(global.navigator, 'geolocation', {
          configurable: true,
          value: undefined,
        });

        component['loadUserLocation']();
        expect(component.userLocation()).toBeNull();
      });
    });

    describe('loadCity', () => {
      it('reports a missing locality without loading anything else', async () => {
        community.getCityBySlug.mockResolvedValue(undefined);

        await component.loadCity('nope');

        expect(component.error()).toBe('Locality not found');
        expect(component.loading()).toBe(false);
        expect(community.getCommunitiesForCity).not.toHaveBeenCalled();
      });

      it('separates the root locality from interest communities', async () => {
        const interest: LocalCommunity = {
          ...rootCommunityFixture,
          id: 'makers',
          slug: 'starland-makers',
          name: 'Starland Makers',
          localityType: 'neighborhood',
          parentId: 'city-1',
        };
        community.getCommunitiesForCity.mockResolvedValue([
          rootCommunityFixture,
          interest,
        ]);

        await component.loadCity('savannah-ga');

        expect(component.communities()).toHaveLength(2);
        expect(component.interestCommunities().map((c) => c.id)).toEqual([
          'makers',
        ]);
        expect(component.getRootLocalityId()).toBe('city-1');
        expect(component.error()).toBeNull();
        expect(component.loading()).toBe(false);
      });

      it('sets the page title and social meta tags including the image', async () => {
        community.getCityBySlug.mockResolvedValue({
          ...cityFixture,
          imageUrl: 'https://cdn.example/savannah.jpg',
        });

        await component.loadCity('savannah-ga');

        expect(document.title).toBe('Savannah - Towne Square');
        expect(
          document
            .querySelector('meta[property="og:image"]')
            ?.getAttribute('content')
        ).toBe('https://cdn.example/savannah.jpg');
      });

      it('survives a failing manager/election lookup', async () => {
        community.getCommunityManager.mockRejectedValue(new Error('nope'));

        await component.loadCity('savannah-ga');

        expect(component.communityManager()).toBeNull();
        expect(component.error()).toBeNull();
      });

      it('stores the manager and active election for the root locality', async () => {
        const manager = {
          userId: 'u1',
          profileId: 'p1',
          name: 'Ada',
          electedAt: '2024-01-01T00:00:00.000Z',
          termEndsAt: '2025-01-01T00:00:00.000Z',
        };
        community.getCommunityManager.mockResolvedValue(manager);
        community.getActiveElection.mockResolvedValue({
          id: 'election-1',
          communityId: 'city-1',
          status: 'open',
          candidates: [],
          startedAt: '2024-01-01T00:00:00.000Z',
          endsAt: '2024-02-01T00:00:00.000Z',
        });

        await component.loadCity('savannah-ga');

        expect(component.communityManager()).toEqual(manager);
        expect(component.activeElection()?.id).toBe('election-1');
      });

      it('keeps rendering when the business lookup fails', async () => {
        payments['getCityBusinesses'].mockRejectedValue(new Error('nope'));

        await component.loadCity('savannah-ga');

        expect(component.businesses()).toEqual([]);
        expect(component.error()).toBeNull();
      });

      it('keeps rendering when the classifieds lookup fails', async () => {
        classifieds['findByCommunity'].mockRejectedValue(new Error('nope'));

        await component.loadCity('savannah-ga');

        expect(component.classifieds()).toEqual([]);
        expect(component.classifiedsLoading()).toBe(false);
      });

      it('loads membership status for every community when signed in', async () => {
        authState.isAuthenticated = true;
        community.getCommunitiesForCity.mockResolvedValue([
          rootCommunityFixture,
          { ...rootCommunityFixture, id: 'makers' },
        ]);
        community.isMember.mockImplementation(
          async (id: string) => id === 'makers'
        );

        await component.loadCity('savannah-ga');

        expect(component.isMember('makers')).toBe(true);
        expect(component.isMember('city-1')).toBe(false);
      });

      it('ignores individual membership lookup failures', async () => {
        authState.isAuthenticated = true;
        community.isMember.mockRejectedValue(new Error('nope'));

        await component.loadCity('savannah-ga');

        expect(component.memberCommunityIds().size).toBe(0);
      });

      it('reports a generic failure when the city lookup throws', async () => {
        community.getCityBySlug.mockRejectedValue(new Error('offline'));

        await component.loadCity('savannah-ga');

        expect(component.error()).toBe('Failed to load city data');
        expect(component.loading()).toBe(false);
      });
    });

    describe('derived state', () => {
      it('maps posts into PostDto and author profile lookups', () => {
        component.posts.set([
          {
            id: 'p1',
            communityId: 'city-1',
            communitySlug: 'savannah-ga',
            communityName: 'Savannah',
            title: 'Hello',
            content: 'World',
            authorName: 'Ada',
            createdAt: '2024-05-01T00:00:00.000Z',
            likes: 0,
            comments: 0,
          },
          {
            id: 'p2',
            communityId: 'city-1',
            communitySlug: 'savannah-ga',
            communityName: 'Savannah',
            title: 'Second',
            content: 'Post',
            authorName: 'Grace',
            authorAvatar: 'https://cdn.example/grace.png',
            createdAt: '2024-05-02T00:00:00.000Z',
            likes: 0,
            comments: 0,
          },
        ]);

        expect(component.discussionPosts()).toEqual([
          {
            id: 'p1',
            title: 'Hello',
            content: 'World',
            userId: 'Ada',
            profileId: 'Ada',
            communityId: 'city-1',
            createdAt: new Date('2024-05-01T00:00:00.000Z'),
          },
          {
            id: 'p2',
            title: 'Second',
            content: 'Post',
            userId: 'Grace',
            profileId: 'Grace',
            communityId: 'city-1',
            createdAt: new Date('2024-05-02T00:00:00.000Z'),
          },
        ]);

        expect(component.postProfiles()).toEqual({
          Ada: { id: 'Ada', name: 'Ada', avatar: 'assets/ts.png' },
          Grace: {
            id: 'Grace',
            name: 'Grace',
            avatar: 'https://cdn.example/grace.png',
          },
        });
      });

      it('only allows posting a classified when signed in and a member of the root locality', () => {
        expect(component.canPostClassified()).toBe(false);

        component.communities.set([rootCommunityFixture]);
        component.isAuthenticated.set(true);
        expect(component.canPostClassified()).toBe(false);

        component.memberCommunityIds.set(new Set(['city-1']));
        expect(component.canPostClassified()).toBe(true);
      });

      it('returns null for the root locality id when no root locality is loaded', () => {
        component.communities.set([
          { ...rootCommunityFixture, parentId: 'somewhere' },
        ]);
        expect(component.getRootLocalityId()).toBeNull();
      });
    });

    describe('community tree', () => {
      it('returns no nodes when there is no root locality', () => {
        expect(
          component['buildCommunityTree']([
            { ...rootCommunityFixture, parentId: 'other' },
          ])
        ).toEqual([]);
      });

      it('nests direct children and parentless communities under the root', () => {
        const child: LocalCommunity = {
          ...rootCommunityFixture,
          id: 'makers',
          parentId: 'city-1',
        };
        const orphan: LocalCommunity = {
          ...rootCommunityFixture,
          id: 'orphan',
          localityType: 'neighborhood',
        };
        const elsewhere: LocalCommunity = {
          ...rootCommunityFixture,
          id: 'elsewhere',
          parentId: 'another-city',
        };

        const tree = component['buildCommunityTree']([
          rootCommunityFixture,
          child,
          orphan,
          elsewhere,
        ]);

        expect(tree).toHaveLength(1);
        expect(tree[0].isExpanded).toBe(true);
        expect(tree[0].community.id).toBe('city-1');
        expect(tree[0].children.map((node) => node.community.id)).toEqual([
          'makers',
          'orphan',
        ]);
        expect(tree[0].children.every((node) => !node.isExpanded)).toBe(true);
      });
    });

    describe('navigation and modals', () => {
      it('navigates to communities, cities, posts and the city index', () => {
        component.navigateToCommunity('starland-makers');
        expect(router.navigate).toHaveBeenCalledWith(['/c', 'starland-makers']);

        component.navigateToCity('savannah-ga');
        expect(router.navigate).toHaveBeenCalledWith(['/city', 'savannah-ga']);

        component.navigateToPost('starland-makers');
        expect(router.navigate).toHaveBeenCalledWith(['/c', 'starland-makers']);

        component.navigateToCities();
        expect(router.navigate).toHaveBeenCalledWith(['/cities']);
      });

      it('sends anonymous visitors to login with a return url', () => {
        component.promptSignIn('join');

        expect(router.navigate).toHaveBeenCalledWith(['/login'], {
          queryParams: { returnUrl: router.url, action: 'join' },
        });
      });

      it.each([
        [
          'openCreateCommunityModal',
          'showCreateCommunityModal',
          'create-community',
        ],
        [
          'openCreateBusinessModal',
          'showCreateBusinessModal',
          'create-business',
        ],
        ['openElectionModal', 'showElectionModal', 'election'],
        ['openClassifiedForm', 'showClassifiedForm', 'post-classified'],
      ])(
        '%s prompts sign-in when anonymous and opens the modal when signed in',
        (method, flag, action) => {
          const open = component[method as keyof CityComponent] as () => void;

          open.call(component);
          expect(router.navigate).toHaveBeenCalledWith(['/login'], {
            queryParams: { returnUrl: router.url, action },
          });
          expect(
            (component[flag as keyof CityComponent] as () => boolean)()
          ).toBe(false);

          component.isAuthenticated.set(true);
          open.call(component);
          expect(
            (component[flag as keyof CityComponent] as () => boolean)()
          ).toBe(true);
        }
      );

      it('closes the classified form on cancel', () => {
        component.showClassifiedForm.set(true);
        component.onClassifiedCancel();
        expect(component.showClassifiedForm()).toBe(false);
      });

      it('clears the expanding marker asynchronously', async () => {
        component.toggleExpand('makers');
        expect(component.expandingInProgress()).toBe('makers');

        await tick();
        expect(component.expandingInProgress()).toBeNull();
      });
    });

    describe('joinCommunity', () => {
      it('prompts sign-in instead of joining when anonymous', async () => {
        await component.joinCommunity('makers');

        expect(community.joinCommunity).not.toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/login'], {
          queryParams: { returnUrl: router.url, action: 'join' },
        });
      });

      it('records membership when the join is approved', async () => {
        component.isAuthenticated.set(true);

        await component.joinCommunity('makers');

        expect(component.isMember('makers')).toBe(true);
        expect(messages.addMessage).toHaveBeenCalledWith({
          content: 'You have joined the community!',
          type: 'success',
        });
        expect(component.expandingInProgress()).toBeNull();
      });

      it('reports a pending review when the join is not approved', async () => {
        component.isAuthenticated.set(true);
        community.joinCommunity.mockResolvedValue({ status: 'pending' });

        await component.joinCommunity('makers');

        expect(component.isMember('makers')).toBe(false);
        expect(messages.addMessage).toHaveBeenCalledWith({
          content: 'Your join request has been submitted for review.',
          type: 'info',
        });
      });

      it('surfaces join failures', async () => {
        component.isAuthenticated.set(true);
        community.joinCommunity.mockRejectedValue(new Error('nope'));

        await component.joinCommunity('makers');

        expect(messages.addMessage).toHaveBeenCalledWith({
          content: 'Failed to join the community. Please try again.',
          type: 'error',
        });
        expect(component.expandingInProgress()).toBeNull();
      });
    });

    describe('createCommunity', () => {
      beforeEach(() => {
        component.city.set(cityFixture);
      });

      it('does nothing when no city is loaded', async () => {
        component.city.set(null);

        await component.createCommunity();

        expect(community.createCommunity).not.toHaveBeenCalled();
      });

      it('requires a community name', async () => {
        component.newCommunityName = '   ';

        await component.createCommunity();

        expect(community.createCommunity).not.toHaveBeenCalled();
        expect(messages.addMessage).toHaveBeenCalledWith({
          content: 'Community name is required.',
          type: 'error',
        });
      });

      it('creates the community, resets the form and navigates to it', async () => {
        component.newCommunityName = '  Starland Makers  ';
        component.newCommunityDescription = '  A maker space  ';
        component.newCommunityTags = 'makers, , events ';
        component.newCommunityType = 'county';
        component.newCommunityIsPrivate = true;
        component.newCommunityJoinPolicy = 'approval_required';
        component.bannerAssetId.set('banner-1');
        component.logoAssetId.set('logo-1');

        await component.createCommunity();

        expect(community.createCommunity).toHaveBeenCalledWith({
          name: 'Starland Makers',
          description: 'A maker space',
          parentId: 'city-1',
          localityType: 'county',
          isPrivate: true,
          joinPolicy: 'approval_required',
          tags: ['makers', 'events'],
          bannerAssetId: 'banner-1',
          logoAssetId: 'logo-1',
        });
        expect(component.showCreateCommunityModal()).toBe(false);
        expect(component.newCommunityName).toBe('');
        expect(component.newCommunityType).toBe('neighborhood');
        expect(component.bannerAssetId()).toBeNull();
        expect(component.logoAssetId()).toBeNull();
        expect(router.navigate).toHaveBeenCalledWith(['/c', 'new-group']);
        expect(component.creatingCommunity()).toBe(false);
      });

      it('sends no tags and no asset ids when none were provided', async () => {
        component.newCommunityName = 'Plain';
        component.newCommunityTags = '';

        await component.createCommunity();

        expect(community.createCommunity).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: [],
            bannerAssetId: undefined,
            logoAssetId: undefined,
          })
        );
      });

      it('waits for a pending image upload before creating', async () => {
        component.newCommunityName = 'Waits';
        component.uploading.set(true);

        const createPromise = component.createCommunity();
        await tick();
        expect(community.createCommunity).not.toHaveBeenCalled();

        component.uploading.set(false);
        await createPromise;

        expect(community.createCommunity).toHaveBeenCalled();
      });

      it('surfaces creation failures', async () => {
        component.newCommunityName = 'Boom';
        community.createCommunity.mockRejectedValue(new Error('nope'));

        await component.createCommunity();

        expect(messages.addMessage).toHaveBeenCalledWith({
          content: 'Failed to create community. Please try again.',
          type: 'error',
        });
        expect(component.creatingCommunity()).toBe(false);
      });
    });

    describe('image uploads', () => {
      const makeEvent = (files: File[] | null): Event =>
        ({ target: { files } } as unknown as Event);

      it('ignores a banner selection with no file', async () => {
        await component.onBannerSelect(makeEvent(null));
        expect(component.bannerPreview()).toBeNull();
      });

      it('ignores a logo selection with no file', async () => {
        await component.onLogoSelect(makeEvent([]));
        expect(component.logoPreview()).toBeNull();
      });

      it('previews and uploads a selected banner', async () => {
        const file = new File(['banner-bytes'], 'banner.png', {
          type: 'image/png',
        });

        const selection = component.onBannerSelect(makeEvent([file]));

        await flushRequest('http://localhost:3000/profile/me', {
          id: 'profile-1',
        });
        const assetRequest = await flushRequest('http://localhost:3000/asset', {
          id: 'asset-1',
        });
        await selection;

        expect(assetRequest.request.body).toMatchObject({
          name: 'banner.png',
          profileId: 'profile-1',
          type: 'image',
          fileExtension: 'png',
        });
        expect(component.bannerPreview()).toContain('data:');
        expect(component.bannerAssetId()).toBe('asset-1');
        expect(component.uploading()).toBe(false);
      });

      it('previews and uploads a selected logo, defaulting a missing extension', async () => {
        const file = new File(['logo-bytes'], 'logo', { type: 'image/png' });

        const selection = component.onLogoSelect(makeEvent([file]));

        await flushRequest('http://localhost:3000/profile/me', {
          id: 'profile-1',
        });
        const assetRequest = await flushRequest('http://localhost:3000/asset', {
          id: 'asset-2',
        });
        await selection;

        // `'logo'.split('.').pop()` is `'logo'`, so the fallback never fires —
        // extensionless names are uploaded with the whole name as extension.
        expect(assetRequest.request.body).toMatchObject({
          fileExtension: 'logo',
        });
        expect(component.logoAssetId()).toBe('asset-2');
      });

      it('clears the banner and logo previews', () => {
        component.bannerPreview.set('data:image/png;base64,x');
        component.bannerAssetId.set('asset-1');
        component.logoPreview.set('data:image/png;base64,y');
        component.logoAssetId.set('asset-2');

        component.removeBanner();
        component.removeLogo();

        expect(component.bannerPreview()).toBeNull();
        expect(component.bannerAssetId()).toBeNull();
        expect(component.logoPreview()).toBeNull();
        expect(component.logoAssetId()).toBeNull();
      });
    });

    describe('createBusinessPage', () => {
      let originalLocation: Location;

      beforeEach(() => {
        originalLocation = window.location;
        Object.defineProperty(window, 'location', {
          configurable: true,
          writable: true,
          value: { href: '' },
        });
      });

      afterEach(() => {
        Object.defineProperty(window, 'location', {
          configurable: true,
          writable: true,
          value: originalLocation,
        });
      });

      it('does nothing without a loaded city', async () => {
        component.city.set(null);

        await component.createBusinessPage();

        expect(payments['createBusinessPage']).not.toHaveBeenCalled();
      });

      it('redirects to the checkout url for the selected tier', async () => {
        component.city.set(cityFixture);
        component.selectedBusinessTier = 'pro';

        await component.createBusinessPage();

        expect(payments['createBusinessPage']).toHaveBeenCalledWith(
          'city-1',
          'pro'
        );
        expect(window.location.href).toBe('https://pay.example/checkout');
        expect(component.creatingBusiness()).toBe(false);
      });

      it('surfaces checkout failures', async () => {
        component.city.set(cityFixture);
        payments['createBusinessPage'].mockRejectedValue(new Error('nope'));

        await component.createBusinessPage();

        expect(messages.addMessage).toHaveBeenCalledWith({
          content: 'Failed to start business page setup. Please try again.',
          type: 'error',
        });
        expect(component.creatingBusiness()).toBe(false);
      });
    });

    describe('elections', () => {
      it('skips nomination when there is no root locality', async () => {
        component.communities.set([]);

        await component.selfNominate();

        expect(community.nominateForManager).not.toHaveBeenCalled();
      });

      it('nominates and refreshes the active election', async () => {
        component.communities.set([rootCommunityFixture]);
        community.getActiveElection.mockResolvedValue({ id: 'election-2' });

        await component.selfNominate();

        expect(community.nominateForManager).toHaveBeenCalledWith('city-1');
        expect(component.activeElection()?.id).toBe('election-2');
        expect(messages.addMessage).toHaveBeenCalledWith({
          content: 'You have been nominated as a candidate!',
          type: 'success',
        });
      });

      it('surfaces nomination failures', async () => {
        component.communities.set([rootCommunityFixture]);
        community.nominateForManager.mockRejectedValue(new Error('nope'));

        await component.selfNominate();

        expect(messages.addMessage).toHaveBeenCalledWith({
          content: 'Nomination failed. Please try again.',
          type: 'error',
        });
      });

      it('skips voting when there is no root locality', async () => {
        component.communities.set([]);

        await component.voteForCandidate('u1');

        expect(community.voteForManager).not.toHaveBeenCalled();
        expect(component.votingInProgress()).toBe(false);
      });

      it('records a vote and stores the updated election', async () => {
        component.communities.set([rootCommunityFixture]);

        await component.voteForCandidate('u1');

        expect(community.voteForManager).toHaveBeenCalledWith('city-1', 'u1');
        expect(component.activeElection()?.id).toBe('election-1');
        expect(messages.addMessage).toHaveBeenCalledWith({
          content: 'Your vote has been recorded!',
          type: 'success',
        });
        expect(component.votingInProgress()).toBe(false);
      });

      it('surfaces vote failures', async () => {
        component.communities.set([rootCommunityFixture]);
        community.voteForManager.mockRejectedValue(new Error('nope'));

        await component.voteForCandidate('u1');

        expect(messages.addMessage).toHaveBeenCalledWith({
          content: 'Failed to cast vote. Please try again.',
          type: 'error',
        });
        expect(component.votingInProgress()).toBe(false);
      });
    });

    describe('classifieds', () => {
      const makeAd = (overrides: Partial<ClassifiedAdDto> = {}) =>
        ({
          id: 'ad-1',
          communityId: 'city-1',
          profileId: 'profile-1',
          userId: 'user-1',
          title: 'Bike',
          description: 'A bike',
          price: 100,
          currency: 'USD',
          category: null,
          condition: null,
          imageUrls: null,
          status: 'active',
          isFeatured: false,
          featuredUntil: null,
          appScope: 'local-hub',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          expiresAt: null,
          ...overrides,
        } as ClassifiedAdDto);

      it('posts a listing and reloads the feed', async () => {
        component.communities.set([rootCommunityFixture]);
        component.showClassifiedForm.set(true);
        classifieds['findByCommunity'].mockResolvedValue({
          data: [makeAd({ sellerProfileName: 'Ada' })],
        });

        const submission = component.onClassifiedSubmit({
          title: 'Bike',
          description: 'A bike',
          price: 100,
        });

        const request = await flushRequest(
          'http://localhost:3000/classifieds',
          { id: 'ad-1' }
        );
        expect(request.request.body).toEqual({
          title: 'Bike',
          description: 'A bike',
          price: 100,
          appScope: 'local-hub',
        });

        // The reload enriches seller profiles, which issues a second request.
        // It has to be flushed too or onClassifiedSubmit never settles.
        await flushRequest('/api/profile/by-ids', [
          { id: 'profile-1', profileName: 'Ada' },
        ]);

        await submission;

        expect(component.showClassifiedForm()).toBe(false);
        expect(messages.addMessage).toHaveBeenCalledWith({
          content: 'Your listing has been posted!',
          type: 'success',
        });
        expect(component.classifieds()).toHaveLength(1);
        expect(component.classifiedsLoading()).toBe(false);
      });

      it('surfaces listing failures', async () => {
        component.communities.set([rootCommunityFixture]);

        const submission = component.onClassifiedSubmit({
          title: 'Bike',
          description: 'A bike',
          price: 100,
        });

        const request = await flushRequest(
          'http://localhost:3000/classifieds',
          null
        );
        expect(request.request.method).toBe('POST');

        await submission;

        // `flushRequest` above resolved the request successfully, so assert the
        // failure branch separately with a rejecting request.
        const failing = component.onClassifiedSubmit({
          title: 'Bike',
          description: 'A bike',
          price: 100,
        });
        for (let attempt = 0; attempt < 100; attempt++) {
          const matches = httpMock.match('http://localhost:3000/classifieds');
          if (matches.length > 0) {
            matches[0].flush('boom', {
              status: 500,
              statusText: 'Server Error',
            });
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
        await failing;

        expect(messages.addMessage).toHaveBeenCalledWith({
          content: 'Failed to post listing. Please try again.',
          type: 'error',
        });
      });

      it('skips the reload when there is no root locality', async () => {
        component.communities.set([]);

        await component['reloadClassifieds']();

        expect(classifieds['findByCommunity']).not.toHaveBeenCalled();
      });

      it('returns ads unchanged when none carry a profile id', async () => {
        const ads = [makeAd({ profileId: '' })];

        await expect(
          component['enrichClassifiedSellerProfiles'](ads)
        ).resolves.toBe(ads);
      });

      it('fills in missing seller names and pictures from profiles', async () => {
        const ads = [
          makeAd({ id: 'ad-1', profileId: 'profile-1' }),
          makeAd({
            id: 'ad-2',
            profileId: 'profile-2',
            sellerProfileName: 'Existing',
            sellerProfilePic: 'existing.png',
          }),
          makeAd({ id: 'ad-3', profileId: 'unknown' }),
        ];

        const enrichment = component['enrichClassifiedSellerProfiles'](ads);

        // NOTE: this endpoint is hardcoded to `/api/profile/by-ids` in the
        // component rather than derived from API_BASE_URL like every other
        // call. Asserted as-is to pin current behaviour.
        const request = await flushRequest('/api/profile/by-ids', [
          { id: 'profile-1', profileName: 'Ada', profilePic: 'ada.png' },
          { id: 'profile-2', profileName: 'Grace', profilePic: 'grace.png' },
        ]);
        expect(request.request.body).toEqual({
          ids: ['profile-1', 'profile-2', 'unknown'],
        });

        const enriched = await enrichment;
        expect(enriched[0]).toMatchObject({
          sellerProfileName: 'Ada',
          sellerProfilePic: 'ada.png',
        });
        expect(enriched[1]).toMatchObject({
          sellerProfileName: 'Existing',
          sellerProfilePic: 'existing.png',
        });
        expect(enriched[2]).toMatchObject({
          sellerProfileName: null,
          sellerProfilePic: null,
        });
      });

      it('returns the original ads when the profile lookup fails', async () => {
        const ads = [makeAd()];

        const enrichment = component['enrichClassifiedSellerProfiles'](ads);

        for (let attempt = 0; attempt < 100; attempt++) {
          const matches = httpMock.match('/api/profile/by-ids');
          if (matches.length > 0) {
            matches[0].flush('boom', {
              status: 500,
              statusText: 'Server Error',
            });
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1));
        }

        await expect(enrichment).resolves.toBe(ads);
      });
    });
  });
});
