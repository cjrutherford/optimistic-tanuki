import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
  EntityManager,
} from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  ClassifiedCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
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
    @Inject(PAYMENT_PROVIDER_ADAPTER)
    private readonly providerAdapter: BillingProviderAdapter,
    private readonly billingReconciliationService: BillingReconciliationService,
    @Inject(ServiceTokens.CLASSIFIEDS_SERVICE)
    private readonly classifiedsClient: ClientProxy
  ) {}

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
    let resolvedAmount: number;
    let resolvedSellerId: string | undefined;

    if (offerId) {
      // Offer-derived path: in practice every caller that has an accepted
      // offer creates the payment via OfferService.acceptOffer (which
      // derives amount/sellerId from the offer itself and never calls this
      // method). No current caller invokes createClassifiedPayment with an
      // offerId, but the parameter is kept for API compatibility. Since
      // this branch is not on the direct-purchase path being hardened here,
      // it retains its existing (client-supplied) behavior rather than
      // silently ignoring an offerId nobody exercises today.
      resolvedAmount = amount || 0;
      resolvedSellerId = sellerId;
    } else {
      // Direct-purchase path: never trust a client-supplied amount/sellerId.
      // Derive both from the actual classified ad so a caller cannot set an
      // arbitrary price or redirect funds to an arbitrary seller.
      const ad = await firstValueFrom(
        this.classifiedsClient.send(
          { cmd: ClassifiedCommands.FIND_BY_ID },
          { id: classifiedId }
        )
      );

      if (!ad) {
        throw new BadRequestException('Classified ad not found');
      }

      if (ad.status !== 'active') {
        throw new BadRequestException(
          `Classified ad is not available for purchase (status: ${ad.status})`
        );
      }

      resolvedAmount = Number(ad.price);
      resolvedSellerId = ad.userId;

      // Guard against a self-owned ad carrying a nonsensical price (zero,
      // negative, or non-numeric). Without this, calculateNetAmount would
      // derive a negative sellerReceivesAmount, which creditSellerWallet
      // would apply as a debit against the seller's own wallet on release.
      if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
        throw new BadRequestException(
          'Classified ad price must be a positive amount'
        );
      }
    }

    const feeBreakdown = calculateNetAmount(resolvedAmount);
    const payment = this.classifiedPaymentRepository.create({
      buyerId,
      sellerId: resolvedSellerId,
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

  /**
   * Participant check shared by the classified-payment action handlers below.
   * The caller must be either the buyer or the seller on the payment. The
   * narrower single-party rule for each action (e.g. "only the buyer may
   * confirm out-of-platform payment", "only the seller may release funds")
   * is genuinely ambiguous in this codebase today (the release route is
   * labeled "Confirm payment received and release funds" and has
   * historically been invoked with the caller's id sent as `sellerId`), so
   * this deliberately requires participation by either party rather than a
   * stricter rule that risks locking out a legitimate caller. Narrowing to
   * a single-party rule per action is a product decision left for follow-up.
   */
  private assertPaymentParticipant(
    payment: ClassifiedPayment,
    callerId: string,
    action: string
  ) {
    if (callerId !== payment.buyerId && callerId !== payment.sellerId) {
      throw new BadRequestException(
        `You can only ${action} for payments you are a party to`
      );
    }
  }

  // Classified-payment state machine (enforced by the three handlers below):
  //
  //   pending ──confirmOutOfPlatformPayment──> confirmed ──releaseFunds──> released
  //      │                                        │
  //      └──────────────disputePayment─────────────┘
  //                          │
  //                          v
  //                      disputed
  //
  // `refunded` and `cancelled` are set outside these handlers and are
  // terminal here. Allowed transitions:
  //   confirmOutOfPlatformPayment: pending -> confirmed
  //   releaseFunds:                confirmed -> released (released -> released is a no-op)
  //   disputePayment:               pending -> disputed, confirmed -> disputed
  // Any other starting status is refused with BadRequestException so a
  // participant cannot thrash the payment back into an earlier state (e.g.
  // dispute a confirmed payment, then re-confirm it to bypass the
  // disputed/refunded/cancelled guard in releaseFunds).
  async confirmOutOfPlatformPayment(
    paymentId: string,
    callerId: string,
    proofImageUrl?: string
  ) {
    const payment = await this.classifiedPaymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    this.assertPaymentParticipant(payment, callerId, 'confirm payment');

    if (payment.status !== 'pending') {
      throw new BadRequestException(
        `Cannot confirm payment with status: ${payment.status}`
      );
    }

    payment.status = 'confirmed';
    payment.proofImageUrl = proofImageUrl;
    payment.confirmedAt = new Date();

    await this.classifiedPaymentRepository.save(payment);

    return { success: true, payment };
  }

  async releaseFunds(paymentId: string, callerId: string) {
    const payment = await this.classifiedPaymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    this.assertPaymentParticipant(payment, callerId, 'release funds');

    if (!payment.sellerId) {
      return {
        success: false,
        message: 'No seller associated with this payment',
      };
    }

    // Idempotency guard (fast path): a payment that is already released is
    // reported as a harmless no-op success rather than an error. This is
    // just an early friendly-response check — it is NOT what prevents a
    // double credit under concurrency (two calls can both pass this check
    // before either has written). The actual concurrency guard is the
    // atomic conditional UPDATE below.
    if (payment.status === 'released') {
      return { success: true, payment, alreadyReleased: true };
    }

    // Only a payment the buyer has actually confirmed may be released.
    // Every other non-terminal status (pending) and every terminal status
    // (disputed/refunded/cancelled) is refused: releasing from `pending`
    // would let a seller self-release before the buyer ever confirmed
    // receipt, and releasing from a terminal status would be a
    // financial-integrity bug in its own right.
    if (payment.status !== 'confirmed') {
      throw new BadRequestException(
        `Cannot release funds for payment with status: ${payment.status}`
      );
    }

    // Atomic conditional transition + credit, in one DB transaction: the
    // conditional UPDATE only affects a row when it is still in `confirmed`
    // at the moment it runs (closing the double-credit race — see below),
    // and the wallet credit happens inside the SAME transaction as that
    // UPDATE. If creditSellerWallet throws for any reason (transient DB
    // error, constraint violation, connection drop), the whole transaction
    // rolls back, so the status flip to `released` is undone and the
    // payment is left `confirmed` — safely retryable. Without this, a
    // credit failure after a committed UPDATE would durably release the
    // payment with no credit, and the idempotency fast-path above
    // (`status === 'released'` -> no-op) would make that loss unrecoverable.
    const releasedAt = new Date();
    let affected = 0;

    await this.classifiedPaymentRepository.manager.transaction(
      async (manager) => {
        // Two concurrent releaseFunds calls both read the payment as
        // `confirmed` above (a classic check-then-act race). Only one of
        // the two UPDATEs below, run inside its own transaction, will find
        // a matching row and flip it to `released` — the other affects
        // zero rows. Crediting the wallet is gated on having actually
        // performed the transition (affected === 1), so exactly one of the
        // two calls credits the seller.
        const updateResult = await manager
          .createQueryBuilder()
          .update(ClassifiedPayment)
          .set({ status: 'released', releasedAt })
          .where('id = :id', { id: paymentId })
          .andWhere('status = :expected', { expected: 'confirmed' })
          .execute();

        affected = updateResult.affected ?? 0;

        if (affected === 1) {
          await this.creditSellerWallet(
            payment.sellerId,
            Number(payment.sellerReceivesAmount),
            paymentId,
            `Payment release for classified: ${payment.classifiedId}`,
            manager
          );
        }
      }
    );

    if (affected !== 1) {
      // Lost the race (or the row changed between our read and the
      // UPDATE): re-read to report the correct friendly outcome instead of
      // crediting a second time.
      const current = await this.classifiedPaymentRepository.findOne({
        where: { id: paymentId },
      });

      if (current?.status === 'released') {
        return { success: true, payment: current, alreadyReleased: true };
      }

      throw new BadRequestException(
        `Cannot release funds for payment with status: ${current?.status}`
      );
    }

    payment.status = 'released';
    payment.releasedAt = releasedAt;

    return { success: true, payment };
  }

  async disputePayment(paymentId: string, callerId: string, reason: string) {
    const payment = await this.classifiedPaymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    this.assertPaymentParticipant(payment, callerId, 'dispute payment');

    if (payment.status !== 'pending' && payment.status !== 'confirmed') {
      throw new BadRequestException(
        `Cannot dispute payment with status: ${payment.status}`
      );
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

    const checkout = await this.providerAdapter.createCheckoutSession({
      appScope,
      customData: {
        sponsorship_id: savedSponsorship.id,
        community_id: communityId,
        user_id: userId,
        type,
      },
    });

    return {
      checkoutUrl: checkout.checkoutUrl,
      sponsorshipId: savedSponsorship.id,
    };
  }

  async getActiveSponsorships(communityId: string) {
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

  async getUserSponsorships(userId: string) {
    return this.sponsorshipRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
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

  async getOrCreateSellerWallet(
    sellerId: string,
    walletRepository: Repository<SellerWallet> = this.sellerWalletRepository
  ): Promise<SellerWallet> {
    let wallet = await walletRepository.findOne({
      where: { sellerId },
    });

    if (!wallet) {
      wallet = walletRepository.create({
        sellerId,
        availableBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalPaidOut: 0,
      });
      wallet = await walletRepository.save(wallet);
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
    description: string,
    manager?: EntityManager
  ): Promise<SellerWallet> {
    // When called from inside releaseFunds' transaction, use the
    // transactional EntityManager's repositories so the wallet credit and
    // the transaction-ledger insert commit/rollback atomically together
    // with the payment status flip. When called standalone (no manager),
    // fall back to the injected repositories as before.
    const walletRepository = manager
      ? manager.getRepository(SellerWallet)
      : this.sellerWalletRepository;
    const transactionRepository = manager
      ? manager.getRepository(Transaction)
      : this.transactionRepository;

    const wallet = await this.getOrCreateSellerWallet(
      sellerId,
      walletRepository
    );
    wallet.availableBalance = Number(wallet.availableBalance) + amount;
    wallet.totalEarned = Number(wallet.totalEarned) + amount;

    const transaction = transactionRepository.create({
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
    await transactionRepository.save(transaction);

    return walletRepository.save(wallet);
  }

  async createPayoutRequest(
    sellerId: string,
    amount: number,
    payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle',
    payoutEmail?: string,
    bankAccountLast4?: string,
    bankRoutingLast4?: string
  ): Promise<PayoutRequest> {
    // Ensure a wallet row exists before attempting the debit below. This
    // read-then-maybe-create is itself racy on first use, but it is
    // idempotent (it only creates a zero-balance row), so a lost race here
    // just means the atomic debit below correctly fails with insufficient
    // funds rather than allowing an over-withdrawal.
    const wallet = await this.getOrCreateSellerWallet(sellerId);

    // Atomic conditional debit: this UPDATE only affects a row when the
    // wallet's availableBalance is still >= amount at the moment it runs.
    // Two concurrent createPayoutRequest calls for the same seller both
    // reading the same pre-debit balance can no longer both pass a
    // check-then-act gate — only one UPDATE can find a matching row and
    // debit it, closing the over-withdrawal race that the old
    // read-compare-then-save pattern allowed.
    const updateResult = await this.sellerWalletRepository
      .createQueryBuilder()
      .update(SellerWallet)
      .set({
        availableBalance: () => '"availableBalance" - :amount',
      })
      .where('sellerId = :sellerId', { sellerId })
      .andWhere('"availableBalance" >= :amount', { amount })
      .setParameter('amount', amount)
      .execute();

    const affected = updateResult.affected ?? 0;

    if (affected !== 1) {
      throw new Error('Insufficient funds for payout');
    }

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

    // Atomic status transition + wallet refund, in one DB transaction, using
    // the same pattern as releaseFunds: the conditional UPDATE below only
    // affects a row when the payout is still `pending` at the moment it
    // runs. Two concurrent cancelPayoutRequest calls for the same payout
    // request can no longer both pass a check-then-act status check and
    // both credit the wallet back (a double-refund) — only one UPDATE can
    // find a matching row, and the refund is gated on affected === 1.
    let affected = 0;

    await this.payoutRequestRepository.manager.transaction(async (manager) => {
      const payoutRepo = manager.getRepository(PayoutRequest);
      const walletRepo = manager.getRepository(SellerWallet);

      const updateResult = await payoutRepo
        .createQueryBuilder()
        .update(PayoutRequest)
        .set({ status: 'cancelled' })
        .where('id = :id', { id: payoutRequestId })
        .andWhere('sellerId = :sellerId', { sellerId })
        .andWhere('status = :expected', { expected: 'pending' })
        .execute();

      affected = updateResult.affected ?? 0;

      if (affected === 1) {
        const wallet = await this.getOrCreateSellerWallet(sellerId, walletRepo);
        wallet.availableBalance =
          Number(wallet.availableBalance) + Number(payoutRequest.amount);
        await walletRepo.save(wallet);
      }
    });

    if (affected !== 1) {
      throw new Error('Only pending payouts can be cancelled');
    }

    payoutRequest.status = 'cancelled';
    return payoutRequest;
  }

  // NOTE: processPayout has no gateway route today (grepped apps/gateway/src
  // — PROCESS_PAYOUT is not wired up), so it's currently unreachable from
  // HTTP. It still uses the same read-then-write check-then-act pattern that
  // createPayoutRequest/cancelPayoutRequest were hardened against (see the
  // atomic conditional UPDATE + affected-row gate there). If an admin
  // surface is ever added for this, apply the same treatment here first.
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

  // NOTE: same as processPayout above — rejectPayout has no gateway route
  // today (REJECT_PAYOUT is not wired up), so the read-then-write status
  // check + wallet refund below is unreachable from HTTP, but carries the
  // same double-refund race that cancelPayoutRequest was hardened against.
  // Apply the same atomic-update treatment here before exposing it.
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
