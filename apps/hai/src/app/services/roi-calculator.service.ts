import { Injectable } from '@angular/core';

export type RoiAcquisition = 'outright' | 'lease-24' | 'lease-36';

export interface RoiTierInput {
  id: string;
  name: string;
  retailPrice: number;
  leaseMonthlyRate: number;
  softwareMonthlyRate: number;
  retainerMonthlyRate: number;
}

export interface RoiComparisonInput {
  tier: RoiTierInput;
  acquisition: RoiAcquisition;
  currentMonthlySpend: number;
  annualUpliftPercent: number;
}

export interface RoiYearRow {
  year: number;
  haiCumulative: number;
  cloudCumulative: number;
}

export interface RoiComparisonResult {
  horizonMonths: number;
  haiTotal: number;
  haiHardwareTotal: number;
  haiServiceTotal: number;
  haiMonthlyLeasePayment: number | null;
  cloudTotal: number;
  savings: number;
  savingsPercent: number | null;
  breakEvenMonth: number | null;
  yearly: RoiYearRow[];
  assumptions: string[];
}

const HORIZON_MONTHS = 60;
const CONTINGENCY_BUFFER = 0.1;

@Injectable({ providedIn: 'root' })
export class RoiCalculatorService {
  compare(input: RoiComparisonInput): RoiComparisonResult {
    this.requireInput(input);
    const monthlyService =
      input.tier.softwareMonthlyRate + input.tier.retainerMonthlyRate;
    const hardwarePrincipal = input.tier.retailPrice * (1 + CONTINGENCY_BUFFER);

    let leasePayment: number | null = null;
    let leaseMonths = 0;
    if (input.acquisition !== 'outright') {
      leaseMonths = input.acquisition === 'lease-24' ? 24 : 36;
      leasePayment = input.tier.leaseMonthlyRate;
    }

    const monthlyUplift = Math.pow(1 + input.annualUpliftPercent / 100, 1 / 12);
    let haiTotal = input.acquisition === 'outright' ? hardwarePrincipal : 0;
    let cloudTotal = 0;
    let breakEvenMonth: number | null = null;
    const yearly: RoiYearRow[] = [];
    let hardwareTotal =
      input.acquisition === 'outright' ? hardwarePrincipal : 0;

    for (let month = 1; month <= HORIZON_MONTHS; month += 1) {
      if (leasePayment !== null && month <= leaseMonths) {
        haiTotal += leasePayment;
        hardwareTotal += leasePayment;
      }
      haiTotal += monthlyService;
      cloudTotal +=
        input.currentMonthlySpend * Math.pow(monthlyUplift, month - 1);
      if (breakEvenMonth === null && haiTotal <= cloudTotal) {
        breakEvenMonth = month;
      }
      if (month % 12 === 0) {
        yearly.push({
          year: month / 12,
          haiCumulative: this.round2(haiTotal),
          cloudCumulative: this.round2(cloudTotal),
        });
      }
    }

    const haiServiceTotal = this.round2(haiTotal - hardwareTotal);
    haiTotal = this.round2(haiTotal);
    cloudTotal = this.round2(cloudTotal);
    const savings = this.round2(cloudTotal - haiTotal);

    return {
      horizonMonths: HORIZON_MONTHS,
      haiTotal,
      haiHardwareTotal: this.round2(hardwareTotal),
      haiServiceTotal,
      haiMonthlyLeasePayment:
        leasePayment === null ? null : this.round2(leasePayment),
      cloudTotal,
      savings,
      savingsPercent:
        cloudTotal > 0 ? this.round2((savings / cloudTotal) * 100) : null,
      breakEvenMonth,
      yearly,
      assumptions: [
        `Five-year horizon (${HORIZON_MONTHS} months).`,
        leasePayment === null
          ? `Outright hardware purchase is paid in month zero; $${hardwarePrincipal.toFixed(
              2
            )} includes a 10% quote contingency buffer.`
          : `${leaseMonths}-month comparison uses the published catalog lease rate of $${leasePayment.toFixed(
              2
            )}/month; the catalog does not specify a lease term.`,
        `Monthly service $${monthlyService.toFixed(
          2
        )} (software plus retainer).`,
        `Cloud spend starts at $${input.currentMonthlySpend.toFixed(
          2
        )}/mo and grows ${input.annualUpliftPercent}% per year.`,
      ],
    };
  }

  private requireInput(input: RoiComparisonInput): void {
    if (!input || typeof input !== 'object') {
      throw new Error('A comparison input is required.');
    }
    if (
      !input.tier ||
      !Number.isFinite(input.tier.retailPrice) ||
      input.tier.retailPrice <= 0
    ) {
      throw new Error('A valid hardware tier is required.');
    }
    if (
      !Number.isFinite(input.tier.leaseMonthlyRate) ||
      input.tier.leaseMonthlyRate < 0
    ) {
      throw new Error('Tier lease rates must be zero or positive.');
    }
    for (const rate of [
      input.tier.softwareMonthlyRate,
      input.tier.retainerMonthlyRate,
    ]) {
      if (!Number.isFinite(rate) || rate < 0) {
        throw new Error('Tier service rates must be zero or positive.');
      }
    }
    if (!['outright', 'lease-24', 'lease-36'].includes(input.acquisition)) {
      throw new Error('A valid acquisition option is required.');
    }
    if (
      !Number.isFinite(input.currentMonthlySpend) ||
      input.currentMonthlySpend < 0
    ) {
      throw new Error('Current monthly spend must be zero or positive.');
    }
    if (
      !Number.isFinite(input.annualUpliftPercent) ||
      input.annualUpliftPercent < 0 ||
      input.annualUpliftPercent > 100
    ) {
      throw new Error('Annual uplift must be between 0 and 100 percent.');
    }
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
