jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {},
  AccountExportProfileSnapshotClient: class {},
  AccountExportOwnerSpoolService: class {},
  AccountExportProfileBoundSnapshotService: class {
    constructor(..._args: unknown[]) {}
  },
  AccountExportProfileBoundSnapshotError: class extends Error {},
}));
import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { AppConfigCommands } from '@optimistic-tanuki/constants';
import { AppConfiguratorAccountExportSnapshotController } from './account-export-snapshot.controller';
it('forwards leased capture RPCs on the fixed commands', async () => {
  const captures = {
    open: jest.fn((v) => v),
    read: jest.fn((v) => v),
    release: jest.fn((v) => v),
  };
  const c = new AppConfiguratorAccountExportSnapshotController(captures as any);
  const v = { lease: 'x' };
  expect(c.open(v)).toBe(v);
  expect(c.read(v)).toBe(v);
  expect(c.release(v)).toBe(v);
  expect(Reflect.getMetadata(PATTERN_METADATA, c.open)).toEqual([
    { cmd: AppConfigCommands.OPEN_ACCOUNT_EXPORT_CAPTURE },
  ]);
  expect(Reflect.getMetadata(PATTERN_METADATA, c.read)).toEqual([
    { cmd: AppConfigCommands.READ_ACCOUNT_EXPORT_CAPTURE },
  ]);
  expect(Reflect.getMetadata(PATTERN_METADATA, c.release)).toEqual([
    { cmd: AppConfigCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE },
  ]);
});
