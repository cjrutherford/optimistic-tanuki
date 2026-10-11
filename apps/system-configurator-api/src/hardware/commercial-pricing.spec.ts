import {
  HAI_LABOR_RATE_PER_HOUR,
  addQuoteExpiryDays,
  calculateHardwareCommercialPricing,
  calculateMonthlySupport,
} from './commercial-pricing';

describe('pass-through commercial pricing', () => {
  const upfront = {
    hardwareCost: 1000,
    freightAmount: 24.5,
    taxAmount: 70,
    setupHours: 6,
    laborRatePerHour: HAI_LABOR_RATE_PER_HOUR,
  };

  it('publishes a $65 labor rate', () => {
    expect(HAI_LABOR_RATE_PER_HOUR).toBe(65);
  });

  it('bills hardware, freight, and tax at actual amounts plus setup labor', () => {
    expect(calculateHardwareCommercialPricing(upfront)).toEqual({
      pricingModel: 'pass-through',
      hardwareCost: 1000,
      freightAmount: 24.5,
      taxAmount: 70,
      setupHours: 6,
      laborRatePerHour: 65,
      setupLabor: 390,
      outrightPrice: 1484.5,
    });
  });

  it('adds no markup, allowance, reserve, or lease figures', () => {
    const pricing = calculateHardwareCommercialPricing({
      ...upfront,
      freightAmount: 0,
      taxAmount: 0,
      setupHours: 0,
    });

    expect(pricing.outrightPrice).toBe(1000);
    expect(Object.keys(pricing)).not.toEqual(
      expect.arrayContaining(['leases'])
    );
    for (const key of Object.keys(pricing)) {
      expect(key).not.toMatch(/markup|margin|allowance|reserve|lease/i);
    }
  });

  it('rounds to cents and rejects invalid input', () => {
    expect(
      calculateHardwareCommercialPricing({
        ...upfront,
        hardwareCost: 0.005,
        freightAmount: 0,
        taxAmount: 0,
        setupHours: 0,
      }).outrightPrice
    ).toBe(0.01);
    expect(() =>
      calculateHardwareCommercialPricing({ ...upfront, hardwareCost: -1 })
    ).toThrow('hardwareCost must be a nonnegative finite number');
    expect(() =>
      calculateHardwareCommercialPricing({ ...upfront, taxAmount: Number.NaN })
    ).toThrow('taxAmount must be a nonnegative finite number');
    expect(() =>
      calculateHardwareCommercialPricing({ ...upfront, laborRatePerHour: 0 })
    ).toThrow('laborRatePerHour must be a positive finite number');
  });

  it('prices monthly support as labor plus pass-through service costs', () => {
    expect(
      calculateMonthlySupport({
        supportHours: 2,
        laborRatePerHour: HAI_LABOR_RATE_PER_HOUR,
        monthlyCloudCost: 12.5,
        monthlySmsCost: 3,
        monthlyNetworkCost: 0,
      })
    ).toEqual({
      supportHours: 2,
      laborRatePerHour: 65,
      supportLabor: 130,
      passThroughCosts: 15.5,
      monthlyTotal: 145.5,
    });
  });

  it('allows a plan with no support hours and rejects negative inputs', () => {
    expect(
      calculateMonthlySupport({
        supportHours: 0,
        laborRatePerHour: 65,
        monthlyCloudCost: 0,
        monthlySmsCost: 0,
        monthlyNetworkCost: 0,
      }).monthlyTotal
    ).toBe(0);
    expect(() =>
      calculateMonthlySupport({
        supportHours: -1,
        laborRatePerHour: 65,
        monthlyCloudCost: 0,
        monthlySmsCost: 0,
        monthlyNetworkCost: 0,
      })
    ).toThrow('supportHours must be a nonnegative finite number');
  });

  it('expires quotes 30 calendar days later in UTC, including month and leap-year rollover', () => {
    expect(addQuoteExpiryDays('2024-01-31T23:45:00-05:00')).toBe(
      '2024-03-02T04:45:00.000Z'
    );
    expect(addQuoteExpiryDays('2025-12-15T12:00:00.000Z')).toBe(
      '2026-01-14T12:00:00.000Z'
    );
    expect(() => addQuoteExpiryDays('not-a-date')).toThrow(
      'issuedAt must be a valid date'
    );
  });
});
