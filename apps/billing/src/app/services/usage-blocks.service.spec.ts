import { InMemoryUsageBlockRepository } from './in-memory-billing.repositories';
import { UsageBlocksService } from './usage-blocks.service';

describe('UsageBlocksService', () => {
  let repository: InMemoryUsageBlockRepository;
  let service: UsageBlocksService;

  beforeEach(() => {
    repository = new InMemoryUsageBlockRepository();
    service = new UsageBlocksService(repository);
  });

  it('grants prepaid usage blocks with a remaining balance', async () => {
    await expect(
      service.grantUsageBlock({
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        accountId: 'acct-1',
        meterId: 'api-calls',
        quantity: 25,
        expiresAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      grant: {
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        accountId: 'acct-1',
        meterId: 'api-calls',
        grantedQuantity: 25,
        remainingQuantity: 25,
        expiresAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    });
  });

  it('consumes earliest expiring available blocks first', async () => {
    const later = await service.grantUsageBlock({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      accountId: 'acct-1',
      meterId: 'api-calls',
      quantity: 10,
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    const earlier = await service.grantUsageBlock({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      accountId: 'acct-1',
      meterId: 'api-calls',
      quantity: 8,
      expiresAt: new Date('2026-05-01T00:00:00.000Z'),
    });

    await expect(
      service.consumeUsageBlock({
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        accountId: 'acct-1',
        meterId: 'api-calls',
        quantity: 12,
        occurredAt: new Date('2026-04-15T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      requestedQuantity: 12,
      consumedQuantity: 12,
      unfilledQuantity: 0,
      consumptions: [
        { grantId: earlier.grant.id, quantity: 8 },
        { grantId: later.grant.id, quantity: 4 },
      ],
    });

    await expect(
      repository.findAvailable({
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        accountId: 'acct-1',
        meterId: 'api-calls',
        at: new Date('2026-04-15T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject([
      {
        id: later.grant.id,
        remainingQuantity: 6,
      },
    ]);
  });

  it('reports unfilled quantity when prepaid balance is insufficient', async () => {
    await service.grantUsageBlock({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      accountId: 'acct-1',
      meterId: 'api-calls',
      quantity: 5,
    });

    await expect(
      service.consumeUsageBlock({
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        accountId: 'acct-1',
        meterId: 'api-calls',
        quantity: 7,
      }),
    ).resolves.toMatchObject({
      requestedQuantity: 7,
      consumedQuantity: 5,
      unfilledQuantity: 2,
      consumptions: [{ quantity: 5 }],
    });
  });
});
