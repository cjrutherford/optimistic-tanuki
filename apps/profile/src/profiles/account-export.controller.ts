import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProfileCommands } from '@optimistic-tanuki/constants';
import type { OwnedAccountProfileIdPageRequest } from '@optimistic-tanuki/profile-contracts';
import { ProfileAccountExportService } from '../app/account-export.service';

@Controller()
export class AccountExportController {
  constructor(private readonly accountExport: ProfileAccountExportService) {}

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
