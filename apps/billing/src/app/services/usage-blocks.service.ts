import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ConsumeUsageBlockDto,
  ConsumeUsageBlockResult,
  GrantUsageBlockDto,
  GrantUsageBlockResult,
  UsageBlockConsumption,
} from '@optimistic-tanuki/billing-contracts';
import { assertBillingScope } from '@optimistic-tanuki/billing-domain';
import {
  USAGE_BLOCK_REPOSITORY,
  UsageBlockRepository,
} from './billing.repositories';

@Injectable()
export class UsageBlocksService {
  constructor(
    @Inject(USAGE_BLOCK_REPOSITORY)
    private readonly usageBlockRepository: UsageBlockRepository,
  ) {}

  async grantUsageBlock(
    input: GrantUsageBlockDto,
  ): Promise<GrantUsageBlockResult> {
    const scope = assertBillingScope(input);
    const now = new Date();
    const grant = await this.usageBlockRepository.save({
      ...scope,
      id: randomUUID(),
      accountId: input.accountId,
      meterId: input.meterId,
      grantedQuantity: input.quantity,
      remainingQuantity: input.quantity,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    return { grant };
  }

  async consumeUsageBlock(
    input: ConsumeUsageBlockDto,
  ): Promise<ConsumeUsageBlockResult> {
    const scope = assertBillingScope(input);
    const occurredAt = input.occurredAt ?? new Date();
    const available = await this.usageBlockRepository.findAvailable({
      ...scope,
      accountId: input.accountId,
      meterId: input.meterId,
      at: occurredAt,
    });
    const consumptions: UsageBlockConsumption[] = [];
    let remainingToConsume = input.quantity;

    for (const grant of available) {
      if (remainingToConsume <= 0) {
        break;
      }

      const quantity = Math.min(grant.remainingQuantity, remainingToConsume);
      const now = new Date();

      grant.remainingQuantity -= quantity;
      grant.updatedAt = now;
      await this.usageBlockRepository.save(grant);

      consumptions.push({
        ...scope,
        id: randomUUID(),
        grantId: grant.id,
        meterId: grant.meterId,
        quantity,
        createdAt: now,
        updatedAt: now,
      });

      remainingToConsume -= quantity;
    }

    return {
      requestedQuantity: input.quantity,
      consumedQuantity: input.quantity - remainingToConsume,
      unfilledQuantity: remainingToConsume,
      consumptions,
    };
  }

  async getAvailableBalance(input: {
    tenantId: string;
    appScope: string;
    accountId: string;
    meterId: string;
    at?: Date;
  }): Promise<number> {
    const scope = assertBillingScope(input);
    const available = await this.usageBlockRepository.findAvailable({
      ...scope,
      accountId: input.accountId,
      meterId: input.meterId,
      at: input.at ?? new Date(),
    });

    return available.reduce(
      (total, grant) => total + grant.remainingQuantity,
      0,
    );
  }
}
