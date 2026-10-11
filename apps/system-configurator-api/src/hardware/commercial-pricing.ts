/**
 * Pass-through commercial pricing (HAI decisions D018–D021).
 *
 * The customer pays for hardware, freight, and tax at the actual amounts,
 * with no markup, plus labor at the published hourly rate. Ongoing support is
 * labor at the same rate plus service costs passed through at actual amounts.
 * Leasing is arranged on request through a third-party lender, so quotes carry
 * no lease figures.
 *
 * The HAI website states the same rate in
 * `apps/hai/src/app/content/pricing.ts`; a test there keeps the two equal.
 */

/** Published labor rate in US dollars per hour (D019). */
export const HAI_LABOR_RATE_PER_HOUR = 65;

export const PRICING_MODEL = 'pass-through' as const;

const QUOTE_EXPIRY_CALENDAR_DAYS = 30;

export interface HardwareCommercialPricingInput {
  /** Sum of the selected supplier offers, at the price HAI pays. */
  hardwareCost: number;
  /** Freight on the order, at the actual amount. */
  freightAmount: number;
  /** Sales tax on the order, at the actual amount. */
  taxAmount: number;
  setupHours: number;
  laborRatePerHour: number;
}

export interface HardwareCommercialPricing {
  pricingModel: typeof PRICING_MODEL;
  hardwareCost: number;
  freightAmount: number;
  taxAmount: number;
  setupHours: number;
  laborRatePerHour: number;
  setupLabor: number;
  /** Everything paid up front: hardware, freight, tax, and setup labor. */
  outrightPrice: number;
}

export interface MonthlySupportInput {
  supportHours: number;
  laborRatePerHour: number;
  monthlyCloudCost: number;
  monthlySmsCost: number;
  monthlyNetworkCost: number;
}

export interface MonthlySupportPricing {
  supportHours: number;
  laborRatePerHour: number;
  supportLabor: number;
  /** Cloud, SMS, and network costs at the actual amounts. */
  passThroughCosts: number;
  monthlyTotal: number;
}

function assertNonnegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a nonnegative finite number`);
  }
}

function cents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('calculated monetary amount must be finite');
  }
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(rounded)) {
    throw new Error('calculated monetary amount must be finite');
  }
  return rounded;
}

function requirePositiveRate(rate: number): void {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('laborRatePerHour must be a positive finite number');
  }
}

export function calculateHardwareCommercialPricing(
  input: HardwareCommercialPricingInput
): HardwareCommercialPricing {
  assertNonnegativeFinite(input.hardwareCost, 'hardwareCost');
  assertNonnegativeFinite(input.freightAmount, 'freightAmount');
  assertNonnegativeFinite(input.taxAmount, 'taxAmount');
  assertNonnegativeFinite(input.setupHours, 'setupHours');
  requirePositiveRate(input.laborRatePerHour);

  const hardwareCost = cents(input.hardwareCost);
  const freightAmount = cents(input.freightAmount);
  const taxAmount = cents(input.taxAmount);
  const setupLabor = cents(input.setupHours * input.laborRatePerHour);

  return {
    pricingModel: PRICING_MODEL,
    hardwareCost,
    freightAmount,
    taxAmount,
    setupHours: input.setupHours,
    laborRatePerHour: input.laborRatePerHour,
    setupLabor,
    outrightPrice: cents(hardwareCost + freightAmount + taxAmount + setupLabor),
  };
}

export function calculateMonthlySupport(
  input: MonthlySupportInput
): MonthlySupportPricing {
  assertNonnegativeFinite(input.supportHours, 'supportHours');
  assertNonnegativeFinite(input.monthlyCloudCost, 'monthlyCloudCost');
  assertNonnegativeFinite(input.monthlySmsCost, 'monthlySmsCost');
  assertNonnegativeFinite(input.monthlyNetworkCost, 'monthlyNetworkCost');
  requirePositiveRate(input.laborRatePerHour);

  const supportLabor = cents(input.supportHours * input.laborRatePerHour);
  const passThroughCosts = cents(
    cents(input.monthlyCloudCost) +
      cents(input.monthlySmsCost) +
      cents(input.monthlyNetworkCost)
  );

  return {
    supportHours: input.supportHours,
    laborRatePerHour: input.laborRatePerHour,
    supportLabor,
    passThroughCosts,
    monthlyTotal: cents(supportLabor + passThroughCosts),
  };
}

export function addQuoteExpiryDays(issuedAt: string | Date): string {
  const issuedAtDate = new Date(issuedAt);
  if (!Number.isFinite(issuedAtDate.getTime())) {
    throw new Error('issuedAt must be a valid date');
  }

  issuedAtDate.setUTCDate(
    issuedAtDate.getUTCDate() + QUOTE_EXPIRY_CALENDAR_DAYS
  );
  return issuedAtDate.toISOString();
}
