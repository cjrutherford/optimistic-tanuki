/**
 * How HAI prices work (D018–D022). Change the rate here and every page
 * follows.
 */

/** Published labor rate in US dollars per hour, confirmed by the owner 2026-10-06 (D019). */
export const LABOR_RATE_PER_HOUR = 65;

export const LABOR_RATE_LABEL = `$${LABOR_RATE_PER_HOUR} per hour`;

export interface PricingTerm {
  title: string;
  description: string;
}

export const PRICING_HEADLINE = `Hardware at cost. Labor at $${LABOR_RATE_PER_HOUR} an hour.`;

export const PRICING_SUMMARY =
  'No markup on equipment and no padded packages. You pay what the hardware actually costs, plus our time to set it up and look after it.';

export const PRICING_TERMS: PricingTerm[] = [
  {
    title: 'Hardware',
    description:
      'Billed at the actual price we pay for the parts, with no markup. Your quote lists each part and its price, and you see the receipts.',
  },
  {
    title: 'Freight and tax',
    description:
      'Passed through at the actual amounts on the order, not a flat allowance.',
  },
  {
    title: 'Labor',
    description: `${LABOR_RATE_LABEL} for setup, migration, and support. Your quote estimates the hours before any work starts.`,
  },
  {
    title: 'Ongoing support',
    description:
      'Billed at the same hourly rate. A monthly plan is an agreed number of hours, plus any service costs, such as cloud backup storage, passed through at actual amounts.',
  },
  {
    title: 'Leasing',
    description:
      'Available on request through a third-party lender. The lender sets the lease terms, and you see them before you commit.',
  },
  {
    title: 'Everything else',
    description:
      'Custom software and larger projects are quoted per project. Where a figure is an estimate, we say so.',
  },
];

/** One-line version for places too small for the full terms. */
export const PRICING_ONE_LINE = `Hardware at actual cost with no markup, freight and tax at actual amounts, and labor at ${LABOR_RATE_LABEL}. Every job gets an itemized quote.`;
