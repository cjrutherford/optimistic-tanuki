import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentService } from './services/payment.service';
import { OfferService } from './services/offer.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly offerService: OfferService
  ) {}

  @MessagePattern({ cmd: 'payments.getDonationGoal' })
  async getDonationGoal(@Payload() data: { month: number; year: number }) {
    return this.paymentService.getDonationGoal(data.month, data.year);
  }

  @MessagePattern({ cmd: 'payments.listDonations' })
  async getDonations(@Payload() data: { month: number; year: number }) {
    return this.paymentService.getDonations(data.month, data.year);
  }

  @MessagePattern({ cmd: 'payments.createDonationCheckout' })
  async createDonationCheckout(
    @Payload()
    data: {
      userId: string;
      profileId: string;
      amount: number;
      isRecurring: boolean;
      appScope: string;
    }
  ) {
    return this.paymentService.createDonationCheckout(
      data.userId,
      data.profileId,
      data.amount,
      data.isRecurring,
      data.appScope
    );
  }

  @MessagePattern({ cmd: 'payments.getUserDonations' })
  async getUserDonations(@Payload() data: { userId: string }) {
    return this.paymentService.getUserDonations(data.userId);
  }

  @MessagePattern({ cmd: 'payments.cancelSubscription' })
  async cancelRecurringDonation(
    @Payload() data: { userId: string; subscriptionId: string }
  ) {
    return this.paymentService.cancelSubscription(
      data.userId,
      data.subscriptionId
    );
  }

  @MessagePattern({ cmd: 'payments.createClassifiedPayment' })
  async createClassifiedPayment(
    @Payload()
    data: {
      buyerId: string;
      profileId: string;
      classifiedId: string;
      paymentMethod: string;
      appScope: string;
    }
  ) {
    return this.paymentService.createClassifiedPayment(
      data.buyerId,
      data.classifiedId,
      data.paymentMethod
    );
  }

  @MessagePattern({ cmd: 'payments.confirmOutOfPlatformPayment' })
  async confirmOutOfPlatformPayment(
    @Payload()
    data: {
      paymentId: string;
      userId: string;
      proofImageUrl?: string;
    }
  ) {
    return this.paymentService.confirmOutOfPlatformPayment(
      data.paymentId,
      data.proofImageUrl
    );
  }

  @MessagePattern({ cmd: 'payments.releaseFunds' })
  async releaseFunds(@Payload() data: { paymentId: string; sellerId: string }) {
    return this.paymentService.releaseFunds(data.paymentId);
  }

  @MessagePattern({ cmd: 'payments.disputePayment' })
  async disputePayment(
    @Payload() data: { paymentId: string; userId: string; reason: string }
  ) {
    return this.paymentService.disputePayment(data.paymentId, data.reason);
  }

  @MessagePattern({ cmd: 'payments.getPayment' })
  async getPayment(@Payload() data: { paymentId: string }) {
    return this.paymentService.getPayment(data.paymentId);
  }

  @MessagePattern({ cmd: 'payments.getUserPayments' })
  async getUserPayments(@Payload() data: { userId: string }) {
    return this.paymentService.getUserPayments(data.userId);
  }

  @MessagePattern({ cmd: 'payments.markInterestedBuyer' })
  async markInterestedBuyer(
    @Payload() data: { paymentId: string; interestedBuyerId: string }
  ) {
    return this.paymentService.markInterestedBuyer(
      data.paymentId,
      data.interestedBuyerId
    );
  }

  @MessagePattern({ cmd: 'payments.markPaidOutsidePlatform' })
  async markPaidOutsidePlatform(@Payload() data: { paymentId: string }) {
    return this.paymentService.markPaidOutsidePlatform(data.paymentId);
  }

  @MessagePattern({ cmd: 'payments.createBusinessCheckout' })
  async createBusinessCheckout(
    @Payload()
    data: {
      userId: string;
      communityId: string;
      tier: string;
      appScope: string;
    }
  ) {
    return this.paymentService.createBusinessCheckout(
      data.userId,
      data.communityId,
      data.tier,
      data.appScope
    );
  }

  @MessagePattern({ cmd: 'payments.getBusinessPage' })
  async getBusinessPage(@Payload() data: { communityId: string }) {
    return this.paymentService.getBusinessPage(data.communityId);
  }

  @MessagePattern({ cmd: 'payments.updateBusinessPage' })
  async updateBusinessPage(
    @Payload()
    data: {
      userId: string;
      communityId: string;
      name?: string;
      description?: string;
      logoUrl?: string;
      website?: string;
      phone?: string;
      email?: string;
      address?: string;
      pinnedPostId?: string;
    }
  ) {
    return this.paymentService.updateBusinessPage(
      data.userId,
      data.communityId,
      {
        name: data.name,
        description: data.description,
        logoUrl: data.logoUrl,
        website: data.website,
        phone: data.phone,
        email: data.email,
        address: data.address,
        pinnedPostId: data.pinnedPostId,
      }
    );
  }

  @MessagePattern({ cmd: 'payments.cancelBusinessSubscription' })
  async cancelBusinessSubscription(
    @Payload() data: { userId: string; communityId: string }
  ) {
    return this.paymentService.cancelBusinessSubscription(
      data.userId,
      data.communityId
    );
  }

  @MessagePattern({ cmd: 'payments.createSponsorshipCheckout' })
  async createSponsorshipCheckout(
    @Payload()
    data: {
      userId: string;
      communityId: string;
      type: string;
      adContent?: string;
      appScope: string;
      months?: number;
      businessPageId?: string;
    }
  ) {
    return this.paymentService.createSponsorshipCheckout(
      data.userId,
      data.communityId,
      data.type,
      data.adContent,
      data.appScope,
      data.months,
      data.businessPageId
    );
  }

  @MessagePattern({ cmd: 'payments.getActiveSponsorships' })
  async getActiveSponsorships(@Payload() data: { communityId: string }) {
    return this.paymentService.getActiveSponsorships(data.communityId);
  }

  @MessagePattern({ cmd: 'payments.getUserSponsorships' })
  async getUserSponsorships(@Payload() data: { userId: string }) {
    return this.paymentService.getUserSponsorships(data.userId);
  }

  @MessagePattern({ cmd: 'payments.getUserTransactions' })
  async getUserTransactions(@Payload() data: { userId: string }) {
    return this.paymentService.getUserTransactions(data.userId);
  }

  @MessagePattern({ cmd: 'payments.getPortalUrl' })
  async getPortalUrl(@Payload() data: { userId: string }) {
    return this.paymentService.getPortalUrl(data.userId);
  }

  @MessagePattern({ cmd: 'payments.createOffer' })
  async createOffer(
    @Payload()
    data: {
      classifiedId: string;
      buyerId: string;
      sellerId: string;
      amount: number;
      message?: string;
    }
  ) {
    return this.offerService.createOffer({
      classifiedId: data.classifiedId,
      buyerId: data.buyerId,
      sellerId: data.sellerId,
      amount: data.amount,
      message: data.message,
    });
  }

  @MessagePattern({ cmd: 'payments.acceptOffer' })
  async acceptOffer(@Payload() data: { offerId: string; sellerId: string }) {
    return this.offerService.acceptOffer(data.offerId, data.sellerId);
  }

  @MessagePattern({ cmd: 'payments.rejectOffer' })
  async rejectOffer(@Payload() data: { offerId: string; sellerId: string }) {
    return this.offerService.rejectOffer(data.offerId, data.sellerId);
  }

  @MessagePattern({ cmd: 'payments.counterOffer' })
  async counterOffer(
    @Payload()
    data: {
      offerId: string;
      sellerId: string;
      counterAmount: number;
      message?: string;
    }
  ) {
    return this.offerService.counterOffer(data.offerId, data.sellerId, {
      counterAmount: data.counterAmount,
      message: data.message,
    });
  }

  @MessagePattern({ cmd: 'payments.withdrawOffer' })
  async withdrawOffer(@Payload() data: { offerId: string; buyerId: string }) {
    return this.offerService.withdrawOffer(data.offerId, data.buyerId);
  }

  @MessagePattern({ cmd: 'payments.getOffersForClassified' })
  async getOffersForClassified(@Payload() data: { classifiedId: string }) {
    return this.offerService.getOffersForClassified(data.classifiedId);
  }

  @MessagePattern({ cmd: 'payments.getUserOffers' })
  async getUserOffers(@Payload() data: { userId: string }) {
    return this.offerService.getUserOffers(data.userId);
  }
}
