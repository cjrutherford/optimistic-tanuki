import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PermissionCommands } from '@optimistic-tanuki/constants';
import { AccountExportService } from './account-export.service';

@Controller()
export class AccountExportController {
  constructor(private readonly accountExport: AccountExportService) {}

  @MessagePattern({ cmd: PermissionCommands.GetAccountExportSnapshot })
  getAccountExportSnapshot(
    @Payload() data: { accountId?: unknown; token?: unknown; appId?: unknown }
  ) {
    return this.accountExport.getAccountExportSnapshot(
      data?.accountId,
      data?.token,
      data?.appId
    );
  }
}
