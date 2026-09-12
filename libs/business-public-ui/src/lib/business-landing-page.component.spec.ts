import { Component, destroyPlatform, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  renderApplication,
  provideServerRendering,
} from '@angular/platform-server';
import { convertToParamMap } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { getContrastRatio } from '@optimistic-tanuki/theme-models';

import {
  BusinessApiService,
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
  type BusinessSiteConfig,
  type BusinessOffer,
  type LandingSectionMotionConfig,
} from '@optimistic-tanuki/business-data-access';

import {
  businessLandingPageContrastStyles,
  BusinessLandingPageComponent,
} from './business-landing-page.component';
import { businessBookingPageStyles } from './business-booking-page.component';
import { businessPlatformHomePageStyles } from './business-platform-home-page.component';
import {
  BUSINESS_PUBLIC_DARK_ACCENT_TEXT,
  BUSINESS_PUBLIC_DARK_LABEL_TEXT,
  BUSINESS_PUBLIC_LIGHT_ACCENT_TEXT,
  BUSINESS_PUBLIC_LIGHT_LABEL_TEXT,
} from './public-contrast.tokens';

@Component({
  selector: 'otui-particle-veil',
  template: '',
  standalone: true,
})
class MockParticleVeilComponent {}

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [BusinessLandingPageComponent],
  template: '<business-landing-page />',
})
class ServerBusinessLandingHostComponent {}

describe('BusinessLandingPageComponent', () => {
  const offers: BusinessOffer[] = [
    {
      id: 'offer-1',
      label: 'Strategy Intensive',
      description:
        'A bookable service built from active business availability.',
      serviceType: 'consulting',
      startingRate: 145,
    },
  ];

  const configWithServices = {
    ...DEFAULT_BUSINESS_SITE_CONFIG,
    landingPage: {
      ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage,
      sections: DEFAULT_BUSINESS_SITE_CONFIG.landingPage.sections.map(
        (section) =>
          section.id === 'services'
            ? { ...section, enabled: true, title: 'How Services Start' }
            : section
      ),
    },
  };

  async function render(
    config: BusinessSiteConfig | null = null,
    titleService = { setTitle: jest.fn() },
    blogPosts$ = of([
      {
        id: 'post-north',
        name: 'North catalog update',
        description: 'A catalog-scoped post.',
      },
    ])
  ) {
    const getStoreProducts = jest.fn().mockReturnValue(
      of([
        {
          id: 'product-1',
          name: 'Collector Print',
          description: 'Archival print release.',
          priceCents: 4800,
          type: 'physical',
          active: true,
          stock: 6,
          imageUrl: '/assets/collector-print.jpg',
        },
      ])
    );
    const getBlogPosts = jest.fn().mockReturnValue(blogPosts$);

    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => config ?? DEFAULT_BUSINESS_SITE_CONFIG),
            fetch: jest
              .fn()
              .mockReturnValue(of(config ?? DEFAULT_BUSINESS_SITE_CONFIG)),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of(offers)),
            getStoreProducts,
            getBlogPosts,
            getSiteConfig: jest
              .fn()
              .mockReturnValue(of({ configId: null, config })),
          },
        },
        { provide: Title, useValue: titleService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('restores the loaded tenant title after returning from the platform route', async () => {
    const titleService = { setTitle: jest.fn() };
    titleService.setTitle('Business Site Platform');
    const tenantConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'North Star Advisory',
        tagline: 'Operational guidance for growing service businesses.',
      },
    };

    await render(tenantConfig, titleService);

    expect(titleService.setTitle).toHaveBeenLastCalledWith(
      'North Star Advisory | Operational guidance for growing service businesses.'
    );
  });

  it('keeps hosted header, contact, hero, and store content on one tenant response', async () => {
    const tenantConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'Emberline Studio',
        tagline: 'Configured tenant hero',
      },
      contact: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.contact,
        email: 'hello@emberline.example',
      },
      serviceCatalog: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.serviceCatalog,
        catalogId: 'emberline-catalog',
      },
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ siteSlug: 'emberline-studio' }),
            },
            paramMap: of(convertToParamMap({ siteSlug: 'emberline-studio' })),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => DEFAULT_BUSINESS_SITE_CONFIG),
            fetch: jest.fn().mockReturnValue(of(tenantConfig)),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of([])),
            getStoreProducts: jest.fn().mockReturnValue(of([])),
            getBlogPosts: jest.fn().mockReturnValue(of([])),
            getSiteConfigForSlug: jest
              .fn()
              .mockReturnValue(
                of({ configId: 'emberline-config', config: tenantConfig })
              ),
          },
        },
        { provide: Title, useValue: { setTitle: jest.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(
      host.querySelector('.public-landing-header__brand-link')?.textContent
    ).toContain('Emberline Studio');
    expect(
      host.querySelector('otui-public-landing-hero h1')?.textContent
    ).toContain('Configured tenant hero');
    expect(host.querySelector('lib-contact-form')?.textContent).toContain(
      'Emberline Studio'
    );
    expect(host.textContent).not.toContain('My Business');
  });

  it('does not render fallback branding while the hosted SSR config is pending', async () => {
    const tenantConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'Emberline Studio',
      },
    };
    const previousTenantConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'North Star Advisory',
      },
    };
    const routeConfig$ = new Subject<BusinessSiteConfig>();

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ siteSlug: 'emberline-studio' }),
            },
            paramMap: of(convertToParamMap({ siteSlug: 'emberline-studio' })),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => previousTenantConfig),
            fetch: jest.fn().mockReturnValue(routeConfig$),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of([])),
            getStoreProducts: jest.fn().mockReturnValue(of([])),
            getBlogPosts: jest.fn().mockReturnValue(of([])),
          },
        },
        { provide: Title, useValue: { setTitle: jest.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('My Business');
    expect(fixture.nativeElement.textContent).not.toContain(
      'North Star Advisory'
    );
    expect(
      fixture.nativeElement.querySelector('.public-landing-header__brand-link')
    ).toBeNull();

    routeConfig$.next(tenantConfig);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Emberline Studio');
    expect(fixture.nativeElement.textContent).not.toContain('My Business');
    expect(fixture.nativeElement.textContent).not.toContain(
      'North Star Advisory'
    );
  });

  it('renders a visible fallback for an enabled persisted unsupported section', async () => {
    const unsupportedType = 'future-section';
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      landingPage: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage,
        sections: [
          {
            id: 'unsupported-section',
            type: unsupportedType,
            title: 'Future section',
            enabled: true,
            order: 0,
          },
        ],
      },
    } as unknown as BusinessSiteConfig);

    const fallback = fixture.nativeElement.querySelector(
      `[data-block-type="${unsupportedType}"]`
    ) as HTMLElement;

    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toContain('Unsupported section');
    expect(fallback.querySelector('a, button')).toBeNull();
  });

  it('requests offers using the hosted tenant slug from the route', async () => {
    const getOffers = jest.fn().mockReturnValue(of(offers));

    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug: 'steady-hand-contracting',
              }),
            },
            paramMap: of(
              convertToParamMap({ siteSlug: 'steady-hand-contracting' })
            ),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers,
            getStoreProducts: jest.fn().mockReturnValue(of([])),
            getSiteConfig: jest
              .fn()
              .mockReturnValue(of({ configId: null, config: null })),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => DEFAULT_BUSINESS_SITE_CONFIG),
            fetch: jest.fn().mockReturnValue(of(DEFAULT_BUSINESS_SITE_CONFIG)),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.detectChanges();

    expect(getOffers).toHaveBeenCalledWith('steady-hand-contracting');
  });

  it('waits for the route-scoped catalog before requesting storefront products', async () => {
    TestBed.resetTestingModule();
    const tenantConfig$ = new Subject<BusinessSiteConfig>();
    const tenantConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      serviceCatalog: { source: 'store' as const, catalogId: 'tenant-catalog' },
    };
    const getStoreProducts = jest.fn((catalogId?: string | null) =>
      catalogId ? of([]) : of([])
    );

    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ siteSlug: 'tenant-site' }),
            },
            paramMap: of(convertToParamMap({ siteSlug: 'tenant-site' })),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => DEFAULT_BUSINESS_SITE_CONFIG),
            fetch: jest.fn().mockReturnValue(tenantConfig$),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of([])),
            getStoreProducts,
            getBlogPosts: jest.fn().mockReturnValue(of([])),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.detectChanges();

    expect(getStoreProducts).not.toHaveBeenCalledWith(undefined);
    expect(getStoreProducts).not.toHaveBeenCalledWith(null);

    tenantConfig$.next(tenantConfig);
    fixture.detectChanges();

    expect(getStoreProducts).toHaveBeenCalledWith('tenant-catalog');
  });

  it('does not announce fragment navigation as the current page', async () => {
    const fixture = await render();
    const heroLink = fixture.nativeElement.querySelector(
      'otui-public-landing-header .public-landing-header__nav-link[href="#hero"]'
    ) as HTMLAnchorElement;

    expect(heroLink).not.toBeNull();
    expect(heroLink.getAttribute('aria-current')).toBeNull();
  });

  it('keeps the hosted tenant slug in the booking call to action link', async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug: 'steady-hand-contracting',
              }),
            },
            paramMap: of(
              convertToParamMap({ siteSlug: 'steady-hand-contracting' })
            ),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of(offers)),
            getStoreProducts: jest.fn().mockReturnValue(of([])),
            getSiteConfig: jest
              .fn()
              .mockReturnValue(
                of({ configId: null, config: configWithServices })
              ),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => configWithServices),
            fetch: jest.fn().mockReturnValue(of(configWithServices)),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.detectChanges();

    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink));

    expect(links.map((link) => link.href)).toContain(
      '/sites/steady-hand-contracting/book'
    );
  });

  it('renders root-mode section navigation CTAs as hash anchors', async () => {
    const fixture = await render({
      ...configWithServices,
      landingPage: {
        ...configWithServices.landingPage,
        sections: [
          ...configWithServices.landingPage.sections,
          {
            id: 'custom-store-link',
            type: 'custom',
            title: 'Browse products',
            enabled: true,
            order: 7,
            ctaLabel: 'View storefront',
            ctaHref: 'storefront',
          },
        ],
      },
    });

    const anchor = fixture.nativeElement.querySelector(
      '.custom-section a.cta-primary'
    ) as HTMLAnchorElement;

    expect(anchor.href.endsWith('#storefront')).toBe(true);
    expect(anchor.textContent).toContain('View storefront');
  });

  it('scopes tenant fragment navigation and configured CTAs to the hosted site path', async () => {
    const tenantConfig = {
      ...configWithServices,
      landingPage: {
        ...configWithServices.landingPage,
        sections: [
          ...configWithServices.landingPage.sections,
          {
            id: 'custom-contact-link',
            type: 'custom',
            title: 'Start here',
            enabled: true,
            order: 7,
            ctaLabel: 'Contact the team',
            ctaHref: '#contact',
          },
        ],
      },
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug: 'steady-hand-contracting',
              }),
            },
            paramMap: of(
              convertToParamMap({ siteSlug: 'steady-hand-contracting' })
            ),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => tenantConfig),
            fetch: jest.fn().mockReturnValue(of(tenantConfig)),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of(offers)),
            getStoreProducts: jest.fn().mockReturnValue(of([])),
            getBlogPosts: jest.fn().mockReturnValue(of([])),
          },
        },
        { provide: Title, useValue: { setTitle: jest.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.detectChanges();

    const navLink = fixture.nativeElement.querySelector(
      '.public-landing-header__nav-link[href="/sites/steady-hand-contracting#about"]'
    ) as HTMLAnchorElement;
    const ctaLink = fixture.nativeElement.querySelector(
      '.custom-section a.cta-primary'
    ) as HTMLAnchorElement;

    expect(navLink).not.toBeNull();
    expect(ctaLink).not.toBeNull();
    expect(ctaLink.getAttribute('href')).toBe(
      '/sites/steady-hand-contracting#contact'
    );
  });

  it('connects the hosted services navigation item to its configured section id', async () => {
    const tenantConfig = {
      ...configWithServices,
      landingPage: {
        ...configWithServices.landingPage,
        sections: configWithServices.landingPage.sections.map((section) =>
          section.id === 'services'
            ? { ...section, id: 'field-guide-services' }
            : section
        ),
      },
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug: 'steady-hand-contracting',
              }),
            },
            paramMap: of(
              convertToParamMap({ siteSlug: 'steady-hand-contracting' })
            ),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => tenantConfig),
            fetch: jest.fn().mockReturnValue(of(tenantConfig)),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of(offers)),
            getStoreProducts: jest.fn().mockReturnValue(of([])),
            getBlogPosts: jest.fn().mockReturnValue(of([])),
          },
        },
        { provide: Title, useValue: { setTitle: jest.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.detectChanges();

    const servicesLink = fixture.nativeElement.querySelector(
      '.public-landing-header__nav-link[href="/sites/steady-hand-contracting#field-guide-services"]'
    ) as HTMLAnchorElement | null;
    const servicesSection = fixture.nativeElement.querySelector(
      'section#field-guide-services'
    ) as HTMLElement | null;

    expect(servicesLink).not.toBeNull();
    expect(servicesSection).not.toBeNull();
  });

  it('renders every visible configured navigation fragment target exactly once', async () => {
    const sections = [
      'hero',
      'about',
      'services',
      'testimonials',
      'contact',
      'booking',
      'store',
      'blog',
      'custom',
      'image',
      'gallery',
    ].map((type, order) => ({
      id: `configured-${type}`,
      type,
      title: `${type} section`,
      enabled: true,
      order,
    }));
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      features: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.features,
        booking: { enabled: true },
        store: { enabled: true },
        testimonials: { enabled: true },
      },
      plugins: {
        schemaVersion: 1,
        surfaceType: 'business-site',
        capabilities: {
          'blogging.posts': {
            enabled: true,
            placement: 'public-content',
            resourceRef: { type: 'blog-catalog', id: 'catalog-fragments' },
          },
        },
      },
      landingPage: {
        layout: 'single-column',
        sections,
      },
    } as BusinessSiteConfig);
    const host = fixture.nativeElement as HTMLElement;

    expect(
      host.querySelector(
        '.public-landing-header__brand-link[href="#configured-hero"]'
      )
    ).not.toBeNull();

    for (const section of sections) {
      const navigationLink = host.querySelector(
        `.public-landing-header__nav-link[href="#${section.id}"]`
      );
      const targets = host.querySelectorAll(`[id="${section.id}"]`);

      expect(navigationLink).not.toBeNull();
      expect(targets).toHaveLength(1);
    }
  });

  it('uses contrast-safe accent and label tokens for tenant landing text', () => {
    expect(businessLandingPageContrastStyles).toContain(
      '--business-public-accent-text: var(--primary-2, #0f5f4b)'
    );
    expect(businessLandingPageContrastStyles).toContain(
      '--business-public-accent-text: var(--primary-8, #9fe0ca)'
    );
    expect(businessLandingPageContrastStyles).toContain(
      'color: var(--business-public-accent-text)'
    );
    expect(businessLandingPageContrastStyles).toContain(
      'color: var(--business-public-label-text)'
    );
    expect(businessLandingPageContrastStyles).toContain(
      '--otui-public-landing-muted: var(--business-public-label-text);'
    );
    expect(
      getContrastRatio(BUSINESS_PUBLIC_LIGHT_ACCENT_TEXT, '#fff8f0')
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      getContrastRatio(BUSINESS_PUBLIC_DARK_ACCENT_TEXT, '#1a221d')
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      getContrastRatio(BUSINESS_PUBLIC_LIGHT_LABEL_TEXT, '#ffffff')
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      getContrastRatio(BUSINESS_PUBLIC_DARK_LABEL_TEXT, '#1a221d')
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('uses the semantic on-brand foreground for tenant CTAs in every mode', () => {
    expect(businessLandingPageContrastStyles).toContain(
      '--business-public-on-brand: var(--on-primary, var(--primary-foreground, #ffffff))'
    );
    expect(businessLandingPageContrastStyles).toContain(
      '--on-primary: var(--business-public-on-brand);'
    );
    expect(businessLandingPageContrastStyles).toContain(
      'color: var(--business-public-on-brand)'
    );
    expect(getContrastRatio('#ffffff', '#1f7a63')).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio('#ffffff', '#1f5f8b')).toBeGreaterThanOrEqual(4.5);
  });

  it('uses contrast-safe accent fallbacks for public booking and platform labels', () => {
    expect(businessBookingPageStyles).toContain(
      '--booking-accent: var(--primary-2, #0f5f4b)'
    );
    expect(businessBookingPageStyles).toContain(
      '--booking-accent: var(--primary-8, #9fe0ca)'
    );
    expect(businessPlatformHomePageStyles).toContain(
      '--platform-accent-text: var(--primary-2, #0f5f4b)'
    );
    expect(businessPlatformHomePageStyles).toContain(
      '--platform-accent-text: var(--primary-8, #9fe0ca)'
    );
  });

  it('keeps contact form labels readable on the dark contact panel', async () => {
    const fixture = await render();
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll(
        'lib-contact-form lib-text-input .form-label, lib-contact-form lib-text-area .form-label'
      ) as NodeListOf<HTMLElement>
    ).map((label) => label.textContent?.trim());

    expect(labels).toEqual(['Name', 'Email Address', 'Your Message']);
    expect(businessLandingPageContrastStyles).toContain(
      'lib-contact-form .form {\n        --background-overlay: #1a221d;'
    );
    expect(businessLandingPageContrastStyles).toContain(
      'lib-text-input .form-label,'
    );
    expect(businessLandingPageContrastStyles).toContain(
      'lib-text-area .form-label'
    );
    expect(businessLandingPageContrastStyles).toContain(
      'color: var(--business-public-dark-label-text) !important'
    );
    expect(
      getContrastRatio(BUSINESS_PUBLIC_DARK_LABEL_TEXT, '#1a221d')
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('associates a visible subject label with the contact subject select', async () => {
    const fixture = await render();
    const select = fixture.nativeElement.querySelector(
      'lib-contact-form lib-select select'
    ) as HTMLSelectElement | null;

    expect(select).not.toBeNull();
    expect(select?.id).toBe('business-contact-subject');

    const label = fixture.nativeElement.querySelector(
      'lib-contact-form label[for="business-contact-subject"]'
    ) as HTMLLabelElement | null;
    expect(label?.textContent?.trim()).toBe('Subject');
  });

  it('keeps tenant actions visibly focusable and disables entrance motion when reduced motion is requested', () => {
    expect(businessLandingPageContrastStyles).toContain(':focus-visible');
    expect(businessLandingPageContrastStyles).toContain(
      '@media (prefers-reduced-motion: reduce)'
    );
    expect(businessLandingPageContrastStyles).toContain(
      'animation-duration: 0.01ms'
    );
  });

  it('hides a broken newsletter banner and exposes an accessible fallback', async () => {
    const fixture = await render();
    const image = fixture.nativeElement.querySelector(
      'lib-contact-form img[alt="Newsletter Banner"]'
    ) as HTMLImageElement | null;

    expect(image).not.toBeNull();
    image?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(image?.isConnected).toBe(false);
    const fallback = fixture.nativeElement.querySelector(
      '.contact-media-fallback'
    ) as HTMLElement | null;
    expect(fallback?.textContent?.trim()).toBe('Newsletter Banner');
    expect(fallback?.getAttribute('aria-hidden')).toBeNull();
    expect(fallback?.getAttribute('role')).toBe('img');
  });

  it('keeps public contact layout children shrinkable at narrow widths', () => {
    expect(businessLandingPageContrastStyles).toContain('.landing-page-root,');
    expect(businessLandingPageContrastStyles).toContain('.landing-shell,');
    expect(businessLandingPageContrastStyles).toContain(
      '.contact-form-panel ::ng-deep lib-contact-form .form'
    );
    expect(businessLandingPageContrastStyles).toContain(
      'box-sizing: border-box;'
    );
    expect(businessLandingPageContrastStyles).toContain('min-width: 0;');
    expect(businessLandingPageContrastStyles).toContain('max-width: 100%;');
  });

  it('keeps the hosted tenant slug in the client portal call to action link', async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug: 'steady-hand-contracting',
              }),
            },
            paramMap: of(
              convertToParamMap({ siteSlug: 'steady-hand-contracting' })
            ),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of(offers)),
            getStoreProducts: jest.fn().mockReturnValue(of([])),
            getSiteConfig: jest
              .fn()
              .mockReturnValue(
                of({ configId: null, config: configWithServices })
              ),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => configWithServices),
            fetch: jest.fn().mockReturnValue(of(configWithServices)),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.detectChanges();

    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink));

    expect(links.map((link) => link.href)).toContain(
      '/sites/steady-hand-contracting/client/login'
    );
  });

  it('does not render a generic root booking link when there is no hosted tenant slug', async () => {
    const fixture = await render(configWithServices);

    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink).href);

    expect(links).not.toContain('/book');
  });

  it('uses business-facing fallback identity and copy', async () => {
    const fixture = await render(configWithServices);
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('My Business');
    expect(text).toContain('Business Owner');
    expect(text).toContain('Owner');
    expect(text).toContain('How Services Start');
    expect(text).not.toContain('Personal Training');
    expect(text).not.toContain('Coach');
    expect(text).not.toContain('How Coaching Starts');
  });

  it('renders business-facing offer descriptions from the api', async () => {
    const fixture = await render(configWithServices);
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Strategy Intensive');
    expect(text).toContain(
      'A bookable service built from active business availability.'
    );
    expect(text).not.toContain('active trainer availability');
  });

  it('marks embedded preview mode explicitly for editor-hosted rendering', async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => configWithServices),
            fetch: jest.fn().mockReturnValue(of(configWithServices)),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of(offers)),
            getStoreProducts: jest.fn().mockReturnValue(of([])),
            getSiteConfig: jest
              .fn()
              .mockReturnValue(
                of({ configId: null, config: configWithServices })
              ),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.componentRef.setInput('embeddedPreview', true);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-embedded-preview-root]')).toBeTruthy();
  });

  it('composes a default tenant landing through shared header and hero primitives', async () => {
    const fixture = await render(configWithServices);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('otui-public-landing-header')).not.toBeNull();
    expect(host.querySelector('otui-public-landing-hero')).not.toBeNull();
    expect(
      host.querySelector('otui-public-landing-hero h1')?.textContent
    ).toContain(configWithServices.brand.tagline);
  });

  it('emits preview section selection and highlights the selected section in embedded mode', async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => configWithServices),
            fetch: jest.fn().mockReturnValue(of(configWithServices)),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of(offers)),
            getStoreProducts: jest.fn().mockReturnValue(of([])),
            getSiteConfig: jest
              .fn()
              .mockReturnValue(
                of({ configId: null, config: configWithServices })
              ),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    const component = fixture.componentInstance;
    const emitSpy = jest.spyOn(component.sectionSelected, 'emit');

    fixture.componentRef.setInput('embeddedPreview', true);
    fixture.componentRef.setInput('selectedSectionId', 'services');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const section = host.querySelector(
      '[data-section-id="services"]'
    ) as HTMLElement;

    section.click();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith('services');
    expect(section.classList.contains('preview-section-selected')).toBe(true);
  });

  it('renders sections in configured order', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      landingPage: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage,
        sections: [
          {
            id: 'contact',
            type: 'contact',
            title: 'Contact',
            enabled: true,
            order: 0,
          },
          {
            id: 'hero',
            type: 'hero',
            title: 'Welcome',
            enabled: true,
            order: 1,
          },
          {
            id: 'testimonials',
            type: 'testimonials',
            title: 'Testimonials',
            enabled: true,
            order: 2,
          },
        ],
      },
    });
    const text = fixture.nativeElement.textContent;

    expect(
      text.indexOf(
        'Reach out when you are ready to talk goals, schedule, and fit.'
      )
    ).toBeLessThan(text.indexOf(DEFAULT_BUSINESS_SITE_CONFIG.brand.tagline));
  });

  it('renders storefront inventory only when the store feature is enabled', async () => {
    const fixture = await render({
      ...configWithServices,
      serviceCatalog: { source: 'store', catalogId: 'catalog-store' },
      features: {
        ...configWithServices.features,
        store: { enabled: true },
      },
      landingPage: {
        ...configWithServices.landingPage,
        sections: [
          ...configWithServices.landingPage.sections,
          {
            id: 'storefront',
            type: 'store',
            title: 'Shop the current release',
            enabled: true,
            order: 6,
          },
        ],
      },
    });

    expect(fixture.nativeElement.textContent).toContain(
      'Shop the current release'
    );
    expect(fixture.nativeElement.textContent).toContain('Collector Print');
  });

  it('hides storefront inventory when the store feature is disabled', async () => {
    const fixture = await render({
      ...configWithServices,
      features: {
        ...configWithServices.features,
        store: { enabled: false },
      },
      landingPage: {
        ...configWithServices.landingPage,
        sections: [
          ...configWithServices.landingPage.sections,
          {
            id: 'storefront',
            type: 'store',
            title: 'Shop the current release',
            enabled: true,
            order: 6,
          },
        ],
      },
    });

    expect(fixture.nativeElement.textContent).not.toContain('Collector Print');
  });

  it('renders a blog section only for an enabled blogging.posts catalog reference', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      plugins: {
        schemaVersion: 1,
        surfaceType: 'business-site',
        capabilities: {
          'blogging.posts': {
            enabled: true,
            placement: 'public-content',
            resourceRef: { type: 'blog-catalog', id: 'catalog-north' },
          },
        },
      },
      landingPage: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage,
        sections: [
          {
            id: 'blog-posts',
            type: 'blog',
            title: 'Field notes',
            enabled: true,
            order: 0,
          },
        ],
      },
    } as BusinessSiteConfig);

    expect(fixture.nativeElement.textContent).toContain('Field notes');
    expect(fixture.nativeElement.textContent).toContain('North catalog update');
  });

  it('keeps the configured blog section and rest of the landing available when the blog API fails', async () => {
    const blogConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      plugins: {
        schemaVersion: 1,
        surfaceType: 'business-site',
        capabilities: {
          'blogging.posts': {
            enabled: true,
            placement: 'public-content',
            resourceRef: { type: 'blog-catalog', id: 'catalog-north' },
          },
        },
      },
      landingPage: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage,
        sections: [
          {
            id: 'hero',
            type: 'hero',
            title: 'Welcome',
            enabled: true,
            order: 0,
          },
          {
            id: 'blog-posts',
            type: 'blog',
            title: 'Field notes',
            enabled: true,
            order: 1,
          },
        ],
      },
    } as unknown as BusinessSiteConfig;

    const fixture = await render(
      blogConfig,
      { setTitle: jest.fn() },
      throwError(() => new Error('blog unavailable'))
    );

    const text = fixture.nativeElement.textContent;
    expect(text).toContain(blogConfig.brand.tagline);
    expect(text).toContain('Field notes');
    expect(text).toContain('No posts are live in this catalog yet.');
  });

  it('does not render a blog section for an unsupported resource reference', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      plugins: {
        schemaVersion: 1,
        surfaceType: 'business-site',
        capabilities: {
          'blogging.posts': {
            enabled: true,
            placement: 'public-content',
            resourceRef: { type: 'store-catalog', id: 'catalog-north' },
          },
        },
      },
      landingPage: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage,
        sections: [
          {
            id: 'blog-posts',
            type: 'blog',
            title: 'Field notes',
            enabled: true,
            order: 0,
          },
        ],
      },
    } as unknown as BusinessSiteConfig);

    expect(fixture.nativeElement.textContent).not.toContain('Field notes');
    expect(fixture.nativeElement.textContent).not.toContain(
      'North catalog update'
    );
  });

  it('hides booking, testimonials, and client portal entry points when their features are disabled', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      contact: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.contact,
        consultationLabel: 'Book strategy session',
      },
      features: {
        store: { enabled: false },
        booking: { enabled: false, allowOnlinePayment: false },
        clientPortal: { enabled: false },
        clientTasks: { enabled: false, allowClientCompletion: false },
        invoices: { enabled: false },
        testimonials: { enabled: false },
      },
      testimonials: [
        {
          quote: 'Helped me simplify my process.',
          clientName: 'Alex',
          clientDetail: 'Founder',
        },
      ],
    });
    const text = fixture.nativeElement.textContent;

    expect(text).not.toContain('Book strategy session');
    expect(text).not.toContain('Client Portal');
    expect(text).not.toContain('Client Login');
    expect(text).not.toContain('Helped me simplify my process.');
  });

  it('renders the configured business and owner names from app config', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'North Star Advisory',
        ownerName: 'Jordan Vale',
      },
    });
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('North Star Advisory');
    expect(text).toContain('Jordan Vale');
  });

  it('renders configured hero rich content below the shared hero heading', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      landingPage: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage,
        sections: DEFAULT_BUSINESS_SITE_CONFIG.landingPage.sections.map(
          (section) =>
            section.id === 'hero'
              ? {
                  ...section,
                  richContent: {
                    title: 'Hero story',
                    content:
                      '<p>Directly editable hero copy for the public landing page.</p>',
                    injectedComponents: [],
                    themeConfig: {
                      theme: 'light',
                      accentColor: '#1f7a63',
                    },
                  },
                }
              : section
        ),
      },
    });
    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent;

    expect(
      host.querySelector('otui-public-landing-hero h1')?.textContent
    ).toContain('Hero story');
    expect(host.querySelector('otui-public-landing-hero h1')).not.toBeNull();
    expect(
      host.querySelector(
        'otui-public-landing-hero business-rich-content-renderer'
      )
    ).not.toBeNull();
    expect(text).toContain(
      'Directly editable hero copy for the public landing page.'
    );
    expect(
      host.querySelector('.public-landing-hero__description')?.textContent
    ).toContain(DEFAULT_BUSINESS_SITE_CONFIG.brand.intro);
    expect(
      host.querySelector('.public-landing-hero__description')?.textContent
    ).not.toContain(DEFAULT_BUSINESS_SITE_CONFIG.brand.longBio);
    expect(host.querySelectorAll('otui-public-landing-hero h1')).toHaveLength(
      1
    );
    expect(
      host.querySelector('otui-public-landing-hero [slot="body"]')
    ).not.toBeNull();
    expect(
      host.querySelector(
        'otui-public-landing-hero [data-public-landing-background].hero-motion'
      )
    ).not.toBeNull();
    expect(
      host.querySelector('otui-public-landing-hero.hero-has-background')
    ).not.toBeNull();
    expect(businessLandingPageContrastStyles).toContain(
      '.hero-motion {\n        pointer-events: none;'
    );
    expect(text).not.toMatch(
      /(?:\bpreset\b|\bseeded\b|\bslice\b|\bP\d+(?:\.\d+)?\b)/i
    );
  });

  it('keeps seeded rich-content heroes inside the shared shell with tenant-scoped booking', async () => {
    const tenantConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'North Star Advisory',
        tagline: 'Operational guidance for growing service businesses.',
      },
      landingPage: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage,
        sections: DEFAULT_BUSINESS_SITE_CONFIG.landingPage.sections.map(
          (section) =>
            section.id === 'hero'
              ? {
                  ...section,
                  richContent: {
                    title: 'North Star field guide',
                    content: '<p>Directly editable North Star hero copy.</p>',
                    injectedComponents: [],
                    themeConfig: {
                      theme: 'light',
                      accentColor: '#1f7a63',
                    },
                  },
                }
              : section
        ),
      },
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug: 'north-star-advisory',
              }),
            },
            paramMap: of(
              convertToParamMap({ siteSlug: 'north-star-advisory' })
            ),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => tenantConfig),
            fetch: jest.fn().mockReturnValue(of(tenantConfig)),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of(offers)),
            getStoreProducts: jest.fn().mockReturnValue(of([])),
            getBlogPosts: jest.fn().mockReturnValue(of([])),
          },
        },
        { provide: Title, useValue: { setTitle: jest.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('otui-public-landing-hero')).not.toBeNull();
    expect(
      host.querySelector('otui-public-landing-hero h1')?.textContent
    ).toContain('North Star field guide');
    expect(host.textContent).toContain(
      'Directly editable North Star hero copy.'
    );

    const bookingLink = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink).href)
      .find((href): href is string => !!href && href.endsWith('/book'));

    expect(bookingLink).toBe('/sites/north-star-advisory/book');
  });

  it('updates projected hero rich content while preserving the single heading', async () => {
    const firstConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      landingPage: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage,
        sections: DEFAULT_BUSINESS_SITE_CONFIG.landingPage.sections.map(
          (section) =>
            section.id === 'hero'
              ? {
                  ...section,
                  richContent: {
                    title: 'First hero title',
                    content: '<p>First hero body.</p>',
                  },
                }
              : section
        ),
      },
    };
    const secondConfig = {
      ...firstConfig,
      landingPage: {
        ...firstConfig.landingPage,
        sections: firstConfig.landingPage.sections.map((section) =>
          section.id === 'hero'
            ? {
                ...section,
                richContent: {
                  title: 'Updated hero title',
                  content: '<p>Updated hero body.</p>',
                },
              }
            : section
        ),
      },
    };
    const site = signal(firstConfig);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: site.asReadonly(),
            fetch: jest.fn().mockReturnValue(of(firstConfig)),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of(offers)),
            getStoreProducts: jest.fn().mockReturnValue(of([])),
            getBlogPosts: jest.fn().mockReturnValue(of([])),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('First hero body.');
    expect(
      fixture.nativeElement.querySelectorAll('otui-public-landing-hero h1')
    ).toHaveLength(1);

    site.set(secondConfig);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('First hero body.');
    expect(fixture.nativeElement.textContent).toContain('Updated hero body.');
    expect(
      fixture.nativeElement.querySelectorAll('otui-public-landing-hero h1')
    ).toHaveLength(1);
  });

  it('applies the configured split layout and renders custom sections', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      landingPage: {
        layout: 'split',
        sections: [
          ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage.sections,
          {
            id: 'custom-1',
            type: 'custom',
            title: 'What working together looks like',
            enabled: true,
            order: 6,
            body: 'Every engagement starts with a scoped plan and a decision cadence.',
            ctaLabel: 'See options',
            ctaHref: '/book',
          },
        ],
      },
    } as BusinessSiteConfig);

    const host = fixture.nativeElement as HTMLElement;
    const customSection = host.querySelector('[data-section-id="custom-1"]');

    expect(host.querySelector('.layout-split')).toBeTruthy();
    expect(customSection?.textContent).toContain(
      'What working together looks like'
    );
    expect(customSection?.textContent).toContain(
      'Every engagement starts with a scoped plan and a decision cadence.'
    );
    expect(customSection?.textContent).toContain('See options');
  });

  it('renders compose-backed custom section content without social post chrome', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      landingPage: {
        layout: 'single-column',
        sections: [
          {
            id: 'custom-1',
            type: 'custom',
            title: 'Working together',
            enabled: true,
            order: 0,
            body: 'Fallback copy',
            richContent: {
              title: 'Working together',
              content:
                '<p>Start with a scoped working session.</p><div data-angular-component data-instance-id="callout-1"></div>',
              injectedComponents: [
                {
                  instanceId: 'callout-1',
                  componentType: 'callout-box',
                  componentData: {
                    title: 'Shared rhythm',
                    content: 'Weekly review and clear owners.',
                    type: 'info',
                  },
                },
              ],
            },
          },
        ],
      },
    } as BusinessSiteConfig);

    const host = fixture.nativeElement as HTMLElement;
    const customSection = host.querySelector('[data-section-id="custom-1"]');

    expect(customSection?.textContent).toContain(
      'Start with a scoped working session.'
    );
    expect(customSection?.textContent).toContain('Shared rhythm');
    expect(customSection?.textContent).not.toContain('Comment');
    expect(customSection?.textContent).not.toContain('Save');
  });

  it('renders split layout sections inside their assigned canvas columns', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      landingPage: {
        layout: 'split',
        sections: [
          {
            id: 'hero',
            type: 'hero',
            title: 'Welcome',
            enabled: true,
            order: 0,
            layoutPlacement: { split: 'primary', grid: 'hero-wide' },
          },
          {
            id: 'contact',
            type: 'contact',
            title: 'Contact',
            enabled: true,
            order: 1,
            layoutPlacement: { split: 'secondary', grid: 'bottom-right' },
          },
        ],
      },
    } as BusinessSiteConfig);

    const host = fixture.nativeElement as HTMLElement;
    const primaryZone = host.querySelector(
      '[data-layout-zone="split:primary"]'
    );
    const secondaryZone = host.querySelector(
      '[data-layout-zone="split:secondary"]'
    );

    expect(primaryZone?.textContent).toContain(
      DEFAULT_BUSINESS_SITE_CONFIG.brand.tagline
    );
    expect(secondaryZone?.textContent).toContain(
      'Reach out when you are ready to talk goals, schedule, and fit.'
    );
  });

  it('renders grid layout sections inside their assigned visual slots', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      landingPage: {
        layout: 'grid',
        sections: [
          {
            id: 'hero',
            type: 'hero',
            title: 'Welcome',
            enabled: true,
            order: 0,
            layoutPlacement: { split: 'primary', grid: 'hero-wide' },
          },
          {
            id: 'services',
            type: 'services',
            title: 'Services',
            enabled: true,
            order: 1,
            layoutPlacement: { split: 'primary', grid: 'top-right' },
          },
        ],
      },
    } as BusinessSiteConfig);

    const host = fixture.nativeElement as HTMLElement;
    const heroWideZone = host.querySelector(
      '[data-layout-zone="grid:hero-wide"]'
    );
    const topRightZone = host.querySelector(
      '[data-layout-zone="grid:top-right"]'
    );

    expect(heroWideZone?.textContent).toContain(
      DEFAULT_BUSINESS_SITE_CONFIG.brand.tagline
    );
    expect(topRightZone?.textContent).toContain(
      'Choose a starting point, then build the right engagement from there.'
    );
  });

  it('folds credentials and specialties into the about section instead of rendering a separate hero owner panel', async () => {
    const fixture = await render({
      ...configWithServices,
      brand: {
        ...configWithServices.brand,
        ownerName: 'Jordan Vale',
        credentials: ['ISA Certified Arborist', 'Fully insured crew'],
        specializations: ['Complex scheduling', 'Operational reset'],
      },
    });
    const host = fixture.nativeElement as HTMLElement;
    const heroSection = host.querySelector('[data-section-id="hero"]');
    const aboutSection = host.querySelector('[data-section-id="about"]');
    const chips = Array.from(
      aboutSection?.querySelectorAll('.specialties span') ?? []
    ) as HTMLElement[];

    expect(heroSection?.querySelector('.profile')).toBeFalsy();
    expect(aboutSection?.textContent).toContain('Jordan Vale');
    expect(aboutSection?.textContent).toContain('ISA Certified Arborist');
    expect(aboutSection?.textContent).toContain('Fully insured crew');
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.every((chip) => chip.dataset['themeAware'] === 'true')).toBe(
      true
    );
  });

  it('renders image and gallery sections from saved landing config', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      landingPage: {
        layout: 'single-column',
        sections: [
          {
            id: 'image-1',
            type: 'image',
            title: 'Studio',
            enabled: true,
            order: 0,
            image: {
              sourceType: 'asset',
              src: '/assets/business/studio.jpg',
              alt: 'Studio floor',
              caption: 'Private and prepared.',
              aspect: 'landscape',
              fit: 'cover',
              focalPoint: 'center',
            },
            motion: {
              kind: 'signal-mesh',
              density: 6,
            },
          },
          {
            id: 'gallery-1',
            type: 'gallery',
            title: 'Gallery',
            enabled: true,
            order: 1,
            gallery: {
              style: 'masonry',
              columns: 2,
              items: [
                {
                  sourceType: 'url',
                  src: 'https://cdn.example.com/one.jpg',
                  alt: 'One',
                  caption: 'First',
                },
                {
                  sourceType: 'asset',
                  src: '/assets/business/two.jpg',
                  alt: 'Two',
                },
              ],
            },
            motion: {
              kind: 'shimmer-beam',
              direction: 'horizontal',
            },
          },
        ],
      },
    } as BusinessSiteConfig);
    const host = fixture.nativeElement as HTMLElement;
    const images = Array.from(
      host.querySelectorAll('img')
    ) as HTMLImageElement[];

    expect(
      images.some((image) => image.src.includes('/assets/business/studio.jpg'))
    ).toBe(true);
    expect(
      images.some((image) =>
        image.src.includes('https://cdn.example.com/one.jpg')
      )
    ).toBe(true);
    expect(host.textContent).toContain('Private and prepared.');
    expect(host.querySelector('[data-motion-kind="signal-mesh"]')).toBeTruthy();
    expect(
      host.querySelector('[data-motion-kind="shimmer-beam"]')
    ).toBeTruthy();
  });

  it('renders motion as a background layer for non-hero sections and does not drop section content', async () => {
    const aboutMotion: LandingSectionMotionConfig = {
      kind: 'aurora-ribbon',
      intensity: 0.5,
    };

    const servicesMotion: LandingSectionMotionConfig = {
      kind: 'pulse-rings',
      ringCount: 2,
      reducedMotion: true,
    };

    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'Ledgerline',
        longBio: 'About Ledgerline business copy.',
      },
      landingPage: {
        layout: 'single-column',
        sections: [
          {
            id: 'about-motion',
            type: 'about',
            title: 'About Ledgerline',
            enabled: true,
            order: 0,
            motion: aboutMotion,
          },
          {
            id: 'services-motion',
            type: 'services',
            title: 'Our Services',
            enabled: true,
            order: 1,
            motion: servicesMotion,
          },
        ],
      },
    } as BusinessSiteConfig);

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('About Ledgerline');
    expect(host.textContent).toContain('Ledgerline');
    expect(host.textContent).toContain('About Ledgerline business copy.');

    const aboutShell = host.querySelector('[data-section-id="about-motion"]');
    const servicesShell = host.querySelector(
      '[data-section-id="services-motion"]'
    );

    expect(aboutShell?.getAttribute('data-motion-kind')).toBe('aurora-ribbon');
    expect(aboutShell?.querySelector('.section-motion')).toBeTruthy();

    expect(servicesShell?.getAttribute('data-motion-kind')).toBe('pulse-rings');
    expect(servicesShell?.querySelector('.section-motion')).toBeTruthy();
  });

  it('stretches motion surfaces to fill the entire section shell', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      landingPage: {
        layout: 'single-column',
        sections: [
          {
            id: 'about-motion',
            type: 'about',
            title: 'About',
            enabled: true,
            order: 0,
            motion: {
              kind: 'aurora-ribbon',
            },
          },
        ],
      },
    } as BusinessSiteConfig);

    const host = fixture.nativeElement as HTMLElement;
    const motionSurface = host.querySelector(
      '[data-section-id="about-motion"] .section-motion .aurora-ribbon'
    ) as HTMLElement | null;

    expect(motionSurface).toBeTruthy();
    expect(motionSurface?.style.height).toBe('100%');
  });

  it('renders an optional contact-section image with the cleaned two-column layout', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      landingPage: {
        layout: 'single-column',
        sections: DEFAULT_BUSINESS_SITE_CONFIG.landingPage.sections.map(
          (section) =>
            section.id === 'contact'
              ? {
                  ...section,
                  image: {
                    sourceType: 'asset',
                    src: '/assets/business/contact.jpg',
                    alt: 'Studio portrait',
                    caption: 'Meet in person or remotely.',
                    aspect: 'portrait',
                    fit: 'cover',
                    focalPoint: 'center',
                  },
                }
              : section
        ),
      },
    } as BusinessSiteConfig);

    const host = fixture.nativeElement as HTMLElement;
    const contactSection = host.querySelector('[data-section-id="contact"]');
    const contactImage = contactSection?.querySelector(
      '.contact-media img'
    ) as HTMLImageElement | null;
    const contactGrid = contactSection?.querySelector('.contact-grid');

    expect(contactGrid?.classList.contains('contact-grid-with-image')).toBe(
      true
    );
    expect(contactImage?.src).toContain('/assets/business/contact.jpg');
    expect(contactImage?.alt).toBe('Studio portrait');
    expect(contactSection?.textContent).toContain(
      'Meet in person or remotely.'
    );
  });
});

describe('BusinessLandingPageComponent SSR', () => {
  it('serializes one Emberline tenant identity across the raw SSR landing output', async () => {
    const tenantConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'Emberline Studio',
        tagline: 'Configured Emberline hero',
      },
    };

    destroyPlatform();
    const html = await renderApplication(
      () =>
        bootstrapApplication(ServerBusinessLandingHostComponent, {
          providers: [
            provideServerRendering(),
            provideRouter([]),
            {
              provide: ActivatedRoute,
              useValue: {
                snapshot: {
                  paramMap: convertToParamMap({ siteSlug: 'emberline-studio' }),
                },
                paramMap: of(
                  convertToParamMap({ siteSlug: 'emberline-studio' })
                ),
              },
            },
            {
              provide: BusinessSiteConfigStore,
              useValue: {
                site: signal(DEFAULT_BUSINESS_SITE_CONFIG),
                fetch: jest.fn().mockReturnValue(of(tenantConfig)),
              },
            },
            {
              provide: BusinessApiService,
              useValue: {
                getOffers: jest.fn().mockReturnValue(of([])),
                getStoreProducts: jest.fn().mockReturnValue(of([])),
                getBlogPosts: jest.fn().mockReturnValue(of([])),
                getSiteConfigForSlug: jest
                  .fn()
                  .mockReturnValue(
                    of({ configId: 'emberline-config', config: tenantConfig })
                  ),
              },
            },
            { provide: Title, useValue: { setTitle: jest.fn() } },
          ],
        }),
      {
        document: '<app-root></app-root>',
        url: '/sites/emberline-studio',
      }
    );

    expect(html).toContain('class="public-landing-header__brand-link"');
    expect(html).toContain('Emberline Studio');
    expect(html).toContain('Contact Emberline Studio');
    expect(html).toContain('Configured Emberline hero');
    expect(html).not.toContain('My Business');
    destroyPlatform();
  });
});
