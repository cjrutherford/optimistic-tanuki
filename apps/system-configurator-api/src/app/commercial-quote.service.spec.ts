import { BadRequestException, ConflictException } from '@nestjs/common';
import type { CommercialQuote } from '@optimistic-tanuki/models';
import { CommercialQuoteEntity } from '../hardware/entities/commercial-quote.entity';
import { SupplierOfferEntity } from '../hardware/entities/supplier-offer.entity';
import { CommercialQuoteService } from './commercial-quote.service';

describe('CommercialQuoteService', () => {
  const now = new Date('2026-09-27T12:00:00.000Z');
  const offer = (overrides: Partial<SupplierOfferEntity> = {}) =>
    ({
      id: 'offer-a',
      vendor: 'CDW',
      sourceChannel: 'live-api',
      sourceId: 'cdw-1',
      sourceSku: 'SKU-1',
      productName: 'Mini PC',
      sourceUrl: null,
      hardwarePartId: null,
      amount: 100,
      currency: 'USD',
      availability: 'in_stock',
      observedAt: new Date('2026-09-25T12:00:00.000Z'),
      ...overrides,
    } as SupplierOfferEntity);
  const request = (overrides = {}) => ({
    tierId: 'tier1',
    items: [{ offerId: 'offer-a', quantity: 2 }],
    monthlyRetainerRevenue: 100,
    monthlyCloudCost: 10,
    monthlySmsCost: 5,
    monthlyNetworkCost: 10,
    idempotencyKey: 'quote-123',
    ...overrides,
  });
  const setup = (offers: SupplierOfferEntity[] = [offer()]) => {
    const offerRepository = {
      find: jest.fn().mockResolvedValue(offers),
    };
    const quoteRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((quote: CommercialQuoteEntity) => quote),
      save: jest.fn(async (quote: CommercialQuoteEntity) => ({
        ...quote,
        id: 'quote-id',
        createdAt: now,
      })),
    };
    const service = new CommercialQuoteService(
      offerRepository as never,
      quoteRepository as never,
      () => new Date(now)
    );
    return { service, offerRepository, quoteRepository };
  };

  it('issues a quote from selected current in-stock USD offers and snapshots pricing', async () => {
    const { service, quoteRepository } = setup();

    const quote: CommercialQuote = await service.issueQuote(request());

    expect(quote.sourceCost).toBe(200);
    expect(quote.currency).toBe('USD');
    expect(quote.validUntil.toISOString()).toBe('2026-10-27T12:00:00.000Z');
    expect(quote.version).toBe('commercial-pricing-v1');
    expect(quote.inputs).toMatchObject({
      tierId: 'tier1',
      sourceOffers: [
        expect.objectContaining({
          offerId: 'offer-a',
          unitAmount: 100,
          quantity: 2,
        }),
      ],
      retainerMargin: expect.objectContaining({ meetsMinimumMargin: true }),
    });
    expect(quote.pricingSnapshot).toMatchObject({
      contingencyPlacement: 'reserve-only',
      outrightPrice: expect.any(Number),
      leases: [
        expect.objectContaining({ termMonths: 24 }),
        expect.objectContaining({ termMonths: 36 }),
      ],
    });
    expect(quoteRepository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate offer IDs and invalid quantities', async () => {
    const { service } = setup();

    await expect(
      service.issueQuote(
        request({
          items: [
            { offerId: 'offer-a', quantity: 1 },
            { offerId: 'offer-a', quantity: 2 },
          ],
        })
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.issueQuote(
        request({ items: [{ offerId: 'offer-a', quantity: 0 }] })
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects stale, unavailable, and non-USD offers', async () => {
    for (const invalidOffer of [
      offer({ observedAt: new Date('2026-09-19T12:00:00.000Z') }),
      offer({ observedAt: new Date('2026-09-28T12:00:00.000Z') }),
      offer({ availability: 'backorder' }),
      offer({ currency: 'CAD' }),
    ]) {
      const { service } = setup([invalidOffer]);
      await expect(service.issueQuote(request())).rejects.toBeInstanceOf(
        BadRequestException
      );
    }
  });

  it('does not issue firm quotes from structured file feed offers', async () => {
    const { service, quoteRepository } = setup([
      offer({ sourceChannel: 'file-import' }),
    ]);

    await expect(service.issueQuote(request())).rejects.toThrow(
      /not verified from a live distributor API/
    );
    expect(quoteRepository.save).not.toHaveBeenCalled();
  });

  it('enforces the minimum 70 percent retainer margin', async () => {
    const { service } = setup();

    await expect(
      service.issueQuote(
        request({
          monthlyCloudCost: 25,
          monthlySmsCost: 3,
          monthlyNetworkCost: 3,
        })
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an existing quote for an identical idempotency retry', async () => {
    const { service, quoteRepository } = setup();
    const first = await service.issueQuote(request());
    quoteRepository.findOne.mockResolvedValueOnce(first);

    const retry = await service.issueQuote(request());

    expect(retry.id).toBe(first.id);
    expect(quoteRepository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects reusing an idempotency key with a different payload', async () => {
    const { service, quoteRepository } = setup();
    const first = await service.issueQuote(request());
    quoteRepository.findOne.mockResolvedValueOnce(first);

    await expect(
      service.issueQuote(request({ monthlyRetainerRevenue: 101 }))
    ).rejects.toBeInstanceOf(ConflictException);
    expect(quoteRepository.save).toHaveBeenCalledTimes(1);
  });

  it('gets an existing quote and rejects unknown quote ids', async () => {
    const { service, quoteRepository } = setup();
    const issued = await service.issueQuote(request());
    quoteRepository.findOne.mockResolvedValueOnce(
      issued as CommercialQuoteEntity
    );

    await expect(service.getQuote(issued.id)).resolves.toMatchObject({
      id: issued.id,
    });
    quoteRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.getQuote('missing')).rejects.toThrow(
      'Commercial quote was not found'
    );
  });

  it('accepts an unexpired quote idempotently and rejects expired or transitioned quotes', async () => {
    const { service, quoteRepository } = setup();
    const issued = await service.issueQuote(request());
    const entity = { ...issued, state: 'issued' } as CommercialQuoteEntity;
    quoteRepository.findOne
      .mockResolvedValueOnce(entity)
      .mockResolvedValueOnce({ ...entity, state: 'accepted' });

    await expect(service.acceptQuote(issued.id)).resolves.toMatchObject({
      state: 'accepted',
    });
    expect(quoteRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: issued.id, state: 'issued' }),
      { state: 'accepted' }
    );

    quoteRepository.findOne.mockResolvedValue({ ...entity, state: 'accepted' });
    await expect(service.acceptQuote(issued.id)).resolves.toMatchObject({
      state: 'accepted',
    });
    expect(quoteRepository.update).toHaveBeenCalledTimes(1);

    quoteRepository.findOne.mockResolvedValue({
      ...entity,
      state: 'withdrawn',
    });
    await expect(service.acceptQuote(issued.id)).rejects.toThrow(
      'cannot be accepted'
    );

    quoteRepository.findOne.mockResolvedValue({
      ...entity,
      validUntil: new Date('2026-09-27T11:59:59.999Z'),
    });
    await expect(service.acceptQuote(issued.id)).rejects.toThrow('expired');
  });
});
