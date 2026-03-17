import {
  PLATFORM_FEE_PERCENTAGE,
  LEMON_SQUEEZY_FEE_PERCENTAGE,
  LEMON_SQUEEZY_FLAT_FEE,
  TOTAL_FEE_PERCENTAGE,
} from '@optimistic-tanuki/payment-fees';

export interface FeeBreakdown {
  gross: number;
  fee: number;
  net: number;
  feePercentage: number;
}

/** Our platform portion of the fee (5% of amount). */
export function calculatePlatformFee(amount: number): number {
  return Math.round(amount * PLATFORM_FEE_PERCENTAGE * 100) / 100;
}

/**
 * Calculate the full fee breakdown for a classified-ad transaction.
 *
 * Total fee = (PLATFORM_FEE_PERCENTAGE + LEMON_SQUEEZY_FEE_PERCENTAGE) * amount
 *             + LEMON_SQUEEZY_FLAT_FEE
 *
 * i.e. 10% of the transaction amount plus $0.50.
 */
export function calculateNetAmount(amount: number): FeeBreakdown {
  const percentageFee = Math.round(amount * TOTAL_FEE_PERCENTAGE * 100) / 100;
  const fee = Math.round((percentageFee + LEMON_SQUEEZY_FLAT_FEE) * 100) / 100;
  const net = Math.round((amount - fee) * 100) / 100;
  return {
    gross: amount,
    fee,
    net,
    feePercentage: TOTAL_FEE_PERCENTAGE * 100,
  };
}

export function calculateSellerReceives(grossAmount: number): number {
  return calculateNetAmount(grossAmount).net;
}
