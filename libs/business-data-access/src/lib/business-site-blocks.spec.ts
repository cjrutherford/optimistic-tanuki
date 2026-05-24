import {
  BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS,
  businessSiteConfigToConfigDocument,
  configDocumentToBusinessSiteConfig,
} from './business-site-blocks';
import {
  DEFAULT_BUSINESS_SITE_CONFIG,
  type BusinessSiteConfig,
} from './business-site.config';

describe('business-site block adapters', () => {
  it('converts a business-site config into a shared config document', () => {
    const config: BusinessSiteConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'North Star Coaching',
      },
      landingPage: {
        layout: 'grid',
        sections: [
          {
            id: 'hero',
            type: 'hero',
            title: 'Reach your next milestone',
            enabled: true,
            order: 7,
            body: 'Guided coaching for teams and leaders.',
          },
        ],
      },
    };

    const document = businessSiteConfigToConfigDocument(config);

    expect(document.layout).toBe('grid');
    expect(document.blocks).toEqual([
      {
        id: 'hero',
        type: 'hero',
        order: 0,
        enabled: true,
        renderContext: 'landing-page',
        data: {
          title: 'Reach your next milestone',
          body: 'Guided coaching for teams and leaders.',
          layoutPlacement: undefined,
          ctaLabel: undefined,
          ctaHref: undefined,
          image: undefined,
          gallery: undefined,
          motion: undefined,
        },
      },
    ]);
    expect(document.metadata?.['businessSite']).toMatchObject({
      brand: {
        businessName: 'North Star Coaching',
      },
    });
    expect(document.theme).toEqual(
      expect.objectContaining({
        mode: 'light',
        primaryColor: DEFAULT_BUSINESS_SITE_CONFIG.theme.primaryColor,
        personalityId: DEFAULT_BUSINESS_SITE_CONFIG.theme.personalityId,
      })
    );
  });

  it('reconstructs a business-site config from a shared document', () => {
    const roundTrip = configDocumentToBusinessSiteConfig(
      businessSiteConfigToConfigDocument({
        ...DEFAULT_BUSINESS_SITE_CONFIG,
        landingPage: {
          layout: 'split',
          sections: [
            {
              id: 'contact',
              type: 'contact',
              title: 'Contact us',
              enabled: true,
              order: 8,
              body: 'Book a discovery call.',
              ctaLabel: 'Schedule now',
              ctaHref: '/book',
            },
            {
              id: 'about',
              type: 'about',
              title: 'About',
              enabled: false,
              order: 1,
              body: 'About copy',
            },
          ],
        },
      })
    );

    expect(roundTrip.landingPage.layout).toBe('split');
    expect(roundTrip.theme).toEqual(
      expect.objectContaining({
        mode: DEFAULT_BUSINESS_SITE_CONFIG.theme.mode,
        personalityId: DEFAULT_BUSINESS_SITE_CONFIG.theme.personalityId,
      })
    );
    expect(roundTrip.landingPage.sections).toEqual([
      expect.objectContaining({
        id: 'about',
        type: 'about',
        order: 0,
        enabled: false,
        body: 'About copy',
      }),
      expect.objectContaining({
        id: 'contact',
        type: 'contact',
        order: 1,
        enabled: true,
        body: 'Book a discovery call.',
        ctaLabel: 'Schedule now',
        ctaHref: '/book',
      }),
    ]);
  });

  it('defines shared schema metadata for business landing-page blocks', () => {
    expect(BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS.image.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'image.src', label: 'Image Source' }),
        expect.objectContaining({
          key: 'motion.kind',
          label: 'Motion Component',
        }),
      ])
    );
    expect(BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS.gallery.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'gallery.columns',
          label: 'Columns',
        }),
      ])
    );
  });
});
