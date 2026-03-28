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
  async getDonationGoal(
    @Payload() data: { month: number; year: number; appScope?: string }
  ) {
    return this.paymentService.getDonationGoal(
      data.month,
      data.year,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.LIST_DONATIONS })
  async getDonations(
    @Payload() data: { month: number; year: number; appScope?: string }
  ) {
    return this.paymentService.getDonations(
      data.month,
      data.year,
      data.appScope
    );
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

  @MessagePattern({ cmd: PaymentCommands.INITIALIZE_DONATION_CHECKOUT })
  async initializeDonationCheckout(
    @Payload()
    data: {
      userId: string;
      profileId: string;
      amount: number;
      isRecurring: boolean;
      appScope: string;
      email?: string;
      name?: string;
    }
  ) {
    return this.paymentService.initializeDonationCheckout(
      data.userId,
      data.profileId,
      data.amount,
      data.isRecurring,
      data.appScope,
      {
        email: data.email,
        name: data.name,
      }
    );
  }

  @MessagePattern({ cmd: PaymentCommands.VALIDATE_DONATION_CHECKOUT })
  async validateDonationCheckout(
    @Payload()
    data: {
      userId: string;
      donationId: string;
      checkoutToken: string;
      response: {
        hash: string;
        data: Record<string, unknown>;
      };
      appScope?: string;
    }
  ) {
    return this.paymentService.validateDonationCheckout(
      data.userId,
      data.donationId,
      data.checkoutToken,
      data.response,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.REFUND_DONATION })
  async refundDonation(
    @Payload()
    data: {
      userId: string;
      donationId: string;
      reason: string;
      appScope?: string;
    }
  ) {
    return this.paymentService.refundDonation(
      data.userId,
      data.donationId,
      data.reason,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.GET_USER_DONATIONS })
  async getUserDonations(
    @Payload() data: { userId: string; appScope?: string }
  ) {
    return this.paymentService.getUserDonations(data.userId, data.appScope);
  }

  @MessagePattern({ cmd: PaymentCommands.CANCEL_SUBSCRIPTION })
  async cancelRecurringDonation(
    @Payload()
    data: { userId: string; subscriptionId: string; appScope?: string }
  ) {
    return this.paymentService.cancelSubscription(
      data.userId,
      data.subscriptionId,
      data.appScope
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
      data.sellerId,
      undefined,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.INITIALIZE_CLASSIFIED_PAYMENT })
  async initializeClassifiedPayment(
    @Payload()
    data: {
      buyerId: string;
      classifiedId: string;
      amount: number;
      appScope?: string;
      sellerId?: string;
      offerId?: string;
    }
  ) {
    return this.paymentService.initializeClassifiedPayment(
      data.buyerId,
      data.classifiedId,
      data.amount,
      data.sellerId,
      data.offerId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.VALIDATE_CLASSIFIED_PAYMENT })
  async validateClassifiedPayment(
    @Payload()
    data: {
      buyerId: string;
      paymentId: string;
      checkoutToken: string;
      response: {
        hash: string;
        data: Record<string, unknown>;
      };
      appScope?: string;
    }
  ) {
    return this.paymentService.validateClassifiedPayment(
      data.buyerId,
      data.paymentId,
      data.checkoutToken,
      data.response,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.CONFIRM_STRIPE_CLASSIFIED_PAYMENT })
  async confirmStripeClassifiedPayment(
    @Payload()
    data: {
      buyerId: string;
      paymentId: string;
      paymentIntentId?: string;
      appScope?: string;
    }
  ) {
    return this.paymentService.confirmStripeClassifiedPayment(
      data.buyerId,
      data.paymentId,
      data.paymentIntentId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.REFUND_CLASSIFIED_PAYMENT })
  async refundClassifiedPayment(
    @Payload()
    data: {
      userId: string;
      paymentId: string;
      reason: string;
      appScope?: string;
    }
  ) {
    return this.paymentService.refundClassifiedPayment(
      data.userId,
      data.paymentId,
      data.reason,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.CONFIRM_OUT_OF_PLATFORM_PAYMENT })
  async confirmOutOfPlatformPayment(
    @Payload()
    data: {
      paymentId: string;
      userId: string;
      proofImageUrl?: string;
      appScope?: string;
    }
  ) {
    return this.paymentService.confirmOutOfPlatformPayment(
      data.paymentId,
      data.proofImageUrl,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.RELEASE_FUNDS })
  async releaseFunds(
    @Payload() data: { paymentId: string; sellerId: string; appScope?: string }
  ) {
    return this.paymentService.releaseFunds(data.paymentId, data.appScope);
  }

  @MessagePattern({ cmd: PaymentCommands.DISPUTE_PAYMENT })
  async disputePayment(
    @Payload()
    data: {
      paymentId: string;
      userId: string;
      reason: string;
      appScope?: string;
    }
  ) {
    return this.paymentService.disputePayment(
      data.paymentId,
      data.reason,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.GET_PAYMENT })
  async getPayment(
    @Payload() data: { paymentId: string; appScope?: string }
  ) {
    return this.paymentService.getPayment(data.paymentId, data.appScope);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_USER_PAYMENTS })
  async getUserPayments(
    @Payload() data: { userId: string; appScope?: string }
  ) {
    return this.paymentService.getUserPayments(data.userId, data.appScope);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_BILLING_PROFILE })
  async getBillingProfile(
    @Payload() data: { userId: string; appScope?: string }
  ) {
    return this.paymentService.getBillingProfile(data.userId, data.appScope);
  }

  @MessagePattern({ cmd: PaymentCommands.UPDATE_BILLING_PROFILE })
  async updateBillingProfile(
    @Payload()
    data: {
      userId: string;
      appScope?: string;
      name?: string;
      email?: string;
      defaultPaymentMethodId?: string;
    }
  ) {
    return this.paymentService.updateBillingProfile(
      data.userId,
      {
        name: data.name,
        email: data.email,
        defaultPaymentMethodId: data.defaultPaymentMethodId,
      },
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.LIST_SAVED_PAYMENT_METHODS })
  async listSavedPaymentMethods(
    @Payload() data: { userId: string; appScope?: string }
  ) {
    return this.paymentService.listSavedPaymentMethods(data.userId, data.appScope);
  }

  @MessagePattern({ cmd: PaymentCommands.MARK_INTERESTED_BUYER })
  async markInterestedBuyer(
    @Payload()
    data: { paymentId: string; interestedBuyerId: string; appScope?: string }
  ) {
    return this.paymentService.markInterestedBuyer(
      data.paymentId,
      data.interestedBuyerId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.MARK_PAID_OUTSIDE_PLATFORM })
  async markPaidOutsidePlatform(
    @Payload() data: { paymentId: string; appScope?: string }
  ) {
    return this.paymentService.markPaidOutsidePlatform(
      data.paymentId,
      data.appScope
    );
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
  async getBusinessPage(
    @Payload() data: { communityId: string; appScope?: string }
  ) {
    return this.paymentService.getBusinessPage(data.communityId, data.appScope);
  }

  @MessagePattern({ cmd: PaymentCommands.UPDATE_BUSINESS_PAGE })
  async updateBusinessPage(
    @Payload()
    data: {
      userId: string;
      communityId: string;
      appScope?: string;
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
      data.appScope,
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
    @Payload() data: { userId: string; communityId: string; appScope?: string }
  ) {
    return this.paymentService.cancelBusinessSubscription(
      data.userId,
      data.communityId,
      data.appScope
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
  async getActiveSponsorships(
    @Payload() data: { communityId: string; appScope?: string }
  ) {
    return this.paymentService.getActiveSponsorships(
      data.communityId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.GET_USER_SPONSORSHIPS })
  async getUserSponsorships(
    @Payload() data: { userId: string; appScope?: string }
  ) {
    return this.paymentService.getUserSponsorships(data.userId, data.appScope);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_USER_TRANSACTIONS })
  async getUserTransactions(
    @Payload() data: { userId: string; appScope?: string }
  ) {
    return this.paymentService.getUserTransactions(data.userId, data.appScope);
  }

  @MessagePattern({ cmd: PaymentCommands.GET_PORTAL_URL })
  async getPortalUrl(@Payload() data: { userId: string; appScope?: string }) {
    return this.paymentService.getPortalUrl(data.userId, data.appScope);
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
  async getSellerWallet(
    @Payload() data: { sellerId: string; appScope?: string }
  ) {
    return this.paymentService.getSellerWallet(data.sellerId, data.appScope);
  }

  @MessagePattern({ cmd: PaymentCommands.CREATE_SELLER_STRIPE_CONNECT_ONBOARDING_LINK })
  async createSellerStripeConnectOnboardingLink(
    @Payload()
    data: {
      sellerId: string;
      email?: string;
      appScope?: string;
    }
  ) {
    return this.paymentService.createSellerStripeConnectOnboardingLink(
      data.sellerId,
      data.email,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.REFRESH_SELLER_STRIPE_CONNECT_STATUS })
  async refreshSellerStripeConnectStatus(
    @Payload() data: { sellerId: string; appScope?: string }
  ) {
    return this.paymentService.refreshSellerStripeConnectStatus(
      data.sellerId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.UPDATE_SELLER_PAYOUT_INFO })
  async updateSellerPayoutInfo(
    @Payload()
    data: {
      sellerId: string;
      appScope?: string;
      payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle';
      payoutEmail?: string;
      bankAccountLast4?: string;
      bankRoutingLast4?: string;
    }
  ) {
    return this.paymentService.updateSellerPayoutInfo(
      data.sellerId,
      data.appScope,
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
      appScope?: string;
      amount: number;
      payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle';
      payoutEmail?: string;
      bankAccountLast4?: string;
      bankRoutingLast4?: string;
    }
  ) {
    return this.paymentService.createPayoutRequest(
      data.sellerId,
      data.appScope,
      data.amount,
      data.payoutMethod,
      data.payoutEmail,
      data.bankAccountLast4,
      data.bankRoutingLast4
    );
  }

  @MessagePattern({ cmd: PaymentCommands.GET_SELLER_PAYOUT_REQUESTS })
  async getSellerPayoutRequests(
    @Payload() data: { sellerId: string; appScope?: string }
  ) {
    return this.paymentService.getSellerPayoutRequests(
      data.sellerId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.CANCEL_PAYOUT_REQUEST })
  async cancelPayoutRequest(
    @Payload()
    data: { payoutRequestId: string; sellerId: string; appScope?: string }
  ) {
    return this.paymentService.cancelPayoutRequest(
      data.payoutRequestId,
      data.sellerId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.GET_SELLER_EARNINGS_SUMMARY })
  async getSellerEarningsSummary(
    @Payload() data: { sellerId: string; appScope?: string }
  ) {
    return this.paymentService.getSellerEarningsSummary(
      data.sellerId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PaymentCommands.GET_BUSINESS_PAGES_BY_CITY })
  async getBusinessPagesByCity(
    @Payload()
    data: { cityId: string; communityIds: string[]; appScope?: string }
  ) {
    return this.paymentService.getBusinessPagesByCity(
      data.cityId,
      data.communityIds || [],
      data.appScope
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

  @MessagePattern({ cmd: PaymentCommands.SYNC_LEMON_SQUEEZY_PRODUCTS })
  async syncLemonSqueezyProducts(@Payload() data: { appScope?: string }) {
    return this.paymentService.syncLemonSqueezyProducts(data.appScope);
  }
}
