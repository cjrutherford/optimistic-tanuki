/** Platform take rate applied to all classified-ad transactions. */
export const PLATFORM_FEE_PERCENTAGE = 0.05;

/** Lemon Squeezy percentage fee charged per transaction. */
export const LEMON_SQUEEZY_FEE_PERCENTAGE = 0.05;

/** Lemon Squeezy flat fee charged per transaction (USD). */
export const LEMON_SQUEEZY_FLAT_FEE = 0.5;

/** Combined percentage deducted from the transaction amount (platform % + LS %). */
export const TOTAL_FEE_PERCENTAGE =
  PLATFORM_FEE_PERCENTAGE + LEMON_SQUEEZY_FEE_PERCENTAGE;
