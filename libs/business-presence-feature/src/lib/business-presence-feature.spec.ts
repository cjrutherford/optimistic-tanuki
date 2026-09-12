import type { ConfigurableFeatureShell } from '@optimistic-tanuki/configurable-plugin-contracts';
import { BUSINESS_SITE_PRESENCE_FEATURE } from './business-presence-feature';

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
});
