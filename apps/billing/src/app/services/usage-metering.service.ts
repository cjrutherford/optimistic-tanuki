import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  BatchRecordUsageDto,
  RecordUsageDto,
  RecordUsageResult,
  UsageSummary,
  UsageSummaryRequest,
} from '@optimistic-tanuki/billing-contracts';
import { assertBillingScope } from '@optimistic-tanuki/billing-domain';
import { InMemoryUsageEventRepository } from './in-memory-billing.repositories';

@Injectable()
export class UsageMeteringService {
  constructor(
    private readonly usageEventRepository: InMemoryUsageEventRepository,
  ) {}

  async recordUsage(input: RecordUsageDto): Promise<RecordUsageResult> {
    const scope = assertBillingScope(input);
    const existing = await this.usageEventRepository.findByEventKey(
      scope.tenantId,
      scope.appScope,
      input.eventKey,
    );

    if (existing) {
      return {
        accepted: false,
        duplicate: true,
        event: existing,
      };
    }

    const now = new Date();
    const event = await this.usageEventRepository.save({
      ...scope,
      id: randomUUID(),
      meterId: input.meterId,
      eventKey: input.eventKey,
      quantity: input.quantity,
      occurredAt: input.occurredAt ?? now,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return {
      accepted: true,
      duplicate: false,
      event,
    };
  }

  async batchRecordUsage(
    input: BatchRecordUsageDto,
  ): Promise<RecordUsageResult[]> {
    const results: RecordUsageResult[] = [];

    for (const event of input.events) {
      results.push(await this.recordUsage(event));
    }

    return results;
  }

  async getUsageSummary(input: UsageSummaryRequest): Promise<UsageSummary> {
    const scope = assertBillingScope(input);
    const events = await this.usageEventRepository.findByMeterAndPeriod({
      ...scope,
      meterId: input.meterId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    });

    return {
      ...scope,
      meterId: input.meterId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      quantity: events.reduce((total, event) => total + event.quantity, 0),
    };
  }
}
