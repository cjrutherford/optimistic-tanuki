jest.mock('@optimistic-tanuki/storage', () => {
  const spool = jest.requireActual(
    '../../../../libs/storage/src/lib/account-export-owner-spool.service'
  );
  const bound = jest.requireActual(
    '../../../../libs/storage/src/lib/account-export-profile-bound-snapshot.service'
  );
  const postgres = jest.requireActual(
    '../../../../libs/storage/src/lib/account-export-postgres-owner.service'
  );
  return {
    AccountExportOwnerSpoolService: spool.AccountExportOwnerSpoolService,
    AccountExportProfileBoundSnapshotService:
      bound.AccountExportProfileBoundSnapshotService,
    AccountExportProfileBoundSnapshotError:
      bound.AccountExportProfileBoundSnapshotError,
    AccountExportProfileSnapshotClient: class {},
    AccountExportPostgresOwnerService:
      postgres.AccountExportPostgresOwnerService,
    AccountExportPostgresOwnerError: postgres.AccountExportPostgresOwnerError,
  };
});
import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { ForumCommands } from '@optimistic-tanuki/constants';
import { ForumAccountExportSnapshotController } from './account-export-snapshot.controller';
import { ForumAccountExportSnapshotService } from './account-export-snapshot.service';

describe('ForumAccountExportSnapshotController', () => {
  it('delegates three internal command patterns', async () => {
    const captures = {
      open: jest.fn(async (input) => ({ opened: input })),
      read: jest.fn(async (input) => ({ read: input })),
      release: jest.fn(async (input) => ({ released: input })),
    };
    const controller = new ForumAccountExportSnapshotController(
      captures as unknown as ForumAccountExportSnapshotService
    );
    const input = { handleId: 'opaque-handle' };
    await expect(controller.open(input)).resolves.toEqual({ opened: input });
    await expect(controller.read(input)).resolves.toEqual({ read: input });
    await expect(controller.release(input)).resolves.toEqual({
      released: input,
    });
    expect(Reflect.getMetadata(PATTERN_METADATA, controller.open)).toEqual([
      { cmd: ForumCommands.OPEN_ACCOUNT_EXPORT_CAPTURE },
    ]);
    expect(Reflect.getMetadata(PATTERN_METADATA, controller.read)).toEqual([
      { cmd: ForumCommands.READ_ACCOUNT_EXPORT_CAPTURE },
    ]);
    expect(Reflect.getMetadata(PATTERN_METADATA, controller.release)).toEqual([
      { cmd: ForumCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE },
    ]);
  });
});
