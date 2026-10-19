import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ForumCommands } from '@optimistic-tanuki/constants';
import { ForumAccountExportService } from './account-export.service';

@Controller()
export class ForumAccountExportController {
  constructor(private readonly accountExport: ForumAccountExportService) {}

  @MessagePattern({ cmd: ForumCommands.GetAccountExportSnapshot })
  getAccountExportSnapshot(@Payload() request: Record<string, unknown>) {
    return this.accountExport.getAccountExportSnapshot(request?.accountId, {
      token: request?.token,
      appId: request?.appId,
    });
  }
}
