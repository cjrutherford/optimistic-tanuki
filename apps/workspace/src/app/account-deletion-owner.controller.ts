import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WorkspaceCommands } from '@optimistic-tanuki/constants';
import { WorkspaceAccountDeletionOwnerService } from './account-deletion-owner.service';
@Controller()
export class WorkspaceAccountDeletionOwnerController {
  constructor(private readonly owner: WorkspaceAccountDeletionOwnerService) {}
  @MessagePattern({ cmd: WorkspaceCommands.FENCE_ACCOUNT_DELETION }) fence(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'fence');
  }
  @MessagePattern({ cmd: WorkspaceCommands.ERASE_ACCOUNT_DELETION }) erase(
    @Payload() value: unknown
  ) {
    return this.owner.execute(value, 'erase');
  }
  @MessagePattern({ cmd: WorkspaceCommands.READBACK_ACCOUNT_DELETION })
  readback(@Payload() value: unknown) {
    return this.owner.execute(value, 'readback');
  }
}
