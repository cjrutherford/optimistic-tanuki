import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  SearchAmazonBusinessOffersDto,
  SupplierOfferSummary,
} from '@optimistic-tanuki/models';
import { AmazonBusinessAdapter } from '../hardware/vendor-api/amazon-business.adapter';
import { SupplierOfferImportService } from './supplier-offer-import.service';

@Injectable()
export class AmazonBusinessLiveSyncService {
  constructor(
    private readonly amazonBusinessAdapter: AmazonBusinessAdapter,
    private readonly supplierOfferImportService: SupplierOfferImportService
  ) {}

  async searchAndPersist(
    input: SearchAmazonBusinessOffersDto
  ): Promise<SupplierOfferSummary[]> {
    if (!this.amazonBusinessAdapter.isConfigured()) {
      throw new ServiceUnavailableException(
        'Amazon Business live sourcing is unavailable until an approved API account is configured.'
      );
    }
    const offers = await this.amazonBusinessAdapter.searchProducts({
      keywords: input.keywords,
      productRegion: 'US',
      locale: 'en-US',
      shippingRegion: 'US',
      ...(input.shippingPostalCode
        ? { shippingPostalCode: input.shippingPostalCode }
        : {}),
    });
    if (!offers.length) return [];

    await this.supplierOfferImportService.recordLiveApiOffers(
      'Amazon Business',
      offers
    );
    const sourceSkus = new Set(offers.map((offer) => offer.sourceSku));
    return (await this.supplierOfferImportService.listRecentOffers()).filter(
      (offer) =>
        offer.vendor === 'Amazon Business' && sourceSkus.has(offer.sourceSku)
    );
  }
}
