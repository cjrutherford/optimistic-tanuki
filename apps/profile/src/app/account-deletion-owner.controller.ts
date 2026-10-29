import { ProfileAccountDeletionFinalizerService } from './account-deletion-finalizer.service';
import { AccountDeletionGrant } from '@optimistic-tanuki/models';
import { Controller, Optional } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProfileCommands } from '@optimistic-tanuki/profile-contracts';
import { ProfileAccountDeletionOwnerService } from './account-deletion-owner.service';
@Controller()
export class ProfileAccountDeletionOwnerController {
  constructor(
    private readonly owner: ProfileAccountDeletionOwnerService,
    @Optional()
    private readonly finalizer?: ProfileAccountDeletionFinalizerService
  ) {}
  @MessagePattern({ cmd: ProfileCommands.FenceAccountDeletion })
  fence(@Payload() grant: unknown) {
    return this.owner.execute(grant, 'fence');
  }
  @MessagePattern({ cmd: ProfileCommands.EraseAccountDeletion })
  erase(@Payload() grant: unknown) {
    return this.owner.execute(grant, 'erase');
  }
  @MessagePattern({ cmd: ProfileCommands.ReadbackAccountDeletion })
  readback(@Payload() grant: unknown) {
    return this.owner.execute(grant, 'readback');
  }
  @MessagePattern({ cmd: ProfileCommands.FinalizeAccountDeletion })
  finalize(@Payload() grant: AccountDeletionGrant) {
    if (!this.finalizer) throw Error('PROFILE_FINALIZATION_UNAVAILABLE');
    return this.finalizer.finalize(grant);
  }
}
