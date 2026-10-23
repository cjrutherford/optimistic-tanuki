jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {
    constructor(...args: unknown[]) {
      (this as any).options = args[3];
    }
  },
  AccountExportProfileSnapshotClient: class {},
}));
import { APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { createAppConfiguratorAccountExportSources } from './account-export-sources';
import { AppConfiguratorAccountExportOwnerService } from './account-export-owner.service';
it('configures the shared owner with the app-configurator source registry', () => {
  const owner = new AppConfiguratorAccountExportOwnerService(
    {} as any,
    {} as any,
    {} as any
  );
  expect((owner as any).options).toMatchObject({
    participantId: 'app-configurator',
    sources: APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    createSources: createAppConfiguratorAccountExportSources,
  });
});
