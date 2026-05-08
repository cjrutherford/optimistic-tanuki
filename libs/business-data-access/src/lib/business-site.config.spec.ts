import {
  DEFAULT_BUSINESS_SITE_CONFIG,
  mergeBusinessSiteConfig,
  type BusinessSiteConfig,
} from './business-site.config';

describe('business-site.config', () => {
  it('preserves landing layout, custom sections, business type, and client capabilities during merge', () => {
    const merged = mergeBusinessSiteConfig({
      businessType: 'consulting',
      landingPage: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage,
        layout: 'grid',
        sections: [
          ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage.sections,
          {
            id: 'custom-1',
            type: 'custom',
            title: 'Proof block',
            enabled: true,
            order: 6,
            layoutPlacement: {
              split: 'secondary',
              grid: 'bottom-right',
            },
            body: 'A custom narrative section.',
            ctaLabel: 'Start here',
            ctaHref: '/book',
          },
        ],
      },
      clientPortal: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.clientPortal,
        capabilities: ['Track invoices', 'Review assignments'],
      },
    } as Partial<BusinessSiteConfig>);

    expect(merged.businessType).toBe('consulting');
    expect(merged.landingPage.layout).toBe('grid');
    expect(merged.clientPortal.capabilities).toEqual([
      'Track invoices',
      'Review assignments',
    ]);
    expect(merged.landingPage.sections.at(-1)).toEqual(
      expect.objectContaining({
        id: 'custom-1',
        type: 'custom',
        layoutPlacement: {
          split: 'secondary',
          grid: 'bottom-right',
        },
        body: 'A custom narrative section.',
        ctaLabel: 'Start here',
        ctaHref: '/book',
      })
    );
  });

  it('preserves landing image, gallery, and motion settings during merge', () => {
    const merged = mergeBusinessSiteConfig({
      landingPage: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage,
        sections: [
          ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage.sections,
          {
            id: 'image-1',
            type: 'image',
            title: 'Studio image',
            enabled: true,
            order: 6,
            image: {
              sourceType: 'asset',
              src: '/assets/business/studio.jpg',
              alt: 'Studio space',
              caption: 'Configured for private sessions.',
              aspect: 'landscape',
              fit: 'cover',
              focalPoint: 'center',
            },
            motion: {
              kind: 'parallax-grid-warp',
              density: 8,
              speed: 1.3,
              intensity: 0.5,
              height: '20rem',
            },
          },
          {
            id: 'gallery-1',
            type: 'gallery',
            title: 'Proof gallery',
            enabled: true,
            order: 7,
            gallery: {
              style: 'masonry',
              columns: 4,
              items: [
                {
                  sourceType: 'url',
                  src: 'https://cdn.example.com/one.jpg',
                  alt: 'Image one',
                },
                {
                  sourceType: 'asset',
                  src: '/assets/business/two.jpg',
                  alt: 'Image two',
                  caption: 'Behind the scenes',
                },
              ],
            },
            motion: {
              kind: 'shimmer-beam',
              direction: 'horizontal',
              speed: 1.1,
              intensity: 0.7,
            },
          },
        ],
      },
    } as Partial<BusinessSiteConfig>);

    expect(merged.landingPage.sections.at(-2)).toEqual(
      expect.objectContaining({
        id: 'image-1',
        type: 'image',
        image: expect.objectContaining({
          sourceType: 'asset',
          src: '/assets/business/studio.jpg',
          alt: 'Studio space',
        }),
        motion: expect.objectContaining({
          kind: 'parallax-grid-warp',
          density: 8,
          speed: 1.3,
          intensity: 0.5,
          height: '20rem',
        }),
      })
    );
    expect(merged.landingPage.sections.at(-1)).toEqual(
      expect.objectContaining({
        id: 'gallery-1',
        type: 'gallery',
        gallery: expect.objectContaining({
          style: 'masonry',
          columns: 4,
          items: expect.arrayContaining([
            expect.objectContaining({
              src: 'https://cdn.example.com/one.jpg',
            }),
            expect.objectContaining({
              src: '/assets/business/two.jpg',
              caption: 'Behind the scenes',
            }),
          ]),
        }),
        motion: expect.objectContaining({
          kind: 'shimmer-beam',
          direction: 'horizontal',
        }),
      })
    );
  });
});
