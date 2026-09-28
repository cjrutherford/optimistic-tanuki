import { ServiceUnavailableException } from '@nestjs/common';
import { AmazonBusinessLiveSyncService } from './amazon-business-live-sync.service';
import { AmazonBusinessAdapter } from '../hardware/vendor-api/amazon-business.adapter';
import { SupplierOfferImportService } from './supplier-offer-import.service';

describe('AmazonBusinessLiveSyncService', () => {
  const liveOffer = {
    vendor: 'Amazon Business' as const,
    sourceId: 'offer-1',
    sourceSku: 'offer-1',
    productName: 'Business workstation',
    sourceUrl: 'https://www.amazon.com/dp/example',
    hardwarePartId: null,
    amount: 1299.99,
    currency: 'USD',
    availability: 'in_stock' as const,
    observedAt: new Date('2026-09-28T12:00:00.000Z'),
  };

  it('fails closed until an approved Amazon Business account is configured', async () => {
    const adapter = { isConfigured: () => false } as AmazonBusinessAdapter;
    const offers = { recordLiveApiOffers: jest.fn() } as never;
    const service = new AmazonBusinessLiveSyncService(adapter, offers);

    await expect(
      service.searchAndPersist({ keywords: 'business workstation' })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('searches the US Business catalog and persists results as live API observations', async () => {
    const adapter = {
      isConfigured: () => true,
      searchProducts: jest.fn().mockResolvedValue([liveOffer]),
    } as unknown as AmazonBusinessAdapter;
    const persisted = jest
      .fn()
      .mockResolvedValue({ inserted: 1, updated: 0, skipped: 0 });
    const listRecentOffers = jest.fn().mockResolvedValue([
      {
        id: 'uuid-1',
        vendor: 'Amazon Business',
        sourceChannel: 'live-api',
        sourceSku: 'offer-1',
        productName: 'Business workstation',
        sourceUrl: liveOffer.sourceUrl,
        amount: 1299.99,
        currency: 'USD',
        availability: 'in_stock',
        observedAt: liveOffer.observedAt,
      },
    ]);
    const importService = {
      recordLiveApiOffers: persisted,
      listRecentOffers,
    } as unknown as SupplierOfferImportService;
    const service = new AmazonBusinessLiveSyncService(adapter, importService);

    await expect(
      service.searchAndPersist({
        keywords: 'workstation',
        shippingPostalCode: '10001',
      })
    ).resolves.toEqual([
      expect.objectContaining({
        sourceChannel: 'live-api',
        sourceSku: 'offer-1',
      }),
    ]);

    expect(adapter.searchProducts).toHaveBeenCalledWith({
      keywords: 'workstation',
      productRegion: 'US',
      locale: 'en-US',
      shippingRegion: 'US',
      shippingPostalCode: '10001',
    });
    expect(persisted).toHaveBeenCalledWith('Amazon Business', [liveOffer]);
    expect(listRecentOffers).toHaveBeenCalled();
  });
});
