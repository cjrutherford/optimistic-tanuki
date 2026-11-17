import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';
import { BusinessDirectoryComponent } from './business-directory.component';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MapComponent } from '../../components/map/map.component';

const cityFixture = {
  id: 'city-1',
  name: 'Valdosta',
  slug: 'valdosta-ga',
  countryCode: 'US',
  adminArea: 'GA',
  description: 'South Georgia town',
  imageUrl: '',
  coordinates: { lat: 30.8327, lng: -83.2785 },
  population: 1,
  timezone: 'America/New_York',
  highlights: [],
  communities: 1,
};

const listingFixture = {
  id: '00000000-0000-4000-8000-000000000101',
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

const communityServiceMock = {
  getCityBySlug: jest.fn().mockResolvedValue(cityFixture),
  getDirectoryBoundary: jest.fn().mockResolvedValue({ status: 'pending' }),
  getLocalDirectoryListings: jest
    .fn()
    .mockResolvedValue({ listings: [], hasMore: false }),
  getDirectoryBusinessLink: jest.fn().mockResolvedValue(null),
  requestDirectoryBusinessLink: jest.fn().mockResolvedValue(undefined),
  getMyDirectoryBusinessLinks: jest.fn().mockResolvedValue([]),
  revokeDirectoryBusinessLink: jest.fn().mockResolvedValue(undefined),
};

const authStateMock = {
  isAuthenticated$: of(false),
  isAuthenticated: false,
  getActingProfileId: jest.fn().mockReturnValue('profile-current'),
};

describe('BusinessDirectoryComponent', () => {
  let fixture: ComponentFixture<BusinessDirectoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessDirectoryComponent, RouterTestingModule],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: Title, useValue: { setTitle: jest.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'valdosta-ga' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BusinessDirectoryComponent);
    fixture.detectChanges();
  });

  it('renders the directory map with reviewed listing locations', async () => {
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.listings.set([listingFixture]);
    fixture.detectChanges();

    const map = fixture.debugElement.query(By.directive(MapComponent))
      ?.componentInstance as MapComponent | undefined;

    expect(map).toBeDefined();
    expect(map?.mode).toBe('directory');
    expect(map?.directoryLocations).toEqual([
      {
        name: listingFixture.name,
        category: listingFixture.category,
        coordinates: listingFixture.coordinates,
      },
    ]);
    expect(fixture.nativeElement.textContent).toContain('reviewed location');
  });

  it('renders directory listings with source notices and paginates', async () => {
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.listings.set([listingFixture]);
    component.hasMore.set(true);
    component.available.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Fixture Bakery');
    expect(fixture.nativeElement.textContent).toContain(
      'Town assignments are unverified'
    );
    expect(fixture.nativeElement.textContent).toContain('Source credit');
    expect(fixture.nativeElement.textContent).toContain('Required notice');
    expect(fixture.nativeElement.textContent).toContain('10 Main St');
    expect(fixture.nativeElement.textContent).toContain('+19125550100');
    expect(
      fixture.nativeElement.querySelector('a[href="https://example.test/"]')
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Show more businesses');
  });

  it('shows a retryable failure instead of an empty directory when loading fails', async () => {
    await fixture.whenStable();
    const component = fixture.componentInstance;
    communityServiceMock.getLocalDirectoryListings.mockRejectedValueOnce(
      new Error('offline')
    );

    await component.loadPage(cityFixture.id, 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Business directory is temporarily unavailable'
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'No businesses found.'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Business locations are temporarily unavailable.'
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'No reviewed locations are in the currently loaded results.'
    );
    const retry = fixture.nativeElement.querySelector(
      '[data-testid="directory-retry"]'
    ) as HTMLButtonElement;
    expect(retry).toBeTruthy();
    retry.click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Business directory is temporarily unavailable'
    );
  });

  describe('coverage states', () => {
    const q = (sel: string) =>
      fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const load = async (page: unknown, search = '') => {
      await fixture.whenStable();
      const component = fixture.componentInstance;
      communityServiceMock.getLocalDirectoryListings.mockResolvedValueOnce(
        page
      );
      component.search = search;
      component.searchDirectory();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const cov = (state: string, extra: object = {}) => ({
      listings: [],
      hasMore: false,
      coverage: { state, withheldReviewedDetails: 0, ...extra },
    });

    it.each([
      ['empty', {}, 'No businesses are listed for this town yet.'],
      ['acquiring', {}, 'Business listings for this town are being gathered.'],
      [
        'blocked',
        { reason: 'town-ineligible' },
        "The business directory isn't available for this town.",
      ],
      [
        'blocked',
        { reason: 'policy-withdrawn' },
        'Business listings for this town have been withdrawn.',
      ],
      ['unknown', {}, "We can't tell yet whether this town has listings."],
    ])('renders %s %j', async (state, extra, text) => {
      await load(cov(state, extra));
      expect(q('[data-testid="coverage-state"]')?.textContent).toContain(text);
      expect(q('[data-testid="directory-retry"]')).toBeNull();
    });

    it('never says there are no businesses when coverage is absent', async () => {
      await load({ listings: [], hasMore: false });
      const text = q('[data-testid="coverage-state"]')?.textContent;
      expect(text).toContain("We can't tell yet");
      expect(text).not.toMatch(/no businesses/i);
    });

    it('uses no-results wording when a search finds nothing in an empty town', async () => {
      await load(cov('empty'), 'zzz');
      const text = q('[data-testid="coverage-state"]')?.textContent;
      expect(text).toContain('No businesses match your search');
      expect(text).not.toContain('for this town yet');
    });

    it('keeps listings visible under partial, stale freshness and withheld', async () => {
      await load({
        listings: [listingFixture],
        hasMore: false,
        sourceFreshness: {
          state: 'stale',
          releaseId: '2026-10-21.0',
          sourcePublishedAt: '2026-10-22T03:00:00Z',
          acquiredAt: null,
          thresholds: { freshDays: 90, staleDays: 120 },
        },
        coverage: { state: 'partial', withheldReviewedDetails: 2 },
      });
      expect(fixture.nativeElement.textContent).toContain('Fixture Bakery');
      expect(q('[data-testid="coverage-state"]')?.textContent).toContain(
        'More listings are still being gathered.'
      );
      expect(q('[data-testid="withheld-note"]')?.textContent).toContain(
        "Some business details are hidden until they're re-checked."
      );
      expect(q('[data-testid="source-freshness"]')?.textContent).toContain(
        'may be out of date'
      );
    });

    it('shows no coverage message when listings are available', async () => {
      await load({
        listings: [listingFixture],
        hasMore: false,
        coverage: { state: 'available', withheldReviewedDetails: 0 },
      });
      expect(q('[data-testid="coverage-state"]')).toBeNull();
      expect(q('[data-testid="withheld-note"]')).toBeNull();
    });
  });

  it('lets a signed-in page owner request review of a matching directory listing', async () => {
    await fixture.whenStable();
    const component = fixture.componentInstance;
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
    await fixture.whenStable();
    const component = fixture.componentInstance;
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
    await fixture.whenStable();
    const component = fixture.componentInstance;
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

  it('keeps adult listings off until the visitor selects them', async () => {
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.isAuthenticated.set(true);
    fixture.detectChanges();

    const checkbox = fixture.nativeElement.querySelector(
      'input[name="directoryAdult"]'
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(
      communityServiceMock.getLocalDirectoryListings
    ).toHaveBeenLastCalledWith(cityFixture.id, 0, '', true);
  });

  describe('source freshness label', () => {
    const base = {
      releaseId: '2026-10-21.0',
      sourcePublishedAt: '2026-10-22T03:00:00Z',
      acquiredAt: '2026-11-01T00:00:00Z',
      thresholds: { freshDays: 90, staleDays: 120 },
    };
    const labelFor = (sf: unknown) => {
      fixture.componentInstance.sourceFreshness.set(sf as never);
      fixture.detectChanges();
      return fixture.nativeElement
        .querySelector('[data-testid="source-freshness"]')
        ?.textContent?.trim();
    };

    it.each([
      ['fresh', 'Source data: updated 2026-10-22 (release 2026-10-21.0)'],
      [
        'due',
        'Source data: updated 2026-10-22 (release 2026-10-21.0), due for refresh',
      ],
      [
        'stale',
        'Source data: updated 2026-10-22 (release 2026-10-21.0), may be out of date',
      ],
    ])('shows %s as text', async (state, text) => {
      await fixture.whenStable();
      expect(labelFor({ ...base, state })).toBe(text);
    });

    it('says the date is unknown and never invents one', async () => {
      await fixture.whenStable();
      expect(
        labelFor({
          state: 'unknown',
          releaseId: null,
          sourcePublishedAt: null,
          acquiredAt: null,
          thresholds: base.thresholds,
        })
      ).toBe('Source date unknown');
    });

    it('renders nothing when the field is absent, and stale keeps listings', async () => {
      await fixture.whenStable();
      expect(labelFor(null)).toBeUndefined();
      fixture.componentInstance.listings.set([listingFixture]);
      expect(labelFor({ ...base, state: 'stale' })).toContain('out of date');
      expect(fixture.nativeElement.textContent).toContain('Fixture Bakery');
    });

    it('stores the freshness from the loaded page', async () => {
      communityServiceMock.getLocalDirectoryListings.mockResolvedValueOnce({
        listings: [],
        hasMore: false,
        sourceFreshness: { ...base, state: 'fresh' },
      });
      await fixture.componentInstance.loadPage(cityFixture.id, 0);
      expect(fixture.componentInstance.sourceFreshness()?.state).toBe('fresh');
    });
  });
});
