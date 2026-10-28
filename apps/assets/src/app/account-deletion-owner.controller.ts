import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AssetCommands } from '@optimistic-tanuki/constants';
import { AssetsAccountDeletionOwnerService } from './account-deletion-owner.service';
@Controller()
export class AssetsAccountDeletionOwnerController {
  constructor(private readonly owner: AssetsAccountDeletionOwnerService) {}
  @MessagePattern({ cmd: AssetCommands.FENCE_ACCOUNT_DELETION })
  fence(@Payload() grant: unknown) {
    return this.owner.execute(grant, 'fence');
  }
  @MessagePattern({ cmd: AssetCommands.ERASE_ACCOUNT_DELETION })
  erase(@Payload() grant: unknown) {
    return this.owner.execute(grant, 'erase');
  }
  @MessagePattern({ cmd: AssetCommands.READBACK_ACCOUNT_DELETION })
  readback(@Payload() grant: unknown) {
    return this.owner.execute(grant, 'readback');
  }
}
