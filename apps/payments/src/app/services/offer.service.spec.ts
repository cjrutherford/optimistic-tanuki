import { BadRequestException, NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';
import { ClassifiedCommands } from '@optimistic-tanuki/constants';
import { OfferService } from './offer.service';
import { Offer } from '../../entities/offer.entity';
import { ClassifiedPayment } from '../../entities/classified-payment.entity';
import { FindOperator } from 'typeorm';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fixture timestamps, fixed once per run rather than per call.
 *
 * They are relative to the run instead of hardcoded calendar dates: the
 * original 2026-08-09/16 pair meant the fixture expired on 2026-08-16 and every
 * test using it began failing on the 17th, measuring the date the suite ran on
 * rather than the behaviour under test.
 *
 * Sampling `Date.now()` inside `buildOffer` would swap that for a subtler bug —
 * several tests call it twice, once for the stored offer and once for the
 * expected value, and two calls straddling a millisecond boundary produce
 * objects that are no longer `toEqual`. Sampling once keeps the fixture both
 * unexpired and comparable.
 */
const FIXTURE_NOW = Date.now();
const OFFER_CREATED_AT = new Date(FIXTURE_NOW - 1 * DAY_MS);
const OFFER_EXPIRES_AT = new Date(FIXTURE_NOW + 7 * DAY_MS);

/** A pending offer that has not expired. Pass `expiresAt` to get one that has. */
function buildOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-1',
    classifiedId: 'classified-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    offeredAmount: 50,
    status: 'pending',
    message: null,
    counterOfferAmount: null,
    counterMessage: null,
    expiresAt: OFFER_EXPIRES_AT,
    acceptedPaymentId: null,
    createdAt: OFFER_CREATED_AT,
    updatedAt: OFFER_CREATED_AT,
    ...overrides,
  } as Offer;
}

function createService(
  offers: Offer[],
  payment: Partial<ClassifiedPayment> | null = null,
  classified:
    | { id?: string; userId?: string; profileId?: string }
    | ((classifiedId: string) => { id?: string; userId?: string } | null)
    | null = {
    id: 'classified-1',
    userId: 'seller-1',
    profileId: 'seller-profile-1',
  },
  ownedClassifiedIds: string[] = []
) {
  const offerRepository = {
    find: jest.fn(async ({ where = {} }: { where?: Partial<Offer> }) => {
      if (where.buyerId) {
        return offers.filter((offer) => offer.buyerId === where.buyerId);
      }
      if (where.sellerId) {
        return offers.filter((offer) => offer.sellerId === where.sellerId);
      }
      if (where.classifiedId) {
        const value = where.classifiedId as any;
        const ids = Array.isArray(value.value)
          ? value.value
          : [value as string];
        return offers.filter((offer) => ids.includes(offer.classifiedId));
      }
      return offers;
    }),
    findOne: jest.fn(async () => null),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const classifiedPaymentRepository = {
    findOne: jest.fn(async () => payment),
    create: jest.fn(),
    save: jest.fn(),
  };
  const classifiedsClient = {
    send: jest.fn((pattern, data: { id?: string }) => {
      if (pattern.cmd === ClassifiedCommands.FIND_BY_USER) {
        return of(ownedClassifiedIds);
      }
      return of(
        typeof classified === 'function' ? classified(data.id!) : classified
      );
    }),
  };

  return {
    service: new (OfferService as unknown as new (
      offerRepository: unknown,
      classifiedPaymentRepository: unknown,
      classifiedsClient: unknown
    ) => OfferService)(
      offerRepository,
      classifiedPaymentRepository,
      classifiedsClient
    ),
    offerRepository,
    classifiedPaymentRepository,
    classifiedsClient,
  };
}

describe('OfferService classified offer authorization', () => {
  const competingOffer = buildOffer({ id: 'offer-2', buyerId: 'buyer-2' });

  it('derives an offer seller from the classified rather than the caller payload', async () => {
    const { service, offerRepository, classifiedsClient } = createService([]);

    await service.createOffer({
      classifiedId: 'classified-1',
      buyerId: 'buyer-1',
      sellerId: 'forged-seller',
      amount: 50,
    });

    expect(classifiedsClient.send).toHaveBeenCalledWith(
      { cmd: ClassifiedCommands.FIND_BY_ID },
      { id: 'classified-1' }
    );
    expect(offerRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: 'seller-1' })
    );
  });

  it.each([
    [
      'acceptOffer',
      (service: OfferService) =>
        service.acceptOffer('offer-1', 'forged-seller'),
    ],
    [
      'rejectOffer',
      (service: OfferService) =>
        service.rejectOffer('offer-1', 'forged-seller'),
    ],
    [
      'counterOffer',
      (service: OfferService) =>
        service.counterOffer('offer-1', 'forged-seller', { counterAmount: 45 }),
    ],
  ])('rejects a forged legacy seller for %s', async (_action, invoke) => {
    const offer = buildOffer({ sellerId: 'forged-seller' });
    const { service, offerRepository, classifiedPaymentRepository } =
      createService([offer], null, { userId: 'seller-1' });
    offerRepository.findOne.mockResolvedValue(offer);

    await expect(invoke(service)).rejects.toBeInstanceOf(BadRequestException);
    expect(offerRepository.save).not.toHaveBeenCalled();
    expect(classifiedPaymentRepository.save).not.toHaveBeenCalled();
  });

  it('accepts a canonical seller and persists that seller on the resulting payment', async () => {
    const offer = buildOffer({ sellerId: 'forged-seller' });
    const { service, offerRepository, classifiedPaymentRepository } =
      createService([offer], null, { userId: 'seller-1' });
    offerRepository.findOne.mockResolvedValue(offer);
    offerRepository.save.mockImplementation(async (input) => input);
    classifiedPaymentRepository.create.mockImplementation((input) => input);
    classifiedPaymentRepository.save.mockResolvedValue({ id: 'payment-1' });

    await expect(service.acceptOffer('offer-1', 'seller-1')).resolves.toEqual(
      expect.objectContaining({ offer })
    );
    expect(classifiedPaymentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: 'seller-1' })
    );
    expect(offerRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(FindOperator),
        classifiedId: 'classified-1',
        buyerId: 'buyer-1',
        status: 'pending',
      }),
      { status: 'expired' }
    );
    const siblingExpiryCriteria = offerRepository.update.mock.calls[0][0];
    expect(siblingExpiryCriteria.id.type).toBe('not');
    expect(siblingExpiryCriteria.id.value).toBe('offer-1');
    expect(siblingExpiryCriteria.id).not.toHaveProperty('$ne');
  });

  it('does not grant listing-seller reads to the seller recorded in a forged offer', async () => {
    const forgedOffer = buildOffer({ sellerId: 'forged-seller' });
    const { service } = createService([forgedOffer]);

    await expect(
      service.getOffersForClassified('classified-1', 'forged-seller')
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('grants listing-seller reads to the owner recorded by the classified service', async () => {
    const forgedOffer = buildOffer({ sellerId: 'forged-seller' });
    const { service } = createService([forgedOffer]);

    await expect(
      service.getOffersForClassified('classified-1', 'seller-1')
    ).resolves.toEqual([forgedOffer]);
  });

  it('includes canonical-owner legacy rows while excluding forged seller rows from a user collection', async () => {
    const buyerOffer = buildOffer({
      id: 'buyer-offer',
      classifiedId: 'classified-buyer',
      buyerId: 'user-1',
      sellerId: 'someone-else',
    });
    const forgedSellerOffer = buildOffer({
      id: 'forged-offer',
      classifiedId: 'classified-forged',
      buyerId: 'buyer-2',
      sellerId: 'user-1',
    });
    const canonicalSellerOffer = buildOffer({
      id: 'canonical-offer-1',
      classifiedId: 'classified-owned',
      buyerId: 'buyer-3',
      sellerId: 'stale-seller',
    });
    const secondCanonicalSellerOffer = buildOffer({
      id: 'canonical-offer-2',
      classifiedId: 'classified-owned',
      buyerId: 'buyer-4',
      sellerId: 'user-1',
    });
    const { service, classifiedsClient, offerRepository } = createService(
      [
        buyerOffer,
        forgedSellerOffer,
        canonicalSellerOffer,
        secondCanonicalSellerOffer,
      ],
      null,
      (classifiedId) =>
        classifiedId === 'classified-owned'
          ? { userId: 'user-1' }
          : { userId: 'other-user' },
      ['classified-owned']
    );

    await expect(service.getUserOffers('user-1')).resolves.toEqual({
      asBuyer: [buyerOffer],
      asSeller: [canonicalSellerOffer, secondCanonicalSellerOffer],
    });
    expect(offerRepository.find).toHaveBeenCalledWith({
      where: { buyerId: 'user-1' },
      order: { createdAt: 'DESC' },
    });
    expect(offerRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ classifiedId: expect.anything() }),
      })
    );
    expect(classifiedsClient.send).toHaveBeenCalledWith(
      { cmd: ClassifiedCommands.FIND_BY_USER },
      { userId: 'user-1' }
    );
  });

  it('returns every offer only to the listing seller', async () => {
    const { service } = createService([buildOffer(), competingOffer]);

    await expect(
      service.getOffersForClassified('classified-1', 'seller-1')
    ).resolves.toEqual([buildOffer(), competingOffer]);
  });

  it('returns an empty collection to the classified owner before any offers exist', async () => {
    const { service } = createService([], { sellerId: 'seller-1' });

    await expect(
      service.getOffersForClassified('classified-1', 'seller-1')
    ).resolves.toEqual([]);
  });

  it('returns only the requesting buyer offers and never competitors', async () => {
    const ownOffer = buildOffer();
    const { service } = createService([ownOffer, competingOffer]);

    await expect(
      service.getOffersForClassified('classified-1', 'buyer-1')
    ).resolves.toEqual([ownOffer]);
  });

  it('does not disclose whether a classified has offers to unrelated users', async () => {
    const { service } = createService([buildOffer(), competingOffer]);

    await expect(
      service.getOffersForClassified('classified-1', 'stranger')
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
