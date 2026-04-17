import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  sellerId: string;
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
    private readonly classifiedPaymentRepository: Repository<ClassifiedPayment>
  ) {}

  async createOffer(dto: CreateOfferDto): Promise<Offer> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_OFFER_EXPIRY_DAYS);

    const offer = this.offerRepository.create({
      classifiedId: dto.classifiedId,
      buyerId: dto.buyerId,
      sellerId: dto.sellerId,
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

    if (offer.sellerId !== sellerId) {
      throw new BadRequestException(
        'You can only accept offers on your own listings'
      );
    }

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
      sellerId: offer.sellerId,
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

    if (offer.sellerId !== sellerId) {
      throw new BadRequestException(
        'You can only reject offers on your own listings'
      );
    }

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

    if (offer.sellerId !== sellerId) {
      throw new BadRequestException(
        'You can only counter offers on your own listings'
      );
    }

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

  async getOffersForClassified(classifiedId: string): Promise<Offer[]> {
    return this.offerRepository.find({
      where: { classifiedId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOffersForBuyer(buyerId: string): Promise<Offer[]> {
    return this.offerRepository.find({
      where: { buyerId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOffersForSeller(sellerId: string): Promise<Offer[]> {
    return this.offerRepository.find({
      where: { sellerId },
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
        id: { $ne: acceptedOfferId } as any,
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
