export const PLATFORM_FEE_PERCENTAGE = 0.05;

export interface FeeBreakdown {
  gross: number;
  fee: number;
  net: number;
  feePercentage: number;
}

export function calculatePlatformFee(amount: number): number {
  return Math.round(amount * PLATFORM_FEE_PERCENTAGE * 100) / 100;
}

export function calculateNetAmount(amount: number): FeeBreakdown {
  const fee = calculatePlatformFee(amount);
  const net = Math.round((amount - fee) * 100) / 100;
  return {
    gross: amount,
    fee,
    net,
    feePercentage: PLATFORM_FEE_PERCENTAGE * 100,
  };
}

export function calculateSellerReceives(grossAmount: number): number {
  return calculateNetAmount(grossAmount).net;
}
