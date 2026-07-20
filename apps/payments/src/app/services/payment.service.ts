import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import {
  CampaignCreativeDto,
  CampaignLifecycleStatus,
  CampaignTargetPlacementDto,
  isValidCampaignTargetPlacement,
} from '@optimistic-tanuki/models';
import { Donation } from '../../entities/donation.entity';
import { ClassifiedPayment } from '../../entities/classified-payment.entity';
import { SellerWallet } from '../../entities/seller-wallet.entity';
import { PayoutRequest } from '../../entities/payout-request.entity';
import {
  BusinessPage,
  BusinessTier,
} from '../../entities/business-page.entity';
import { AdvertisingCampaign } from '../../entities/advertising-campaign.entity';
import { AdvertisingCampaignCreative } from '../../entities/advertising-campaign-creative.entity';
import { AdvertisingCampaignTargetPlacement } from '../../entities/advertising-campaign-target-placement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { LemonSqueezyProduct } from '../../entities/lemon-squeezy-product.entity';
import { calculateNetAmount } from '../utils/platform-fee.util';
import {
  BillingProviderAdapter,
  ProviderCatalogStore,
} from '@optimistic-tanuki/payments-domain';
import { PAYMENT_PROVIDER_ADAPTER } from './payment-provider.tokens';
import { BillingReconciliationService } from './billing-reconciliation.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  private getCreativeMediaUrl(creative: {
    mediaUrl?: string | null;
    imageUrl?: string | null;
  }) {
    const mediaUrl = creative.mediaUrl?.trim() || null;
    const legacyImageUrl = creative.imageUrl?.trim() || null;
    return mediaUrl || legacyImageUrl;
  }

  private validateCreativeMediaUrl(creative: {
    mediaUrl?: string | null;
    imageUrl?: string | null;
  }) {
    const mediaUrl = creative.mediaUrl?.trim() || null;
    if (mediaUrl !== null && !this.isUsableMediaUrl(mediaUrl)) {
      throw new Error('Creative mediaUrl must be an absolute HTTPS URL');
    }
    return this.getCreativeMediaUrl(creative);
  }

  private validateCreativeMediaUrls(
    creatives: Array<{ mediaUrl?: string | null; imageUrl?: string | null }>
  ) {
    creatives.forEach((creative) => this.validateCreativeMediaUrl(creative));
  }

  private isUsableMediaUrl(url?: string | null) {
    if (!url) {
      return false;
    }
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && parsed.hostname.length > 0;
    } catch {
      return false;
    }
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
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(LemonSqueezyProduct)
    private readonly lsProductRepository: Repository<LemonSqueezyProduct>,
    @Inject(PAYMENT_PROVIDER_ADAPTER)
    private readonly providerAdapter: BillingProviderAdapter,
    private readonly billingReconciliationService: BillingReconciliationService,
    @InjectRepository(AdvertisingCampaign)
    private readonly campaignRepository?: Repository<AdvertisingCampaign>,
    @InjectRepository(AdvertisingCampaignCreative)
    private readonly campaignCreativeRepository?: Repository<AdvertisingCampaignCreative>,
    @InjectRepository(AdvertisingCampaignTargetPlacement)
    private readonly campaignTargetPlacementRepository?: Repository<AdvertisingCampaignTargetPlacement>
  ) {}

  async createAdvertisingCampaign(
    userId: string,
    data: {
      businessPageId: string;
      name: string;
      budget?: number | null;
      startsAt: Date;
      endsAt: Date;
      targetPlacements: CampaignTargetPlacementDto[];
      creatives: CampaignCreativeDto[];
    }
  ) {
    this.validateCreativeMediaUrls(data.creatives);
    if (
      data.targetPlacements.some(
        (target) => !isValidCampaignTargetPlacement(target)
      )
    ) {
      throw new Error('Community targets only support on-page placement');
    }
    if (data.targetPlacements.length === 0) {
      throw new Error('Campaign requires at least one target placement');
    }
    if (data.endsAt <= data.startsAt) {
      throw new Error('Campaign end date must be after the start date');
    }

    const businessPage = await this.businessPageRepository.findOne({
      where: { id: data.businessPageId, ownerId: userId },
    });
    if (!businessPage) {
      throw new Error('Business page not found');
    }
    if (
      !this.campaignRepository ||
      !this.campaignCreativeRepository ||
      !this.campaignTargetPlacementRepository
    ) {
      throw new Error('Campaign repositories are not configured');
    }

    const campaign = await this.campaignRepository.save(
      this.campaignRepository.create({
        businessPageId: businessPage.id,
        userId,
        name: data.name.trim(),
        budget: data.budget ?? null,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: 'draft' as CampaignLifecycleStatus,
      })
    );
    await this.campaignCreativeRepository.save(
      data.creatives.map((creative) =>
        this.campaignCreativeRepository!.create({
          campaignId: campaign.id,
          placementType: creative.placementType,
          headline: creative.headline?.trim() || null,
          body: creative.body?.trim() || null,
          ctaLabel: creative.ctaLabel?.trim() || null,
          ctaUrl: creative.ctaUrl?.trim() || null,
          mediaUrl: this.getCreativeMediaUrl(creative),
          imageUrl: creative.imageUrl?.trim() || null,
        })
      )
    );
    await this.campaignTargetPlacementRepository.save(
      data.targetPlacements.map((target) =>
        this.campaignTargetPlacementRepository!.create({
          campaignId: campaign.id,
          targetType: target.targetType,
          targetId: target.targetId,
          placementType: target.placementType,
        })
      )
    );
    return campaign;
  }

  async getOwnerAdvertisingCampaigns(userId: string) {
    if (
      !this.campaignRepository ||
      !this.campaignCreativeRepository ||
      !this.campaignTargetPlacementRepository
    ) {
      throw new Error('Campaign repositories are not configured');
    }
    const campaigns = await this.campaignRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const campaignIds = campaigns.map((campaign) => campaign.id);
    if (campaignIds.length === 0) {
      return [];
    }
    const [creatives, targetPlacements] = await Promise.all([
      this.campaignCreativeRepository.find({
        where: { campaignId: In(campaignIds) },
      }),
      this.campaignTargetPlacementRepository.find({
        where: { campaignId: In(campaignIds) },
      }),
    ]);
    return campaigns.map((campaign) => ({
      ...campaign,
      creatives: creatives
        .filter((creative) => creative.campaignId === campaign.id)
        .map((creative) => ({
          ...creative,
          mediaUrl: this.getCreativeMediaUrl(creative),
        })),
      targetPlacements: targetPlacements.filter(
        (target) => target.campaignId === campaign.id
      ),
    }));
  }

  async updateAdvertisingCampaign(
    userId: string,
    campaignId: string,
    data: {
      businessPageId: string;
      name: string;
      budget?: number | null;
      startsAt: Date;
      endsAt: Date;
      targetPlacements: CampaignTargetPlacementDto[];
      creatives: CampaignCreativeDto[];
    }
  ) {
    this.validateCreativeMediaUrls(data.creatives);
    if (
      data.targetPlacements.some(
        (target) => !isValidCampaignTargetPlacement(target)
      )
    ) {
      throw new Error('Community targets only support on-page placement');
    }
    if (data.targetPlacements.length === 0) {
      throw new Error('Campaign requires at least one target placement');
    }
    if (data.endsAt <= data.startsAt) {
      throw new Error('Campaign end date must be after the start date');
    }
    if (
      !this.campaignRepository ||
      !this.campaignCreativeRepository ||
      !this.campaignTargetPlacementRepository
    ) {
      throw new Error('Campaign repositories are not configured');
    }
    const [campaign, businessPage] = await Promise.all([
      this.campaignRepository.findOne({ where: { id: campaignId, userId } }),
      this.businessPageRepository.findOne({
        where: { id: data.businessPageId, ownerId: userId },
      }),
    ]);
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    if (!businessPage) {
      throw new Error('Business page not found');
    }

    Object.assign(campaign, {
      businessPageId: businessPage.id,
      name: data.name.trim(),
      budget: data.budget ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      status: 'draft' as CampaignLifecycleStatus,
    });
    await Promise.all([
      this.campaignCreativeRepository.delete({ campaignId }),
      this.campaignTargetPlacementRepository.delete({ campaignId }),
    ]);
    await Promise.all([
      this.campaignCreativeRepository.save(
        data.creatives.map((creative) =>
          this.campaignCreativeRepository!.create({
            campaignId,
            placementType: creative.placementType,
            headline: creative.headline?.trim() || null,
            body: creative.body?.trim() || null,
            ctaLabel: creative.ctaLabel?.trim() || null,
            ctaUrl: creative.ctaUrl?.trim() || null,
            mediaUrl: this.getCreativeMediaUrl(creative),
            imageUrl: creative.imageUrl?.trim() || null,
          })
        )
      ),
      this.campaignTargetPlacementRepository.save(
        data.targetPlacements.map((target) =>
          this.campaignTargetPlacementRepository!.create({
            campaignId,
            ...target,
          })
        )
      ),
    ]);
    return this.campaignRepository.save(campaign);
  }

  async updateAdvertisingCampaignStatus(
    userId: string,
    campaignId: string,
    status: CampaignLifecycleStatus
  ) {
    if (
      !this.campaignRepository ||
      !this.campaignCreativeRepository ||
      !this.campaignTargetPlacementRepository
    ) {
      throw new Error('Campaign repositories are not configured');
    }
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId, userId },
    });
    if (!campaign) {
      return { success: false, message: 'Campaign not found' };
    }
    if (status === 'active') {
      const [creatives, targetPlacements] = await Promise.all([
        this.campaignCreativeRepository.find({ where: { campaignId } }),
        this.campaignTargetPlacementRepository.find({ where: { campaignId } }),
      ]);
      if (targetPlacements.length === 0) {
        throw new Error('Campaign requires at least one target placement');
      }
      const missingCreative = targetPlacements.some(
        (target) =>
          !creatives.some(
            (creative) => creative.placementType === target.placementType
          )
      );
      if (missingCreative) {
        throw new Error(
          'Campaign requires creative for every selected placement type'
        );
      }
    }
    campaign.status = status;
    return {
      success: true,
      campaign: await this.campaignRepository.save(campaign),
    };
  }

  async getEligibleOnPageCampaigns(input: {
    channelId?: string;
    communityId?: string;
  }) {
    if (
      !this.campaignRepository ||
      !this.campaignCreativeRepository ||
      !this.campaignTargetPlacementRepository
    ) {
      throw new Error('Campaign repositories are not configured');
    }
    const now = new Date();
    const targets = await this.campaignTargetPlacementRepository.find({
      where: { placementType: 'on-page' },
    });
    const matchingTargets = targets.filter(
      (target) =>
        (target.targetType === 'channel' &&
          target.targetId === input.channelId) ||
        (target.targetType === 'community' &&
          target.targetId === input.communityId)
    );
    const campaignIds = [
      ...new Set(matchingTargets.map((target) => target.campaignId)),
    ];
    if (campaignIds.length === 0) {
      return [];
    }
    const [campaigns, creatives] = await Promise.all([
      this.campaignRepository.find({
        where: { id: In(campaignIds), status: 'active' },
      }),
      this.campaignCreativeRepository.find({
        where: { campaignId: In(campaignIds), placementType: 'on-page' },
      }),
    ]);
    return campaigns
      .filter((campaign) => campaign.startsAt <= now && campaign.endsAt >= now)
      .map((campaign) => ({
        ...campaign,
        creative: (() => {
          const creative = creatives.find(
            (candidate) => candidate.campaignId === campaign.id
          );
          const mediaUrl = creative && this.getCreativeMediaUrl(creative);
          return creative && mediaUrl ? { ...creative, mediaUrl } : null;
        })(),
      }))
      .filter(
        (campaign) =>
          campaign.creative !== null &&
          this.isUsableMediaUrl(campaign.creative.mediaUrl)
      );
  }

  async getEligiblePlaybackCampaigns(input: {
    channelId?: string;
    communityId?: string;
    placementType: 'pre-roll' | 'mid-roll' | 'post-roll';
  }) {
    if (
      !this.campaignRepository ||
      !this.campaignCreativeRepository ||
      !this.campaignTargetPlacementRepository
    ) {
      throw new Error('Campaign repositories are not configured');
    }

    const now = new Date();
    const targets = await this.campaignTargetPlacementRepository.find({
      where: { placementType: input.placementType },
    });
    const matchingTargets = targets.filter(
      (target) =>
        (target.targetType === 'channel' &&
          target.targetId === input.channelId) ||
        (target.targetType === 'community' &&
          target.targetId === input.communityId)
    );
    const campaignIds = [
      ...new Set(matchingTargets.map((target) => target.campaignId)),
    ];
    if (campaignIds.length === 0) {
      return [];
    }

    const [campaigns, creatives] = await Promise.all([
      this.campaignRepository.find({
        where: { id: In(campaignIds), status: 'active' },
      }),
      this.campaignCreativeRepository.find({
        where: {
          campaignId: In(campaignIds),
          placementType: input.placementType,
        },
      }),
    ]);

    return campaigns
      .filter((campaign) => campaign.startsAt <= now && campaign.endsAt >= now)
      .map((campaign) => {
        const target = matchingTargets.find(
          (candidate) => candidate.campaignId === campaign.id
        );
        const creative = creatives.find(
          (candidate) => candidate.campaignId === campaign.id
        );
        const mediaUrl = creative && this.getCreativeMediaUrl(creative);
        if (!target || !mediaUrl || !this.isUsableMediaUrl(mediaUrl)) {
          return null;
        }
        return {
          campaignId: campaign.id,
          businessPageId: campaign.businessPageId,
          campaignName: campaign.name,
          placementType: input.placementType,
          targetType: target.targetType,
          targetId: target.targetId,
          localityMatch:
            target.targetType === 'channel'
              ? 'channel-anchor'
              : 'community-anchor',
          mediaUrl,
          creative: {
            headline: creative.headline,
            body: creative.body,
            ctaLabel: creative.ctaLabel,
            ctaUrl: creative.ctaUrl,
            mediaUrl,
            imageUrl: creative.imageUrl,
          },
        };
      })
      .filter(
        (campaign): campaign is NonNullable<typeof campaign> =>
          campaign !== null
      )
      .sort((left, right) => left.campaignId.localeCompare(right.campaignId));
  }

  async getDonationGoal(month?: number | string, year?: number | string) {
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

    return {
      monthlyGoal: 5000,
      currentAmount,
      donorCount,
      sponsorshipAmount: 0,
      month: period.month,
      year: period.year,
    };
  }

  async getDonations(month?: number | string, year?: number | string) {
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

    const checkout = await this.providerAdapter.createCheckoutSession({
      appScope,
      customData: {
        donation_id: savedDonation.id,
        user_id: userId,
        profile_id: profileId,
      },
    });

    return {
      checkoutUrl: checkout.checkoutUrl,
      donationId: savedDonation.id,
    };
  }

  async getUserDonations(userId: string) {
    return this.donationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelSubscription(userId: string, subscriptionId: string) {
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
    offerId?: string
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

  async confirmOutOfPlatformPayment(paymentId: string, proofImageUrl?: string) {
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

  async releaseFunds(paymentId: string) {
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

  async disputePayment(paymentId: string, reason: string) {
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

  async getPayment(paymentId: string) {
    return this.classifiedPaymentRepository.findOne({
      where: { id: paymentId },
    });
  }

  async getUserPayments(userId: string) {
    return this.classifiedPaymentRepository.find({
      where: [{ buyerId: userId }, { sellerId: userId }],
      order: { createdAt: 'DESC' },
    });
  }

  async markInterestedBuyer(paymentId: string, interestedBuyerId: string) {
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

  async markPaidOutsidePlatform(paymentId: string) {
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
      businessPage = await this.businessPageRepository.save(businessPage);
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

    const checkout = await this.providerAdapter.createCheckoutSession({
      appScope,
      providerPriceRef: variantId,
      customData: {
        business_page_id: businessPage.id,
        community_id: communityId,
        user_id: userId,
        tier,
      },
    });

    return {
      checkoutUrl: checkout.checkoutUrl,
      businessPageId: businessPage.id,
    };
  }

  async getBusinessPage(communityId: string) {
    return this.businessPageRepository.findOne({
      where: { communityId },
    });
  }

  async getOwnerBusinessPages(userId: string) {
    return this.businessPageRepository.find({
      where: { ownerId: userId },
      order: { createdAt: 'ASC' },
    });
  }

  async listActiveBusinessPages() {
    return this.businessPageRepository.find({
      where: { subscriptionStatus: 'active' },
      order: { isFeatured: 'DESC', createdAt: 'ASC' },
    });
  }

  async updateBusinessPage(
    userId: string,
    communityId: string,
    data: {
      name?: string;
      description?: string;
      logoUrl?: string;
      website?: string;
      phone?: string;
      email?: string;
      address?: string;
      pinnedPostId?: string;
      anchorLat?: number;
      anchorLng?: number;
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

  async updateOwnerBusinessPage(
    userId: string,
    businessPageId: string,
    data: {
      name?: string;
      description?: string;
      logoUrl?: string;
      website?: string;
      phone?: string;
      email?: string;
      address?: string;
      pinnedPostId?: string;
      anchorLat?: number;
      anchorLng?: number;
    }
  ) {
    const businessPage = await this.businessPageRepository.findOne({
      where: { id: businessPageId, ownerId: userId },
    });

    if (!businessPage) {
      return { success: false, message: 'Business page not found' };
    }

    Object.assign(businessPage, data);
    await this.businessPageRepository.save(businessPage);

    return { success: true, businessPage };
  }

  async cancelBusinessSubscription(userId: string, communityId: string) {
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

  async getUserTransactions(userId: string) {
    return this.transactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getPortalUrl(userId: string) {
    return {
      portalUrl: `https://my-store.lemonsqueezy.com/billing?user_id=${userId}`,
    };
  }

  async getOrCreateSellerWallet(sellerId: string): Promise<SellerWallet> {
    let wallet = await this.sellerWalletRepository.findOne({
      where: { sellerId },
    });

    if (!wallet) {
      wallet = this.sellerWalletRepository.create({
        sellerId,
        availableBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalPaidOut: 0,
      });
      wallet = await this.sellerWalletRepository.save(wallet);
    }

    return wallet;
  }

  async getSellerWallet(sellerId: string): Promise<SellerWallet | null> {
    return this.sellerWalletRepository.findOne({
      where: { sellerId },
    });
  }

  async updateSellerPayoutInfo(
    sellerId: string,
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

  async getSellerPayoutRequests(sellerId: string): Promise<PayoutRequest[]> {
    return this.payoutRequestRepository.find({
      where: { sellerId },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelPayoutRequest(
    payoutRequestId: string,
    sellerId: string
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

  async getBusinessPagesByCity(cityId: string, communityIds: string[]) {
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

  async getSellerEarningsSummary(sellerId: string) {
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
      const providerEvent = await this.providerAdapter.processWebhook({
        eventType,
        payload,
      });
      const customData = providerEvent.customData;
      await this.billingReconciliationService.publishProviderEvent(
        providerEvent
      );

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
      }
    } catch (err) {
      this.logger.error(`Webhook processing error: ${err?.message}`, err);
    }

    return { received: true };
  }

  async syncLemonSqueezyProducts(appScope?: string): Promise<void> {
    const configsToSync: ProviderCatalogStore[] =
      this.providerAdapter.listCatalogStores(appScope);

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
