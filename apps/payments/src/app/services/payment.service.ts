import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Donation } from '../../entities/donation.entity';
import { ClassifiedPayment } from '../../entities/classified-payment.entity';
import { SellerWallet } from '../../entities/seller-wallet.entity';
import { PayoutRequest } from '../../entities/payout-request.entity';
import {
  BusinessPage,
  BusinessTier,
} from '../../entities/business-page.entity';
import {
  CommunitySponsorship,
  SponsorshipType,
} from '../../entities/community-sponsorship.entity';
import { Transaction } from '../../entities/transaction.entity';
import { LemonSqueezyProduct } from '../../entities/lemon-squeezy-product.entity';
import { ConfigService } from '@nestjs/config';
import { calculateNetAmount } from '../utils/platform-fee.util';
import type { LemonSqueezyStoreConfig } from '../../config';
import { StripeConnectService } from './stripe-connect.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly defaultStoreConfig: LemonSqueezyStoreConfig;
  private readonly storeConfigs: Record<string, LemonSqueezyStoreConfig>;

  private getStoreConfig(appScope: string): LemonSqueezyStoreConfig {
    if (appScope && this.storeConfigs[appScope]) {
      return this.storeConfigs[appScope];
    }
    return this.defaultStoreConfig;
  }

  private getStoreConfigByStoreId(
    storeId: string
  ): LemonSqueezyStoreConfig | null {
    if (this.defaultStoreConfig.storeId === storeId) {
      return this.defaultStoreConfig;
    }
    for (const scope of Object.keys(this.storeConfigs)) {
      if (this.storeConfigs[scope].storeId === storeId) {
        return this.storeConfigs[scope];
      }
    }
    return null;
  }

  private normalizeMonthYear(month?: number | string, year?: number | string) {
    const now = new Date();
    const parsedMonth = Number(month);
    const parsedYear = Number(year);

    const safeMonth =
      Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth
        : now.getMonth() + 1;
    const safeYear =
      Number.isInteger(parsedYear) && parsedYear >= 1970 && parsedYear <= 3000
        ? parsedYear
        : now.getFullYear();

    if (safeMonth !== parsedMonth || safeYear !== parsedYear) {
      this.logger.warn(
        `Invalid donation period received (month=${String(
          month
        )}, year=${String(year)}); defaulting to ${safeMonth}/${safeYear}`
      );
    }

    return {
      month: safeMonth,
      year: safeYear,
      startDate: new Date(safeYear, safeMonth - 1, 1),
      endDate: new Date(safeYear, safeMonth, 0, 23, 59, 59),
    };
  }

  constructor(
    @InjectRepository(Donation)
    private readonly donationRepository: Repository<Donation>,
    @InjectRepository(ClassifiedPayment)
    private readonly classifiedPaymentRepository: Repository<ClassifiedPayment>,
    @InjectRepository(SellerWallet)
    private readonly sellerWalletRepository: Repository<SellerWallet>,
    @InjectRepository(PayoutRequest)
    private readonly payoutRequestRepository: Repository<PayoutRequest>,
    @InjectRepository(BusinessPage)
    private readonly businessPageRepository: Repository<BusinessPage>,
    @InjectRepository(CommunitySponsorship)
    private readonly sponsorshipRepository: Repository<CommunitySponsorship>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(LemonSqueezyProduct)
    private readonly lsProductRepository: Repository<LemonSqueezyProduct>,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(StripeConnectService)
    private readonly stripeConnectService: StripeConnectService
  ) {
    const defaultConfig = this.configService.get('lemonSqueezy.default') as
      | LemonSqueezyStoreConfig
      | undefined;
    const storesConfig = this.configService.get('lemonSqueezy.stores') as
      | Record<string, LemonSqueezyStoreConfig>
      | undefined;

    this.defaultStoreConfig = defaultConfig || {
      apiKey: '',
      storeId: '',
    };
    this.storeConfigs = storesConfig || {};
  }

  async getDonationGoal(
    month?: number | string,
    year?: number | string,
    appScope?: string
  ) {
    const period = this.normalizeMonthYear(month, year);

    const donations = await this.donationRepository.find({
      where: {
        createdAt: Between(period.startDate, period.endDate),
        status: 'completed',
      },
    });

    const currentAmount = donations.reduce(
      (sum, d) => sum + Number(d.amount),
      0
    );
    const donorCount = new Set(donations.map((d) => d.userId)).size;

    const activeSponsorships = await this.sponsorshipRepository.find({
      where: {
        status: 'active',
      },
    });

    const sponsorshipAmount = activeSponsorships.reduce(
      (sum, s) => sum + Number(s.amount),
      0
    );

    return {
      monthlyGoal: 5000,
      currentAmount: currentAmount + sponsorshipAmount,
      donorCount,
      sponsorshipAmount,
      month: period.month,
      year: period.year,
    };
  }

  async getDonations(
    month?: number | string,
    year?: number | string,
    appScope?: string
  ) {
    const period = this.normalizeMonthYear(month, year);

    return this.donationRepository.find({
      where: {
        createdAt: Between(period.startDate, period.endDate),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async createDonationCheckout(
    userId: string,
    profileId: string,
    amount: number,
    isRecurring: boolean,
    appScope: string
  ) {
    const donation = this.donationRepository.create({
      userId,
      profileId,
      amount,
      isRecurring,
      status: 'pending',
      currency: 'USD',
    });

    const savedDonation = await this.donationRepository.save(donation);

    const storeConfig = this.getStoreConfig(appScope);
    const checkoutUrl = isRecurring
      ? `https://store.lemonsqueezy.com/checkout/buy/${storeConfig.storeId}?checkout[custom][donation_id]=${savedDonation.id}&checkout[custom][user_id]=${userId}&checkout[custom][profile_id]=${profileId}&checkout[custom][app_scope]=${appScope}`
      : `https://store.lemonsqueezy.com/checkout/buy/${storeConfig.storeId}?checkout[custom][donation_id]=${savedDonation.id}&checkout[custom][user_id]=${userId}&checkout[custom][profile_id]=${profileId}&checkout[custom][app_scope]=${appScope}`;

    return {
      checkoutUrl,
      donationId: savedDonation.id,
    };
  }

  async initializeDonationCheckout(
    userId: string,
    profileId: string,
    amount: number,
    isRecurring: boolean,
    appScope: string,
    customer?: { email?: string; name?: string }
  ) {
    const donation = this.donationRepository.create({
      userId,
      profileId,
      amount,
      isRecurring,
      status: 'pending',
      currency: 'USD',
    });

    const savedDonation = await this.donationRepository.save(donation);

    try {
      const result =
        await this.stripeConnectService.createMarketplacePaymentIntent({
          appScope,
          amountCents: Math.round(amount * 100),
          currency: 'usd',
          paymentId: savedDonation.id,
          classifiedId: `donation-${savedDonation.id}`,
          buyerId: userId,
          applicationFeeAmountCents: 0,
        });

      return {
        clientSecret: result.clientSecret,
        donationId: savedDonation.id,
        paymentIntentId: result.paymentIntentId,
        publishableKey: result.publishableKey,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create Stripe payment intent for donation: ${error.message}`
      );
      throw error;
    }
  }

  async validateDonationCheckout(
    userId: string,
    donationId: string,
    checkoutToken: string,
    response: { hash: string; data: Record<string, unknown> },
    appScope?: string
  ) {
    const donation = await this.donationRepository.findOne({
      where: { id: donationId, userId },
    });

    if (!donation) {
      return { valid: false, message: 'Donation not found' };
    }

    donation.status = 'completed';
    donation.completedAt = new Date();
    await this.donationRepository.save(donation);

    return { valid: true, donation };
  }

  async refundDonation(
    userId: string,
    donationId: string,
    reason: string,
    appScope?: string
  ) {
    const donation = await this.donationRepository.findOne({
      where: { id: donationId, userId },
    });

    if (!donation) {
      return { success: false, message: 'Donation not found' };
    }

    if (donation.status !== 'completed') {
      return { success: false, message: 'Can only refund completed donations' };
    }

    if (donation.paymentIntentId) {
      try {
        await this.stripeConnectService.refundMarketplacePayment({
          appScope,
          paymentIntentId: donation.paymentIntentId,
          reason: 'requested_by_customer',
          metadata: { donationId, reason },
        });
      } catch (error) {
        this.logger.error(
          `Failed to refund donation via Stripe: ${error.message}`
        );
      }
    }

    donation.status = 'refunded';
    donation.refundedAt = new Date();
    await this.donationRepository.save(donation);

    return { success: true, donation };
  }

  async getUserDonations(userId: string, appScope?: string) {
    return this.donationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelSubscription(
    userId: string,
    subscriptionId: string,
    appScope?: string
  ) {
    const donation = await this.donationRepository.findOne({
      where: { lemonSqueezySubscriptionId: subscriptionId, userId },
    });

    if (!donation) {
      return { success: false, message: 'Subscription not found' };
    }

    donation.status = 'cancelled';
    donation.cancelledAt = new Date();
    await this.donationRepository.save(donation);

    return { success: true };
  }

  async createClassifiedPayment(
    buyerId: string,
    classifiedId: string,
    paymentMethod: string,
    amount?: number,
    sellerId?: string,
    offerId?: string,
    appScope?: string
  ) {
    const feeBreakdown = calculateNetAmount(amount || 0);
    const payment = this.classifiedPaymentRepository.create({
      buyerId,
      sellerId,
      classifiedId,
      offerId,
      paymentMethod: paymentMethod as any,
      amount: feeBreakdown.gross,
      platformFeeAmount: feeBreakdown.fee,
      sellerReceivesAmount: feeBreakdown.net,
      status: 'pending',
    });

    return this.classifiedPaymentRepository.save(payment);
  }

  async initializeClassifiedPayment(
    buyerId: string,
    classifiedId: string,
    amount: number,
    sellerId?: string,
    offerId?: string,
    appScope?: string
  ) {
    const feeBreakdown = calculateNetAmount(amount);
    const payment = this.classifiedPaymentRepository.create({
      buyerId,
      sellerId,
      classifiedId,
      offerId,
      paymentMethod: 'card',
      amount: feeBreakdown.gross,
      platformFeeAmount: feeBreakdown.fee,
      sellerReceivesAmount: feeBreakdown.net,
      status: 'pending',
      appScope: appScope || 'default',
    });

    const savedPayment = await this.classifiedPaymentRepository.save(payment);

    try {
      const result =
        await this.stripeConnectService.createMarketplacePaymentIntent({
          appScope,
          amountCents: Math.round(feeBreakdown.gross * 100),
          currency: 'usd',
          paymentId: savedPayment.id,
          classifiedId,
          buyerId,
          sellerId,
          offerId,
          applicationFeeAmountCents: Math.round(feeBreakdown.fee * 100),
        });

      return {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
        paymentId: savedPayment.id,
        publishableKey: result.publishableKey,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create Stripe payment intent: ${error.message}`
      );
      throw error;
    }
  }

  async validateClassifiedPayment(
    buyerId: string,
    paymentId: string,
    checkoutToken: string,
    response: { hash: string; data: Record<string, unknown> },
    appScope?: string
  ) {
    const payment = await this.classifiedPaymentRepository.findOne({
      where: { id: paymentId, buyerId },
    });

    if (!payment) {
      return { valid: false, message: 'Payment not found' };
    }

    payment.status = 'confirmed';
    payment.confirmedAt = new Date();
    await this.classifiedPaymentRepository.save(payment);

    return { valid: true, payment };
  }

  async confirmStripeClassifiedPayment(
    buyerId: string,
    paymentId: string,
    paymentIntentId?: string,
    appScope?: string
  ) {
    const payment = await this.classifiedPaymentRepository.findOne({
      where: { id: paymentId, buyerId },
    });

    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    if (paymentIntentId) {
      try {
        const paymentIntent =
          await this.stripeConnectService.getMarketplacePaymentIntent(
            paymentIntentId,
            appScope
          );

        if (paymentIntent.status === 'succeeded') {
          payment.status = 'confirmed';
          payment.paymentIntentId = paymentIntentId;
          payment.confirmedAt = new Date();
          await this.classifiedPaymentRepository.save(payment);
          return { success: true, payment };
        } else {
          return {
            success: false,
            message: 'Payment not confirmed',
            status: paymentIntent.status,
          };
        }
      } catch (error) {
        this.logger.error(`Failed to confirm payment: ${error.message}`);
        return { success: false, message: error.message };
      }
    }

    payment.status = 'confirmed';
    payment.confirmedAt = new Date();
    await this.classifiedPaymentRepository.save(payment);

    return { success: true, payment };
  }

  async refundClassifiedPayment(
    userId: string,
    paymentId: string,
    reason: string,
    appScope?: string
  ) {
    const payment = await this.classifiedPaymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    if (payment.paymentIntentId) {
      try {
        await this.stripeConnectService.refundMarketplacePayment({
          appScope,
          paymentIntentId: payment.paymentIntentId,
          reason: 'requested_by_customer',
          metadata: { paymentId, reason },
        });
      } catch (error) {
        this.logger.error(`Failed to refund payment: ${error.message}`);
      }
    }

    payment.status = 'refunded';
    payment.refundReason = reason;
    payment.refundedAt = new Date();
    await this.classifiedPaymentRepository.save(payment);

    return { success: true, payment };
  }

  async getBillingProfile(userId: string, appScope?: string) {
    const donations = await this.donationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    if (donations.length === 0 || !donations[0].externalCustomerId) {
      return null;
    }

    try {
      const customer = await this.stripeConnectService.getCustomer(
        donations[0].externalCustomerId,
        appScope
      );
      return {
        customerId: customer.id,
        email: customer.email,
        name: customer.name,
        defaultPaymentMethodId:
          customer.invoice_settings?.default_payment_method,
      };
    } catch (error) {
      this.logger.error(`Failed to get billing profile: ${error.message}`);
      return null;
    }
  }

  async updateBillingProfile(
    userId: string,
    data: { name?: string; email?: string; defaultPaymentMethodId?: string },
    appScope?: string
  ) {
    const donations = await this.donationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    if (donations.length === 0 || !donations[0].externalCustomerId) {
      return {
        success: false,
        message: 'No customer found. Create a donation first.',
      };
    }

    try {
      const customer = await this.stripeConnectService.updateCustomer(
        donations[0].externalCustomerId,
        data,
        appScope
      );
      return {
        success: true,
        customer: {
          customerId: customer.id,
          email: customer.email,
          name: customer.name,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update billing profile: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  async listSavedPaymentMethods(userId: string, appScope?: string) {
    const donations = await this.donationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    if (donations.length === 0 || !donations[0].externalCustomerId) {
      return [];
    }

    try {
      const methods = await this.stripeConnectService.listPaymentMethods(
        donations[0].externalCustomerId,
        appScope
      );
      return methods.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
      }));
    } catch (error) {
      this.logger.error(`Failed to list payment methods: ${error.message}`);
      return [];
    }
  }

  async confirmOutOfPlatformPayment(
    paymentId: string,
    proofImageUrl?: string,
    appScope?: string
  ) {
    const payment = await this.classifiedPaymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    payment.status = 'confirmed';
    payment.proofImageUrl = proofImageUrl;
    payment.confirmedAt = new Date();

    await this.classifiedPaymentRepository.save(payment);

    return { success: true, payment };
  }

  async releaseFunds(paymentId: string, appScope?: string) {
    const payment = await this.classifiedPaymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    if (!payment.sellerId) {
      return {
        success: false,
        message: 'No seller associated with this payment',
      };
    }

    payment.status = 'released';
    payment.releasedAt = new Date();

    await this.classifiedPaymentRepository.save(payment);

    await this.creditSellerWallet(
      payment.sellerId,
      Number(payment.sellerReceivesAmount),
      paymentId,
      `Payment release for classified: ${payment.classifiedId}`
    );

    return { success: true, payment };
  }

  async disputePayment(paymentId: string, reason: string, appScope?: string) {
    const payment = await this.classifiedPaymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    payment.status = 'disputed';
    payment.disputeReason = reason;

    await this.classifiedPaymentRepository.save(payment);

    return { success: true, payment };
  }

  async getPayment(paymentId: string, appScope?: string) {
    return this.classifiedPaymentRepository.findOne({
      where: { id: paymentId },
    });
  }

  async getUserPayments(userId: string, appScope?: string) {
    return this.classifiedPaymentRepository.find({
      where: [{ buyerId: userId }, { sellerId: userId }],
      order: { createdAt: 'DESC' },
    });
  }

  async markInterestedBuyer(
    paymentId: string,
    interestedBuyerId: string,
    appScope?: string
  ) {
    const payment = await this.classifiedPaymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    payment.interestedBuyerId = interestedBuyerId;
    await this.classifiedPaymentRepository.save(payment);

    return { success: true, payment };
  }

  async markPaidOutsidePlatform(paymentId: string, appScope?: string) {
    const payment = await this.classifiedPaymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    payment.status = 'released';
    payment.releasedAt = new Date();
    await this.classifiedPaymentRepository.save(payment);

    return { success: true, payment };
  }

  async createBusinessCheckout(
    userId: string,
    communityId: string,
    tier: string,
    appScope: string
  ) {
    let businessPage = await this.businessPageRepository.findOne({
      where: { communityId },
    });

    if (!businessPage) {
      businessPage = this.businessPageRepository.create({
        communityId,
        ownerId: userId,
        tier: tier as BusinessTier,
        subscriptionStatus: 'inactive',
      });
      await this.businessPageRepository.save(businessPage);
    }

    const lsProduct = await this.lsProductRepository.findOne({
      where: { appScope, tier: tier as any, isActive: true },
    });

    const variantId = lsProduct?.lemonSqueezyVariantId;

    if (!variantId) {
      this.logger.warn(
        `No Lemon Squeezy variant found for appScope=${appScope}, tier=${tier}. Using storeId as fallback.`
      );
    }

    const storeConfig = this.getStoreConfig(appScope);
    const checkoutUrl = `https://store.lemonsqueezy.com/checkout/buy/${
      variantId || storeConfig.storeId
    }?checkout[custom][business_page_id]=${
      businessPage.id
    }&checkout[custom][community_id]=${communityId}&checkout[custom][user_id]=${userId}&checkout[custom][tier]=${tier}&checkout[custom][app_scope]=${appScope}`;

    return {
      checkoutUrl,
      businessPageId: businessPage.id,
    };
  }

  async getBusinessPage(communityId: string, appScope?: string) {
    return this.businessPageRepository.findOne({
      where: { communityId },
    });
  }

  async updateBusinessPage(
    userId: string,
    communityId: string,
    appScope: string | undefined,
    data: {
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
    const businessPage = await this.businessPageRepository.findOne({
      where: { communityId, ownerId: userId },
    });

    if (!businessPage) {
      return { success: false, message: 'Business page not found' };
    }

    Object.assign(businessPage, data);
    await this.businessPageRepository.save(businessPage);

    return { success: true, businessPage };
  }

  async cancelBusinessSubscription(
    userId: string,
    communityId: string,
    appScope?: string
  ) {
    const businessPage = await this.businessPageRepository.findOne({
      where: { communityId, ownerId: userId },
    });

    if (!businessPage) {
      return { success: false, message: 'Business page not found' };
    }

    businessPage.subscriptionStatus = 'cancelled';
    await this.businessPageRepository.save(businessPage);

    return { success: true };
  }

  async createSponsorshipCheckout(
    userId: string,
    communityId: string,
    type: string,
    adContent: string | undefined,
    appScope: string,
    months: number = 1,
    businessPageId?: string
  ) {
    const durationMs = months * 30 * 24 * 60 * 60 * 1000;
    const sponsorship = this.sponsorshipRepository.create({
      communityId,
      businessPageId,
      userId,
      type: type as SponsorshipType,
      adContent,
      amount: 0,
      status: 'pending',
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + durationMs),
      months,
    });

    const savedSponsorship = await this.sponsorshipRepository.save(sponsorship);

    const storeConfig = this.getStoreConfig(appScope);
    const checkoutUrl = `https://store.lemonsqueezy.com/checkout/buy/${storeConfig.storeId}?checkout[custom][sponsorship_id]=${savedSponsorship.id}&checkout[custom][community_id]=${communityId}&checkout[custom][user_id]=${userId}&checkout[custom][type]=${type}&checkout[custom][app_scope]=${appScope}`;

    return {
      checkoutUrl,
      sponsorshipId: savedSponsorship.id,
    };
  }

  async getActiveSponsorships(communityId: string, appScope?: string) {
    const now = new Date();
    return this.sponsorshipRepository.find({
      where: {
        communityId,
        status: 'active',
        startsAt: LessThanOrEqual(now),
        expiresAt: MoreThanOrEqual(now),
      },
    });
  }

  async getUserSponsorships(userId: string, appScope?: string) {
    return this.sponsorshipRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getUserTransactions(userId: string, appScope?: string) {
    return this.transactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getPortalUrl(userId: string, appScope?: string) {
    return {
      portalUrl: `https://my-store.lemonsqueezy.com/billing?user_id=${userId}`,
    };
  }

  async createSellerStripeConnectOnboardingLink(
    sellerId: string,
    email?: string,
    accountId?: string,
    appScope?: string
  ) {
    try {
      const result = await this.stripeConnectService.createConnectedAccountLink(
        {
          appScope,
          sellerId,
          email,
          accountId,
        }
      );
      return {
        success: true,
        accountId: result.accountId,
        onboardingUrl: result.onboardingUrl,
        expiresAt: result.expiresAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create Stripe Connect onboarding link: ${error.message}`
      );
      return { success: false, message: error.message };
    }
  }

  async refreshSellerStripeConnectStatus(sellerId: string, appScope?: string) {
    try {
      const wallet = await this.sellerWalletRepository.findOne({
        where: { sellerId },
      });

      if (!wallet?.stripeAccountId) {
        return {
          success: false,
          message: 'No Stripe Connect account found for seller',
        };
      }

      const account = await this.stripeConnectService.getConnectedAccount(
        wallet.stripeAccountId,
        appScope
      );
      return {
        success: true,
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh Stripe Connect status: ${error.message}`
      );
      return { success: false, message: error.message };
    }
  }

  async getOrCreateSellerWallet(
    sellerId: string,
    appScope?: string
  ): Promise<SellerWallet> {
    let wallet = await this.sellerWalletRepository.findOne({
      where: { sellerId },
    });

    if (!wallet) {
      wallet = this.sellerWalletRepository.create({
        sellerId,
        appScope: appScope || 'default',
        availableBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalPaidOut: 0,
      });
      wallet = await this.sellerWalletRepository.save(wallet);
    }

    return wallet;
  }

  async getSellerWallet(
    sellerId: string,
    appScope?: string
  ): Promise<SellerWallet | null> {
    return this.sellerWalletRepository.findOne({
      where: { sellerId },
    });
  }

  async updateSellerPayoutInfo(
    sellerId: string,
    appScope: string | undefined,
    payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle',
    payoutEmail?: string,
    bankAccountLast4?: string,
    bankRoutingLast4?: string
  ): Promise<SellerWallet> {
    const wallet = await this.getOrCreateSellerWallet(sellerId);
    wallet.payoutMethod = payoutMethod;
    wallet.payoutEmail = payoutEmail || null;
    wallet.bankAccountLast4 = bankAccountLast4 || null;
    wallet.bankRoutingLast4 = bankRoutingLast4 || null;
    return this.sellerWalletRepository.save(wallet);
  }

  async creditSellerWallet(
    sellerId: string,
    amount: number,
    paymentId: string,
    description: string
  ): Promise<SellerWallet> {
    const wallet = await this.getOrCreateSellerWallet(sellerId);
    wallet.availableBalance = Number(wallet.availableBalance) + amount;
    wallet.totalEarned = Number(wallet.totalEarned) + amount;

    const transaction = this.transactionRepository.create({
      type: 'payout',
      direction: 'incoming',
      amount,
      platformFee: 0,
      netAmount: amount,
      currency: 'USD',
      status: 'completed',
      description,
      referenceId: paymentId,
      userId: sellerId,
    });
    await this.transactionRepository.save(transaction);

    return this.sellerWalletRepository.save(wallet);
  }

  async createPayoutRequest(
    sellerId: string,
    appScope: string,
    amount: number,
    payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle',
    payoutEmail?: string,
    bankAccountLast4?: string,
    bankRoutingLast4?: string
  ): Promise<PayoutRequest> {
    const wallet = await this.getOrCreateSellerWallet(sellerId);

    if (Number(wallet.availableBalance) < amount) {
      throw new Error('Insufficient funds for payout');
    }

    wallet.availableBalance = Number(wallet.availableBalance) - amount;
    await this.sellerWalletRepository.save(wallet);

    const payoutRequest = this.payoutRequestRepository.create({
      sellerId,
      amount,
      payoutMethod,
      payoutEmail: payoutEmail || wallet.payoutEmail || undefined,
      bankAccountLast4:
        bankAccountLast4 || wallet.bankAccountLast4 || undefined,
      bankRoutingLast4:
        bankRoutingLast4 || wallet.bankRoutingLast4 || undefined,
      status: 'pending',
    });

    return this.payoutRequestRepository.save(payoutRequest);
  }

  async getSellerPayoutRequests(
    sellerId: string,
    appScope?: string
  ): Promise<PayoutRequest[]> {
    return this.payoutRequestRepository.find({
      where: { sellerId },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelPayoutRequest(
    payoutRequestId: string,
    sellerId: string,
    appScope?: string
  ): Promise<PayoutRequest> {
    const payoutRequest = await this.payoutRequestRepository.findOne({
      where: { id: payoutRequestId, sellerId },
    });

    if (!payoutRequest) {
      throw new Error('Payout request not found');
    }

    if (payoutRequest.status !== 'pending') {
      throw new Error('Only pending payouts can be cancelled');
    }

    const wallet = await this.getOrCreateSellerWallet(sellerId);
    wallet.availableBalance =
      Number(wallet.availableBalance) + Number(payoutRequest.amount);
    await this.sellerWalletRepository.save(wallet);

    payoutRequest.status = 'cancelled';
    return this.payoutRequestRepository.save(payoutRequest);
  }

  async processPayout(
    payoutRequestId: string,
    adminId: string,
    transactionId?: string
  ): Promise<PayoutRequest> {
    const payoutRequest = await this.payoutRequestRepository.findOne({
      where: { id: payoutRequestId },
    });

    if (!payoutRequest) {
      throw new Error('Payout request not found');
    }

    if (payoutRequest.status !== 'pending') {
      throw new Error('Only pending payouts can be processed');
    }

    payoutRequest.status = 'processing';
    payoutRequest.processedBy = adminId;
    payoutRequest.transactionId = transactionId || `payout-${Date.now()}`;
    await this.payoutRequestRepository.save(payoutRequest);

    const wallet = await this.getOrCreateSellerWallet(payoutRequest.sellerId);
    wallet.totalPaidOut =
      Number(wallet.totalPaidOut) + Number(payoutRequest.amount);
    wallet.lastPayoutAt = new Date();
    await this.sellerWalletRepository.save(wallet);

    payoutRequest.status = 'completed';
    payoutRequest.processedAt = new Date();
    return this.payoutRequestRepository.save(payoutRequest);
  }

  async rejectPayout(
    payoutRequestId: string,
    adminId: string,
    reason: string
  ): Promise<PayoutRequest> {
    const payoutRequest = await this.payoutRequestRepository.findOne({
      where: { id: payoutRequestId },
    });

    if (!payoutRequest) {
      throw new Error('Payout request not found');
    }

    if (payoutRequest.status !== 'pending') {
      throw new Error('Only pending payouts can be rejected');
    }

    payoutRequest.status = 'rejected';
    payoutRequest.processedBy = adminId;
    payoutRequest.rejectionReason = reason;
    payoutRequest.processedAt = new Date();
    await this.payoutRequestRepository.save(payoutRequest);

    const wallet = await this.getOrCreateSellerWallet(payoutRequest.sellerId);
    wallet.availableBalance =
      Number(wallet.availableBalance) + Number(payoutRequest.amount);
    await this.sellerWalletRepository.save(wallet);

    return payoutRequest;
  }

  async getAllPayoutRequests(status?: string): Promise<PayoutRequest[]> {
    const where = status ? { status: status as any } : {};
    return this.payoutRequestRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getBusinessPagesByCity(
    cityId: string,
    communityIds: string[],
    appScope?: string
  ) {
    if (!communityIds || communityIds.length === 0) {
      return [];
    }

    const allIds = [cityId, ...communityIds].filter((id) => id !== undefined);

    const businesses = await this.businessPageRepository
      .createQueryBuilder('business')
      .where('business.communityId IN (:...ids)', { ids: allIds })
      .andWhere('business.subscriptionStatus = :status', { status: 'active' })
      .orderBy('business.isFeatured', 'DESC')
      .addOrderBy(
        "CASE business.tier WHEN 'enterprise' THEN 1 WHEN 'pro' THEN 2 WHEN 'basic' THEN 3 END"
      )
      .addOrderBy(
        "CASE business.featuredSpotType WHEN 'hero' THEN 1 WHEN 'featured-carousel' THEN 2 WHEN 'sidebar' THEN 3 WHEN 'top-list' THEN 4 ELSE 5 END"
      )
      .addOrderBy('business.createdAt', 'ASC')
      .getMany();

    return businesses;
  }

  async getSellerEarningsSummary(sellerId: string, appScope?: string) {
    const wallet = await this.getOrCreateSellerWallet(sellerId);

    const payments = await this.classifiedPaymentRepository.find({
      where: { sellerId },
    });

    const salesCount = payments.filter(
      (p) => p.status === 'released' || p.status === 'confirmed'
    ).length;

    const pendingPayments = payments.filter(
      (p) => p.status === 'pending' || p.status === 'confirmed'
    );

    const pendingAmount = pendingPayments.reduce(
      (sum, p) => sum + Number(p.sellerReceivesAmount || 0),
      0
    );

    return {
      availableBalance: wallet.availableBalance,
      pendingBalance: pendingAmount,
      totalEarned: wallet.totalEarned,
      totalPaidOut: wallet.totalPaidOut,
      salesCount,
      payoutMethod: wallet.payoutMethod,
      payoutEmail: wallet.payoutEmail,
    };
  }

  async processWebhook(
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<{ received: boolean }> {
    try {
      const meta = (payload?.meta as Record<string, unknown>) ?? {};
      const customData =
        (meta?.custom_data as Record<string, string>) ??
        (meta?.customData as Record<string, string>) ??
        {};

      this.logger.log(`Lemon Squeezy webhook: event=${eventType}`);

      if (
        eventType === 'subscription_created' ||
        eventType === 'subscription_updated'
      ) {
        const communityId = customData.community_id;
        if (communityId) {
          const businessPage = await this.businessPageRepository.findOne({
            where: { communityId },
          });
          if (businessPage) {
            businessPage.subscriptionStatus = 'active';
            await this.businessPageRepository.save(businessPage);
            this.logger.log(
              `Activated business page for community ${communityId}`
            );
          }
        }
      } else if (
        eventType === 'subscription_cancelled' ||
        eventType === 'subscription_expired'
      ) {
        const communityId = customData.community_id;
        if (communityId) {
          const businessPage = await this.businessPageRepository.findOne({
            where: { communityId },
          });
          if (businessPage) {
            businessPage.subscriptionStatus = 'cancelled';
            await this.businessPageRepository.save(businessPage);
          }
        }
      } else if (eventType === 'order_created') {
        const sponsorshipId = customData.sponsorship_id;
        if (sponsorshipId) {
          const sponsorship = await this.sponsorshipRepository.findOne({
            where: { id: sponsorshipId },
          });
          if (sponsorship) {
            sponsorship.status = 'active';
            await this.sponsorshipRepository.save(sponsorship);
          }
        }
      }
    } catch (err) {
      this.logger.error(`Webhook processing error: ${err?.message}`, err);
    }

    return { received: true };
  }

  async syncLemonSqueezyProducts(appScope?: string): Promise<void> {
    const configsToSync =
      appScope && this.storeConfigs[appScope]
        ? [{ appScope, config: this.storeConfigs[appScope] }]
        : [
            { appScope: 'default', config: this.defaultStoreConfig },
            ...Object.entries(this.storeConfigs).map(([scope, config]) => ({
              appScope: scope,
              config,
            })),
          ];

    for (const { appScope, config } of configsToSync) {
      if (!config.apiKey || !config.storeId) {
        this.logger.warn(
          `Skipping product sync for ${appScope}: missing apiKey or storeId`
        );
        continue;
      }

      try {
        const response = await fetch(
          `https://api.lemonsqueezy.com/v1/products?filter[store]=${config.storeId}`,
          {
            headers: {
              Accept: 'application/vnd.api+json',
              'Content-Type': 'application/vnd.api+json',
              Authorization: `Bearer ${config.apiKey}`,
            },
          }
        );

        if (!response.ok) {
          this.logger.error(
            `Failed to fetch products for store ${config.storeId}: ${response.status} ${response.statusText}`
          );
          continue;
        }

        const data = (await response.json()) as {
          data: Array<{
            id: string;
            attributes: {
              name: string;
              status: string;
            };
            relationships?: {
              variants?: {
                data: Array<{ id: string }>;
              };
            };
          }>;
        };

        for (const product of data.data) {
          const variants = product.relationships?.variants?.data || [];

          for (const variant of variants) {
            const variantResponse = await fetch(
              `https://api.lemonsqueezy.com/v1/variants/${variant.id}`,
              {
                headers: {
                  Accept: 'application/vnd.api+json',
                  'Content-Type': 'application/vnd.api+json',
                  Authorization: `Bearer ${config.apiKey}`,
                },
              }
            );

            if (!variantResponse.ok) continue;

            const variantData = (await variantResponse.json()) as {
              data: {
                attributes: {
                  name: string;
                  price_formatted: string;
                };
              };
            };

            const variantName = variantData.data.attributes.name;
            let tier: 'basic' | 'pro' | 'enterprise' = 'basic';

            const nameLower = variantName.toLowerCase();
            if (nameLower.includes('pro')) {
              tier = 'pro';
            } else if (nameLower.includes('enterprise')) {
              tier = 'enterprise';
            }

            const existingProduct = await this.lsProductRepository.findOne({
              where: { appScope, tier },
            });

            const productData = {
              appScope,
              tier,
              lemonSqueezyProductId: product.id,
              lemonSqueezyVariantId: variant.id,
              name: product.attributes.name,
              isActive: product.attributes.status === 'published',
            };

            if (existingProduct) {
              Object.assign(existingProduct, productData);
              await this.lsProductRepository.save(existingProduct);
            } else {
              const newProduct = this.lsProductRepository.create(productData);
              await this.lsProductRepository.save(newProduct);
            }
          }
        }

        this.logger.log(`Synced products for ${appScope}`);
      } catch (err) {
        this.logger.error(
          `Error syncing products for ${appScope}: ${err?.message}`,
          err
        );
      }
    }
  }
}
