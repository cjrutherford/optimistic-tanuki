import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject, of } from 'rxjs';
import {
  BusinessDirectoryComponent,
  readDirectoryQuery,
} from './business-directory.component';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import {
  DirectoryPage,
  DirectoryQuery,
  DirectoryRequestError,
  DirectoryService,
} from '../../services/directory.service';
import { MapComponent } from '../../components/map/map.component';

const cityFixture = {
  id: 'city-1',
  name: 'Valdosta',
  slug: 'valdosta-ga',
  countryCode: 'US',
  adminArea: 'GA',
  description: 'A town',
  imageUrl: '',
  coordinates: { lat: 30.8327, lng: -83.2785 },
  population: 1,
  timezone: 'America/New_York',
  highlights: [],
  communities: 1,
};
const nearbyFixture = {
  ...cityFixture,
  id: 'city-2',
  name: 'Quitman',
  slug: 'quitman-ga',
  coordinates: { lat: 30.78, lng: -83.56 },
};

const listingFixture = {
  id: '00000000-0000-4000-8000-000000000101',
  reference: 'ref-101',
  name: 'Fixture Bakery',
  category: 'bakery',
  attribution: ['Source credit'],
  notices: ['Required notice'],
  termsUrls: ['https://example.test/terms'],
  website: 'https://example.test/',
  phone: '+19125550100',
  address: '10 Main St',
  coordinates: { lat: 30.8327, lng: -83.2785 },
};

const page = (over: Partial<DirectoryPage> = {}): DirectoryPage => ({
  listings: [listingFixture],
  hasMore: false,
  nextCursor: null,
  sourceFreshness: null,
  coverage: null,
  ...over,
});

interface DirectoryServiceDouble {
  getPage: jest.Mock;
  snapshotKey: jest.Mock;
  saveSnapshot: jest.Mock;
  getSnapshot: jest.Mock;
}

const communityServiceMock = {
  getCityBySlug: jest.fn(),
  getCities: jest.fn(),
  getDirectoryBoundary: jest.fn(),
  getDirectoryBusinessLink: jest.fn(),
  requestDirectoryBusinessLink: jest.fn(),
  getMyDirectoryBusinessLinks: jest.fn(),
  revokeDirectoryBusinessLink: jest.fn(),
};

const authStateMock = {
  isAuthenticated$: of(false),
  isAuthenticated: false,
  getActingProfileId: jest.fn().mockReturnValue('profile-current'),
};

describe('readDirectoryQuery', () => {
  it('reads q, category, adult and cursor from the URL', () => {
    expect(
      readDirectoryQuery(
        convertToParamMap({
          q: ' pie ',
          category: 'bakery',
          adult: '1',
          cursor: 'abc',
        })
      )
    ).toEqual({ q: 'pie', category: 'bakery', adult: true, cursor: 'abc' });
  });
  it('defaults to an unfiltered first page', () => {
    expect(readDirectoryQuery(convertToParamMap({}))).toEqual({
      q: '',
      category: '',
      adult: false,
      cursor: '',
    });
  });
});

describe('BusinessDirectoryComponent', () => {
  let fixture: ComponentFixture<BusinessDirectoryComponent>;
  let directory: DirectoryServiceDouble;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: Router;

  const create = async (query: Record<string, string> = {}) => {
    queryParams.next(convertToParamMap(query));
    fixture = TestBed.createComponent(BusinessDirectoryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    communityServiceMock.getCityBySlug.mockResolvedValue(cityFixture);
    communityServiceMock.getCities.mockResolvedValue([
      cityFixture,
      nearbyFixture,
    ]);
    communityServiceMock.getDirectoryBoundary.mockResolvedValue({
      status: 'pending',
    });
    communityServiceMock.getDirectoryBusinessLink.mockResolvedValue(null);
    communityServiceMock.requestDirectoryBusinessLink.mockResolvedValue(
      undefined
    );
    communityServiceMock.getMyDirectoryBusinessLinks.mockResolvedValue([]);
    communityServiceMock.revokeDirectoryBusinessLink.mockResolvedValue(
      undefined
    );
    directory = {
      getPage: jest.fn().mockResolvedValue(page()),
      snapshotKey: jest.fn(
        (id: string, q: DirectoryQuery) =>
          `${id}|${q.q}|${q.category}|${q.adult}|${q.cursor}`
      ),
      saveSnapshot: jest.fn(),
      getSnapshot: jest.fn().mockReturnValue(undefined),
    };
    queryParams = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [BusinessDirectoryComponent, RouterTestingModule],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: DirectoryService, useValue: directory },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: Title, useValue: { setTitle: jest.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'valdosta-ga' } },
            paramMap: of(convertToParamMap({ slug: 'valdosta-ga' })),
            get queryParamMap() {
              return queryParams;
            },
          },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('renders the directory map with reviewed listing locations', async () => {
    await create();
    const map = fixture.debugElement.query(By.directive(MapComponent))
      ?.componentInstance as MapComponent | undefined;
    expect(map?.mode).toBe('directory');
    expect(map?.directoryLocations).toEqual([
      {
        name: listingFixture.name,
        category: listingFixture.category,
        coordinates: listingFixture.coordinates,
      },
    ]);
  });

  it('offers CSV and JSON Lines downloads with accessible names and no fetch', async () => {
    await create();
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.directory-page__download otui-button'
      )
    ).map((el) => (el as HTMLElement).getAttribute('ariaLabel'));
    expect(labels).toEqual([
      'Download listings as CSV',
      'Download listings as JSON Lines',
    ]);
    // Rendering the control asks for nothing; the download is a navigation.
    expect(directory.getPage).toHaveBeenCalledTimes(1);
  });

  it('loads the first page in cursor mode from URL filters', async () => {
    await create({ q: 'pie', category: 'bakery', adult: '1' });
    expect(directory.getPage).toHaveBeenCalledWith('city-1', {
      q: 'pie',
      category: 'bakery',
      adult: true,
      cursor: '',
    });
    expect(fixture.componentInstance.filters()).toEqual({
      q: 'pie',
      category: 'bakery',
      adult: true,
    });
    expect(fixture.nativeElement.textContent).toContain('Fixture Bakery');
    expect(fixture.nativeElement.textContent).toContain('Required notice');
  });

  it('links each card to its detail route and carries the adult flag', async () => {
    await create({ adult: '1' });
    const link = fixture.nativeElement.querySelector(
      'a[href*="/city/valdosta-ga/businesses/ref-101"]'
    ) as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('adult=1');
  });

  it('restores a saved snapshot without asking the server', async () => {
    directory.getSnapshot.mockReturnValue(page({ listings: [listingFixture] }));
    await create({ cursor: 'c2' });
    expect(directory.getPage).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Fixture Bakery');
  });

  it('accumulates results on Load more and writes the cursor to the URL', async () => {
    directory.getPage.mockResolvedValueOnce(
      page({ hasMore: true, nextCursor: 'c2' })
    );
    const component = await create();
    directory.getPage.mockResolvedValueOnce(
      page({
        listings: [
          {
            ...listingFixture,
            name: 'Second',
            reference: 'ref-2',
            id: undefined as never,
          },
        ],
      })
    );
    await component.loadMore();
    expect(directory.getPage).toHaveBeenLastCalledWith('city-1', {
      q: '',
      category: '',
      adult: false,
      cursor: 'c2',
    });
    expect(component.listings().map((l) => l.name)).toEqual([
      'Fixture Bakery',
      'Second',
    ]);
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { cursor: 'c2' },
        replaceUrl: true,
      })
    );
  });

  it('submits filters to the URL and resets the cursor', async () => {
    const component = await create();
    component.submitFilters({ q: 'pie', category: '', adult: false });
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { q: 'pie', category: null, adult: null, cursor: null },
      })
    );
  });

  it('restarts from the first page when a cursor is rejected', async () => {
    directory.getPage.mockRejectedValueOnce(new DirectoryRequestError(400));
    await create({ cursor: 'old' });
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { cursor: null },
        replaceUrl: true,
      })
    );
  });

  it('shows a retryable failure with generic copy instead of an empty directory', async () => {
    directory.getPage.mockRejectedValueOnce(new DirectoryRequestError(503));
    await create();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Business directory is temporarily unavailable');
    expect(text).not.toContain('No businesses listed');
    directory.getPage.mockResolvedValueOnce(page());
    (
      fixture.nativeElement.querySelector(
        '[data-testid="directory-retry"]'
      ) as HTMLElement
    ).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fixture Bakery');
  });

  it('shows the coverage state and keeps the directory visible with zero listings', async () => {
    directory.getPage.mockResolvedValueOnce(
      page({
        listings: [],
        coverage: { state: 'acquiring', reason: null } as never,
      })
    );
    await create();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Gathering listings');
    expect(text).toContain('Business directory');
  });

  it('lists the closest other towns by distance', async () => {
    const component = await create();
    expect(component.nearbyTowns().map((t) => t.slug)).toEqual(['quitman-ga']);
    expect(fixture.nativeElement.textContent).toContain('Quitman');
  });

  it('lets a signed-in page owner request review of a matching directory listing', async () => {
    const component = await create();
    const listing = {
      id: '00000000-0000-4000-8000-000000000101',
      name: 'Cafe',
      category: 'restaurant',
      attribution: ['Source'],
      notices: [],
    };
    component.listings.set([listing]);
    component.isAuthenticated.set(true);
    await component.checkBusinessPage(listing);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Request a link');

    const previous = Object.getOwnPropertyDescriptor(
      globalThis.crypto,
      'randomUUID'
    );
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: () => '00000000-0000-4000-8000-000000000102',
      configurable: true,
    });
    await component.requestBusinessPageLink(
      listing,
      `${globalThis.location.origin}/c/cafe`
    );
    fixture.detectChanges();
    expect(
      communityServiceMock.requestDirectoryBusinessLink
    ).toHaveBeenCalledWith(
      cityFixture.id,
      listing.id,
      'cafe',
      '00000000-0000-4000-8000-000000000102',
      false
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Request sent for review'
    );
    await component.revokeBusinessPageLink(
      listing,
      '00000000-0000-4000-8000-000000000102'
    );
    expect(
      communityServiceMock.revokeDirectoryBusinessLink
    ).toHaveBeenCalledWith(
      cityFixture.id,
      listing.id,
      '00000000-0000-4000-8000-000000000102'
    );
    if (previous) {
      Object.defineProperty(globalThis.crypto, 'randomUUID', previous);
    } else {
      delete (globalThis.crypto as { randomUUID?: () => string }).randomUUID;
    }
  });

  it('offers a page owner a way to remove an approved link', async () => {
    const component = await create();
    const listing = {
      id: '00000000-0000-4000-8000-000000000101',
      name: 'Cafe',
      category: 'restaurant',
      attribution: ['Source'],
      notices: [],
    };
    component.listings.set([listing]);
    component.isAuthenticated.set(true);
    communityServiceMock.getDirectoryBusinessLink.mockResolvedValueOnce({
      communityId: 'c',
      slug: 'cafe',
      name: 'Cafe page',
    });
    communityServiceMock.getMyDirectoryBusinessLinks.mockResolvedValueOnce([
      {
        requestId: '00000000-0000-4000-8000-000000000102',
        businessCommunityId: 'c',
        status: 'approved',
      },
    ]);
    await component.checkBusinessPage(listing);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('View Cafe page');
    expect(fixture.nativeElement.textContent).toContain('Remove link');
  });

  it('maps only listings with reviewed coordinates', async () => {
    const component = await create();
    component.listings.set([
      {
        name: 'Reviewed',
        category: 'restaurant',
        attribution: ['Source'],
        notices: [],
        coordinates: { lat: 31, lng: -83 },
      },
      {
        name: 'Unreviewed',
        category: 'shop',
        attribution: ['Source'],
        notices: [],
      },
    ]);
    expect(component.directoryMapLocations()).toEqual([
      {
        name: 'Reviewed',
        category: 'restaurant',
        coordinates: { lat: 31, lng: -83 },
      },
    ]);
  });
});
