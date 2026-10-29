jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {
    readonly options: unknown;
    constructor(
      _dataSource: unknown,
      _identities: unknown,
      _auth: unknown,
      options: unknown
    ) {
      this.options = options;
    }
  },
  AccountExportProfileSnapshotClient: class {},
}));

import { AccountExportPostgresOwnerService } from '@optimistic-tanuki/storage';
import { createPaymentsAccountExportSources } from './account-export-sources';
import {
  PaymentsAccountExportOwnerService,
  PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from './account-export-owner.service';

describe('PaymentsAccountExportOwnerService', () => {
  it('configures the shared owner with the Payments participant and ordered sources', () => {
    const owner = new PaymentsAccountExportOwnerService(
      {} as any,
      {} as any,
      {} as any
    );
    expect(owner).toBeInstanceOf(AccountExportPostgresOwnerService);
    expect((owner as any).options).toMatchObject({
      participantId: 'payments',
      sources: PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      createSources: createPaymentsAccountExportSources,
    });
    expect(PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES).toEqual([
      'Donation',
      'ClassifiedPayment',
      'SellerWallet',
      'Transaction',
      'Offer',
      'PayoutRequest',
      'BusinessPage',
      'BusinessTheme',
      'CommunitySponsorship',
      'LemonSqueezyProduct',
    ]);
  });
});
