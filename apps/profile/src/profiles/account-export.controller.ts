import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProfileCommands } from '@optimistic-tanuki/constants';
import type { OwnedAccountProfileIdPageRequest } from '@optimistic-tanuki/profile-contracts';
import { ProfileAccountExportService } from '../app/account-export.service';
import { ProfileAccountExportSnapshotService } from '../app/account-export-snapshot.service';

@Controller()
export class AccountExportController {
  constructor(
    private readonly accountExport: ProfileAccountExportService,
    private readonly snapshot: ProfileAccountExportSnapshotService
  ) {}

  @MessagePattern({ cmd: ProfileCommands.OpenAccountExportCapture })
  openAccountExportCapture(@Payload() data: unknown) {
    return this.snapshot.open(data);
  }

  @MessagePattern({ cmd: ProfileCommands.ReadAccountExportCapture })
  readAccountExportCapture(@Payload() data: unknown) {
    return this.snapshot.read(data);
  }

  @MessagePattern({ cmd: ProfileCommands.ReadAccountExportCaptureIdentities })
  readAccountExportCaptureIdentities(@Payload() data: unknown) {
    return this.snapshot.readIdentities(data);
  }

  @MessagePattern({ cmd: ProfileCommands.ReleaseAccountExportCapture })
  releaseAccountExportCapture(@Payload() data: unknown) {
    return this.snapshot.release(data);
  }

  @MessagePattern({ cmd: ProfileCommands.GetAccountExportSnapshot })
  getAccountExportSnapshot(
    @Payload() data: { accountId?: unknown; token?: unknown; appId?: unknown }
  ) {
    return this.accountExport.getAccountExportSnapshot(
      data?.accountId,
      data?.token,
      data?.appId
    );
  }

  @MessagePattern({ cmd: ProfileCommands.GetOwnedAccountProfileIdPage })
  getOwnedAccountProfileIdPage(
    @Payload() data: OwnedAccountProfileIdPageRequest
  ) {
    return this.accountExport.getOwnedProfileIdPage(data);
  }
}
