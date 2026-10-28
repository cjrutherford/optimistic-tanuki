import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PermissionCommands } from '@optimistic-tanuki/constants';
import { PermissionsAccountDeletionOwnerService } from './account-deletion-owner.service';
@Controller()
export class PermissionsAccountDeletionOwnerController {
  constructor(private readonly owner: PermissionsAccountDeletionOwnerService) {}
  @MessagePattern({ cmd: PermissionCommands.FENCE_ACCOUNT_DELETION }) fence(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'fence');
  }
  @MessagePattern({ cmd: PermissionCommands.ERASE_ACCOUNT_DELETION }) erase(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'erase');
  }
  @MessagePattern({ cmd: PermissionCommands.READBACK_ACCOUNT_DELETION })
  readback(@Payload() value: unknown) {
    return this.owner.execute(value, 'readback');
  }
}
