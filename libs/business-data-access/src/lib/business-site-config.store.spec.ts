import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, throwError } from 'rxjs';

import {
  BusinessApiService,
  type SiteConfigResponse,
} from './business-api.service';
import { BusinessAuthService } from './business-auth.service';
import { DEFAULT_BUSINESS_SITE_CONFIG } from './business-site.config';
import { BusinessSiteConfigStore } from './business-site-config.store';

describe('BusinessSiteConfigStore', () => {
  function authStub(
    ownerToken: string | null = null,
    clientToken: string | null = null
  ) {
    return {
      token: signal<string | null>(ownerToken),
      clientToken: signal<string | null>(clientToken),
    };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads tenant-scoped config when a site slug is provided', () => {
    const getSiteConfigForSlug = jest
      .fn()
      .mockReturnValue(new Subject<SiteConfigResponse>().asObservable());

    TestBed.configureTestingModule({
      providers: [
        BusinessSiteConfigStore,
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfigForSlug,
            getSiteConfig: jest.fn(),
          },
        },
        {
          provide: BusinessAuthService,
          useValue: authStub(),
        },
      ],
    });

    const store = TestBed.inject(BusinessSiteConfigStore);
    store.fetch(false, 'north-star-advisory').subscribe();

    expect(getSiteConfigForSlug).toHaveBeenLastCalledWith(
      'north-star-advisory'
    );
  });

  it('falls back to the base site-config request when slug loading is unavailable', () => {
    const getSiteConfig = jest
      .fn()
      .mockReturnValue(new Subject<SiteConfigResponse>().asObservable());

    TestBed.configureTestingModule({
      providers: [
        BusinessSiteConfigStore,
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfig,
          },
        },
        {
          provide: BusinessAuthService,
          useValue: authStub(),
        },
      ],
    });

    const store = TestBed.inject(BusinessSiteConfigStore);
    store.fetch(false, 'north-star-advisory').subscribe();

    expect(getSiteConfig).toHaveBeenCalledTimes(2);
  });

  it('shares a single in-flight tenant request until the response resolves', () => {
    const response$ = new Subject<SiteConfigResponse>();
    const getSiteConfigForSlug = jest.fn().mockReturnValue(response$);

    TestBed.configureTestingModule({
      providers: [
        BusinessSiteConfigStore,
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfigForSlug,
            getSiteConfig: jest.fn(),
          },
        },
        {
          provide: BusinessAuthService,
          useValue: authStub(),
        },
      ],
    });

    const store = TestBed.inject(BusinessSiteConfigStore);

    store.fetch(false, 'north-star-advisory').subscribe();
    store.fetch(false, 'north-star-advisory').subscribe();

    expect(getSiteConfigForSlug).toHaveBeenCalledTimes(2);

    response$.next({
      configId: 'cfg-1',
      config: {
        site: {
          slug: 'north-star-advisory',
        },
      } as SiteConfigResponse['config'],
    });
    response$.complete();

    expect(store.loaded()).toBe(true);
    expect(store.configId()).toBe('cfg-1');
    expect(store.site().site.slug).toBe('north-star-advisory');
  });

  it('resets to the default site config when the request fails', () => {
    const getSiteConfigForSlug = jest
      .fn()
      .mockReturnValue(throwError(() => new Error('boom')));

    TestBed.configureTestingModule({
      providers: [
        BusinessSiteConfigStore,
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfigForSlug,
            getSiteConfig: jest.fn(),
          },
        },
        {
          provide: BusinessAuthService,
          useValue: authStub(),
        },
      ],
    });

    const store = TestBed.inject(BusinessSiteConfigStore);

    store.setSite({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'Loaded site',
      },
    });
    store.fetch(true, 'north-star-advisory').subscribe();

    expect(store.loaded()).toBe(true);
    expect(store.configId()).toBeNull();
    expect(store.site().brand.businessName).toBe('My Business');
  });

  it('tolerates auth-service doubles without token signals', () => {
    const getSiteConfigForSlug = jest
      .fn()
      .mockReturnValue(new Subject<SiteConfigResponse>().asObservable());

    TestBed.configureTestingModule({
      providers: [
        BusinessSiteConfigStore,
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfigForSlug,
            getSiteConfig: jest.fn(),
          },
        },
        {
          provide: BusinessAuthService,
          useValue: {},
        },
      ],
    });

    const store = TestBed.inject(BusinessSiteConfigStore);
    store.fetch(false, 'north-star-advisory').subscribe();

    expect(getSiteConfigForSlug).toHaveBeenLastCalledWith(
      'north-star-advisory'
    );
  });

  it('ignores a stale default-config response after a hosted slug fetch starts', () => {
    const defaultResponse$ = new Subject<SiteConfigResponse>();
    const hostedResponse$ = new Subject<SiteConfigResponse>();
    const getSiteConfigForSlug = jest
      .fn()
      .mockReturnValueOnce(defaultResponse$)
      .mockReturnValueOnce(hostedResponse$);

    TestBed.configureTestingModule({
      providers: [
        BusinessSiteConfigStore,
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfigForSlug,
            getSiteConfig: jest.fn(),
          },
        },
        {
          provide: BusinessAuthService,
          useValue: authStub(),
        },
      ],
    });

    const store = TestBed.inject(BusinessSiteConfigStore);
    store.fetch(false, 'steady-hand-contracting').subscribe();

    hostedResponse$.next({
      configId: 'cfg-hosted',
      config: {
        site: { slug: 'steady-hand-contracting' },
        brand: { businessName: 'Steady Hand Contracting' },
      } as SiteConfigResponse['config'],
    });
    hostedResponse$.complete();

    defaultResponse$.next({
      configId: 'cfg-default',
      config: {
        site: { slug: 'north-star-advisory' },
        brand: { businessName: 'North Star Advisory' },
      } as SiteConfigResponse['config'],
    });
    defaultResponse$.complete();

    expect(store.configId()).toBe('cfg-hosted');
    expect(store.site().site.slug).toBe('steady-hand-contracting');
    expect(store.site().brand.businessName).toBe('Steady Hand Contracting');
  });

  it('clears loadError on a successful fetch after a prior failure', () => {
    const getSiteConfigForSlug = jest
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('boom')));

    TestBed.configureTestingModule({
      providers: [
        BusinessSiteConfigStore,
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfigForSlug,
            getSiteConfig: jest.fn(),
          },
        },
        {
          provide: BusinessAuthService,
          useValue: authStub(),
        },
      ],
    });

    const store = TestBed.inject(BusinessSiteConfigStore);

    // The initial constructor-driven fetch fails synchronously.
    expect(store.loadError()).toBe('boom');

    const response$ = new Subject<SiteConfigResponse>();
    getSiteConfigForSlug.mockReturnValueOnce(response$);

    store.fetch(true, 'north-star-advisory').subscribe();

    response$.next({
      configId: 'cfg-1',
      config: {
        site: { slug: 'north-star-advisory' },
      } as SiteConfigResponse['config'],
    });
    response$.complete();

    expect(store.loadError()).toBeNull();
    expect(store.configId()).toBe('cfg-1');
  });

  it('sets loadError when a fetch fails and does not touch loaded/site/configId beyond the existing fallback behavior', () => {
    const getSiteConfigForSlug = jest
      .fn()
      .mockReturnValue(throwError(() => new Error('network down')));

    TestBed.configureTestingModule({
      providers: [
        BusinessSiteConfigStore,
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfigForSlug,
            getSiteConfig: jest.fn(),
          },
        },
        {
          provide: BusinessAuthService,
          useValue: authStub(),
        },
      ],
    });

    const store = TestBed.inject(BusinessSiteConfigStore);

    // Constructor already ran an initial fetch that failed synchronously.
    expect(store.loadError()).toBe('network down');
    expect(store.loaded()).toBe(true);
    expect(store.configId()).toBeNull();
    expect(store.site().brand.businessName).toBe('My Business');
  });

  it('does not let a stale error from a superseded slug clobber a newer successful load', () => {
    const staleResponse$ = new Subject<SiteConfigResponse>();
    const freshResponse$ = new Subject<SiteConfigResponse>();
    const getSiteConfigForSlug = jest
      .fn()
      .mockReturnValueOnce(new Subject<SiteConfigResponse>().asObservable())
      .mockReturnValueOnce(staleResponse$)
      .mockReturnValueOnce(freshResponse$);

    TestBed.configureTestingModule({
      providers: [
        BusinessSiteConfigStore,
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfigForSlug,
            getSiteConfig: jest.fn(),
          },
        },
        {
          provide: BusinessAuthService,
          useValue: authStub(),
        },
      ],
    });

    const store = TestBed.inject(BusinessSiteConfigStore);

    // First fetch, for slug A, stays in flight.
    store.fetch(false, 'slug-a').subscribe();
    // Second fetch switches to slug B before A resolves, superseding it.
    store.fetch(false, 'slug-b').subscribe();

    // The newer slug-b request resolves successfully first.
    freshResponse$.next({
      configId: 'cfg-b',
      config: {
        site: { slug: 'slug-b' },
        brand: { businessName: 'Slug B Business' },
      } as SiteConfigResponse['config'],
    });
    freshResponse$.complete();

    expect(store.loadError()).toBeNull();
    expect(store.configId()).toBe('cfg-b');

    // The stale slug-a request now errors out after the fact.
    staleResponse$.error(new Error('stale network error'));

    expect(store.loadError()).toBeNull();
    expect(store.configId()).toBe('cfg-b');
    expect(store.site().site.slug).toBe('slug-b');
    expect(store.site().brand.businessName).toBe('Slug B Business');
  });
});
