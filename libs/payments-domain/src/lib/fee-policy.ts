export interface TransactionFeePolicy {
    platformPercentage: number;
    processorPercentage: number;
    processorFlatFee: number;
}

export interface TransactionFeeBreakdown {
    gross: number;
    platformFee: number;
    processorPercentageFee: number;
    processorFlatFee: number;
    totalFee: number;
    net: number;
    feePercentage: number;
}

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

export const calculateTransactionFeeBreakdown = (
    amount: number,
    policy: TransactionFeePolicy
): TransactionFeeBreakdown => {
    const platformFee = roundCurrency(amount * policy.platformPercentage);
    const processorPercentageFee = roundCurrency(
        amount * policy.processorPercentage
    );
    const processorFlatFee = roundCurrency(policy.processorFlatFee);
    const totalFee = roundCurrency(
        platformFee + processorPercentageFee + processorFlatFee
    );

    return {
        gross: roundCurrency(amount),
        platformFee,
        processorPercentageFee,
        processorFlatFee,
        totalFee,
        net: roundCurrency(amount - totalFee),
        feePercentage: (policy.platformPercentage + policy.processorPercentage) * 100,
    };
};
