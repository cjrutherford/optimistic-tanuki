import { TestBed } from '@angular/core/testing';
import {
  RoiCalculatorService,
  RoiComparisonInput,
} from './roi-calculator.service';

describe('RoiCalculatorService', () => {
  let service: RoiCalculatorService;
  const tier = {
    id: 'tier1',
    name: 'Compact Edge Appliance',
    retailPrice: 705,
    leaseMonthlyRate: 99,
    softwareMonthlyRate: 50,
    retainerMonthlyRate: 0,
  };
  const base: RoiComparisonInput = {
    tier,
    acquisition: 'outright',
    currentMonthlySpend: 200,
    annualUpliftPercent: 8,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RoiCalculatorService);
  });

  it('totals an outright purchase plus sixty months of service', () => {
    const result = service.compare(base);

    expect(result.horizonMonths).toBe(60);
    expect(result.haiHardwareTotal).toBeCloseTo(705 * 1.1, 2);
    expect(result.haiServiceTotal).toBe(50 * 60);
    expect(result.haiTotal).toBeCloseTo(705 * 1.1 + 3000, 2);
    expect(result.yearly).toHaveLength(5);
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it('matches a hand-calculated five-year comparison with no cloud uplift', () => {
    const result = service.compare({ ...base, annualUpliftPercent: 0 });

    expect(result.horizonMonths).toBe(60);
    expect(result.haiHardwareTotal).toBe(775.5);
    expect(result.haiServiceTotal).toBe(3000);
    expect(result.haiTotal).toBe(3775.5);
    expect(result.cloudTotal).toBe(12000);
    expect(result.savings).toBe(8224.5);
    expect(result.yearly).toEqual([
      { year: 1, haiCumulative: 1375.5, cloudCumulative: 2400 },
      { year: 2, haiCumulative: 1975.5, cloudCumulative: 4800 },
      { year: 3, haiCumulative: 2575.5, cloudCumulative: 7200 },
      { year: 4, haiCumulative: 3175.5, cloudCumulative: 9600 },
      { year: 5, haiCumulative: 3775.5, cloudCumulative: 12000 },
    ]);
  });

  it('accepts zero cloud spend and zero uplift without claiming break-even', () => {
    const result = service.compare({
      ...base,
      currentMonthlySpend: 0,
      annualUpliftPercent: 0,
    });

    expect(result.cloudTotal).toBe(0);
    expect(result.savings).toBe(-3775.5);
    expect(result.savingsPercent).toBeNull();
    expect(result.breakEvenMonth).toBeNull();
    expect(result.yearly.map((row) => row.cloudCumulative)).toEqual([
      0, 0, 0, 0, 0,
    ]);
  });

  it('uses the published catalog lease rate for the selected term', () => {
    const leased = service.compare({ ...base, acquisition: 'lease-36' });

    expect(leased.haiMonthlyLeasePayment).toBe(99);
    expect(leased.haiHardwareTotal).toBe(99 * 36);
    expect(leased.haiServiceTotal).toBe(3000);
    expect(leased.haiTotal).toBe(99 * 36 + 3000);
    expect(leased.assumptions.join(' ')).toContain(
      'published catalog lease rate'
    );
  });

  it('compounds cloud spend monthly and finds break-even', () => {
    const result = service.compare(base);

    const monthly = Math.pow(1.08, 1 / 12);
    let expected = 0;
    for (let month = 1; month <= 60; month += 1) {
      expected += 200 * Math.pow(monthly, month - 1);
    }
    expect(result.cloudTotal).toBeCloseTo(expected, 2);
    expect(result.savings).toBeCloseTo(result.cloudTotal - result.haiTotal, 2);
    expect(result.breakEvenMonth).not.toBeNull();
  });

  it('reports no break-even when cloud stays cheaper', () => {
    const result = service.compare({
      ...base,
      currentMonthlySpend: 10,
      annualUpliftPercent: 0,
    });

    expect(result.breakEvenMonth).toBeNull();
    expect(result.savings).toBeLessThan(0);
  });

  it('rejects invalid inputs instead of inventing figures', () => {
    expect(() =>
      service.compare({ ...base, tier: { ...tier, retailPrice: 0 } })
    ).toThrow();
    expect(() =>
      service.compare({ ...base, currentMonthlySpend: -5 })
    ).toThrow();
    expect(() =>
      service.compare({ ...base, currentMonthlySpend: Number.NaN })
    ).toThrow('Current monthly spend must be zero or positive.');
    expect(() =>
      service.compare({ ...base, annualUpliftPercent: 101 })
    ).toThrow();
    expect(() =>
      service.compare({
        ...base,
        acquisition: 'rental' as never,
      })
    ).toThrow();
  });
});
