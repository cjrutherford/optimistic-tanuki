jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {},
  AccountExportProfileSnapshotClient: class {},
  AccountExportOwnerSpoolService: class {},
  AccountExportProfileBoundSnapshotService: class {
    readonly participantId: string;
    readonly sources: readonly string[];
    constructor(
      _owner: unknown,
      _spool: unknown,
      _auth: unknown,
      config: { participantId: string; sources: readonly string[] }
    ) {
      this.participantId = config.participantId;
      this.sources = config.sources;
    }
  },
  AccountExportProfileBoundSnapshotError: class extends Error {},
}));

import { AccountExportProfileBoundSnapshotService } from '@optimistic-tanuki/storage';
import { PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from './account-export-owner.service';
import { PaymentsAccountExportSnapshotService } from './account-export-snapshot.service';

describe('PaymentsAccountExportSnapshotService', () => {
  it('wraps the shared profile-bound snapshot implementation', () => {
    const service = new PaymentsAccountExportSnapshotService(
      {} as any,
      {} as any,
      {} as any
    );
    expect(service).toBeInstanceOf(AccountExportProfileBoundSnapshotService);
    expect((service as any).participantId).toBe('payments');
    expect((service as any).sources).toEqual(
      PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES
    );
  });
});
