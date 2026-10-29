jest.mock('@optimistic-tanuki/storage', () => {
  const spool = jest.requireActual(
    '../../../../libs/storage/src/lib/account-export-owner-spool.service'
  );
  const bound = jest.requireActual(
    '../../../../libs/storage/src/lib/account-export-profile-bound-snapshot.service'
  );
  return {
    AccountExportOwnerSpoolService: spool.AccountExportOwnerSpoolService,
    AccountExportProfileBoundSnapshotService:
      bound.AccountExportProfileBoundSnapshotService,
    AccountExportProfileBoundSnapshotError:
      bound.AccountExportProfileBoundSnapshotError,
    AccountExportProfileSnapshotClient: class {},
  };
});

import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { SocialCommands } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import { SocialAccountExportSnapshotService } from './account-export-snapshot.service';
import { SocialAccountExportSnapshotController } from './account-export-snapshot.controller';
import { AppModule } from './app.module';
import { SocialAccountExportOwnerService } from './account-export-owner.service';

describe('SocialAccountExportSnapshotController', () => {
  it('routes the three internal commands to the profile-bound snapshot service', async () => {
    const captures = {
      open: jest.fn(async (input) => ({ opened: input })),
      read: jest.fn(async (input) => ({ read: input })),
      release: jest.fn(async (input) => ({ released: input })),
    };
    const controller = new SocialAccountExportSnapshotController(
      captures as unknown as SocialAccountExportSnapshotService
    );
    const input = { handleId: 'opaque-handle' };

    await expect(controller.open(input)).resolves.toEqual({ opened: input });
    await expect(controller.read(input)).resolves.toEqual({ read: input });
    await expect(controller.release(input)).resolves.toEqual({
      released: input,
    });
    expect(captures.open).toHaveBeenCalledWith(input);
    expect(captures.read).toHaveBeenCalledWith(input);
    expect(captures.release).toHaveBeenCalledWith(input);

    expect(Reflect.getMetadata(PATTERN_METADATA, controller.open)).toEqual([
      { cmd: SocialCommands.OPEN_ACCOUNT_EXPORT_CAPTURE },
    ]);
    expect(Reflect.getMetadata(PATTERN_METADATA, controller.read)).toEqual([
      { cmd: SocialCommands.READ_ACCOUNT_EXPORT_CAPTURE },
    ]);
    expect(Reflect.getMetadata(PATTERN_METADATA, controller.release)).toEqual([
      { cmd: SocialCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE },
    ]);
  });

  it('registers the controller and production snapshot providers', () => {
    const metadata = Reflect.getMetadata('controllers', AppModule);
    const providers = Reflect.getMetadata('providers', AppModule);
    expect(metadata).toContain(SocialAccountExportSnapshotController);
    expect(providers).toContain(AccountExportOwnerSpoolService);
    expect(providers).toContain(AccountExportProfileSnapshotClient);
    expect(
      providers.some(
        (provider: any) =>
          provider?.provide === SocialAccountExportSnapshotService
      )
    ).toBe(true);
    expect(
      providers.some(
        (provider: any) => provider?.provide === SocialAccountExportOwnerService
      )
    ).toBe(true);
  });
});
