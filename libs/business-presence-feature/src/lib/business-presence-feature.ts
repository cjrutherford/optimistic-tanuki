import type { ConfigurableFeatureShell } from '@optimistic-tanuki/configurable-plugin-contracts';

/**
 * The first manifest-aware feature shell. It maps the existing business-site
 * public presence and owner editor to one reusable capability without moving
 * or duplicating either established page. Host applications own component
 * loading so this contract stays independent of Angular UI implementation.
 */
export const BUSINESS_SITE_PRESENCE_FEATURE: ConfigurableFeatureShell = {
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
};
