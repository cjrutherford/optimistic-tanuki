import { ACCOUNT_DELETION_ENVIRONMENT_COMMAND } from '@optimistic-tanuki/models';
import { ACCOUNT_DELETION_RUNTIME_CUSTODY_COMMAND } from '@optimistic-tanuki/models';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import {
  AccountDeletionGrant,
  ACCOUNT_DELETION_RUNTIME_READBACK_COMMAND,
} from '@optimistic-tanuki/models';
import { AccountDeletionOwnerService } from './account-deletion-owner.service';

@Controller()
export class AccountDeletionOwnerController {
  constructor(private readonly owner: AccountDeletionOwnerService) {}
  @MessagePattern({ cmd: ACCOUNT_DELETION_ENVIRONMENT_COMMAND })
  environment(@Payload() grant: AccountDeletionGrant) {
    return this.owner.runtimeEnvironment(grant);
  }

  @MessagePattern({ cmd: ACCOUNT_DELETION_RUNTIME_CUSTODY_COMMAND })
  custody(
    @Payload()
    value: {
      grant: AccountDeletionGrant;
      probe: { nonce: string; mode: 'write' | 'read' | 'remove' };
    }
  ) {
    return this.owner.runtimeCustody(value?.grant, value?.probe);
  }

  @MessagePattern({ cmd: ACCOUNT_DELETION_RUNTIME_READBACK_COMMAND })
  runtime(@Payload() grant: AccountDeletionGrant) {
    return this.owner.runtimeReadback(grant);
  }
  @MessagePattern({ cmd: AuthCommands.FenceAuthenticationDeletion })
  fence(@Payload() grant: AccountDeletionGrant) {
    return this.owner.fence(grant);
  }
  @MessagePattern({ cmd: AuthCommands.EraseAuthenticationDeletion })
  erase(@Payload() grant: AccountDeletionGrant) {
    return this.owner.erase(grant);
  }
  @MessagePattern({ cmd: AuthCommands.ReadbackAuthenticationDeletion })
  readback(@Payload() grant: AccountDeletionGrant) {
    return this.owner.readback(grant);
  }
}
