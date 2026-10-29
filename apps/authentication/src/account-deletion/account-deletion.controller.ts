import { AccountDeletionRunnerService } from './account-deletion-runner.service';
import { Controller, Optional } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import {
  AccountDeletionGrant,
  AccountDeletionIdentityDomains,
} from '@optimistic-tanuki/models';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { AppService } from '../app/app.service';
import { AccountDeletionAuthorityService } from './account-deletion-authority.service';

@Controller()
export class AccountDeletionController {
  constructor(
    private readonly auth: AppService,
    private readonly authority: AccountDeletionAuthorityService,
    @Optional() private readonly runner?: AccountDeletionRunnerService
  ) {}

  @MessagePattern({ cmd: AuthCommands.CreateAccountDeletionOperation })
  async create(@Payload() request: unknown) {
    if (!request || typeof request !== 'object' || Array.isArray(request))
      throw new RpcException('ACCOUNT_DELETION_REQUEST_INVALID');
    const value = request as Record<string, unknown>;
    if (
      Object.keys(value).some(
        (key) =>
          !['token', 'appId', 'idempotencyKey', 'confirmation'].includes(key)
      ) ||
      typeof value['token'] !== 'string' ||
      typeof value['appId'] !== 'string' ||
      typeof value['idempotencyKey'] !== 'string' ||
      value['confirmation'] !== 'delete-account'
    )
      throw new RpcException('ACCOUNT_DELETION_REQUEST_INVALID');
    const session = await this.auth.validateToken(
      value['token'],
      value['appId']
    );
    if (
      !session.isValid ||
      typeof session.data?.userId !== 'string' ||
      session.data.appId !== value['appId']
    )
      throw new RpcException('ACCOUNT_DELETION_SESSION_INVALID');
    const operation = await this.authority.accept(
      session.data.userId,
      value['appId'],
      value['idempotencyKey']
    );
    if (this.runner) void this.runner.run(operation.id).catch(() => {});
    return this.authority.status(operation.id);
  }

  @MessagePattern({ cmd: AuthCommands.RecordAccountDeletionProfileScope })
  async recordScope(
    @Payload()
    value: {
      grant: AccountDeletionGrant;
      scope: AccountDeletionIdentityDomains;
    }
  ) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'grant,scope'
    )
      throw new RpcException('ACCOUNT_DELETION_SCOPE_INVALID');
    await this.authority.recordProfileScope(value.grant, value.scope);
    return {
      recorded: true,
      operationId: value.grant.operationId,
      attempt: value.grant.attempt,
      profileCount: value.scope.currentProfileIds.length,
      legacyCount: value.scope.legacyProfileIds.length,
    };
  }

  // Internal owner boundary: authority checks current ledger lease and signed owner/action.
  @MessagePattern({ cmd: AuthCommands.ValidateAccountDeletionGrant })
  validate(@Payload() grant: unknown) {
    return this.authority.validateGrant(grant);
  }
}
