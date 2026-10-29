import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SocialCommands } from '@optimistic-tanuki/constants';
import { SocialAccountExportService } from './account-export.service';

@Controller()
export class SocialAccountExportController {
  constructor(private readonly accountExport: SocialAccountExportService) {}

  @MessagePattern({ cmd: SocialCommands.GetAccountExportSnapshot })
  getAccountExportSnapshot(
    @Payload()
    request: {
      accountId?: unknown;
      token?: unknown;
      appId?: unknown;
    }
  ) {
    return this.accountExport.getAccountExportSnapshot(
      request?.accountId,
      request ?? {}
    );
  }
}
