import type { ConfigurableFeatureShell } from '@optimistic-tanuki/configurable-plugin-contracts';
import { BUSINESS_SITE_PRESENCE_FEATURE } from './business-presence-feature';
import {
  BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS,
  businessSiteConfigToConfigDocument,
} from './business-presence-blocks';

const referenceFeature: ConfigurableFeatureShell =
  BUSINESS_SITE_PRESENCE_FEATURE;

describe('business site presence feature shell', () => {
  it('describes the public presence and owner editor entry points', () => {
    expect(referenceFeature).toEqual({
      id: 'business-site-presence',
      surfaceType: 'business-site',
      routes: [
        {
          id: 'business-site-presence-public',
          capabilityId: 'business-site.presence',
          placement: 'public',
        },
        {
          id: 'business-site-presence-owner-editor',
          capabilityId: 'business-site.presence',
          placement: 'owner',
        },
      ],
    });
  });

  it('owns the landing editor catalog and shared-document adapter', () => {
    expect(BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS.hero).toEqual(
      expect.objectContaining({ type: 'hero', category: 'Intro' })
    );
    expect(
      businessSiteConfigToConfigDocument({
        brand: { businessName: 'North Star' },
        landingPage: { layout: 'single', sections: [] },
        theme: {
          mode: 'light',
          primaryColor: '#000000',
          personalityId: 'professional',
        },
      } as any).blocks
    ).toEqual([]);
  });
});
