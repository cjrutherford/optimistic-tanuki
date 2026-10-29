import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChatCommands } from '@optimistic-tanuki/constants';
import { ChatAccountDeletionOwnerService } from './account-deletion-owner.service';
@Controller()
export class ChatAccountDeletionOwnerController {
  constructor(private readonly owner: ChatAccountDeletionOwnerService) {}
  @MessagePattern({ cmd: ChatCommands.FENCE_ACCOUNT_DELETION }) fence(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'fence');
  }
  @MessagePattern({ cmd: ChatCommands.ERASE_ACCOUNT_DELETION }) erase(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'erase');
  }
  @MessagePattern({ cmd: ChatCommands.READBACK_ACCOUNT_DELETION })
  readback(@Payload() value: unknown) {
    return this.owner.execute(value, 'readback');
  }
}
