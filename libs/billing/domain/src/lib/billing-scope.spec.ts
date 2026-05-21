import { assertBillingScope } from './billing-scope';

describe('assertBillingScope', () => {
  it('returns tenant and app scope when both are present', () => {
    expect(
      assertBillingScope({ tenantId: 'tenant-1', appScope: 'local-hub' }),
    ).toEqual({ tenantId: 'tenant-1', appScope: 'local-hub' });
  });

  it('rejects records without a tenant id', () => {
    expect(() => assertBillingScope({ appScope: 'local-hub' })).toThrow(
      'Billing records require tenantId',
    );
  });

  it('rejects records without an app scope', () => {
    expect(() => assertBillingScope({ tenantId: 'tenant-1' })).toThrow(
      'Billing records require appScope',
    );
  });
});
