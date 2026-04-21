import { createCatalogEntry } from './app-catalog';

describe('app catalog contracts', () => {
  it('creates immutable developer catalog entries', () => {
    expect(
      createCatalogEntry({
        name: '@optimistic-tanuki/billing-sdk',
        ownerDomain: 'billing',
        releaseChannel: 'beta',
        deploymentMode: 'publishable-lib',
        billingEligibility: ['metered', 'usage-block'],
      }),
    ).toEqual({
      name: '@optimistic-tanuki/billing-sdk',
      ownerDomain: 'billing',
      releaseChannel: 'beta',
      deploymentMode: 'publishable-lib',
      billingEligibility: ['metered', 'usage-block'],
    });
  });
});
