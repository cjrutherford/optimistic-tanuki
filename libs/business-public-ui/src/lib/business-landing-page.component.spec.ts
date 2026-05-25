import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import {
  BusinessApiService,
  DEFAULT_BUSINESS_SITE_CONFIG,
  type BusinessSiteConfig,
  type BusinessOffer,
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
    await TestBed.configureTestingModule({
      imports: [BusinessLandingPageComponent, MockParticleVeilComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of(offers)),
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
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of(offers)),
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
          provide: BusinessApiService,
          useValue: {
            getOffers: jest.fn().mockReturnValue(of(offers)),
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

  it('hides booking, testimonials, and client portal entry points when their features are disabled', async () => {
    const fixture = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      contact: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.contact,
        consultationLabel: 'Book strategy session',
      },
      features: {
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

  it('marks specialty chips as theme-aware in the owner profile block', async () => {
    const fixture = await render({
      ...configWithServices,
      brand: {
        ...configWithServices.brand,
        specializations: ['Complex scheduling', 'Operational reset'],
      },
    });
    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('.specialties span')
    ) as HTMLElement[];

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
});
