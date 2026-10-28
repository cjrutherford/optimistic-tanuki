import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { deletionIdentityKey } from '@optimistic-tanuki/storage';
import { Repository } from 'typeorm';
import { AccountDeletionOperationEntity } from './account-deletion-operation.entity';

/** Permanent denial uses the immutable account identity, including terminal operations. */
@Injectable()
export class AccountDeletionFenceService {
  constructor(
    @Inject(getRepositoryToken(AccountDeletionOperationEntity))
    private readonly operations: Repository<AccountDeletionOperationEntity>
  ) {}

  async assertActiveAccount(accountId: string): Promise<void> {
    const fenceKey = deletionIdentityKey('account', accountId);
    if (await this.operations.existsBy({ fenceKey })) {
      throw new RpcException('ACCOUNT_DELETION_FENCED');
    }
  }
}
