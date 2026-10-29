import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentCommands } from '@optimistic-tanuki/constants';
import { PaymentsAccountDeletionOwnerService } from './account-deletion-owner.service';
@Controller()
export class PaymentsAccountDeletionOwnerController {
  constructor(private readonly owner: PaymentsAccountDeletionOwnerService) {}
  @MessagePattern({ cmd: PaymentCommands.FENCE_ACCOUNT_DELETION }) fence(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'fence');
  }
  @MessagePattern({ cmd: PaymentCommands.ERASE_ACCOUNT_DELETION }) erase(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'erase');
  }
  @MessagePattern({ cmd: PaymentCommands.READBACK_ACCOUNT_DELETION })
  readback(@Payload() value: unknown) {
    return this.owner.execute(value, 'readback');
  }
}
