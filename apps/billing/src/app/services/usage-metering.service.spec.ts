import { InMemoryUsageEventRepository } from './in-memory-billing.repositories';
import { UsageMeteringService } from './usage-metering.service';

describe('UsageMeteringService', () => {
  let service: UsageMeteringService;

  beforeEach(() => {
    service = new UsageMeteringService(new InMemoryUsageEventRepository());
  });

  it('records usage events once by tenant, app scope, and event key', async () => {
    const first = await service.recordUsage({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      meterId: 'api-calls',
      eventKey: 'evt-1',
      quantity: 5,
      occurredAt: new Date('2026-04-01T12:00:00.000Z'),
    });

    const second = await service.recordUsage({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      meterId: 'api-calls',
      eventKey: 'evt-1',
      quantity: 7,
      occurredAt: new Date('2026-04-01T12:01:00.000Z'),
    });

    expect(first).toMatchObject({
      accepted: true,
      duplicate: false,
      event: {
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        meterId: 'api-calls',
        eventKey: 'evt-1',
        quantity: 5,
      },
    });
    expect(second).toMatchObject({
      accepted: false,
      duplicate: true,
      event: {
        id: first.event.id,
        quantity: 5,
      },
    });
  });

  it('aggregates usage summaries inside the requested period', async () => {
    await service.batchRecordUsage({
      events: [
        {
          tenantId: 'tenant-1',
          appScope: 'local-hub',
          meterId: 'api-calls',
          eventKey: 'before-period',
          quantity: 100,
          occurredAt: new Date('2026-03-31T23:59:59.000Z'),
        },
        {
          tenantId: 'tenant-1',
          appScope: 'local-hub',
          meterId: 'api-calls',
          eventKey: 'inside-1',
          quantity: 3,
          occurredAt: new Date('2026-04-01T00:00:00.000Z'),
        },
        {
          tenantId: 'tenant-1',
          appScope: 'local-hub',
          meterId: 'api-calls',
          eventKey: 'inside-2',
          quantity: 4,
          occurredAt: new Date('2026-04-15T00:00:00.000Z'),
        },
        {
          tenantId: 'tenant-1',
          appScope: 'local-hub',
          meterId: 'api-calls',
          eventKey: 'period-end-exclusive',
          quantity: 100,
          occurredAt: new Date('2026-05-01T00:00:00.000Z'),
        },
      ],
    });

    await service.recordUsage({
      tenantId: 'tenant-1',
      appScope: 'store',
      meterId: 'api-calls',
      eventKey: 'other-scope',
      quantity: 100,
      occurredAt: new Date('2026-04-15T00:00:00.000Z'),
    });

    await expect(
      service.getUsageSummary({
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        meterId: 'api-calls',
        periodStart: new Date('2026-04-01T00:00:00.000Z'),
        periodEnd: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      meterId: 'api-calls',
      quantity: 7,
    });
  });
});
