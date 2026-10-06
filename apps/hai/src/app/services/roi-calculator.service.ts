import { Injectable } from '@angular/core';

/**
 * Five-year comparison of an owned system, priced the way HAI prices
 * (hardware at actual cost, labor at the published hourly rate), against an
 * existing cloud subscription. Every HAI-side figure comes from the
 * visitor's own quote or estimate; nothing is assumed on their behalf.
 */
export interface OwnedCostInput {
  /** Hardware cost from a quote or estimate, before the price buffer. */
  hardwareCost: number;
  setupHours: number;
  monthlySupportHours: number;
  /** Service costs passed through at actual amounts, e.g. backup storage. */
  monthlyServiceCosts: number;
  laborRatePerHour: number;
  currentMonthlySpend: number;
  annualUpliftPercent: number;
}

export interface RoiYearRow {
  year: number;
  ownedCumulative: number;
  cloudCumulative: number;
}

export interface RoiComparisonResult {
  horizonMonths: number;
  ownedUpfront: number;
  ownedMonthly: number;
  ownedHardwareTotal: number;
  ownedLaborTotal: number;
  ownedServiceCostTotal: number;
  ownedTotal: number;
  cloudTotal: number;
  /** Cloud total minus owned total; negative when the subscription costs less. */
  difference: number;
  breakEvenMonth: number | null;
  yearly: RoiYearRow[];
  assumptions: string[];
}

const HORIZON_MONTHS = 60;
/** Allowance for hardware prices moving between estimate and order. */
const HARDWARE_PRICE_BUFFER = 0.1;

@Injectable({ providedIn: 'root' })
export class RoiCalculatorService {
  compare(input: OwnedCostInput): RoiComparisonResult {
    this.requireInput(input);

    const hardware = this.round2(
      input.hardwareCost * (1 + HARDWARE_PRICE_BUFFER)
    );
    const setupLabor = this.round2(input.setupHours * input.laborRatePerHour);
    const monthlyLabor = input.monthlySupportHours * input.laborRatePerHour;
    const ownedMonthly = this.round2(monthlyLabor + input.monthlyServiceCosts);
    const monthlyUplift = Math.pow(1 + input.annualUpliftPercent / 100, 1 / 12);

    let ownedTotal = hardware + setupLabor;
    let cloudTotal = 0;
    let breakEvenMonth: number | null = null;
    const yearly: RoiYearRow[] = [];

    for (let month = 1; month <= HORIZON_MONTHS; month += 1) {
      ownedTotal += ownedMonthly;
      cloudTotal +=
        input.currentMonthlySpend * Math.pow(monthlyUplift, month - 1);
      if (breakEvenMonth === null && ownedTotal <= cloudTotal) {
        breakEvenMonth = month;
      }
      if (month % 12 === 0) {
        yearly.push({
          year: month / 12,
          ownedCumulative: this.round2(ownedTotal),
          cloudCumulative: this.round2(cloudTotal),
        });
      }
    }

    ownedTotal = this.round2(ownedTotal);
    cloudTotal = this.round2(cloudTotal);
    const rate = this.dollars(input.laborRatePerHour);

    return {
      horizonMonths: HORIZON_MONTHS,
      ownedUpfront: this.round2(hardware + setupLabor),
      ownedMonthly,
      ownedHardwareTotal: hardware,
      ownedLaborTotal: this.round2(setupLabor + monthlyLabor * HORIZON_MONTHS),
      ownedServiceCostTotal: this.round2(
        input.monthlyServiceCosts * HORIZON_MONTHS
      ),
      ownedTotal,
      cloudTotal,
      difference: this.round2(cloudTotal - ownedTotal),
      breakEvenMonth,
      yearly,
      assumptions: [
        `Five-year horizon (${HORIZON_MONTHS} months).`,
        `Hardware is your estimate of ${this.dollars(
          input.hardwareCost
        )} plus a 10% buffer for price changes before ordering (${this.dollars(
          hardware
        )}), paid up front at actual cost.`,
        `Setup is ${this.hours(
          input.setupHours
        )} at ${rate} an hour (${this.dollars(setupLabor)}), paid up front.`,
        `Support is ${this.hours(
          input.monthlySupportHours
        )} a month at ${rate} an hour, plus ${this.dollars(
          input.monthlyServiceCosts
        )} a month in service costs at actual amounts.`,
        `Your current subscriptions start at ${this.dollars(
          input.currentMonthlySpend
        )} a month and rise ${input.annualUpliftPercent}% a year.`,
        'Not included: replacing or repairing hardware within five years, electricity, internet, or your own time.',
      ],
    };
  }

  private requireInput(input: OwnedCostInput): void {
    if (!input || typeof input !== 'object') {
      throw new Error('A comparison input is required.');
    }
    const checks: [number, string][] = [
      [input.hardwareCost, 'Hardware cost'],
      [input.setupHours, 'Setup hours'],
      [input.monthlySupportHours, 'Monthly support hours'],
      [input.monthlyServiceCosts, 'Monthly service costs'],
      [input.currentMonthlySpend, 'Current monthly spend'],
    ];
    for (const [value, name] of checks) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${name} must be zero or positive.`);
      }
    }
    if (
      !Number.isFinite(input.laborRatePerHour) ||
      input.laborRatePerHour <= 0
    ) {
      throw new Error('A labor rate is required.');
    }
    if (
      !Number.isFinite(input.annualUpliftPercent) ||
      input.annualUpliftPercent < 0 ||
      input.annualUpliftPercent > 100
    ) {
      throw new Error('Annual uplift must be between 0 and 100 percent.');
    }
  }

  private hours(value: number): string {
    return `${value} ${value === 1 ? 'hour' : 'hours'}`;
  }

  private dollars(value: number): string {
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
