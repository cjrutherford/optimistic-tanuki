import { SupplierOfferEntity } from '../hardware/entities/supplier-offer.entity';
import { SupplierOfferImportService } from './supplier-offer-import.service';
import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';

type TestOffer = Partial<SupplierOfferEntity> &
  Pick<SupplierOfferEntity, 'vendor' | 'sourceId'>;

function makeFeed(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify([
    {
      provider: 'CDW',
      sku: 'SKU-1',
      productName: 'Server',
      unitWholesaleAmount: '100.00',
      currency: 'USD',
      availability: 'in_stock',
      observedAt: '2026-01-01T00:00:00Z',
      ...overrides,
    },
  ]);
}

function createService(initial: TestOffer[] = []) {
  let stored = initial.map((row) => ({ ...row })) as SupplierOfferEntity[];
  const transactionalFindOne = jest.fn(
    async ({ where }: { where: { vendor: string; sourceId: string } }) =>
      stored.find(
        (row) => row.vendor === where.vendor && row.sourceId === where.sourceId
      ) ?? null
  );
  const transactionalSave = jest.fn(
    async (row: Partial<SupplierOfferEntity>) => {
      const existingIndex = stored.findIndex(
        (candidate) =>
          candidate.vendor === row.vendor && candidate.sourceId === row.sourceId
      );
      const saved = { ...row } as SupplierOfferEntity;
      if (existingIndex === -1) stored.push(saved);
      else stored[existingIndex] = saved;
      return saved;
    }
  );
  const repo = {
    manager: {
      transaction: async <T>(
        work: (manager: { getRepository: () => unknown }) => Promise<T>
      ) => {
        const before = stored.map((row) => ({ ...row }));
        try {
          return await work({
            getRepository: () => ({
              findOne: transactionalFindOne,
              save: transactionalSave,
              create: (row: Partial<SupplierOfferEntity>) => row,
            }),
          });
        } catch (error) {
          stored = before;
          throw error;
        }
      },
    },
  };
  const service = new SupplierOfferImportService(repo as never);
  return {
    service,
    stored: () => stored,
    transactionalFindOne,
    transactionalSave,
  };
}

describe('SupplierOfferImportService', () => {
  it('stores only normalized adapter results with live API provenance', async () => {
    const { service, stored } = createService();
    const observedAt = new Date();

    const result = await service.recordLiveApiOffers('Amazon Business', [
      {
        vendor: 'Amazon Business',
        sourceId: 'offer-live-1',
        sourceSku: 'offer-live-1',
        productName: 'Business workstation',
        sourceUrl: 'https://www.amazon.com/dp/example',
        hardwarePartId: null,
        amount: 1299.99,
        currency: 'usd',
        availability: 'in_stock',
        observedAt,
      },
    ]);

    expect(result).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(stored()[0]).toMatchObject({
      vendor: 'Amazon Business',
      sourceChannel: 'live-api',
      currency: 'USD',
      observedAt,
    });
  });

  it('rejects mismatched or invalid live adapter results before opening a transaction', async () => {
    const { service, stored, transactionalFindOne } = createService();

    await expect(
      service.recordLiveApiOffers('Amazon Business', [
        {
          vendor: 'Dell OEM',
          sourceId: 'offer-1',
          sourceSku: 'sku-1',
          productName: 'Workstation',
          sourceUrl: null,
          hardwarePartId: null,
          amount: 100,
          currency: 'USD',
          availability: 'in_stock',
          observedAt: new Date(),
        },
      ])
    ).rejects.toThrow('vendor must match');

    expect(stored).toHaveLength(0);
    expect(transactionalFindOne).not.toHaveBeenCalled();
  });

  it('lists recent offers with IDs and provenance for owner quote selection', async () => {
    const observedAt = new Date('2026-09-27T12:00:00Z');
    const find = jest.fn().mockResolvedValue([
      {
        id: 'offer-live-1',
        vendor: 'Amazon Business',
        sourceChannel: 'live-api',
        sourceSku: 'ASIN-1',
        productName: 'Business workstation',
        sourceUrl: null,
        amount: '1299.99',
        currency: 'USD',
        availability: 'in_stock',
        observedAt,
      },
    ]);
    const service = new SupplierOfferImportService({ find } as never);

    const offers = await service.listRecentOffers();

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { observedAt: 'DESC', vendor: 'ASC', sourceSku: 'ASC' },
        take: 500,
      })
    );
    const findOptions = find.mock.calls[0][0] as {
      where: { observedAt: unknown };
    };
    expect(findOptions.where.observedAt).toBeInstanceOf(FindOperator);
    expect(offers).toEqual([
      {
        id: 'offer-live-1',
        vendor: 'Amazon Business',
        sourceChannel: 'live-api',
        sourceSku: 'ASIN-1',
        productName: 'Business workstation',
        sourceUrl: null,
        amount: 1299.99,
        currency: 'USD',
        availability: 'in_stock',
        observedAt,
      },
    ]);
  });

  it('treats a repeated feed as a skipped retry', async () => {
    const { service, stored } = createService();

    expect(
      await service.import({
        provider: 'CDW',
        content: makeFeed(),
        format: 'json',
      })
    ).toEqual({
      inserted: 1,
      updated: 0,
      skipped: 0,
    });
    expect(stored()[0].sourceChannel).toBe('file-import');
    expect(
      await service.import({
        provider: 'CDW',
        content: makeFeed(),
        format: 'json',
      })
    ).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
  });

  it('does not let an older observation overwrite a newer offer', async () => {
    const { service, stored } = createService();
    await service.import({
      provider: 'CDW',
      content: makeFeed({ observedAt: '2026-02-01T00:00:00Z' }),
      format: 'json',
    });

    const result = await service.import({
      provider: 'CDW',
      content: makeFeed({
        productName: 'Stale name',
        unitWholesaleAmount: '1.00',
        observedAt: '2026-01-01T00:00:00Z',
      }),
      format: 'json',
    });

    expect(result).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(stored()[0].productName).toBe('Server');
    expect(stored()[0].amount).toBe(100);
    expect(stored()[0].observedAt?.toISOString()).toBe(
      '2026-02-01T00:00:00.000Z'
    );
  });

  it('keeps the same SKU independent across vendors', async () => {
    const { service, stored } = createService();
    await service.import({
      provider: 'CDW',
      content: makeFeed(),
      format: 'json',
    });
    const otherVendor = makeFeed({ provider: 'Dell OEM' });

    const result = await service.import({
      provider: 'Dell OEM',
      content: otherVendor,
      format: 'json',
    });

    expect(result).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(stored().map((offer) => [offer.vendor, offer.sourceId])).toEqual([
      ['CDW', 'SKU-1'],
      ['Dell OEM', 'SKU-1'],
    ]);
  });

  it('validates every row before writing any offers', async () => {
    const { service, stored, transactionalSave } = createService();
    const feed = JSON.stringify([
      JSON.parse(makeFeed())[0],
      { ...JSON.parse(makeFeed())[0], sku: '' },
    ]);

    await expect(
      service.import({ provider: 'CDW', content: feed, format: 'json' })
    ).rejects.toThrow('sku is required');

    expect(stored()).toHaveLength(0);
    expect(transactionalSave).not.toHaveBeenCalled();
  });

  it('rejects a feed containing a different provider', async () => {
    const { service, stored } = createService();

    await expect(
      service.import({
        provider: 'CDW',
        content: makeFeed({ provider: 'Dell OEM' }),
        format: 'json',
      })
    ).rejects.toThrow('Feed provider must match the selected provider');

    expect(stored()).toHaveLength(0);
  });

  it('rejects feeds larger than one mebibyte before parsing or writing', async () => {
    const { service, stored } = createService();

    await expect(
      service.import({
        provider: 'CDW',
        content: 'x'.repeat(1_048_577),
        format: 'json',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(stored()).toHaveLength(0);
  });
});
