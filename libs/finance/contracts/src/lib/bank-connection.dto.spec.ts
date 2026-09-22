import {
  BankConnectionStatus,
  BankSyncSourceType,
  BankTransactionReviewStatus,
} from './bank-connection.dto';

describe('finance banking enums', () => {
  it('exports stable source and status values for linked-bank flows', () => {
    expect(BankConnectionStatus.HEALTHY).toBe('healthy');
    expect(BankSyncSourceType.BANK_SYNC).toBe('bank-sync');
    expect(BankTransactionReviewStatus.NEEDS_REVIEW).toBe('needs-review');
  });
});
