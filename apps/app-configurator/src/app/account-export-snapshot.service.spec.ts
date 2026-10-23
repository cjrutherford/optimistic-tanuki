jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {},
  AccountExportProfileSnapshotClient: class {},
  AccountExportProfileBoundSnapshotService: class {
    constructor(...args: unknown[]) {
      (this as any).args = args;
    }
  },
  AccountExportProfileBoundSnapshotError: class extends Error {},
  AccountExportOwnerSpoolService: class {},
}));
import { APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { AppConfiguratorAccountExportSnapshotService } from './account-export-snapshot.service';
it('wraps the leased shared snapshot service for this participant', () => {
  const s = new AppConfiguratorAccountExportSnapshotService(
    {} as any,
    {} as any,
    {} as any
  );
  expect((s as any).args[3]).toEqual({
    participantId: 'app-configurator',
    sources: APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  });
});
