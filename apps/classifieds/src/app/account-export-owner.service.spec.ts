jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {
    options: any;
    constructor(...args: any[]) {
      this.options = args[3];
    }
  },
  AccountExportProfileSnapshotClient: class {},
}));
import { CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { ClassifiedsAccountExportOwnerService } from './account-export-owner.service';

it('configures one classifieds participant and the canonical source factory', () => {
  const owner = new ClassifiedsAccountExportOwnerService(
    {} as any,
    {} as any,
    {} as any
  );
  expect((owner as any).options).toEqual({
    participantId: 'classifieds',
    sources: CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    createSources: expect.any(Function),
  });
});
