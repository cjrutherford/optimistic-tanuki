jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportProfileBoundSnapshotService: class {
    args: any[];
    constructor(...args: any[]) {
      this.args = args;
    }
  },
  AccountExportProfileBoundSnapshotError: class extends Error {},
  AccountExportOwnerSpoolService: class {},
  AccountExportPostgresOwnerService: class {},
  AccountExportProfileSnapshotClient: class {},
}));
import { CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { ClassifiedsAccountExportSnapshotService } from './account-export-snapshot.service';

it('uses profile-bound spool snapshots for the classifieds participant', () => {
  const service = new ClassifiedsAccountExportSnapshotService(
    {} as any,
    {} as any,
    {} as any
  );
  expect((service as any).args[3]).toEqual({
    participantId: 'classifieds',
    sources: CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  });
});
