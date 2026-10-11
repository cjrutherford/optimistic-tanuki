import { TestBed } from '@angular/core/testing';
import { OwnedCostInput, RoiCalculatorService } from './roi-calculator.service';

describe('RoiCalculatorService', () => {
  let service: RoiCalculatorService;
  const base: OwnedCostInput = {
    hardwareCost: 1000,
    setupHours: 10,
    monthlySupportHours: 1,
    monthlyServiceCosts: 5,
    laborRatePerHour: 65,
    currentMonthlySpend: 200,
    annualUpliftPercent: 0,
  };

  beforeEach(() => {
    service = TestBed.inject(RoiCalculatorService);
  });

  it('matches a hand-calculated five-year comparison with no uplift', () => {
    const result = service.compare(base);

    // Up front: 1000 × 1.1 hardware + 10 × 65 setup = 1100 + 650.
    expect(result.ownedHardwareTotal).toBe(1100);
    expect(result.ownedUpfront).toBe(1750);
    // Monthly: 1 × 65 support + 5 service costs.
    expect(result.ownedMonthly).toBe(70);
    expect(result.ownedLaborTotal).toBe(650 + 65 * 60);
    expect(result.ownedServiceCostTotal).toBe(300);
    expect(result.ownedTotal).toBe(1750 + 70 * 60);
    expect(result.cloudTotal).toBe(12000);
    expect(result.difference).toBe(12000 - 5950);
    expect(result.yearly).toEqual([
      { year: 1, ownedCumulative: 2590, cloudCumulative: 2400 },
      { year: 2, ownedCumulative: 3430, cloudCumulative: 4800 },
      { year: 3, ownedCumulative: 4270, cloudCumulative: 7200 },
      { year: 4, ownedCumulative: 5110, cloudCumulative: 9600 },
      { year: 5, ownedCumulative: 5950, cloudCumulative: 12000 },
    ]);
    // 1750 + 70m <= 200m first holds at m = 14 (2730 <= 2800).
    expect(result.breakEvenMonth).toBe(14);
  });

  it('reports a negative difference when the subscription costs less', () => {
    const result = service.compare({ ...base, currentMonthlySpend: 50 });

    expect(result.difference).toBeLessThan(0);
    expect(result.breakEvenMonth).toBeNull();
  });

  it('compounds annual subscription increases monthly', () => {
    const result = service.compare({ ...base, annualUpliftPercent: 10 });

    const [year1, year2] = result.yearly.map((row) => row.cloudCumulative);

    // Monthly compounding: the first year already costs more than 12 × 200,
    // and year two's spend is exactly 10% more than year one's.
    expect(year1).toBeGreaterThan(2400);
    expect(year2 - year1).toBeCloseTo(year1 * 1.1, 1);
  });

  it('states every assumption, including what it leaves out', () => {
    const text = service.compare(base).assumptions.join(' ');

    expect(text).toContain('10% buffer');
    expect(text).toContain('10 hours at $65 an hour');
    expect(text).toContain('1 hour a month at $65 an hour');
    expect(text).toContain(
      'Not included: replacing or repairing hardware within five years, electricity, internet'
    );
  });

  it.each([
    ['hardwareCost', -1],
    ['setupHours', Number.NaN],
    ['monthlySupportHours', -2],
    ['monthlyServiceCosts', -5],
    ['currentMonthlySpend', -1],
  ] as const)('rejects a negative or missing %s', (field, value) => {
    expect(() => service.compare({ ...base, [field]: value })).toThrow(
      /must be zero or positive/
    );
  });

  it('requires a labor rate and a sane uplift', () => {
    expect(() => service.compare({ ...base, laborRatePerHour: 0 })).toThrow(
      /labor rate/
    );
    expect(() =>
      service.compare({ ...base, annualUpliftPercent: 101 })
    ).toThrow(/between 0 and 100/);
  });
});
