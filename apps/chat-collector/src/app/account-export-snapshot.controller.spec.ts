jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {},
  AccountExportProfileSnapshotClient: class {},
  AccountExportOwnerSpoolService: class {},
  AccountExportProfileBoundSnapshotService: class {},
  AccountExportProfileBoundSnapshotError: class extends Error {},
}));
import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { ChatCommands } from '@optimistic-tanuki/constants';
import { ChatAccountExportSnapshotController } from './account-export-snapshot.controller';

it('forwards open, read and release RPCs on the chat leased capture commands', () => {
  const captures = {
    open: jest.fn((value) => value),
    read: jest.fn((value) => value),
    release: jest.fn((value) => value),
  };
  const controller = new ChatAccountExportSnapshotController(captures as any);
  const input = { lease: 'opaque' };
  expect(controller.open(input)).toBe(input);
  expect(controller.read(input)).toBe(input);
  expect(controller.release(input)).toBe(input);
  expect(Reflect.getMetadata(PATTERN_METADATA, controller.open)).toEqual([
    { cmd: ChatCommands.OPEN_ACCOUNT_EXPORT_CAPTURE },
  ]);
  expect(Reflect.getMetadata(PATTERN_METADATA, controller.read)).toEqual([
    { cmd: ChatCommands.READ_ACCOUNT_EXPORT_CAPTURE },
  ]);
  expect(Reflect.getMetadata(PATTERN_METADATA, controller.release)).toEqual([
    { cmd: ChatCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE },
  ]);
});
