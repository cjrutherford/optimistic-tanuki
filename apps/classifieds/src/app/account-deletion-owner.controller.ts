import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ClassifiedCommands } from '@optimistic-tanuki/constants';
import { ClassifiedsAccountDeletionOwnerService } from './account-deletion-owner.service';
@Controller()
export class ClassifiedsAccountDeletionOwnerController {
  constructor(private readonly owner: ClassifiedsAccountDeletionOwnerService) {}
  @MessagePattern({ cmd: ClassifiedCommands.FENCE_ACCOUNT_DELETION }) fence(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'fence');
  }
  @MessagePattern({ cmd: ClassifiedCommands.ERASE_ACCOUNT_DELETION }) erase(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'erase');
  }
  @MessagePattern({ cmd: ClassifiedCommands.READBACK_ACCOUNT_DELETION })
  readback(@Payload() value: unknown) {
    return this.owner.execute(value, 'readback');
  }
}
