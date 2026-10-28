import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AccountDeletionOperationEntity } from './account-deletion-operation.entity';
import {
  AccountDeletionReceiptService,
  DeletionReceipt,
} from './account-deletion-receipt.service';
import { AccountDeletionAuthorityService } from './account-deletion-authority.service';
import { AccountDeletionRunnerService } from './account-deletion-runner.service';
import { AppService } from '../app/app.service';

@Controller()
export class AccountDeletionPublicController {
  constructor(
    private readonly auth: AppService,
    private readonly authority: AccountDeletionAuthorityService,
    private readonly receipts: AccountDeletionReceiptService,
    private readonly runner: AccountDeletionRunnerService,
    @Inject('AUTHENTICATION_CONNECTION') private readonly db: DataSource
  ) {}
  @MessagePattern({ cmd: AuthCommands.PreparePublicAccountDeletion })
  async prepare(@Payload() request: unknown) {
    const hasPrior =
      !!request &&
      typeof request === 'object' &&
      Object.prototype.hasOwnProperty.call(request, 'priorReceipt');
    const value = this.input(
      request,
      hasPrior
        ? ['token', 'appId', 'idempotencyKey', 'priorReceipt']
        : ['token', 'appId', 'idempotencyKey']
    );
    const account = await this.session(value);
    let receipt: string;
    try {
      receipt = this.receipts.issue(
        account,
        String(value['appId']),
        randomUUID(),
        String(value['idempotencyKey'])
      );
    } catch {
      this.deny(400);
    }
    if (hasPrior) {
      try {
        const prior = this.receipts.verify(
          value['priorReceipt'],
          value['appId']
        );
        if (this.receipts.matchesAccount(prior, account))
          return { receipt: value['priorReceipt'] };
      } catch {
        /* A new preparation still requires the live session above. */
      }
    }
    return { receipt: receipt! };
  }
  @MessagePattern({ cmd: AuthCommands.AcceptPublicAccountDeletion })
  async accept(@Payload() request: unknown) {
    const value = this.input(request, [
      'token',
      'appId',
      'receipt',
      'confirmation',
    ]);
    if (value['confirmation'] !== 'delete-account') this.deny(400);
    const receipt = this.verify(value),
      account = await this.session(value);
    if (!this.receipts.matchesAccount(receipt, account)) this.deny(409);
    let operation: AccountDeletionOperationEntity;
    try {
      operation = await this.authority.accept(
        account,
        receipt.appId,
        receipt.requestId,
        receipt.operationId
      );
    } catch {
      this.deny(409);
    }
    void this.runner.run(operation!.id).catch(() => undefined);
    return this.publicStatus(receipt);
  }
  @MessagePattern({ cmd: AuthCommands.ReadPublicAccountDeletion })
  async read(@Payload() request: unknown) {
    return this.publicStatus(
      this.verify(this.input(request, ['appId', 'receipt']))
    );
  }
  @MessagePattern({ cmd: AuthCommands.RetryPublicAccountDeletion })
  async retry(@Payload() request: unknown) {
    const receipt = this.verify(this.input(request, ['appId', 'receipt']));
    const status = await this.publicStatus(receipt);
    if (status.state === 'blocked')
      void this.runner.run(receipt.operationId).catch(() => undefined);
    return this.publicStatus(receipt);
  }
  private input(value: unknown, keys: string[]): Record<string, unknown> {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== [...keys].sort().join(',')
    )
      this.deny(400);
    return value as Record<string, unknown>;
  }
  private verify(value: Record<string, unknown>): Readonly<DeletionReceipt> {
    try {
      return this.receipts.verify(value['receipt'], value['appId']);
    } catch {
      this.deny(401);
    }
  }
  private async session(value: Record<string, unknown>): Promise<string> {
    if (
      typeof value['token'] !== 'string' ||
      value['token'].length > 8192 ||
      !['client-interface', 'local-hub'].includes(String(value['appId']))
    )
      this.deny(400);
    const result = await this.auth.validateToken(
      value['token'] as string,
      value['appId'] as string
    );
    if (
      !result.isValid ||
      !result.data?.userId ||
      result.data.appId !== value['appId']
    )
      this.deny(401);
    return result.data.userId;
  }
  private async publicStatus(receipt: Readonly<DeletionReceipt>) {
    const row = await this.db
      .getRepository(AccountDeletionOperationEntity)
      .findOne({
        where: { id: receipt.operationId },
        select: {
          id: true,
          fenceKey: true,
          appId: true,
          idempotencyKey: true,
          state: true,
        },
      });
    if (!row)
      return {
        operationId: receipt.operationId,
        appId: receipt.appId,
        state: 'not-accepted',
        canRetry: false,
        expiresAt: new Date(receipt.expiresAt).toISOString(),
      };
    if (
      row.fenceKey !== receipt.subject ||
      row.appId !== receipt.appId ||
      (row.state !== 'complete' && row.idempotencyKey !== receipt.requestId)
    )
      this.deny(403);
    const status = await this.authority.status(receipt.operationId);
    return {
      operationId: receipt.operationId,
      appId: receipt.appId,
      state: status.state,
      canRetry: status.state === 'blocked',
      expiresAt: new Date(receipt.expiresAt).toISOString(),
    };
  }
  private deny(statusCode: number): never {
    throw new RpcException({
      statusCode,
      message:
        statusCode === 401
          ? 'Deletion receipt or session unavailable'
          : 'Deletion request unavailable',
    });
  }
}
