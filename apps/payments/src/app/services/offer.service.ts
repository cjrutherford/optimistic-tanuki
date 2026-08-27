import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  ClassifiedCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  Offer,
  OfferStatus,
  DEFAULT_OFFER_EXPIRY_DAYS,
} from '../../entities/offer.entity';
import { ClassifiedPayment } from '../../entities/classified-payment.entity';
import { calculateNetAmount } from '../../app/utils/platform-fee.util';

export interface CreateOfferDto {
  classifiedId: string;
  buyerId: string;
  // Legacy transport payloads may include this field. It is deliberately
  // ignored: seller ownership is derived from the classified service.
  sellerId?: string;
  amount: number;
  message?: string;
}

export interface CounterOfferDto {
  counterAmount: number;
  message?: string;
}

@Injectable()
export class OfferService {
  private readonly logger = new Logger(OfferService.name);

  constructor(
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(ClassifiedPayment)
    private readonly classifiedPaymentRepository: Repository<ClassifiedPayment>,
    @Inject(ServiceTokens.CLASSIFIEDS_SERVICE)
    private readonly classifiedsClient: ClientProxy
  ) {}

  private async findClassifiedSellerId(
    classifiedId: string
  ): Promise<string | null> {
    const classified = await firstValueFrom(
      this.classifiedsClient.send<{ userId?: string }>(
        { cmd: ClassifiedCommands.FIND_BY_ID },
        { id: classifiedId }
      )
    );

    return classified?.userId ?? null;
  }

  private async getClassifiedSellerId(classifiedId: string): Promise<string> {
    const sellerId = await this.findClassifiedSellerId(classifiedId);

    if (!sellerId) {
      throw new NotFoundException('Classified not found');
    }

    return sellerId;
  }

  private async assertClassifiedSeller(
    classifiedId: string,
    callerId: string,
    action: string
  ): Promise<string> {
    const sellerId = await this.getClassifiedSellerId(classifiedId);

    if (sellerId !== callerId) {
      throw new BadRequestException(
        `You can only ${action} on your own listings`
      );
    }

    return sellerId;
  }

  private async findClassifiedIdsForUser(userId: string): Promise<string[]> {
    return firstValueFrom(
      this.classifiedsClient.send<string[]>(
        { cmd: ClassifiedCommands.FIND_BY_USER },
        { userId }
      )
    );
  }

  async createOffer(dto: CreateOfferDto): Promise<Offer> {
    const sellerId = await this.getClassifiedSellerId(dto.classifiedId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_OFFER_EXPIRY_DAYS);

    const offer = this.offerRepository.create({
      classifiedId: dto.classifiedId,
      buyerId: dto.buyerId,
      sellerId,
      offeredAmount: dto.amount,
      message: dto.message,
      status: 'pending',
      expiresAt,
    });

    return this.offerRepository.save(offer);
  }

  async acceptOffer(
    offerId: string,
    sellerId: string
  ): Promise<{ offer: Offer; payment: ClassifiedPayment }> {
    const offer = await this.getOfferById(offerId);
    const canonicalSellerId = await this.assertClassifiedSeller(
      offer.classifiedId,
      sellerId,
      'accept offers'
    );

    if (offer.status !== 'pending' && offer.status !== 'countered') {
      throw new BadRequestException(
        `Cannot accept offer with status: ${offer.status}`
      );
    }

    if (new Date() > offer.expiresAt) {
      offer.status = 'expired';
      await this.offerRepository.save(offer);
      throw new BadRequestException('Offer has expired');
    }

    const feeBreakdown = calculateNetAmount(Number(offer.offeredAmount));

    const payment = this.classifiedPaymentRepository.create({
      classifiedId: offer.classifiedId,
      buyerId: offer.buyerId,
      sellerId: canonicalSellerId,
      offerId: offer.id,
      amount: feeBreakdown.gross,
      platformFeeAmount: feeBreakdown.fee,
      sellerReceivesAmount: feeBreakdown.net,
      status: 'pending',
      paymentMethod: 'card',
    });

    const savedPayment = await this.classifiedPaymentRepository.save(payment);

    offer.status = 'accepted';
    offer.acceptedPaymentId = savedPayment.id;
    await this.offerRepository.save(offer);

    await this.expireOtherOffers(offer.id, offer.classifiedId, offer.buyerId);

    return { offer, payment: savedPayment };
  }

  async rejectOffer(offerId: string, sellerId: string): Promise<Offer> {
    const offer = await this.getOfferById(offerId);
    await this.assertClassifiedSeller(
      offer.classifiedId,
      sellerId,
      'reject offers'
    );

    if (offer.status !== 'pending' && offer.status !== 'countered') {
      throw new BadRequestException(
        `Cannot reject offer with status: ${offer.status}`
      );
    }

    offer.status = 'rejected';
    return this.offerRepository.save(offer);
  }

  async counterOffer(
    offerId: string,
    sellerId: string,
    dto: CounterOfferDto
  ): Promise<Offer> {
    const offer = await this.getOfferById(offerId);
    await this.assertClassifiedSeller(
      offer.classifiedId,
      sellerId,
      'counter offers'
    );

    if (offer.status !== 'pending' && offer.status !== 'countered') {
      throw new BadRequestException(
        `Cannot counter offer with status: ${offer.status}`
      );
    }

    offer.status = 'countered';
    offer.counterOfferAmount = dto.counterAmount;
    offer.counterMessage = dto.message;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_OFFER_EXPIRY_DAYS);
    offer.expiresAt = expiresAt;

    return this.offerRepository.save(offer);
  }

  async withdrawOffer(offerId: string, buyerId: string): Promise<Offer> {
    const offer = await this.getOfferById(offerId);

    if (offer.buyerId !== buyerId) {
      throw new BadRequestException('You can only withdraw your own offers');
    }

    if (offer.status !== 'pending' && offer.status !== 'countered') {
      throw new BadRequestException(
        `Cannot withdraw offer with status: ${offer.status}`
      );
    }

    offer.status = 'withdrawn';
    return this.offerRepository.save(offer);
  }

  async getOffersForClassified(
    classifiedId: string,
    userId: string
  ): Promise<Offer[]> {
    const sellerId = await this.getClassifiedSellerId(classifiedId);
    const offers = await this.offerRepository.find({
      where: { classifiedId },
      order: { createdAt: 'DESC' },
    });

    if (sellerId === userId) {
      return offers;
    }

    const buyerOffers = offers.filter((offer) => offer.buyerId === userId);
    if (buyerOffers.length > 0) {
      return buyerOffers;
    }

    // A listing can legitimately have no offers yet. Its authoritative owner
    // was already resolved from the classified service above, so only buyers
    // with a persisted payment can receive an empty collection here.
    if (offers.length === 0) {
      const payment = await this.classifiedPaymentRepository.findOne({
        where: { classifiedId },
      });

      if (payment?.buyerId === userId) {
        return [];
      }
    }

    throw new NotFoundException('Classified offers not found');
  }

  async getOffersForBuyer(buyerId: string): Promise<Offer[]> {
    return this.offerRepository.find({
      where: { buyerId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOffersForSeller(sellerId: string): Promise<Offer[]> {
    const classifiedIds = await this.findClassifiedIdsForUser(sellerId);
    if (classifiedIds.length === 0) {
      return [];
    }

    await this.offerRepository.update(
      { classifiedId: In(classifiedIds) },
      { sellerId }
    );
    return this.offerRepository.find({
      where: { classifiedId: In(classifiedIds) },
      order: { createdAt: 'DESC' },
    });
  }

  async getUserOffers(
    userId: string
  ): Promise<{ asBuyer: Offer[]; asSeller: Offer[] }> {
    const [asBuyer, asSeller] = await Promise.all([
      this.getOffersForBuyer(userId),
      this.getOffersForSeller(userId),
    ]);
    return { asBuyer, asSeller };
  }

  async getOfferById(offerId: string): Promise<Offer> {
    const offer = await this.offerRepository.findOne({
      where: { id: offerId },
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return offer;
  }

  private async expireOtherOffers(
    acceptedOfferId: string,
    classifiedId: string,
    buyerId: string
  ): Promise<void> {
    await this.offerRepository.update(
      {
        id: Not(acceptedOfferId),
        classifiedId,
        buyerId,
        status: 'pending',
      },
      { status: 'expired' }
    );
  }

  async checkAndExpireOffers(): Promise<number> {
    const result = await this.offerRepository.update(
      {
        status: 'pending',
        expiresAt: { $lt: new Date() } as any,
      },
      { status: 'expired' }
    );
    return result.affected || 0;
  }
}
