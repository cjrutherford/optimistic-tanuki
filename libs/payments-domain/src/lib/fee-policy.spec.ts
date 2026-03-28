import { calculateTransactionFeeBreakdown } from './fee-policy';

describe('calculateTransactionFeeBreakdown', () => {
    it('calculates provider-neutral platform and processor fees', () => {
        expect(
            calculateTransactionFeeBreakdown(100, {
                platformPercentage: 0.05,
                processorPercentage: 0.05,
                processorFlatFee: 0.5,
            })
        ).toEqual({
            gross: 100,
            platformFee: 5,
            processorPercentageFee: 5,
            processorFlatFee: 0.5,
            totalFee: 10.5,
            net: 89.5,
            feePercentage: 10,
        });
    });
});
