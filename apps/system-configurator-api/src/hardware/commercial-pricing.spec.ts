import {
  addQuoteExpiryDays,
  assessRetainerMargin,
  calculateHardwareCommercialPricing,
} from './commercial-pricing';

describe('commercial hardware pricing', () => {
  it('keeps contingency internal and prices from raw distributor cost', () => {
    const quote = calculateHardwareCommercialPricing({
      costBasis: {
        kind: 'raw',
        wholesaleCost: 1000,
      },
    });

    expect(quote).toEqual({
      sourceWholesaleCost: 1000,
      contingencyAmount: 0,
      contingencyReserve: 100,
      bufferedSourceCost: 1000,
      freightAndTaxAllowance: 80,
      landedCost: 1080,
      procurementMarkup: 378,
      outrightPrice: 1458,
      leases: [
        {
          termMonths: 24,
          monthlyAmortization: 66.94,
          monthlyMaintenanceReserve: 13.5,
          monthlyTotal: 80.44,
        },
        {
          termMonths: 36,
          monthlyAmortization: 46.7,
          monthlyMaintenanceReserve: 13.5,
          monthlyTotal: 60.2,
        },
      ],
    });
  });

  it('keeps the 10 percent contingency as an internal reserve by default', () => {
    const quote = calculateHardwareCommercialPricing({
      costBasis: { kind: 'raw', wholesaleCost: 1000 },
    });

    expect(quote.outrightPrice).toBe(1458);
    expect(quote.contingencyAmount).toBe(0);
    expect(quote.contingencyReserve).toBe(100);
  });

  it('rounds monetary outputs to cents and rejects invalid cost input', () => {
    expect(
      calculateHardwareCommercialPricing({
        costBasis: {
          kind: 'raw',
          wholesaleCost: 0.01,
        },
      }).outrightPrice
    ).toBe(0.01);

    expect(() =>
      calculateHardwareCommercialPricing({
        costBasis: {
          kind: 'raw',
          wholesaleCost: Number.NaN,
        },
      })
    ).toThrow('wholesaleCost must be a nonnegative finite number');
  });

  it('enforces a 70 percent margin from explicit recurring costs', () => {
    expect(
      assessRetainerMargin({
        monthlyRevenue: 1000,
        monthlyCloudCost: 100,
        monthlySmsCost: 100,
        monthlyNetworkCost: 100,
      })
    ).toEqual({
      monthlyRevenue: 1000,
      monthlyCosts: 300,
      monthlyGrossProfit: 700,
      grossMargin: 0.7,
      meetsMinimumMargin: true,
    });

    expect(
      assessRetainerMargin({
        monthlyRevenue: 1000,
        monthlyCloudCost: 101,
        monthlySmsCost: 100,
        monthlyNetworkCost: 100,
      }).meetsMinimumMargin
    ).toBe(false);

    expect(
      assessRetainerMargin({
        monthlyRevenue: 100.004,
        monthlyCloudCost: 30.006,
        monthlySmsCost: 0,
        monthlyNetworkCost: 0,
      })
    ).toMatchObject({
      monthlyRevenue: 100,
      monthlyCosts: 30.01,
      monthlyGrossProfit: 69.99,
      grossMargin: 0.6999,
      meetsMinimumMargin: false,
    });
    expect(() =>
      assessRetainerMargin({
        monthlyRevenue: 0,
        monthlyCloudCost: 0,
        monthlySmsCost: 0,
        monthlyNetworkCost: 0,
      })
    ).toThrow('monthlyRevenue must be greater than zero');
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
