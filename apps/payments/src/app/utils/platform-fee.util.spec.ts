import {
  calculateNetAmount,
  calculatePlatformFee,
  calculateSellerReceives,
} from './platform-fee.util';

describe('calculatePlatformFee', () => {
  // Our 5% take rate only, excluding the provider's percentage and flat fee.
  it.each([
    [100, 5],
    [250, 12.5],
    [0, 0],
    // Rounded to cents rather than left as 0.5150000000000001.
    [10.3, 0.52],
  ])('takes 5%% of %d as %d', (amount, expected) => {
    expect(calculatePlatformFee(amount)).toBe(expected);
  });
});

describe('calculateSellerReceives', () => {
  it.each([100, 37.55, 0.75])(
    'returns the net leg of the full breakdown for %d',
    (amount) => {
      expect(calculateSellerReceives(amount)).toBe(
        calculateNetAmount(amount).net
      );
    }
  );

  it('deducts 10% plus the $0.50 flat fee', () => {
    // 100 - (10 + 0.50)
    expect(calculateSellerReceives(100)).toBe(89.5);
  });
});
