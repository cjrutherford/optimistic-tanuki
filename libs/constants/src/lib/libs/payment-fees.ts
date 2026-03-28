/** Platform take rate applied to all classified-ad transactions. */
export const PLATFORM_FEE_PERCENTAGE = 0.05;

/** Processor percentage fee charged per transaction. */
export const PROCESSOR_FEE_PERCENTAGE = 0.05;

/** Processor flat fee charged per transaction (USD). */
export const PROCESSOR_FLAT_FEE = 0.5;

/** Combined percentage deducted from the transaction amount. */
export const TOTAL_FEE_PERCENTAGE =
  PLATFORM_FEE_PERCENTAGE + PROCESSOR_FEE_PERCENTAGE;

/** Legacy export kept until Lemon Squeezy-specific naming is removed from callers. */
export const LEMON_SQUEEZY_FEE_PERCENTAGE = PROCESSOR_FEE_PERCENTAGE;

/** Legacy export kept until Lemon Squeezy-specific naming is removed from callers. */
export const LEMON_SQUEEZY_FLAT_FEE = PROCESSOR_FLAT_FEE;
