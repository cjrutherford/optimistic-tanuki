import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppConfigCommands } from '@optimistic-tanuki/constants';
import { AppConfiguratorAccountDeletionOwnerService } from './account-deletion-owner.service';
@Controller()
export class AppConfiguratorAccountDeletionOwnerController {
  constructor(
    private readonly owner: AppConfiguratorAccountDeletionOwnerService
  ) {}
  @MessagePattern({ cmd: AppConfigCommands.FENCE_ACCOUNT_DELETION }) fence(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'fence');
  }
  @MessagePattern({ cmd: AppConfigCommands.ERASE_ACCOUNT_DELETION }) erase(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'erase');
  }
  @MessagePattern({ cmd: AppConfigCommands.READBACK_ACCOUNT_DELETION })
  readback(@Payload() value: unknown) {
    return this.owner.execute(value, 'readback');
  }
}
