import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { AccountExportService } from './account-export.service';

@Controller()
export class AccountExportController {
  constructor(private readonly accountExport: AccountExportService) {}

  @MessagePattern({ cmd: AuthCommands.GetAccountExportSnapshot })
  getAuthenticationSnapshot(
    @Payload() data: { accountId?: unknown; token?: unknown; appId?: unknown }
  ) {
    return this.accountExport.getAuthenticationSnapshot(
      data?.accountId,
      data?.token,
      data?.appId
    );
  }

  @MessagePattern({ cmd: AuthCommands.PreviewAccountExport })
  previewAccountExport(
    @Payload() data: { accountId?: unknown; token?: unknown; appId?: unknown }
  ) {
    return this.accountExport.previewAccountExport(
      data?.accountId,
      data?.token,
      data?.appId
    );
  }
}
