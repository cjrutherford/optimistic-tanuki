import { DataSource, Repository } from 'typeorm';
import { UsageBlockGrantEntity, UsageEventEntity } from '@optimistic-tanuki/billing-data-access';
import {
  TypeOrmUsageBlockRepository,
  TypeOrmUsageEventRepository,
} from './typeorm-billing.repositories';

describe('TypeOrmUsageEventRepository', () => {
  it('persists usage events through the billing database repository', async () => {
    const usageEventRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (event) => event),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<UsageEventEntity>>;
    const dataSource = {
      getRepository: jest.fn(() => usageEventRepository),
    } as unknown as jest.Mocked<DataSource>;
    const repository = new TypeOrmUsageEventRepository(dataSource);
    const event = {
      id: 'event-1',
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      meterId: 'api-calls',
      eventKey: 'evt-1',
      quantity: 5,
      occurredAt: new Date('2026-04-01T00:00:00.000Z'),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    };

    await expect(repository.save(event)).resolves.toBe(event);

    expect(dataSource.getRepository).toHaveBeenCalledWith(UsageEventEntity);
    expect(usageEventRepository.save).toHaveBeenCalledWith(event);
  });
});

describe('TypeOrmUsageBlockRepository', () => {
  it('queries available grants from the billing database repository', async () => {
    const usageBlockRepository = {
      save: jest.fn(),
      find: jest.fn(async () => []),
    } as unknown as jest.Mocked<Repository<UsageBlockGrantEntity>>;
    const dataSource = {
      getRepository: jest.fn(() => usageBlockRepository),
    } as unknown as jest.Mocked<DataSource>;
    const repository = new TypeOrmUsageBlockRepository(dataSource);
    const at = new Date('2026-04-15T00:00:00.000Z');

    await expect(
      repository.findAvailable({
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        accountId: 'acct-1',
        meterId: 'api-calls',
        at,
      }),
    ).resolves.toEqual([]);

    expect(dataSource.getRepository).toHaveBeenCalledWith(UsageBlockGrantEntity);
    expect(usageBlockRepository.find).toHaveBeenCalledWith({
      where: [
        {
          tenantId: 'tenant-1',
          appScope: 'local-hub',
          accountId: 'acct-1',
          meterId: 'api-calls',
          remainingQuantity: expect.any(Object),
          expiresAt: expect.any(Object),
        },
        {
          tenantId: 'tenant-1',
          appScope: 'local-hub',
          accountId: 'acct-1',
          meterId: 'api-calls',
          remainingQuantity: expect.any(Object),
          expiresAt: expect.any(Object),
        },
      ],
      order: {
        expiresAt: 'ASC',
      },
    });
  });
});
