import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SocialCommands } from '@optimistic-tanuki/constants';
import { SocialAccountDeletionOwnerService } from './account-deletion-owner.service';
@Controller()
export class SocialAccountDeletionOwnerController {
  constructor(private readonly owner: SocialAccountDeletionOwnerService) {}
  @MessagePattern({ cmd: SocialCommands.FENCE_ACCOUNT_DELETION }) fence(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'fence');
  }
  @MessagePattern({ cmd: SocialCommands.ERASE_ACCOUNT_DELETION }) erase(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'erase');
  }
  @MessagePattern({ cmd: SocialCommands.READBACK_ACCOUNT_DELETION })
  readback(@Payload() value: unknown) {
    return this.owner.execute(value, 'readback');
  }
}
