import { validateSync } from 'class-validator';
import {
  AcceptCommercialQuoteDto,
  CommercialQuoteItemDto,
  CreateSupplierOfferDto,
  ImportSupplierOffersDto,
  IssueCommercialQuoteDto,
} from './commercial-contracts';

describe('CreateSupplierOfferDto', () => {
  const validOffer = (): CreateSupplierOfferDto =>
    Object.assign(new CreateSupplierOfferDto(), {
      vendor: 'CDW',
      sourceId: 'feed-001',
      sourceSku: 'ABC-123',
      productName: 'Enterprise NVMe drive',
      amount: 129.99,
      currency: 'USD',
      availability: 'in_stock',
      observedAt: '2026-09-27T12:00:00.000Z',
    });

  it('accepts the normalized shape from an approved vendor', () => {
    expect(validateSync(validOffer())).toHaveLength(0);
  });

  it('rejects unknown vendors, negative prices, malformed currencies, and unsupported availability', () => {
    const offer = validOffer();
    Object.assign(offer, {
      vendor: 'PCPartPicker',
      amount: -1,
      currency: 'US dollars',
      availability: 'maybe',
    });

    expect(validateSync(offer).map((error) => error.property)).toEqual(
      expect.arrayContaining(['vendor', 'amount', 'currency', 'availability'])
    );
  });
});

describe('commercial operator request DTOs', () => {
  it('accepts a typed quote request and bounded structured feed import', () => {
    const quote = Object.assign(new IssueCommercialQuoteDto(), {
      tierId: 'tier1',
      items: [
        Object.assign(new CommercialQuoteItemDto(), {
          offerId: 'offer-1',
          quantity: 2,
        }),
      ],
      freightAmount: 24.5,
      taxAmount: 70,
      setupHours: 6,
      monthlySupportHours: 2,
      monthlyCloudCost: 50,
      monthlySmsCost: 10,
      monthlyNetworkCost: 20,
      idempotencyKey: 'quote-key-1',
    });
    const feed = Object.assign(new ImportSupplierOffersDto(), {
      provider: 'CDW',
      format: 'json',
      content: '[]',
    });

    expect(validateSync(quote)).toHaveLength(0);
    expect(validateSync(feed)).toHaveLength(0);
  });

  it('rejects malformed quote items, oversized feeds, and invalid quote ids', () => {
    const quote = Object.assign(new IssueCommercialQuoteDto(), {
      tierId: 'tier1',
      items: [
        Object.assign(new CommercialQuoteItemDto(), {
          offerId: '',
          quantity: 0,
        }),
      ],
      freightAmount: -1,
      taxAmount: 0,
      setupHours: -2,
      monthlySupportHours: 0,
      monthlyCloudCost: 0,
      monthlySmsCost: 0,
      monthlyNetworkCost: 0,
      idempotencyKey: '',
    });
    const feed = Object.assign(new ImportSupplierOffersDto(), {
      provider: 'Unknown',
      format: 'xml',
      content: 'x'.repeat(1_048_577),
    });
    const accept = Object.assign(new AcceptCommercialQuoteDto(), {
      quoteId: 'not-a-uuid',
    });

    const quoteErrors = validateSync(quote, { whitelist: true }).map(
      (error) => error.property
    );
    expect(quoteErrors).toEqual(
      expect.arrayContaining(['freightAmount', 'setupHours'])
    );
    expect(validateSync(feed, { whitelist: true }).length).toBeGreaterThan(0);
    expect(validateSync(accept)).toHaveLength(1);
  });
});
