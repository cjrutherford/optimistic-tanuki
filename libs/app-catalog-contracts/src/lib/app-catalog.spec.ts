import {
  createCatalogEntry,
  validateCatalogEntries,
} from './app-catalog';

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

  it('rejects entries with app-service billing but no metered eligibility', () => {
    expect(() =>
      validateCatalogEntries([
        {
          name: 'local-hub',
          ownerDomain: 'local-hub',
          releaseChannel: 'stable',
          deploymentMode: 'app-service',
          billingEligibility: ['none'],
        },
      ]),
    ).toThrow('app-service entries must declare billable eligibility');
  });

  it('rejects duplicate catalog entry names', () => {
    expect(() =>
      validateCatalogEntries([
        {
          name: '@optimistic-tanuki/billing-sdk',
          ownerDomain: 'billing',
          releaseChannel: 'beta',
          deploymentMode: 'publishable-lib',
          billingEligibility: ['none'],
        },
        {
          name: '@optimistic-tanuki/billing-sdk',
          ownerDomain: 'billing',
          releaseChannel: 'beta',
          deploymentMode: 'publishable-lib',
          billingEligibility: ['none'],
        },
      ]),
    ).toThrow('Duplicate developer catalog entry');
  });
});
