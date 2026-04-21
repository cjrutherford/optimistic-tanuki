import {
  UsageBlockGrant,
  UsageEvent,
} from '@optimistic-tanuki/billing-contracts';

export class InMemoryUsageEventRepository {
  private readonly events: UsageEvent[] = [];

  async findByEventKey(
    tenantId: string,
    appScope: string,
    eventKey: string,
  ): Promise<UsageEvent | undefined> {
    return this.events.find(
      (event) =>
        event.tenantId === tenantId &&
        event.appScope === appScope &&
        event.eventKey === eventKey,
    );
  }

  async save(event: UsageEvent): Promise<UsageEvent> {
    this.events.push(event);
    return event;
  }

  async findByMeterAndPeriod(input: {
    tenantId: string;
    appScope: string;
    meterId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<UsageEvent[]> {
    return this.events.filter(
      (event) =>
        event.tenantId === input.tenantId &&
        event.appScope === input.appScope &&
        event.meterId === input.meterId &&
        event.occurredAt >= input.periodStart &&
        event.occurredAt < input.periodEnd,
    );
  }
}

export class InMemoryUsageBlockRepository {
  private readonly grants: UsageBlockGrant[] = [];

  async save(grant: UsageBlockGrant): Promise<UsageBlockGrant> {
    const existingIndex = this.grants.findIndex(
      (existing) => existing.id === grant.id,
    );

    if (existingIndex >= 0) {
      this.grants[existingIndex] = grant;
      return grant;
    }

    this.grants.push(grant);
    return grant;
  }

  async findAvailable(input: {
    tenantId: string;
    appScope: string;
    accountId: string;
    meterId: string;
    at: Date;
  }): Promise<UsageBlockGrant[]> {
    return this.grants
      .filter(
        (grant) =>
          grant.tenantId === input.tenantId &&
          grant.appScope === input.appScope &&
          grant.accountId === input.accountId &&
          grant.meterId === input.meterId &&
          grant.remainingQuantity > 0 &&
          (!grant.expiresAt || grant.expiresAt > input.at),
      )
      .sort((a, b) => {
        const aTime = a.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }
}
