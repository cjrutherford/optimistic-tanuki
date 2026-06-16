import { Component } from '@angular/core';
import { convertToParamMap } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, RouterLink, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
  type BusinessSiteConfig,
  type BusinessOffer,
  type LandingSectionMotionConfig,
} from '@optimistic-tanuki/business-data-access';

import { BusinessLandingPageComponent } from './business-landing-page.component';

@Component({
  selector: 'otui-particle-veil',
  template: '',
  standalone: true,
})
class MockParticleVeilComponent {}

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

  async function render(config: BusinessSiteConfig | null = null) {
    const getStoreProducts = jest.fn().mockReturnValue(
      of([
        {
          id: 'product-1',
          name: 'Collector Print',
          description: 'Archival print release.',
          price: 48,
          type: 'physical',
          active: true,
          stock: 6,
          imageUrl: '/assets/collector-print.jpg',
        },
      ])
    );

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
            getSiteConfig: jest
              .fn()
              .mockReturnValue(of({ configId: null, config })),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessLandingPageComponent);
    fixture.detectChanges();
    return fixture;
  }

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

  it('renders rich content for the hero section when configured', async () => {
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
    const text = fixture.nativeElement.textContent;

    expect(text).toContain(
      'Directly editable hero copy for the public landing page.'
    );
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
