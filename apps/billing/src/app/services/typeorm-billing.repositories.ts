import { Inject, Injectable } from '@nestjs/common';
import {
  UsageBlockGrantEntity,
  UsageEventEntity,
} from '@optimistic-tanuki/billing-data-access';
import {
  UsageBlockGrant,
  UsageEvent,
} from '@optimistic-tanuki/billing-contracts';
import { DataSource, IsNull, MoreThan, Raw, Repository } from 'typeorm';
import {
  UsageBlockRepository,
  UsageEventRepository,
} from './billing.repositories';

@Injectable()
export class TypeOrmUsageEventRepository implements UsageEventRepository {
  private readonly events: Repository<UsageEventEntity>;

  constructor(@Inject('BILLING_CONNECTION') dataSource: DataSource) {
    this.events = dataSource.getRepository(UsageEventEntity);
  }

  async findByEventKey(
    tenantId: string,
    appScope: string,
    eventKey: string,
  ): Promise<UsageEvent | undefined> {
    const event = await this.events.findOne({
      where: { tenantId, appScope, eventKey },
    });

    return event ?? undefined;
  }

  async save(event: UsageEvent): Promise<UsageEvent> {
    return this.events.save(event);
  }

  async findByMeterAndPeriod(input: {
    tenantId: string;
    appScope: string;
    meterId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<UsageEvent[]> {
    return this.events.find({
      where: {
        tenantId: input.tenantId,
        appScope: input.appScope,
        meterId: input.meterId,
        occurredAt: Raw(
          (alias) => `${alias} >= :periodStart AND ${alias} < :periodEnd`,
          {
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
          },
        ),
      },
    });
  }
}

@Injectable()
export class TypeOrmUsageBlockRepository implements UsageBlockRepository {
  private readonly grants: Repository<UsageBlockGrantEntity>;

  constructor(@Inject('BILLING_CONNECTION') dataSource: DataSource) {
    this.grants = dataSource.getRepository(UsageBlockGrantEntity);
  }

  async save(grant: UsageBlockGrant): Promise<UsageBlockGrant> {
    return this.grants.save(grant);
  }

  async findAvailable(input: {
    tenantId: string;
    appScope: string;
    accountId: string;
    meterId: string;
    at: Date;
  }): Promise<UsageBlockGrant[]> {
    const commonWhere = {
      tenantId: input.tenantId,
      appScope: input.appScope,
      accountId: input.accountId,
      meterId: input.meterId,
      remainingQuantity: MoreThan(0),
    };

    return this.grants.find({
      where: [
        {
          ...commonWhere,
          expiresAt: MoreThan(input.at),
        },
        {
          ...commonWhere,
          expiresAt: IsNull(),
        },
      ],
      order: {
        expiresAt: 'ASC',
      },
    });
  }
}
