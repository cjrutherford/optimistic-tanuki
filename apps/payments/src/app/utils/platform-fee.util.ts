import {
  PLATFORM_FEE_PERCENTAGE,
  PROCESSOR_FEE_PERCENTAGE,
  PROCESSOR_FLAT_FEE,
  TOTAL_FEE_PERCENTAGE,
} from '@optimistic-tanuki/payment-fees';
import { calculateTransactionFeeBreakdown } from '@optimistic-tanuki/payments-domain';

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
 * Total fee = (PLATFORM_FEE_PERCENTAGE + PROCESSOR_FEE_PERCENTAGE) * amount
 *             + PROCESSOR_FLAT_FEE
 *
 * i.e. 10% of the transaction amount plus $0.50.
 */
export function calculateNetAmount(amount: number): FeeBreakdown {
  const breakdown = calculateTransactionFeeBreakdown(amount, {
    platformPercentage: PLATFORM_FEE_PERCENTAGE,
    processorPercentage: PROCESSOR_FEE_PERCENTAGE,
    processorFlatFee: PROCESSOR_FLAT_FEE,
  });

  return {
    gross: breakdown.gross,
    fee: breakdown.totalFee,
    net: breakdown.net,
    feePercentage: TOTAL_FEE_PERCENTAGE * 100,
  };
}

export function calculateSellerReceives(grossAmount: number): number {
  return calculateNetAmount(grossAmount).net;
}
