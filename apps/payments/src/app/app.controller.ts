import { Controller, Logger, Inject } from '@nestjs/common';
import { PaymentCommands } from '@optimistic-tanuki/constants';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentService } from './services/payment.service';
import { BusinessThemeService } from './services/business-theme.service';
import { OfferService } from './services/offer.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    @Inject(PaymentService)
    private readonly paymentService: PaymentService,
    @Inject(BusinessThemeService)
    private readonly businessThemeService: BusinessThemeService,
    @Inject(OfferService)
    private readonly offerService: OfferService
  ) { }

  @MessagePattern({ cmd: PaymentCommands.GET_DONATION_GOAL })
  async getDonationGoal(@Payload() data: { month: number; year: number }) {
    return this.paymentService.getDonationGoal(data.month, data.year);
  }

  @MessagePattern({ cmd: PaymentCommands.LIST_DONATIONS })
  async getDonations(@Payload() data: { month: number; year: number }) {
    return this.paymentService.getDonations(data.month, data.year);
  }

  @MessagePattern({ cmd: PaymentCommands.CREATE_DONATION_CHECKOUT })
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

  @MessagePattern({ cmd: PaymentCommands.GET_USER_DONATIONS })
  async getUserDonations(@Payload() data: { userId: string }) {
    return this.paymentService.getUserDonations(data.userId);
  }

  @MessagePattern({ cmd: PaymentCommands.CANCEL_SUBSCRIPTION })
  async cancelRecurringDonation(
    @Payload() data: { userId: string; subscriptionId: string }
  ) {
    return this.paymentService.cancelSubscription(
      data.userId,
      data.subscriptionId
    );
  }

  @MessagePattern({ cmd: PaymentCommands.CREATE_CLASSIFIED_PAYMENT })
  async createClassifiedPayment(
    @Payload()
    data: {
      buyerId: string;
      profileId: string;
      classifiedId: string;
      paymentMethod: string;
      appScope: string;
      sellerId?: string;
      amount?: number;
    }
  ) {
    return this.paymentService.createClassifiedPayment(
      data.buyerId,
      data.classifiedId,
      data.paymentMethod,
      data.amount,
      data.sellerId
    );
  }

  @MessagePattern({ cmd: PaymentCommands.CONFIRM_OUT_OF_PLATFORM_PAYMENT })
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

  @MessagePattern({ cmd: PaymentCommands.RELEASE_FUNDS })
  async releaseFunds(@Payload() data: { paymentId: string; sellerId: string }) {
    return this.paymentService.releaseFunds(data.paymentId);
  }

  @MessagePattern({ cmd: PaymentCommands.DISPUTE_PAYMENT })
  async disputePayment(
    @Payload() data: { paymentId: string; userId: string; reason: string }
  ) {
    return this.paymentService.disputePayment(data.paymentId, data.reason);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_PAYMENT })
  async getPayment(@Payload() data: { paymentId: string }) {
    return this.paymentService.getPayment(data.paymentId);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_USER_PAYMENTS })
  async getUserPayments(@Payload() data: { userId: string }) {
    return this.paymentService.getUserPayments(data.userId);
  }

  @MessagePattern({ cmd: PaymentCommands.MARK_INTERESTED_BUYER })
  async markInterestedBuyer(
    @Payload() data: { paymentId: string; interestedBuyerId: string }
  ) {
    return this.paymentService.markInterestedBuyer(
      data.paymentId,
      data.interestedBuyerId
    );
  }

  @MessagePattern({ cmd: PaymentCommands.MARK_PAID_OUTSIDE_PLATFORM })
  async markPaidOutsidePlatform(@Payload() data: { paymentId: string }) {
    return this.paymentService.markPaidOutsidePlatform(data.paymentId);
  }

  @MessagePattern({ cmd: PaymentCommands.CREATE_BUSINESS_CHECKOUT })
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

  @MessagePattern({ cmd: PaymentCommands.GET_BUSINESS_PAGE })
  async getBusinessPage(@Payload() data: { communityId: string }) {
    return this.paymentService.getBusinessPage(data.communityId);
  }

  @MessagePattern({ cmd: PaymentCommands.UPDATE_BUSINESS_PAGE })
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

  @MessagePattern({ cmd: PaymentCommands.CANCEL_BUSINESS_SUBSCRIPTION })
  async cancelBusinessSubscription(
    @Payload() data: { userId: string; communityId: string }
  ) {
    return this.paymentService.cancelBusinessSubscription(
      data.userId,
      data.communityId
    );
  }

  @MessagePattern({ cmd: PaymentCommands.CREATE_SPONSORSHIP_CHECKOUT })
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

  @MessagePattern({ cmd: PaymentCommands.GET_ACTIVE_SPONSORSHIPS })
  async getActiveSponsorships(@Payload() data: { communityId: string }) {
    return this.paymentService.getActiveSponsorships(data.communityId);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_USER_SPONSORSHIPS })
  async getUserSponsorships(@Payload() data: { userId: string }) {
    return this.paymentService.getUserSponsorships(data.userId);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_USER_TRANSACTIONS })
  async getUserTransactions(@Payload() data: { userId: string }) {
    return this.paymentService.getUserTransactions(data.userId);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_PORTAL_URL })
  async getPortalUrl(@Payload() data: { userId: string }) {
    return this.paymentService.getPortalUrl(data.userId);
  }

  @MessagePattern({ cmd: PaymentCommands.CREATE_OFFER })
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

  @MessagePattern({ cmd: PaymentCommands.ACCEPT_OFFER })
  async acceptOffer(@Payload() data: { offerId: string; sellerId: string }) {
    return this.offerService.acceptOffer(data.offerId, data.sellerId);
  }

  @MessagePattern({ cmd: PaymentCommands.REJECT_OFFER })
  async rejectOffer(@Payload() data: { offerId: string; sellerId: string }) {
    return this.offerService.rejectOffer(data.offerId, data.sellerId);
  }

  @MessagePattern({ cmd: PaymentCommands.COUNTER_OFFER })
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

  @MessagePattern({ cmd: PaymentCommands.WITHDRAW_OFFER })
  async withdrawOffer(@Payload() data: { offerId: string; buyerId: string }) {
    return this.offerService.withdrawOffer(data.offerId, data.buyerId);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_OFFERS_FOR_CLASSIFIED })
  async getOffersForClassified(@Payload() data: { classifiedId: string }) {
    return this.offerService.getOffersForClassified(data.classifiedId);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_USER_OFFERS })
  async getUserOffers(@Payload() data: { userId: string }) {
    return this.offerService.getUserOffers(data.userId);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_SELLER_WALLET })
  async getSellerWallet(@Payload() data: { sellerId: string }) {
    return this.paymentService.getSellerWallet(data.sellerId);
  }

  @MessagePattern({ cmd: PaymentCommands.UPDATE_SELLER_PAYOUT_INFO })
  async updateSellerPayoutInfo(
    @Payload()
    data: {
      sellerId: string;
      payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle';
      payoutEmail?: string;
      bankAccountLast4?: string;
      bankRoutingLast4?: string;
    }
  ) {
    return this.paymentService.updateSellerPayoutInfo(
      data.sellerId,
      data.payoutMethod,
      data.payoutEmail,
      data.bankAccountLast4,
      data.bankRoutingLast4
    );
  }

  @MessagePattern({ cmd: PaymentCommands.CREATE_PAYOUT_REQUEST })
  async createPayoutRequest(
    @Payload()
    data: {
      sellerId: string;
      amount: number;
      payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle';
      payoutEmail?: string;
      bankAccountLast4?: string;
      bankRoutingLast4?: string;
    }
  ) {
    return this.paymentService.createPayoutRequest(
      data.sellerId,
      data.amount,
      data.payoutMethod,
      data.payoutEmail,
      data.bankAccountLast4,
      data.bankRoutingLast4
    );
  }

  @MessagePattern({ cmd: PaymentCommands.GET_SELLER_PAYOUT_REQUESTS })
  async getSellerPayoutRequests(@Payload() data: { sellerId: string }) {
    return this.paymentService.getSellerPayoutRequests(data.sellerId);
  }

  @MessagePattern({ cmd: PaymentCommands.CANCEL_PAYOUT_REQUEST })
  async cancelPayoutRequest(
    @Payload() data: { payoutRequestId: string; sellerId: string }
  ) {
    return this.paymentService.cancelPayoutRequest(
      data.payoutRequestId,
      data.sellerId
    );
  }

  @MessagePattern({ cmd: PaymentCommands.GET_SELLER_EARNINGS_SUMMARY })
  async getSellerEarningsSummary(@Payload() data: { sellerId: string }) {
    return this.paymentService.getSellerEarningsSummary(data.sellerId);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_BUSINESS_PAGES_BY_CITY })
  async getBusinessPagesByCity(
    @Payload() data: { cityId: string; communityIds: string[] }
  ) {
    return this.paymentService.getBusinessPagesByCity(
      data.cityId,
      data.communityIds || []
    );
  }

  @MessagePattern({ cmd: PaymentCommands.CREATE_BUSINESS_THEME })
  async createBusinessTheme(
    @Payload()
    data: {
      businessPageId: string;
      personalityId?: string;
      primaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
      customCss?: string;
      customFontFamily?: string;
    }
  ) {
    return this.businessThemeService.createTheme(data.businessPageId, {
      personalityId: data.personalityId,
      primaryColor: data.primaryColor,
      accentColor: data.accentColor,
      backgroundColor: data.backgroundColor,
      customCss: data.customCss,
      customFontFamily: data.customFontFamily,
    });
  }

  @MessagePattern({ cmd: PaymentCommands.GET_BUSINESS_THEME })
  async getBusinessTheme(@Payload() data: { businessPageId: string }) {
    return this.businessThemeService.getThemeByBusinessPageId(
      data.businessPageId
    );
  }

  @MessagePattern({ cmd: PaymentCommands.UPDATE_BUSINESS_THEME })
  async updateBusinessTheme(
    @Payload()
    data: {
      themeId: string;
      personalityId?: string;
      primaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
      customCss?: string;
      customFontFamily?: string;
    }
  ) {
    return this.businessThemeService.updateTheme(data.themeId, {
      personalityId: data.personalityId,
      primaryColor: data.primaryColor,
      accentColor: data.accentColor,
      backgroundColor: data.backgroundColor,
      customCss: data.customCss,
      customFontFamily: data.customFontFamily,
    });
  }

  @MessagePattern({ cmd: PaymentCommands.PROCESS_WEBHOOK })
  async processWebhook(
    @Payload() data: { eventType: string; data: Record<string, unknown> }
  ) {
    return this.paymentService.processWebhook(data.eventType, data.data);
  }
}
