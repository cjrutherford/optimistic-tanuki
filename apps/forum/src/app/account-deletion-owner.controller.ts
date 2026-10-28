import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ForumCommands } from '@optimistic-tanuki/constants';
import { ForumAccountDeletionOwnerService } from './account-deletion-owner.service';
@Controller()
export class ForumAccountDeletionOwnerController {
  constructor(private readonly owner: ForumAccountDeletionOwnerService) {}
  @MessagePattern({ cmd: ForumCommands.FENCE_ACCOUNT_DELETION }) fence(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'fence');
  }
  @MessagePattern({ cmd: ForumCommands.ERASE_ACCOUNT_DELETION }) erase(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'erase');
  }
  @MessagePattern({ cmd: ForumCommands.READBACK_ACCOUNT_DELETION })
  readback(@Payload() value: unknown) {
    return this.owner.execute(value, 'readback');
  }
}
