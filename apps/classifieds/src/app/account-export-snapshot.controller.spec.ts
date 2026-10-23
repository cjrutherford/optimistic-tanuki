jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportProfileBoundSnapshotService: class {},
  AccountExportProfileBoundSnapshotError: class extends Error {},
  AccountExportOwnerSpoolService: class {},
  AccountExportPostgresOwnerService: class {},
  AccountExportProfileSnapshotClient: class {},
}));
import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { ClassifiedCommands } from '@optimistic-tanuki/constants';
import { ClassifiedsAccountExportSnapshotController } from './account-export-snapshot.controller';

it('forwards open/read/release on the classifieds capture RPCs', () => {
  const captures = {
    open: jest.fn((v) => v),
    read: jest.fn((v) => v),
    release: jest.fn((v) => v),
  };
  const controller = new ClassifiedsAccountExportSnapshotController(
    captures as any
  );
  const input = {};
  expect(controller.open(input)).toBe(input);
  expect(controller.read(input)).toBe(input);
  expect(controller.release(input)).toBe(input);
  expect(Reflect.getMetadata(PATTERN_METADATA, controller.open)).toEqual([
    { cmd: ClassifiedCommands.OPEN_ACCOUNT_EXPORT_CAPTURE },
  ]);
  expect(Reflect.getMetadata(PATTERN_METADATA, controller.read)).toEqual([
    { cmd: ClassifiedCommands.READ_ACCOUNT_EXPORT_CAPTURE },
  ]);
  expect(Reflect.getMetadata(PATTERN_METADATA, controller.release)).toEqual([
    { cmd: ClassifiedCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE },
  ]);
});
