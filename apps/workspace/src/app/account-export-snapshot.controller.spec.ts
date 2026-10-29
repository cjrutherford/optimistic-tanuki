jest.mock('@optimistic-tanuki/storage', () => ({
  AccountExportPostgresOwnerService: class {
    constructor(..._args: unknown[]) {}
  },
  AccountExportProfileSnapshotClient: class {},
  AccountExportOwnerSpoolService: class {},
  AccountExportProfileBoundSnapshotService: class {
    constructor(..._args: unknown[]) {}
  },
  AccountExportProfileBoundSnapshotError: class extends Error {},
}));

import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { WorkspaceCommands } from '@optimistic-tanuki/constants';
import { AppModule } from './app.module';
import { WorkspaceAccountExportOwnerService } from './account-export-owner.service';
import { WorkspaceAccountExportSnapshotController } from './account-export-snapshot.controller';
import { WorkspaceAccountExportSnapshotService } from './account-export-snapshot.service';

describe('WorkspaceAccountExportSnapshotController', () => {
  it('forwards open/read/release and binds the three workspace commands', async () => {
    const captures = {
      open: jest.fn(async (v) => ({ opened: v })),
      read: jest.fn(async (v) => ({ read: v })),
      release: jest.fn(async (v) => ({ released: v })),
    };
    const controller = new WorkspaceAccountExportSnapshotController(
      captures as unknown as WorkspaceAccountExportSnapshotService
    );
    const input = { handleId: 'opaque' };
    await expect(controller.open(input)).resolves.toEqual({ opened: input });
    await expect(controller.read(input)).resolves.toEqual({ read: input });
    await expect(controller.release(input)).resolves.toEqual({
      released: input,
    });
    expect(Reflect.getMetadata(PATTERN_METADATA, controller.open)).toEqual([
      { cmd: WorkspaceCommands.OPEN_ACCOUNT_EXPORT_CAPTURE },
    ]);
    expect(Reflect.getMetadata(PATTERN_METADATA, controller.read)).toEqual([
      { cmd: WorkspaceCommands.READ_ACCOUNT_EXPORT_CAPTURE },
    ]);
    expect(Reflect.getMetadata(PATTERN_METADATA, controller.release)).toEqual([
      { cmd: WorkspaceCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE },
    ]);
  });

  it('registers the snapshot capture providers', () => {
    expect(Reflect.getMetadata('controllers', AppModule)).toContain(
      WorkspaceAccountExportSnapshotController
    );
    const providers = Reflect.getMetadata('providers', AppModule).map(
      (provider: any) =>
        typeof provider === 'function' ? provider : provider.provide
    );
    expect(providers).toContain(WorkspaceAccountExportOwnerService);
    expect(providers).toContain(WorkspaceAccountExportSnapshotService);
  });
});
