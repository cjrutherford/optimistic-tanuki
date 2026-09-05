import { Logger } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { of } from 'rxjs';
import { ClassifiedCommands } from '@optimistic-tanuki/constants';
import {
  BillingProviderAdapter,
  CreateCheckoutInput,
  ProcessWebhookInput,
  ProviderCatalogStore,
  ProviderWebhookResult,
} from '@optimistic-tanuki/payments-domain';
import { PaymentService } from './payment.service';
import { BusinessPage } from '../../entities/business-page.entity';
import { ClassifiedPayment } from '../../entities/classified-payment.entity';
import { CommunitySponsorship } from '../../entities/community-sponsorship.entity';
import { Donation } from '../../entities/donation.entity';
import { PayoutRequest } from '../../entities/payout-request.entity';
import { SellerWallet } from '../../entities/seller-wallet.entity';
import { calculateNetAmount } from '../utils/platform-fee.util';

/**
 * Explicitly named mock surface rather than an index-signature record, so the
 * repository doubles stay type-checked under
 * `noPropertyAccessFromIndexSignature`.
 */
interface MockRepository {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  createQueryBuilder: jest.Mock;
  manager: {
    transaction: jest.Mock;
    getRepository: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
}

function repository(overrides: Partial<MockRepository> = {}): MockRepository {
  const repo = {
    create: jest.fn((input: unknown) => input),
    save: jest.fn(async (input: object) => ({ id: 'saved-id', ...input })),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(),
  } as unknown as MockRepository;

  // Default transactional manager: hands the callback back a manager whose
  // getRepository/createQueryBuilder resolve to this same repo. Tests that
  // need cross-repository routing inside a transaction replace `.manager`.
  repo.manager = {
    transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) =>
      cb(repo.manager)
    ),
    getRepository: jest.fn(() => repo),
    createQueryBuilder: jest.fn((...args: unknown[]) =>
      repo.createQueryBuilder(...args)
    ),
  };

  Object.assign(repo, overrides);
  return repo;
}

/**
 * Provider adapter double whose webhook result, catalog stores and failure
 * behaviour are configurable per test — `processWebhook` is the seam every
 * PaymentService.processWebhook branch reads its custom data from, and
 * `listCatalogStores` is what drives syncLemonSqueezyProducts' outer loop.
 */
class ConfigurableProviderAdapter implements BillingProviderAdapter {
  checkoutInputs: CreateCheckoutInput[] = [];
  webhookInputs: ProcessWebhookInput[] = [];
  webhookCustomData: Record<string, string> = {};
  webhookError: Error | null = null;
  catalogStores: ProviderCatalogStore[] = [];
  catalogScopes: (string | undefined)[] = [];

  async createCheckoutSession(input: CreateCheckoutInput) {
    this.checkoutInputs.push(input);
    return {
      provider: 'lemon-squeezy' as const,
      checkoutUrl: `provider-checkout:${input.providerPriceRef ?? 'fallback'}`,
      providerReference: input.providerPriceRef ?? 'fallback',
    };
  }

  async processWebhook(input: ProcessWebhookInput) {
    this.webhookInputs.push(input);
    if (this.webhookError) {
      throw this.webhookError;
    }
    return {
      provider: 'lemon-squeezy' as const,
      eventType: input.eventType,
      customData: this.webhookCustomData,
      rawPayload: input.payload,
    };
  }

  listCatalogStores(appScope?: string): ProviderCatalogStore[] {
    this.catalogScopes.push(appScope);
    return this.catalogStores;
  }
}

class RecordingBillingReconciliationService {
  events: ProviderWebhookResult[] = [];

  async publishProviderEvent(event: ProviderWebhookResult): Promise<void> {
    this.events.push(event);
  }
}

interface MockClassifiedsClient {
  send: jest.Mock;
}

function createClassifiedsClient(
  ad: Record<string, unknown> | null = null,
  ownedClassifiedIds: string[] = []
): MockClassifiedsClient {
  return {
    send: jest.fn((pattern: { cmd: string }) => {
      if (pattern.cmd === ClassifiedCommands.FIND_BY_USER) {
        return of(ownedClassifiedIds);
      }
      return of(ad);
    }),
  };
}

interface Harness {
  service: PaymentService;
  providerAdapter: ConfigurableProviderAdapter;
  billingReconciliationService: RecordingBillingReconciliationService;
  donationRepository: MockRepository;
  classifiedPaymentRepository: MockRepository;
  sellerWalletRepository: MockRepository;
  payoutRequestRepository: MockRepository;
  businessPageRepository: MockRepository;
  sponsorshipRepository: MockRepository;
  transactionRepository: MockRepository;
  productRepository: MockRepository;
  classifiedsClient: MockClassifiedsClient;
}

function createHarness(
  overrides: Partial<{
    donationRepository: MockRepository;
    classifiedPaymentRepository: MockRepository;
    sellerWalletRepository: MockRepository;
    payoutRequestRepository: MockRepository;
    businessPageRepository: MockRepository;
    sponsorshipRepository: MockRepository;
    transactionRepository: MockRepository;
    productRepository: MockRepository;
    providerAdapter: ConfigurableProviderAdapter;
    classifiedsClient: MockClassifiedsClient;
  }> = {}
): Harness {
  const donationRepository = overrides.donationRepository ?? repository();
  const classifiedPaymentRepository =
    overrides.classifiedPaymentRepository ?? repository();
  const sellerWalletRepository =
    overrides.sellerWalletRepository ?? repository();
  const payoutRequestRepository =
    overrides.payoutRequestRepository ?? repository();
  const businessPageRepository =
    overrides.businessPageRepository ?? repository();
  const sponsorshipRepository = overrides.sponsorshipRepository ?? repository();
  const transactionRepository = overrides.transactionRepository ?? repository();
  const productRepository = overrides.productRepository ?? repository();
  const providerAdapter =
    overrides.providerAdapter ?? new ConfigurableProviderAdapter();
  const classifiedsClient =
    overrides.classifiedsClient ?? createClassifiedsClient();
  const billingReconciliationService =
    new RecordingBillingReconciliationService();

  const service = new PaymentService(
    donationRepository as never,
    classifiedPaymentRepository as never,
    sellerWalletRepository as never,
    payoutRequestRepository as never,
    businessPageRepository as never,
    sponsorshipRepository as never,
    transactionRepository as never,
    productRepository as never,
    providerAdapter,
    billingReconciliationService as never,
    classifiedsClient as never
  );

  return {
    service,
    providerAdapter,
    billingReconciliationService,
    donationRepository,
    classifiedPaymentRepository,
    sellerWalletRepository,
    payoutRequestRepository,
    businessPageRepository,
    sponsorshipRepository,
    transactionRepository,
    productRepository,
    classifiedsClient,
  };
}

function buildClassifiedPayment(
  overrides: Partial<ClassifiedPayment> = {}
): ClassifiedPayment {
  return {
    id: 'payment-1',
    classifiedId: 'classified-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    interestedBuyerId: null,
    amount: 100,
    platformFeeAmount: 10,
    sellerReceivesAmount: 90,
    offerId: null,
    paymentMethod: 'card',
    status: 'pending',
    proofImageUrl: null,
    disputeReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    confirmedAt: null,
    releasedAt: null,
    ...overrides,
  } as ClassifiedPayment;
}

function buildWallet(overrides: Partial<SellerWallet> = {}): SellerWallet {
  return {
    id: 'wallet-1',
    sellerId: 'seller-1',
    availableBalance: 0,
    pendingBalance: 0,
    totalEarned: 0,
    totalPaidOut: 0,
    payoutMethod: null,
    payoutEmail: null,
    bankAccountLast4: null,
    bankRoutingLast4: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    lastPayoutAt: null,
    ...overrides,
  } as unknown as SellerWallet;
}

function buildPayoutRequest(
  overrides: Partial<PayoutRequest> = {}
): PayoutRequest {
  return {
    id: 'payout-1',
    sellerId: 'seller-1',
    amount: 25,
    status: 'pending',
    payoutMethod: 'paypal',
    payoutEmail: null,
    bankAccountLast4: null,
    bankRoutingLast4: null,
    transactionId: null,
    rejectionReason: null,
    processedBy: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    processedAt: null,
    ...overrides,
  } as PayoutRequest;
}

function buildBusinessPage(
  overrides: Partial<BusinessPage> = {}
): BusinessPage {
  return {
    id: 'business-page-1',
    communityId: 'community-1',
    ownerId: 'user-1',
    tier: 'basic',
    subscriptionStatus: 'inactive',
    ...overrides,
  } as BusinessPage;
}

describe('PaymentService donation period normalization', () => {
  it.each([
    ['numeric month/year', 3, 2026, 3, 2026],
    ['numeric-string month/year', '11', '2025', 11, 2025],
  ])(
    'accepts a valid %s and queries that exact calendar window',
    async (_label, month, year, expectedMonth, expectedYear) => {
      const donationRepository = repository();
      const { service } = createHarness({ donationRepository });

      const result = await service.getDonationGoal(
        month as number | string,
        year as number | string
      );

      expect(result.month).toBe(expectedMonth);
      expect(result.year).toBe(expectedYear);

      const where = donationRepository.find.mock.calls[0][0].where;
      expect(where.status).toBe('completed');
      expect(where.createdAt).toBeInstanceOf(FindOperator);
      expect(where.createdAt.value).toEqual([
        new Date(expectedYear, expectedMonth - 1, 1),
        new Date(expectedYear, expectedMonth, 0, 23, 59, 59),
      ]);
    }
  );

  // Each field falls back independently, so the expectations name which of
  // the two is expected to survive the rejected input.
  it.each([
    ['an out-of-range month', 13, 2026, 'current', 2026],
    ['a zero month', 0, 2026, 'current', 2026],
    ['an out-of-range year', 6, 1969, 6, 'current'],
    ['non-numeric input', 'not-a-month', 'not-a-year', 'current', 'current'],
    ['missing input', undefined, undefined, 'current', 'current'],
  ])(
    'falls back to the current period and warns for %s',
    async (_label, month, year, expectedMonth, expectedYear) => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const { service } = createHarness();
      const now = new Date();

      try {
        const result = await service.getDonationGoal(
          month as number | string | undefined,
          year as number | string | undefined
        );

        expect(result.month).toBe(
          expectedMonth === 'current' ? now.getMonth() + 1 : expectedMonth
        );
        expect(result.year).toBe(
          expectedYear === 'current' ? now.getFullYear() : expectedYear
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid donation period received')
        );
      } finally {
        warn.mockRestore();
      }
    }
  );
});

describe('PaymentService donation reads', () => {
  it('aggregates completed donations and active sponsorships into the monthly goal', async () => {
    const donationRepository = repository({
      find: jest.fn(async () => [
        { amount: '25.50', userId: 'user-1' },
        { amount: 10, userId: 'user-1' },
        { amount: '4.50', userId: 'user-2' },
      ]),
    });
    const sponsorshipRepository = repository({
      find: jest.fn(async () => [{ amount: '100' }, { amount: 60 }]),
    });
    const { service } = createHarness({
      donationRepository,
      sponsorshipRepository,
    });

    await expect(service.getDonationGoal(4, 2026)).resolves.toEqual({
      monthlyGoal: 5000,
      // 25.50 + 10 + 4.50 donations, plus 160 of active sponsorship.
      currentAmount: 200,
      // Two distinct donors across three donations.
      donorCount: 2,
      sponsorshipAmount: 160,
      month: 4,
      year: 2026,
    });
    expect(sponsorshipRepository.find).toHaveBeenCalledWith({
      where: { status: 'active' },
    });
  });

  it('lists every donation in the period newest first', async () => {
    const donations = [{ id: 'donation-1' }];
    const donationRepository = repository({
      find: jest.fn(async () => donations),
    });
    const { service } = createHarness({ donationRepository });

    await expect(service.getDonations(2, 2026)).resolves.toBe(donations);
    expect(donationRepository.find).toHaveBeenCalledWith({
      where: { createdAt: expect.any(FindOperator) },
      order: { createdAt: 'DESC' },
    });
  });

  it('lists a single user donations newest first', async () => {
    const donations = [{ id: 'donation-1' }];
    const donationRepository = repository({
      find: jest.fn(async () => donations),
    });
    const { service } = createHarness({ donationRepository });

    await expect(service.getUserDonations('user-1')).resolves.toBe(donations);
    expect(donationRepository.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { createdAt: 'DESC' },
    });
  });
});

describe('PaymentService.cancelSubscription', () => {
  it('marks the donation cancelled and stamps the cancellation time', async () => {
    const donation = {
      id: 'donation-1',
      status: 'completed',
      cancelledAt: null,
    } as unknown as Donation;
    const donationRepository = repository({
      findOne: jest.fn(async () => donation),
    });
    const { service } = createHarness({ donationRepository });

    await expect(
      service.cancelSubscription('user-1', 'sub-1')
    ).resolves.toEqual({ success: true });

    expect(donationRepository.findOne).toHaveBeenCalledWith({
      where: { lemonSqueezySubscriptionId: 'sub-1', userId: 'user-1' },
    });
    expect(donation.status).toBe('cancelled');
    expect(donation.cancelledAt).toBeInstanceOf(Date);
    expect(donationRepository.save).toHaveBeenCalledWith(donation);
  });

  it('reports a missing subscription without writing anything', async () => {
    const donationRepository = repository();
    const { service } = createHarness({ donationRepository });

    await expect(
      service.cancelSubscription('user-1', 'missing-sub')
    ).resolves.toEqual({
      success: false,
      message: 'Subscription not found',
    });
    expect(donationRepository.save).not.toHaveBeenCalled();
  });
});

describe('PaymentService.createClassifiedPayment offer-derived path', () => {
  it('uses the supplied amount and seller without consulting the classifieds service', async () => {
    const classifiedPaymentRepository = repository();
    const classifiedsClient = createClassifiedsClient();
    const { service } = createHarness({
      classifiedPaymentRepository,
      classifiedsClient,
    });

    await service.createClassifiedPayment(
      'buyer-1',
      'classified-1',
      'card',
      50,
      'seller-9',
      'offer-1'
    );

    // The offer path is authoritative on its own: no classified lookup runs.
    expect(classifiedsClient.send).not.toHaveBeenCalled();

    const fees = calculateNetAmount(50);
    expect(classifiedPaymentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerId: 'buyer-1',
        sellerId: 'seller-9',
        offerId: 'offer-1',
        amount: fees.gross,
        platformFeeAmount: fees.fee,
        sellerReceivesAmount: fees.net,
        status: 'pending',
      })
    );
  });

  it('defaults a missing offer amount to zero', async () => {
    const classifiedPaymentRepository = repository();
    const { service } = createHarness({ classifiedPaymentRepository });

    await service.createClassifiedPayment(
      'buyer-1',
      'classified-1',
      'card',
      undefined,
      undefined,
      'offer-1'
    );

    expect(classifiedPaymentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 0, sellerId: undefined })
    );
  });
});

describe('PaymentService classified payment lookups for missing rows', () => {
  it.each([
    [
      'confirmOutOfPlatformPayment',
      (service: PaymentService) =>
        service.confirmOutOfPlatformPayment('missing', 'buyer-1'),
    ],
    [
      'releaseFunds',
      (service: PaymentService) => service.releaseFunds('missing', 'buyer-1'),
    ],
    [
      'disputePayment',
      (service: PaymentService) =>
        service.disputePayment('missing', 'buyer-1', 'reason'),
    ],
    [
      'markInterestedBuyer',
      (service: PaymentService) =>
        service.markInterestedBuyer('missing', 'buyer-2'),
    ],
    [
      'markPaidOutsidePlatform',
      (service: PaymentService) => service.markPaidOutsidePlatform('missing'),
    ],
  ])('%s reports a missing payment without writing', async (_label, invoke) => {
    const classifiedPaymentRepository = repository();
    const { service } = createHarness({ classifiedPaymentRepository });

    await expect(invoke(service)).resolves.toEqual({
      success: false,
      message: 'Payment not found',
    });
    expect(classifiedPaymentRepository.save).not.toHaveBeenCalled();
  });

  it('getPayment refuses a missing payment with NotFoundException', async () => {
    const { service } = createHarness();

    await expect(service.getPayment('missing', 'buyer-1')).rejects.toThrow(
      'Payment not found'
    );
  });
});

describe('PaymentService.releaseFunds seller resolution failures', () => {
  it('refuses to release when the classified has no resolvable owner', async () => {
    const payment = buildClassifiedPayment({ status: 'confirmed' });
    const classifiedPaymentRepository = repository({
      findOne: jest.fn(async () => payment),
    });
    const sellerWalletRepository = repository();
    // The classifieds service returns nothing for this ad, so there is no
    // canonical seller to credit.
    const classifiedsClient = createClassifiedsClient(null);
    const { service } = createHarness({
      classifiedPaymentRepository,
      sellerWalletRepository,
      classifiedsClient,
    });

    await expect(service.releaseFunds('payment-1', 'buyer-1')).rejects.toThrow(
      'Classified seller not found'
    );
    expect(sellerWalletRepository.save).not.toHaveBeenCalled();
  });

  it('reports the current status when the conditional UPDATE loses the race to a non-release transition', async () => {
    const payment = buildClassifiedPayment({ status: 'confirmed' });
    const classifiedPaymentRepository = repository({
      findOne: jest
        .fn()
        // The first read sees `confirmed`...
        .mockResolvedValueOnce(payment)
        // ...but a concurrent dispute landed before the UPDATE ran.
        .mockResolvedValueOnce(buildClassifiedPayment({ status: 'disputed' })),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn(function (this: unknown) {
          return this;
        }),
        set: jest.fn(function (this: unknown) {
          return this;
        }),
        where: jest.fn(function (this: unknown) {
          return this;
        }),
        andWhere: jest.fn(function (this: unknown) {
          return this;
        }),
        execute: jest.fn(async () => ({ affected: 0 })),
      })),
    });
    const sellerWalletRepository = repository();
    const { service } = createHarness({
      classifiedPaymentRepository,
      sellerWalletRepository,
      classifiedsClient: createClassifiedsClient({ userId: 'seller-1' }),
    });

    await expect(service.releaseFunds('payment-1', 'buyer-1')).rejects.toThrow(
      'Cannot release funds for payment with status: disputed'
    );
    expect(sellerWalletRepository.save).not.toHaveBeenCalled();
  });
});

describe('PaymentService buyer-interest and out-of-band settlement flags', () => {
  it('records the interested buyer on the payment', async () => {
    const payment = buildClassifiedPayment();
    const classifiedPaymentRepository = repository({
      findOne: jest.fn(async () => payment),
    });
    const { service } = createHarness({ classifiedPaymentRepository });

    const result = await service.markInterestedBuyer('payment-1', 'buyer-7');

    expect(result).toEqual({ success: true, payment });
    expect(payment.interestedBuyerId).toBe('buyer-7');
    expect(classifiedPaymentRepository.save).toHaveBeenCalledWith(payment);
  });

  it('marks a payment settled outside the platform as released', async () => {
    const payment = buildClassifiedPayment();
    const classifiedPaymentRepository = repository({
      findOne: jest.fn(async () => payment),
    });
    const { service } = createHarness({ classifiedPaymentRepository });

    const result = await service.markPaidOutsidePlatform('payment-1');

    expect(result).toEqual({ success: true, payment });
    expect(payment.status).toBe('released');
    expect(payment.releasedAt).toBeInstanceOf(Date);
    expect(classifiedPaymentRepository.save).toHaveBeenCalledWith(payment);
  });
});

describe('PaymentService business page lifecycle', () => {
  it('reuses an existing business page and falls back when no provider variant is mapped', async () => {
    const existingPage = buildBusinessPage({ id: 'existing-page' });
    const businessPageRepository = repository({
      findOne: jest.fn(async () => existingPage),
    });
    // No active LS product for this scope/tier: the checkout must still be
    // created, with no providerPriceRef, and the gap must be logged.
    const productRepository = repository({
      findOne: jest.fn(async () => null),
    });
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { service, providerAdapter } = createHarness({
      businessPageRepository,
      productRepository,
    });

    try {
      await expect(
        service.createBusinessCheckout(
          'user-1',
          'community-1',
          'pro',
          'local-hub'
        )
      ).resolves.toEqual({
        checkoutUrl: 'provider-checkout:fallback',
        businessPageId: 'existing-page',
      });

      // An existing page is reused rather than duplicated.
      expect(businessPageRepository.create).not.toHaveBeenCalled();
      expect(businessPageRepository.save).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('No Lemon Squeezy variant found')
      );
      expect(providerAdapter.checkoutInputs[0]).toEqual({
        appScope: 'local-hub',
        providerPriceRef: undefined,
        customData: {
          business_page_id: 'existing-page',
          community_id: 'community-1',
          user_id: 'user-1',
          tier: 'pro',
        },
      });
    } finally {
      warn.mockRestore();
    }
  });

  it('reads a business page by community', async () => {
    const page = buildBusinessPage();
    const businessPageRepository = repository({
      findOne: jest.fn(async () => page),
    });
    const { service } = createHarness({ businessPageRepository });

    await expect(service.getBusinessPage('community-1')).resolves.toBe(page);
    expect(businessPageRepository.findOne).toHaveBeenCalledWith({
      where: { communityId: 'community-1' },
    });
  });

  it('applies owner edits to a business page', async () => {
    const page = buildBusinessPage();
    const businessPageRepository = repository({
      findOne: jest.fn(async () => page),
    });
    const { service } = createHarness({ businessPageRepository });

    const result = await service.updateBusinessPage('user-1', 'community-1', {
      name: 'Tanuki Coffee',
      phone: '555-0100',
    });

    expect(result).toEqual({ success: true, businessPage: page });
    expect(page.name).toBe('Tanuki Coffee');
    expect(page.phone).toBe('555-0100');
    expect(businessPageRepository.findOne).toHaveBeenCalledWith({
      where: { communityId: 'community-1', ownerId: 'user-1' },
    });
    expect(businessPageRepository.save).toHaveBeenCalledWith(page);
  });

  it.each([
    [
      'updateBusinessPage',
      (service: PaymentService) =>
        service.updateBusinessPage('user-1', 'community-1', { name: 'x' }),
    ],
    [
      'cancelBusinessSubscription',
      (service: PaymentService) =>
        service.cancelBusinessSubscription('user-1', 'community-1'),
    ],
  ])(
    '%s reports a page the caller does not own as not found without writing',
    async (_label, invoke) => {
      const businessPageRepository = repository();
      const { service } = createHarness({ businessPageRepository });

      await expect(invoke(service)).resolves.toEqual({
        success: false,
        message: 'Business page not found',
      });
      expect(businessPageRepository.save).not.toHaveBeenCalled();
    }
  );

  it('cancels an owned business subscription', async () => {
    const page = buildBusinessPage({ subscriptionStatus: 'active' });
    const businessPageRepository = repository({
      findOne: jest.fn(async () => page),
    });
    const { service } = createHarness({ businessPageRepository });

    await expect(
      service.cancelBusinessSubscription('user-1', 'community-1')
    ).resolves.toEqual({ success: true });
    expect(page.subscriptionStatus).toBe('cancelled');
    expect(businessPageRepository.save).toHaveBeenCalledWith(page);
  });

  it('orders city business listings by feature flag, tier, spot type then age', async () => {
    const businesses = [buildBusinessPage()];
    const queryBuilder = {
      where: jest.fn(() => queryBuilder),
      andWhere: jest.fn(() => queryBuilder),
      orderBy: jest.fn(() => queryBuilder),
      addOrderBy: jest.fn(() => queryBuilder),
      getMany: jest.fn(async () => businesses),
    };
    const businessPageRepository = repository({
      createQueryBuilder: jest.fn(() => queryBuilder),
    });
    const { service } = createHarness({ businessPageRepository });

    await expect(
      service.getBusinessPagesByCity('city-1', ['community-1', 'community-2'])
    ).resolves.toBe(businesses);

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'business.communityId IN (:...ids)',
      { ids: ['city-1', 'community-1', 'community-2'] }
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'business.subscriptionStatus = :status',
      { status: 'active' }
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'business.isFeatured',
      'DESC'
    );
    expect(queryBuilder.addOrderBy).toHaveBeenCalledTimes(3);
    expect(queryBuilder.addOrderBy).toHaveBeenLastCalledWith(
      'business.createdAt',
      'ASC'
    );
  });

  it.each([
    ['an empty community list', [] as string[]],
    ['a missing community list', undefined],
  ])(
    'returns no city listings for %s without querying',
    async (_label, communityIds) => {
      const businessPageRepository = repository();
      const { service } = createHarness({ businessPageRepository });

      await expect(
        service.getBusinessPagesByCity(
          'city-1',
          communityIds as unknown as string[]
        )
      ).resolves.toEqual([]);
      expect(businessPageRepository.createQueryBuilder).not.toHaveBeenCalled();
    }
  );
});

describe('PaymentService sponsorships and ledger reads', () => {
  it('creates a pending sponsorship spanning the requested number of months', async () => {
    const sponsorshipRepository = repository({
      save: jest.fn(async (input: object) => ({
        id: 'sponsorship-1',
        ...input,
      })),
    });
    const { service, providerAdapter } = createHarness({
      sponsorshipRepository,
    });

    const before = Date.now();
    const result = await service.createSponsorshipCheckout(
      'user-1',
      'community-1',
      'banner',
      'Buy our beans',
      'local-hub',
      3,
      'business-page-1'
    );
    const after = Date.now();

    expect(result).toEqual({
      checkoutUrl: 'provider-checkout:fallback',
      sponsorshipId: 'sponsorship-1',
    });

    const created = sponsorshipRepository.create.mock
      .calls[0][0] as CommunitySponsorship;
    expect(created).toEqual(
      expect.objectContaining({
        communityId: 'community-1',
        businessPageId: 'business-page-1',
        userId: 'user-1',
        type: 'banner',
        adContent: 'Buy our beans',
        amount: 0,
        status: 'pending',
        months: 3,
      })
    );
    // Three 30-day months from "now", bounded by the clock either side of
    // the call rather than by an exact timestamp.
    const durationMs = 3 * 30 * 24 * 60 * 60 * 1000;
    expect(created.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + durationMs
    );
    expect(created.expiresAt.getTime()).toBeLessThanOrEqual(after + durationMs);
    expect(providerAdapter.checkoutInputs[0].customData).toEqual({
      sponsorship_id: 'sponsorship-1',
      community_id: 'community-1',
      user_id: 'user-1',
      type: 'banner',
    });
  });

  it('defaults a sponsorship to a single month', async () => {
    const sponsorshipRepository = repository({
      save: jest.fn(async (input: object) => ({
        id: 'sponsorship-2',
        ...input,
      })),
    });
    const { service } = createHarness({ sponsorshipRepository });

    await service.createSponsorshipCheckout(
      'user-1',
      'community-1',
      'sticky-ad',
      undefined,
      'local-hub'
    );

    expect(sponsorshipRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        months: 1,
        adContent: undefined,
        businessPageId: undefined,
      })
    );
  });

  it('restricts active sponsorships to the currently running window', async () => {
    const sponsorships = [{ id: 'sponsorship-1' }];
    const sponsorshipRepository = repository({
      find: jest.fn(async () => sponsorships),
    });
    const { service } = createHarness({ sponsorshipRepository });

    await expect(service.getActiveSponsorships('community-1')).resolves.toBe(
      sponsorships
    );

    const where = sponsorshipRepository.find.mock.calls[0][0].where;
    expect(where.communityId).toBe('community-1');
    expect(where.status).toBe('active');
    expect(where.startsAt.type).toBe('lessThanOrEqual');
    expect(where.expiresAt.type).toBe('moreThanOrEqual');
  });

  it('lists a user sponsorships newest first', async () => {
    const sponsorships = [{ id: 'sponsorship-1' }];
    const sponsorshipRepository = repository({
      find: jest.fn(async () => sponsorships),
    });
    const { service } = createHarness({ sponsorshipRepository });

    await expect(service.getUserSponsorships('user-1')).resolves.toBe(
      sponsorships
    );
    expect(sponsorshipRepository.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { createdAt: 'DESC' },
    });
  });

  it('lists a user transactions newest first', async () => {
    const transactions = [{ id: 'transaction-1' }];
    const transactionRepository = repository({
      find: jest.fn(async () => transactions),
    });
    const { service } = createHarness({ transactionRepository });

    await expect(service.getUserTransactions('user-1')).resolves.toBe(
      transactions
    );
    expect(transactionRepository.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { createdAt: 'DESC' },
    });
  });

  it('builds a per-user billing portal URL', async () => {
    const { service } = createHarness();

    await expect(service.getPortalUrl('user-42')).resolves.toEqual({
      portalUrl: 'https://my-store.lemonsqueezy.com/billing?user_id=user-42',
    });
  });
});

describe('PaymentService seller wallet', () => {
  it('returns an existing wallet without creating one', async () => {
    const wallet = buildWallet();
    const sellerWalletRepository = repository({
      findOne: jest.fn(async () => wallet),
    });
    const { service } = createHarness({ sellerWalletRepository });

    await expect(service.getOrCreateSellerWallet('seller-1')).resolves.toBe(
      wallet
    );
    expect(sellerWalletRepository.create).not.toHaveBeenCalled();
    expect(sellerWalletRepository.save).not.toHaveBeenCalled();
  });

  it('creates a zero-balance wallet on first use', async () => {
    const sellerWalletRepository = repository();
    const { service } = createHarness({ sellerWalletRepository });

    const wallet = await service.getOrCreateSellerWallet('seller-1');

    expect(sellerWalletRepository.create).toHaveBeenCalledWith({
      sellerId: 'seller-1',
      availableBalance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      totalPaidOut: 0,
    });
    expect(wallet).toEqual(
      expect.objectContaining({ sellerId: 'seller-1', availableBalance: 0 })
    );
  });

  it('reads a seller wallet without creating one when absent', async () => {
    const sellerWalletRepository = repository();
    const { service } = createHarness({ sellerWalletRepository });

    await expect(service.getSellerWallet('seller-1')).resolves.toBeNull();
    expect(sellerWalletRepository.findOne).toHaveBeenCalledWith({
      where: { sellerId: 'seller-1' },
    });
    expect(sellerWalletRepository.create).not.toHaveBeenCalled();
  });

  it('stores the seller payout details', async () => {
    const wallet = buildWallet();
    const sellerWalletRepository = repository({
      findOne: jest.fn(async () => wallet),
    });
    const { service } = createHarness({ sellerWalletRepository });

    await service.updateSellerPayoutInfo(
      'seller-1',
      'bank-transfer',
      'seller@example.com',
      '4321',
      '8765'
    );

    expect(sellerWalletRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        payoutMethod: 'bank-transfer',
        payoutEmail: 'seller@example.com',
        bankAccountLast4: '4321',
        bankRoutingLast4: '8765',
      })
    );
  });

  it('clears omitted payout details to null rather than leaving stale values', async () => {
    const wallet = buildWallet({
      payoutEmail: 'old@example.com',
      bankAccountLast4: '1111',
      bankRoutingLast4: '2222',
    } as Partial<SellerWallet>);
    const sellerWalletRepository = repository({
      findOne: jest.fn(async () => wallet),
    });
    const { service } = createHarness({ sellerWalletRepository });

    await service.updateSellerPayoutInfo('seller-1', 'venmo');

    expect(sellerWalletRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        payoutMethod: 'venmo',
        payoutEmail: null,
        bankAccountLast4: null,
        bankRoutingLast4: null,
      })
    );
  });
});

describe('PaymentService payout requests', () => {
  /**
   * Query-builder double for the atomic debit. `set` deliberately invokes a
   * function-valued column the way TypeORM does when turning it into raw
   * SQL, so the debit expression itself is asserted rather than left as an
   * unevaluated closure.
   */
  function createDebitQueryBuilder(wallet: { availableBalance: number }) {
    const state: { rawSql?: string; amount?: number } = {};
    const qb = {
      state,
      update: jest.fn(() => qb),
      set: jest.fn((values: Record<string, unknown>) => {
        for (const value of Object.values(values)) {
          if (typeof value === 'function') {
            state.rawSql = (value as () => string)();
          }
        }
        return qb;
      }),
      where: jest.fn(() => qb),
      andWhere: jest.fn((_sql: string, params?: Record<string, unknown>) => {
        if (params && 'amount' in params) {
          state.amount = params.amount as number;
        }
        return qb;
      }),
      setParameter: jest.fn((key: string, value: unknown) => {
        if (key === 'amount') {
          state.amount = value as number;
        }
        return qb;
      }),
      execute: jest.fn(async () => {
        if (
          state.amount !== undefined &&
          wallet.availableBalance >= state.amount
        ) {
          wallet.availableBalance -= state.amount;
          return { affected: 1 };
        }
        return { affected: 0 };
      }),
    };
    return qb;
  }

  it('debits with a relative SQL subtraction and inherits stored payout details', async () => {
    const wallet = buildWallet({
      availableBalance: 100,
      payoutEmail: 'stored@example.com',
      bankAccountLast4: '9999',
      bankRoutingLast4: '8888',
    } as Partial<SellerWallet>);
    const queryBuilder = createDebitQueryBuilder(
      wallet as unknown as { availableBalance: number }
    );
    const sellerWalletRepository = repository({
      findOne: jest.fn(async () => wallet),
      createQueryBuilder: jest.fn(() => queryBuilder),
    });
    const payoutRequestRepository = repository();
    const { service } = createHarness({
      sellerWalletRepository,
      payoutRequestRepository,
    });

    await service.createPayoutRequest('seller-1', 40, 'paypal');

    // A relative decrement, not an absolute assignment: that is what makes
    // the debit safe against a concurrent balance change.
    expect(queryBuilder.state.rawSql).toBe('"availableBalance" - :amount');
    expect(wallet.availableBalance).toBe(60);
    expect(payoutRequestRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerId: 'seller-1',
        amount: 40,
        payoutMethod: 'paypal',
        payoutEmail: 'stored@example.com',
        bankAccountLast4: '9999',
        bankRoutingLast4: '8888',
        status: 'pending',
      })
    );
  });

  it('prefers explicitly supplied payout details over the stored wallet values', async () => {
    const wallet = buildWallet({
      availableBalance: 100,
      payoutEmail: 'stored@example.com',
    } as Partial<SellerWallet>);
    const sellerWalletRepository = repository({
      findOne: jest.fn(async () => wallet),
      createQueryBuilder: jest.fn(() =>
        createDebitQueryBuilder(
          wallet as unknown as { availableBalance: number }
        )
      ),
    });
    const payoutRequestRepository = repository();
    const { service } = createHarness({
      sellerWalletRepository,
      payoutRequestRepository,
    });

    await service.createPayoutRequest(
      'seller-1',
      10,
      'zelle',
      'fresh@example.com',
      '1234',
      '5678'
    );

    expect(payoutRequestRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payoutEmail: 'fresh@example.com',
        bankAccountLast4: '1234',
        bankRoutingLast4: '5678',
      })
    );
  });

  it('lists a seller payout requests newest first', async () => {
    const payouts = [buildPayoutRequest()];
    const payoutRequestRepository = repository({
      find: jest.fn(async () => payouts),
    });
    const { service } = createHarness({ payoutRequestRepository });

    await expect(service.getSellerPayoutRequests('seller-1')).resolves.toBe(
      payouts
    );
    expect(payoutRequestRepository.find).toHaveBeenCalledWith({
      where: { sellerId: 'seller-1' },
      order: { createdAt: 'DESC' },
    });
  });

  it.each([
    ['a status filter', 'pending', { status: 'pending' }],
    ['no filter', undefined, {}],
  ])(
    'lists all payout requests with %s',
    async (_label, status, expectedWhere) => {
      const payouts = [buildPayoutRequest()];
      const payoutRequestRepository = repository({
        find: jest.fn(async () => payouts),
      });
      const { service } = createHarness({ payoutRequestRepository });

      await expect(
        service.getAllPayoutRequests(status as string | undefined)
      ).resolves.toBe(payouts);
      expect(payoutRequestRepository.find).toHaveBeenCalledWith({
        where: expectedWhere,
        order: { createdAt: 'DESC' },
      });
    }
  );

  it('refuses to cancel a payout request that does not belong to the seller', async () => {
    const sellerWalletRepository = repository();
    const payoutRequestRepository = repository();
    const { service } = createHarness({
      sellerWalletRepository,
      payoutRequestRepository,
    });

    await expect(
      service.cancelPayoutRequest('payout-1', 'seller-1')
    ).rejects.toThrow('Payout request not found');
    expect(sellerWalletRepository.save).not.toHaveBeenCalled();
  });

  it('refuses to cancel a payout request that has already been processed', async () => {
    const sellerWalletRepository = repository();
    const payoutRequestRepository = repository({
      findOne: jest.fn(async () => buildPayoutRequest({ status: 'completed' })),
    });
    const { service } = createHarness({
      sellerWalletRepository,
      payoutRequestRepository,
    });

    await expect(
      service.cancelPayoutRequest('payout-1', 'seller-1')
    ).rejects.toThrow('Only pending payouts can be cancelled');
    expect(payoutRequestRepository.manager.transaction).not.toHaveBeenCalled();
    expect(sellerWalletRepository.save).not.toHaveBeenCalled();
  });
});

describe('PaymentService admin payout processing', () => {
  it.each([
    [
      'processPayout',
      'Payout request not found',
      (service: PaymentService) => service.processPayout('payout-1', 'admin-1'),
    ],
    [
      'rejectPayout',
      'Payout request not found',
      (service: PaymentService) =>
        service.rejectPayout('payout-1', 'admin-1', 'no'),
    ],
  ])('%s refuses a missing payout request', async (_label, message, invoke) => {
    const payoutRequestRepository = repository();
    const { service } = createHarness({ payoutRequestRepository });

    await expect(invoke(service)).rejects.toThrow(message);
    expect(payoutRequestRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    [
      'processPayout',
      'Only pending payouts can be processed',
      (service: PaymentService) => service.processPayout('payout-1', 'admin-1'),
    ],
    [
      'rejectPayout',
      'Only pending payouts can be rejected',
      (service: PaymentService) =>
        service.rejectPayout('payout-1', 'admin-1', 'no'),
    ],
  ])(
    '%s refuses a payout request that is not pending',
    async (_label, message, invoke) => {
      const payoutRequestRepository = repository({
        findOne: jest.fn(async () =>
          buildPayoutRequest({ status: 'cancelled' })
        ),
      });
      const { service } = createHarness({ payoutRequestRepository });

      await expect(invoke(service)).rejects.toThrow(message);
      expect(payoutRequestRepository.save).not.toHaveBeenCalled();
    }
  );

  it('completes a payout and moves the amount into the wallet paid-out total', async () => {
    const payoutRequest = buildPayoutRequest({ amount: 25 });
    const wallet = buildWallet({ totalPaidOut: 10 } as Partial<SellerWallet>);
    const payoutRequestRepository = repository({
      findOne: jest.fn(async () => payoutRequest),
      save: jest.fn(async (input: PayoutRequest) => input),
    });
    const sellerWalletRepository = repository({
      findOne: jest.fn(async () => wallet),
    });
    const { service } = createHarness({
      payoutRequestRepository,
      sellerWalletRepository,
    });

    const result = await service.processPayout(
      'payout-1',
      'admin-1',
      'txn-external-1'
    );

    expect(result.status).toBe('completed');
    expect(result.processedBy).toBe('admin-1');
    expect(result.transactionId).toBe('txn-external-1');
    expect(result.processedAt).toBeInstanceOf(Date);
    expect(Number(wallet.totalPaidOut)).toBe(35);
    expect(wallet.lastPayoutAt).toBeInstanceOf(Date);
    expect(sellerWalletRepository.save).toHaveBeenCalledWith(wallet);
  });

  it('generates a transaction reference when the admin supplies none', async () => {
    const payoutRequest = buildPayoutRequest();
    const payoutRequestRepository = repository({
      findOne: jest.fn(async () => payoutRequest),
      save: jest.fn(async (input: PayoutRequest) => input),
    });
    const sellerWalletRepository = repository({
      findOne: jest.fn(async () => buildWallet()),
    });
    const { service } = createHarness({
      payoutRequestRepository,
      sellerWalletRepository,
    });

    const result = await service.processPayout('payout-1', 'admin-1');

    expect(result.transactionId).toMatch(/^payout-\d+$/);
  });

  it('rejects a payout and refunds the amount to the available balance', async () => {
    const payoutRequest = buildPayoutRequest({ amount: 25 });
    const wallet = buildWallet({
      availableBalance: 5,
    } as Partial<SellerWallet>);
    const payoutRequestRepository = repository({
      findOne: jest.fn(async () => payoutRequest),
      save: jest.fn(async (input: PayoutRequest) => input),
    });
    const sellerWalletRepository = repository({
      findOne: jest.fn(async () => wallet),
    });
    const { service } = createHarness({
      payoutRequestRepository,
      sellerWalletRepository,
    });

    const result = await service.rejectPayout(
      'payout-1',
      'admin-1',
      'invalid bank details'
    );

    expect(result.status).toBe('rejected');
    expect(result.processedBy).toBe('admin-1');
    expect(result.rejectionReason).toBe('invalid bank details');
    expect(result.processedAt).toBeInstanceOf(Date);
    expect(Number(wallet.availableBalance)).toBe(30);
    expect(sellerWalletRepository.save).toHaveBeenCalledWith(wallet);
  });
});

describe('PaymentService.getSellerEarningsSummary', () => {
  it('counts settled sales and pends only unreleased seller proceeds', async () => {
    const wallet = buildWallet({
      availableBalance: 120,
      totalEarned: 300,
      totalPaidOut: 180,
      payoutMethod: 'paypal',
      payoutEmail: 'seller@example.com',
    } as Partial<SellerWallet>);
    const sellerWalletRepository = repository({
      findOne: jest.fn(async () => wallet),
    });
    const classifiedPaymentRepository = repository({
      find: jest.fn(async () => [
        buildClassifiedPayment({
          status: 'released',
          sellerReceivesAmount: 90,
        }),
        buildClassifiedPayment({
          status: 'confirmed',
          sellerReceivesAmount: '45.50' as unknown as number,
        }),
        buildClassifiedPayment({ status: 'pending', sellerReceivesAmount: 20 }),
        buildClassifiedPayment({
          status: 'disputed',
          sellerReceivesAmount: 500,
        }),
        // A row with no seller amount must contribute 0, not NaN.
        buildClassifiedPayment({
          status: 'pending',
          sellerReceivesAmount: null as unknown as number,
        }),
      ]),
    });
    const { service } = createHarness({
      sellerWalletRepository,
      classifiedPaymentRepository,
    });

    await expect(service.getSellerEarningsSummary('seller-1')).resolves.toEqual(
      {
        availableBalance: 120,
        // pending + confirmed only: 45.50 + 20 + 0
        pendingBalance: 65.5,
        totalEarned: 300,
        totalPaidOut: 180,
        // released + confirmed only
        salesCount: 2,
        payoutMethod: 'paypal',
        payoutEmail: 'seller@example.com',
      }
    );
    expect(classifiedPaymentRepository.find).toHaveBeenCalledWith({
      where: { sellerId: 'seller-1' },
    });
  });
});

describe('PaymentService.processWebhook subscription and order handling', () => {
  it.each([
    ['subscription_created', 'active'],
    ['subscription_updated', 'active'],
    ['subscription_cancelled', 'cancelled'],
    ['subscription_expired', 'cancelled'],
  ])(
    'sets the business page subscription to %s -> %s',
    async (eventType, expectedStatus) => {
      const page = buildBusinessPage({ subscriptionStatus: 'inactive' });
      const businessPageRepository = repository({
        findOne: jest.fn(async () => page),
      });
      const providerAdapter = new ConfigurableProviderAdapter();
      providerAdapter.webhookCustomData = { community_id: 'community-1' };
      const { service, billingReconciliationService } = createHarness({
        businessPageRepository,
        providerAdapter,
      });

      await expect(service.processWebhook(eventType, {})).resolves.toEqual({
        received: true,
      });

      expect(page.subscriptionStatus).toBe(expectedStatus);
      expect(businessPageRepository.save).toHaveBeenCalledWith(page);
      // Every webhook is republished on the reconciliation seam regardless
      // of which branch handles it.
      expect(billingReconciliationService.events).toHaveLength(1);
    }
  );

  it.each(['subscription_created', 'subscription_cancelled'])(
    'ignores a %s webhook that carries no community id',
    async (eventType) => {
      const businessPageRepository = repository();
      const providerAdapter = new ConfigurableProviderAdapter();
      providerAdapter.webhookCustomData = {};
      const { service } = createHarness({
        businessPageRepository,
        providerAdapter,
      });

      await expect(service.processWebhook(eventType, {})).resolves.toEqual({
        received: true,
      });
      expect(businessPageRepository.findOne).not.toHaveBeenCalled();
      expect(businessPageRepository.save).not.toHaveBeenCalled();
    }
  );

  it.each(['subscription_created', 'subscription_cancelled'])(
    'ignores a %s webhook for a community with no business page',
    async (eventType) => {
      const businessPageRepository = repository();
      const providerAdapter = new ConfigurableProviderAdapter();
      providerAdapter.webhookCustomData = { community_id: 'community-1' };
      const { service } = createHarness({
        businessPageRepository,
        providerAdapter,
      });

      await expect(service.processWebhook(eventType, {})).resolves.toEqual({
        received: true,
      });
      expect(businessPageRepository.findOne).toHaveBeenCalledWith({
        where: { communityId: 'community-1' },
      });
      expect(businessPageRepository.save).not.toHaveBeenCalled();
    }
  );

  it('activates the sponsorship referenced by an order_created webhook', async () => {
    const sponsorship = { id: 'sponsorship-1', status: 'pending' };
    const sponsorshipRepository = repository({
      findOne: jest.fn(async () => sponsorship),
    });
    const providerAdapter = new ConfigurableProviderAdapter();
    providerAdapter.webhookCustomData = { sponsorship_id: 'sponsorship-1' };
    const { service } = createHarness({
      sponsorshipRepository,
      providerAdapter,
    });

    await expect(service.processWebhook('order_created', {})).resolves.toEqual({
      received: true,
    });

    expect(sponsorshipRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'sponsorship-1' },
    });
    expect(sponsorship.status).toBe('active');
    expect(sponsorshipRepository.save).toHaveBeenCalledWith(sponsorship);
  });

  it.each([
    ['a sponsorship that no longer exists', { sponsorship_id: 'missing' }],
    ['no sponsorship id', {}],
  ])(
    'ignores an order_created webhook referencing %s',
    async (_label, customData) => {
      const sponsorshipRepository = repository();
      const providerAdapter = new ConfigurableProviderAdapter();
      providerAdapter.webhookCustomData = customData as Record<string, string>;
      const { service } = createHarness({
        sponsorshipRepository,
        providerAdapter,
      });

      await expect(
        service.processWebhook('order_created', {})
      ).resolves.toEqual({ received: true });
      expect(sponsorshipRepository.save).not.toHaveBeenCalled();
    }
  );

  it('swallows a provider failure so the webhook is still acknowledged', async () => {
    const providerAdapter = new ConfigurableProviderAdapter();
    providerAdapter.webhookError = new Error('signature mismatch');
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { service, billingReconciliationService } = createHarness({
      providerAdapter,
    });

    try {
      // Acknowledging avoids the provider retrying a payload we can never
      // process; the failure is surfaced through the log instead.
      await expect(
        service.processWebhook('subscription_created', {})
      ).resolves.toEqual({ received: true });

      expect(error).toHaveBeenCalledWith(
        'Webhook processing error: signature mismatch',
        expect.any(Error)
      );
      expect(billingReconciliationService.events).toHaveLength(0);
    } finally {
      error.mockRestore();
    }
  });
});

describe('PaymentService.syncLemonSqueezyProducts', () => {
  const realFetch = global.fetch;

  function mockFetch(
    handler: (url: string) => {
      ok: boolean;
      status?: number;
      statusText?: string;
      body?: unknown;
    }
  ) {
    const fetchMock = jest.fn(async (url: string) => {
      const response = handler(url);
      return {
        ok: response.ok,
        status: response.status ?? (response.ok ? 200 : 500),
        statusText: response.statusText ?? '',
        json: async () => response.body,
      };
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;
    return fetchMock;
  }

  function productListBody(variantIds: string[], status = 'published') {
    return {
      data: [
        {
          id: 'product-1',
          attributes: { name: 'Tanuki Plan', status },
          relationships: {
            variants: { data: variantIds.map((id) => ({ id })) },
          },
        },
      ],
    };
  }

  function variantBody(name: string) {
    return {
      data: { attributes: { name, price_formatted: '$10.00' } },
    };
  }

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it.each([
    ['a missing api key', { apiKey: '', storeId: 'store-1' }],
    ['a missing store id', { apiKey: 'key-1', storeId: '' }],
  ])('skips a catalog store with %s', async (_label, config) => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const fetchMock = mockFetch(() => ({ ok: true, body: { data: [] } }));
    const providerAdapter = new ConfigurableProviderAdapter();
    providerAdapter.catalogStores = [{ appScope: 'local-hub', config }];
    const { service } = createHarness({ providerAdapter });

    await service.syncLemonSqueezyProducts('local-hub');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'Skipping product sync for local-hub: missing apiKey or storeId'
    );
    expect(providerAdapter.catalogScopes).toEqual(['local-hub']);
  });

  it('logs and skips a store whose product listing request fails', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    mockFetch(() => ({ ok: false, status: 401, statusText: 'Unauthorized' }));
    const providerAdapter = new ConfigurableProviderAdapter();
    providerAdapter.catalogStores = [
      {
        appScope: 'local-hub',
        config: { apiKey: 'key-1', storeId: 'store-1' },
      },
    ];
    const productRepository = repository();
    const { service } = createHarness({ providerAdapter, productRepository });

    await service.syncLemonSqueezyProducts();

    expect(error).toHaveBeenCalledWith(
      'Failed to fetch products for store store-1: 401 Unauthorized'
    );
    expect(productRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    ['Pro Monthly', 'pro'],
    ['Enterprise Annual', 'enterprise'],
    ['Starter', 'basic'],
  ])('maps the variant name %s to the %s tier', async (variantName, tier) => {
    mockFetch((url) =>
      url.includes('/variants/')
        ? { ok: true, body: variantBody(variantName) }
        : { ok: true, body: productListBody(['variant-1']) }
    );
    const providerAdapter = new ConfigurableProviderAdapter();
    providerAdapter.catalogStores = [
      {
        appScope: 'local-hub',
        config: { apiKey: 'key-1', storeId: 'store-1' },
      },
    ];
    const productRepository = repository();
    const { service } = createHarness({ providerAdapter, productRepository });

    await service.syncLemonSqueezyProducts();

    expect(productRepository.findOne).toHaveBeenCalledWith({
      where: { appScope: 'local-hub', tier },
    });
    expect(productRepository.create).toHaveBeenCalledWith({
      appScope: 'local-hub',
      tier,
      lemonSqueezyProductId: 'product-1',
      lemonSqueezyVariantId: 'variant-1',
      name: 'Tanuki Plan',
      isActive: true,
    });
    expect(productRepository.save).toHaveBeenCalledTimes(1);
  });

  it('updates an already-synced product row in place instead of inserting a duplicate', async () => {
    const existingProduct = {
      id: 'ls-product-1',
      appScope: 'local-hub',
      tier: 'pro',
      lemonSqueezyProductId: 'stale-product',
      lemonSqueezyVariantId: 'stale-variant',
      name: 'Stale name',
      isActive: true,
    };
    mockFetch((url) =>
      url.includes('/variants/')
        ? { ok: true, body: variantBody('Pro Monthly') }
        : { ok: true, body: productListBody(['variant-1'], 'draft') }
    );
    const providerAdapter = new ConfigurableProviderAdapter();
    providerAdapter.catalogStores = [
      {
        appScope: 'local-hub',
        config: { apiKey: 'key-1', storeId: 'store-1' },
      },
    ];
    const productRepository = repository({
      findOne: jest.fn(async () => existingProduct),
    });
    const { service } = createHarness({ providerAdapter, productRepository });

    await service.syncLemonSqueezyProducts();

    expect(productRepository.create).not.toHaveBeenCalled();
    expect(productRepository.save).toHaveBeenCalledWith(existingProduct);
    expect(existingProduct.lemonSqueezyProductId).toBe('product-1');
    expect(existingProduct.lemonSqueezyVariantId).toBe('variant-1');
    expect(existingProduct.name).toBe('Tanuki Plan');
    // An unpublished product is synced but deactivated.
    expect(existingProduct.isActive).toBe(false);
  });

  it('skips a variant whose detail request fails and keeps syncing the rest', async () => {
    mockFetch((url) => {
      if (url.includes('/variants/variant-bad')) {
        return { ok: false, status: 404, statusText: 'Not Found' };
      }
      if (url.includes('/variants/variant-good')) {
        return { ok: true, body: variantBody('Pro Monthly') };
      }
      return {
        ok: true,
        body: productListBody(['variant-bad', 'variant-good']),
      };
    });
    const providerAdapter = new ConfigurableProviderAdapter();
    providerAdapter.catalogStores = [
      {
        appScope: 'local-hub',
        config: { apiKey: 'key-1', storeId: 'store-1' },
      },
    ];
    const productRepository = repository();
    const { service } = createHarness({ providerAdapter, productRepository });

    await service.syncLemonSqueezyProducts();

    expect(productRepository.save).toHaveBeenCalledTimes(1);
    expect(productRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ lemonSqueezyVariantId: 'variant-good' })
    );
  });

  it('writes nothing for a product that declares no variants', async () => {
    mockFetch(() => ({
      ok: true,
      body: {
        data: [
          {
            id: 'product-1',
            attributes: { name: 'Tanuki Plan', status: 'published' },
          },
        ],
      },
    }));
    const providerAdapter = new ConfigurableProviderAdapter();
    providerAdapter.catalogStores = [
      {
        appScope: 'local-hub',
        config: { apiKey: 'key-1', storeId: 'store-1' },
      },
    ];
    const productRepository = repository();
    const { service } = createHarness({ providerAdapter, productRepository });

    await service.syncLemonSqueezyProducts();

    expect(productRepository.save).not.toHaveBeenCalled();
  });

  it('logs a transport failure for one store without aborting the remaining stores', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('store-broken')) {
        throw new Error('network down');
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [] }),
      };
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;
    const providerAdapter = new ConfigurableProviderAdapter();
    providerAdapter.catalogStores = [
      {
        appScope: 'broken-hub',
        config: { apiKey: 'key-1', storeId: 'store-broken' },
      },
      {
        appScope: 'local-hub',
        config: { apiKey: 'key-2', storeId: 'store-ok' },
      },
    ];
    const { service } = createHarness({ providerAdapter });

    await service.syncLemonSqueezyProducts();

    expect(error).toHaveBeenCalledWith(
      'Error syncing products for broken-hub: network down',
      expect.any(Error)
    );
    // The healthy store is still visited after the broken one threw.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
