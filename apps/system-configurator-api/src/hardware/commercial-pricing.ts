const CONTINGENCY_RATE = 0.1;
const FREIGHT_AND_TAX_RATE = 0.08;
const PROCUREMENT_MARKUP_RATE = 0.35;
const LEASE_APR = 0.095;
const ANNUAL_MAINTENANCE_RESERVE_RATE = 0.15;
const MINIMUM_RETAINER_MARGIN = 0.7;
const QUOTE_EXPIRY_CALENDAR_DAYS = 30;

export interface HardwareCostBasis {
  kind: 'raw';
  wholesaleCost: number;
}

export interface HardwareCommercialPricingInput {
  costBasis: HardwareCostBasis;
}

export interface HardwareLeasePrice {
  termMonths: 24 | 36;
  monthlyAmortization: number;
  monthlyMaintenanceReserve: number;
  monthlyTotal: number;
}

export interface HardwareCommercialPricing {
  sourceWholesaleCost: number;
  /** Customer-facing contingency amount. The internal reserve is separate. */
  contingencyAmount: 0;
  /** Internal reserve on raw wholesale cost; never added to the public price. */
  contingencyReserve: number | null;
  bufferedSourceCost: number;
  freightAndTaxAllowance: number;
  landedCost: number;
  procurementMarkup: number;
  outrightPrice: number;
  leases: HardwareLeasePrice[];
}

export interface RetainerMarginInput {
  monthlyRevenue: number;
  monthlyCloudCost: number;
  monthlySmsCost: number;
  monthlyNetworkCost: number;
}

export interface RetainerMarginAssessment {
  monthlyRevenue: number;
  monthlyCosts: number;
  monthlyGrossProfit: number;
  grossMargin: number;
  meetsMinimumMargin: boolean;
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

function amortizedMonthlyPayment(
  principal: number,
  termMonths: 24 | 36
): number {
  const monthlyRate = LEASE_APR / 12;
  const payment =
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
  return cents(payment);
}

function makeLease(
  outrightPrice: number,
  landedCost: number,
  termMonths: 24 | 36
): HardwareLeasePrice {
  const monthlyAmortization = amortizedMonthlyPayment(
    outrightPrice,
    termMonths
  );
  const monthlyMaintenanceReserve = cents(
    (landedCost * ANNUAL_MAINTENANCE_RESERVE_RATE) / 12
  );

  return {
    termMonths,
    monthlyAmortization,
    monthlyMaintenanceReserve,
    monthlyTotal: cents(monthlyAmortization + monthlyMaintenanceReserve),
  };
}

export function calculateHardwareCommercialPricing(
  input: HardwareCommercialPricingInput
): HardwareCommercialPricing {
  const { wholesaleCost } = input.costBasis;
  assertNonnegativeFinite(wholesaleCost, 'wholesaleCost');
  const sourceWholesaleCost = cents(wholesaleCost);
  const contingencyReserve = cents(sourceWholesaleCost * CONTINGENCY_RATE);
  const bufferedSourceCost = sourceWholesaleCost;
  const contingencyAmount = 0 as const;
  const freightAndTaxAllowance = cents(
    bufferedSourceCost * FREIGHT_AND_TAX_RATE
  );
  const landedCost = cents(bufferedSourceCost + freightAndTaxAllowance);
  const procurementMarkup = cents(landedCost * PROCUREMENT_MARKUP_RATE);
  const outrightPrice = cents(landedCost + procurementMarkup);

  return {
    sourceWholesaleCost,
    contingencyAmount,
    contingencyReserve,
    bufferedSourceCost,
    freightAndTaxAllowance,
    landedCost,
    procurementMarkup,
    outrightPrice,
    leases: [
      makeLease(outrightPrice, landedCost, 24),
      makeLease(outrightPrice, landedCost, 36),
    ],
  };
}

export function assessRetainerMargin(
  input: RetainerMarginInput
): RetainerMarginAssessment {
  assertNonnegativeFinite(input.monthlyRevenue, 'monthlyRevenue');
  assertNonnegativeFinite(input.monthlyCloudCost, 'monthlyCloudCost');
  assertNonnegativeFinite(input.monthlySmsCost, 'monthlySmsCost');
  assertNonnegativeFinite(input.monthlyNetworkCost, 'monthlyNetworkCost');
  if (input.monthlyRevenue === 0) {
    throw new Error('monthlyRevenue must be greater than zero');
  }

  const monthlyRevenue = cents(input.monthlyRevenue);
  if (monthlyRevenue === 0) {
    throw new Error(
      'monthlyRevenue must be greater than zero after cent rounding'
    );
  }
  const monthlyCosts = cents(
    cents(input.monthlyCloudCost) +
      cents(input.monthlySmsCost) +
      cents(input.monthlyNetworkCost)
  );
  const monthlyGrossProfit = cents(monthlyRevenue - monthlyCosts);
  const grossMargin = (monthlyRevenue - monthlyCosts) / monthlyRevenue;

  return {
    monthlyRevenue,
    monthlyCosts,
    monthlyGrossProfit,
    grossMargin,
    meetsMinimumMargin: grossMargin >= MINIMUM_RETAINER_MARGIN,
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
