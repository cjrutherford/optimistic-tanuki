import { BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';
import {
  BillingProviderAdapter,
  CreateCheckoutInput,
  ProviderWebhookResult,
  ProcessWebhookInput,
} from '@optimistic-tanuki/payments-domain';
import { BillingReconciliationService } from './billing-reconciliation.service';
import { PaymentService } from './payment.service';
import { ClassifiedPayment } from '../../entities/classified-payment.entity';
import { SellerWallet } from '../../entities/seller-wallet.entity';
import { Transaction } from '../../entities/transaction.entity';
import { PayoutRequest } from '../../entities/payout-request.entity';
import { calculateNetAmount } from '../utils/platform-fee.util';

class RecordingProviderAdapter implements BillingProviderAdapter {
  checkoutInputs: CreateCheckoutInput[] = [];
  webhookInputs: ProcessWebhookInput[] = [];

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

    return {
      provider: 'lemon-squeezy' as const,
      eventType: input.eventType,
      customData: {
        community_id: 'community-1',
      },
      rawPayload: input.payload,
    };
  }

  listCatalogStores() {
    return [];
  }
}

class RecordingBillingReconciliationService
  implements Pick<BillingReconciliationService, 'publishProviderEvent'>
{
  events: ProviderWebhookResult[] = [];

  async publishProviderEvent(event: ProviderWebhookResult): Promise<void> {
    this.events.push(event);
  }
}

function repository<T extends object>(
  overrides: Partial<Record<string, unknown>> = {}
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repo: any = {
    create: jest.fn((input: T) => input),
    save: jest.fn(async (input: T) => ({ id: 'saved-id', ...input })),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    createQueryBuilder: jest.fn(),
  };
  // Default no-op transactional manager: invokes the callback with itself,
  // delegating createQueryBuilder to this repo's own mock and getRepository
  // to itself. This is enough for tests that never exercise the credit/
  // refund side-effect inside the transaction (e.g. the lost-race path,
  // which returns affected: 0 before any cross-repository call happens).
  // Tests that DO need multi-repository routing inside a transaction (e.g.
  // releaseFunds crediting the wallet, cancelPayoutRequest refunding it)
  // override `.manager` explicitly after construction.
  repo.manager = {
    transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) =>
      cb(repo.manager)
    ),
    getRepository: jest.fn(() => repo),
    createQueryBuilder: (...args: unknown[]) =>
      repo.createQueryBuilder(...args),
  };
  Object.assign(repo, overrides);
  return repo;
}

function createClassifiedsClient(ad: Record<string, unknown> | null = null) {
  return {
    send: jest.fn(() => of(ad)),
  };
}

function createService(
  providerAdapter = new RecordingProviderAdapter(),
  repoOverrides: {
    classifiedPaymentRepository?: ReturnType<typeof repository>;
    sellerWalletRepository?: ReturnType<typeof repository>;
    transactionRepository?: ReturnType<typeof repository>;
    payoutRequestRepository?: ReturnType<typeof repository>;
  } = {},
  classifiedsClient: ReturnType<
    typeof createClassifiedsClient
  > = createClassifiedsClient()
) {
  const billingReconciliationService =
    new RecordingBillingReconciliationService();
  const donationRepository = repository();
  const businessPageRepository = repository({
    findOne: jest.fn(async () => null),
    save: jest.fn(async (input: object) => ({
      id: 'business-page-1',
      ...input,
    })),
  });
  const productRepository = repository({
    findOne: jest.fn(async () => ({
      lemonSqueezyVariantId: 'variant-pro',
    })),
  });
  const classifiedPaymentRepository =
    repoOverrides.classifiedPaymentRepository ?? repository();
  const sellerWalletRepository =
    repoOverrides.sellerWalletRepository ?? repository();
  const transactionRepository =
    repoOverrides.transactionRepository ?? repository();
  const payoutRequestRepository =
    repoOverrides.payoutRequestRepository ?? repository();

  const service = new PaymentService(
    donationRepository as never,
    classifiedPaymentRepository as never,
    sellerWalletRepository as never,
    payoutRequestRepository as never,
    businessPageRepository as never,
    repository() as never,
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
    classifiedPaymentRepository,
    sellerWalletRepository,
    transactionRepository,
    payoutRequestRepository,
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
    paymentIntentId: null,
    paymentMethod: 'card',
    status: 'confirmed',
    proofImageUrl: null,
    disputeReason: null,
    LemonSqueezyOrderId: null,
    createdAt: new Date(),
    confirmedAt: null,
    releasedAt: null,
    ...overrides,
  } as ClassifiedPayment;
}

/**
 * Simulates the atomic `UPDATE ... WHERE id = :id AND status = :expected`
 * query builder used by releaseFunds. The affected-row count is derived
 * from the *current* in-memory status of `payment` at the moment
 * `execute()` runs (not the status seen by an earlier `findOne`), which is
 * exactly the property that makes the real SQL version race-safe: only a
 * call that observes the row still in the expected state can transition it.
 */
function createAtomicUpdateQueryBuilder(payment: ClassifiedPayment) {
  let expectedStatus: string | undefined;
  let setValues: Partial<ClassifiedPayment> = {};
  const qb = {
    update: jest.fn(() => qb),
    set: jest.fn((values: Partial<ClassifiedPayment>) => {
      setValues = values;
      return qb;
    }),
    where: jest.fn(() => qb),
    andWhere: jest.fn((_sql: string, params?: Record<string, unknown>) => {
      if (params && 'expected' in params) {
        expectedStatus = params.expected as string;
      }
      return qb;
    }),
    execute: jest.fn(async () => {
      if (expectedStatus !== undefined && payment.status === expectedStatus) {
        Object.assign(payment, setValues);
        return { affected: 1 };
      }
      return { affected: 0 };
    }),
  };
  return qb;
}

function createServiceWithPayment(payment: ClassifiedPayment) {
  const atomicQueryBuilder = createAtomicUpdateQueryBuilder(payment);
  const classifiedPaymentRepository = repository({
    findOne: jest.fn(async () => payment),
    save: jest.fn(async (input: Partial<ClassifiedPayment>) => {
      Object.assign(payment, input);
      return payment;
    }),
    createQueryBuilder: jest.fn(() => atomicQueryBuilder),
  });
  const sellerWalletRepository = repository({
    findOne: jest.fn(async () => null),
    save: jest.fn(async (input: object) => ({ id: 'wallet-1', ...input })),
  });
  const transactionRepository = repository({
    save: jest.fn(async (input: object) => ({ id: 'transaction-1', ...input })),
  });

  // Wire releaseFunds' `this.classifiedPaymentRepository.manager.transaction`
  // to a fake transactional EntityManager that:
  //  - exposes the same atomic query builder used for the conditional
  //    status UPDATE (so `manager.createQueryBuilder()` behaves exactly
  //    like the untransacted version did), and
  //  - routes `manager.getRepository(SellerWallet/Transaction)` to the same
  //    sellerWalletRepository/transactionRepository mocks, so
  //    creditSellerWallet's writes are observable via those spies, and
  //  - on a thrown error from the transaction callback, rolls back the
  //    in-memory payment mutation the atomic UPDATE made — mirroring a real
  //    DB transaction rollback — before rethrowing, so a mid-transaction
  //    credit failure is provably NOT left durably `released`.
  const manager = {
    createQueryBuilder: jest.fn(() => atomicQueryBuilder),
    getRepository: jest.fn((entity: unknown) => {
      if (entity === SellerWallet) return sellerWalletRepository;
      if (entity === Transaction) return transactionRepository;
      return classifiedPaymentRepository;
    }),
  };
  classifiedPaymentRepository.manager = {
    transaction: jest.fn(
      async (cb: (m: typeof manager) => Promise<unknown>) => {
        const before = {
          status: payment.status,
          releasedAt: payment.releasedAt,
        };
        try {
          return await cb(manager);
        } catch (err) {
          Object.assign(payment, before);
          throw err;
        }
      }
    ),
    getRepository: manager.getRepository,
    createQueryBuilder: manager.createQueryBuilder,
  };

  const { service } = createService(undefined, {
    classifiedPaymentRepository,
    sellerWalletRepository,
    transactionRepository,
  });

  return {
    service,
    classifiedPaymentRepository,
    sellerWalletRepository,
    transactionRepository,
  };
}

describe('PaymentService provider adapter boundary', () => {
  it('delegates donation checkout URL creation to the configured provider', async () => {
    const { service, providerAdapter } = createService();

    await expect(
      service.createDonationCheckout(
        'user-1',
        'profile-1',
        25,
        false,
        'local-hub'
      )
    ).resolves.toEqual({
      checkoutUrl: 'provider-checkout:fallback',
      donationId: 'saved-id',
    });

    expect(providerAdapter.checkoutInputs).toEqual([
      {
        appScope: 'local-hub',
        customData: {
          donation_id: 'saved-id',
          user_id: 'user-1',
          profile_id: 'profile-1',
        },
      },
    ]);
  });

  it('uses provider product mappings when creating business checkouts', async () => {
    const { service, providerAdapter } = createService();

    await expect(
      service.createBusinessCheckout(
        'user-1',
        'community-1',
        'pro',
        'local-hub'
      )
    ).resolves.toEqual({
      checkoutUrl: 'provider-checkout:variant-pro',
      businessPageId: 'business-page-1',
    });

    expect(providerAdapter.checkoutInputs).toEqual([
      {
        appScope: 'local-hub',
        providerPriceRef: 'variant-pro',
        customData: {
          business_page_id: 'business-page-1',
          community_id: 'community-1',
          user_id: 'user-1',
          tier: 'pro',
        },
      },
    ]);
  });

  it('publishes normalized provider webhooks to the billing reconciliation seam', async () => {
    const { service, billingReconciliationService } = createService();

    await expect(
      service.processWebhook('subscription_created', {
        meta: {
          custom_data: {
            community_id: 'community-1',
          },
        },
      })
    ).resolves.toEqual({ received: true });

    expect(billingReconciliationService.events).toEqual([
      {
        provider: 'lemon-squeezy',
        eventType: 'subscription_created',
        customData: {
          community_id: 'community-1',
        },
        rawPayload: {
          meta: {
            custom_data: {
              community_id: 'community-1',
            },
          },
        },
      },
    ]);
  });
});

describe('PaymentService classified payment authorization', () => {
  it('confirmOutOfPlatformPayment throws for a non-participant caller and does not persist changes', async () => {
    const payment = buildClassifiedPayment({ status: 'pending' });
    const { service, classifiedPaymentRepository } =
      createServiceWithPayment(payment);

    await expect(
      service.confirmOutOfPlatformPayment('payment-1', 'stranger', 'proof.png')
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(classifiedPaymentRepository.save).not.toHaveBeenCalled();
    expect(payment.status).toBe('pending');
  });

  it('releaseFunds throws for a non-participant caller and does not credit the wallet', async () => {
    const payment = buildClassifiedPayment({ status: 'confirmed' });
    const {
      service,
      classifiedPaymentRepository,
      sellerWalletRepository,
      transactionRepository,
    } = createServiceWithPayment(payment);

    await expect(
      service.releaseFunds('payment-1', 'stranger')
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(classifiedPaymentRepository.save).not.toHaveBeenCalled();
    expect(sellerWalletRepository.save).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
    expect(payment.status).toBe('confirmed');
  });

  it('disputePayment throws for a non-participant caller and does not persist changes', async () => {
    const payment = buildClassifiedPayment({ status: 'confirmed' });
    const { service, classifiedPaymentRepository } =
      createServiceWithPayment(payment);

    await expect(
      service.disputePayment('payment-1', 'stranger', 'not as described')
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(classifiedPaymentRepository.save).not.toHaveBeenCalled();
    expect(payment.status).toBe('confirmed');
  });

  it.each([
    ['buyer', 'buyer-1'],
    ['seller', 'seller-1'],
  ])(
    'confirmOutOfPlatformPayment succeeds when the caller is the %s',
    async (_label, callerId) => {
      const payment = buildClassifiedPayment({ status: 'pending' });
      const { service } = createServiceWithPayment(payment);

      const result = await service.confirmOutOfPlatformPayment(
        'payment-1',
        callerId,
        'proof.png'
      );

      expect(result.success).toBe(true);
      expect(payment.status).toBe('confirmed');
    }
  );

  it.each([
    ['buyer', 'buyer-1'],
    ['seller', 'seller-1'],
  ])(
    'releaseFunds succeeds when the caller is the %s',
    async (_label, callerId) => {
      const payment = buildClassifiedPayment({ status: 'confirmed' });
      const { service } = createServiceWithPayment(payment);
      const creditSpy = jest.spyOn(service, 'creditSellerWallet');

      const result = await service.releaseFunds('payment-1', callerId);

      expect(result.success).toBe(true);
      expect(payment.status).toBe('released');
      expect(creditSpy).toHaveBeenCalledTimes(1);
      expect(creditSpy).toHaveBeenCalledWith(
        'seller-1',
        90,
        'payment-1',
        expect.any(String),
        // the transactional EntityManager the credit runs under
        expect.anything()
      );
    }
  );

  it.each([
    ['buyer', 'buyer-1'],
    ['seller', 'seller-1'],
  ])(
    'disputePayment succeeds when the caller is the %s',
    async (_label, callerId) => {
      const payment = buildClassifiedPayment({ status: 'confirmed' });
      const { service } = createServiceWithPayment(payment);

      const result = await service.disputePayment(
        'payment-1',
        callerId,
        'reason'
      );

      expect(result.success).toBe(true);
      expect(payment.status).toBe('disputed');
    }
  );
});

describe('PaymentService.releaseFunds idempotency and state guards', () => {
  it('credits the seller wallet exactly once across two release calls for the same payment', async () => {
    const payment = buildClassifiedPayment({ status: 'confirmed' });
    const { service, transactionRepository } =
      createServiceWithPayment(payment);
    const creditSpy = jest.spyOn(service, 'creditSellerWallet');

    const first = await service.releaseFunds('payment-1', 'buyer-1');
    expect(first.success).toBe(true);
    expect(
      (first as { alreadyReleased?: boolean }).alreadyReleased
    ).toBeUndefined();
    expect(payment.status).toBe('released');

    const second = await service.releaseFunds('payment-1', 'buyer-1');
    expect(second.success).toBe(true);
    expect((second as { alreadyReleased?: boolean }).alreadyReleased).toBe(
      true
    );

    expect(creditSpy).toHaveBeenCalledTimes(1);
    expect(transactionRepository.save).toHaveBeenCalledTimes(1);
  });

  it.each(['disputed', 'refunded', 'cancelled'] as const)(
    'refuses to release funds for a payment in a %s state and does not credit the wallet',
    async (status) => {
      const payment = buildClassifiedPayment({ status });
      const {
        service,
        classifiedPaymentRepository,
        sellerWalletRepository,
        transactionRepository,
      } = createServiceWithPayment(payment);

      await expect(
        service.releaseFunds('payment-1', 'buyer-1')
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(classifiedPaymentRepository.save).not.toHaveBeenCalled();
      expect(sellerWalletRepository.save).not.toHaveBeenCalled();
      expect(transactionRepository.save).not.toHaveBeenCalled();
      expect(payment.status).toBe(status);
    }
  );

  it('refuses to release funds for a payment still in pending state (blocks seller self-release before buyer confirmation) and does not credit the wallet', async () => {
    const payment = buildClassifiedPayment({ status: 'pending' });
    const {
      service,
      classifiedPaymentRepository,
      sellerWalletRepository,
      transactionRepository,
    } = createServiceWithPayment(payment);
    const creditSpy = jest.spyOn(service, 'creditSellerWallet');

    await expect(
      service.releaseFunds('payment-1', 'seller-1')
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(classifiedPaymentRepository.save).not.toHaveBeenCalled();
    expect(sellerWalletRepository.save).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
    expect(creditSpy).not.toHaveBeenCalled();
    expect(payment.status).toBe('pending');
  });
});

describe('PaymentService classified payment state machine bypass regressions', () => {
  it.each(['disputed', 'confirmed', 'released'] as const)(
    'confirmOutOfPlatformPayment throws when the payment is already %s and does not persist changes',
    async (status) => {
      const payment = buildClassifiedPayment({ status });
      const { service, classifiedPaymentRepository } =
        createServiceWithPayment(payment);

      await expect(
        service.confirmOutOfPlatformPayment('payment-1', 'buyer-1', 'proof.png')
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(classifiedPaymentRepository.save).not.toHaveBeenCalled();
      expect(payment.status).toBe(status);
    }
  );

  it('blocks the dispute -> reconfirm -> release bypass chain', async () => {
    const payment = buildClassifiedPayment({ status: 'confirmed' });
    const { service } = createServiceWithPayment(payment);

    const disputed = await service.disputePayment(
      'payment-1',
      'buyer-1',
      'item not as described'
    );
    expect(disputed.success).toBe(true);
    expect(payment.status).toBe('disputed');

    await expect(
      service.confirmOutOfPlatformPayment('payment-1', 'buyer-1', 'proof.png')
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(payment.status).toBe('disputed');

    await expect(
      service.releaseFunds('payment-1', 'seller-1')
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(payment.status).toBe('disputed');
  });

  it('disputePayment throws when the payment is already released and does not persist changes', async () => {
    const payment = buildClassifiedPayment({ status: 'released' });
    const { service, classifiedPaymentRepository } =
      createServiceWithPayment(payment);

    await expect(
      service.disputePayment('payment-1', 'buyer-1', 'too late')
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(classifiedPaymentRepository.save).not.toHaveBeenCalled();
    expect(payment.status).toBe('released');
  });
});

describe('PaymentService.createClassifiedPayment server-side price/seller derivation', () => {
  it('ignores a client-supplied amount/sellerId and derives both from the classified ad (direct-purchase path)', async () => {
    const classifiedPaymentRepository = repository();
    const classifiedsClient = createClassifiedsClient({
      id: 'classified-1',
      price: '250.00',
      userId: 'real-seller',
      status: 'active',
    });

    const { service } = createService(
      undefined,
      { classifiedPaymentRepository },
      classifiedsClient
    );

    const result = await service.createClassifiedPayment(
      'buyer-1',
      'classified-1',
      'card',
      // Attacker-supplied amount/sellerId: must be ignored entirely.
      1,
      'attacker-controlled-seller'
    );

    expect(classifiedsClient.send).toHaveBeenCalledWith(
      { cmd: 'classified.findById' },
      { id: 'classified-1' }
    );

    const expectedFees = calculateNetAmount(250);
    expect(classifiedPaymentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerId: 'buyer-1',
        sellerId: 'real-seller',
        classifiedId: 'classified-1',
        amount: expectedFees.gross,
        platformFeeAmount: expectedFees.fee,
        sellerReceivesAmount: expectedFees.net,
      })
    );
    expect((result as ClassifiedPayment).sellerId).toBe('real-seller');
    expect(Number((result as ClassifiedPayment).amount)).toBe(250);
  });

  it('throws and does not save a payment when the classified ad does not exist', async () => {
    const classifiedPaymentRepository = repository();
    const classifiedsClient = createClassifiedsClient(null);

    const { service } = createService(
      undefined,
      { classifiedPaymentRepository },
      classifiedsClient
    );

    await expect(
      service.createClassifiedPayment(
        'buyer-1',
        'missing-classified',
        'card',
        999,
        'someone'
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(classifiedPaymentRepository.create).not.toHaveBeenCalled();
    expect(classifiedPaymentRepository.save).not.toHaveBeenCalled();
  });

  it('throws and does not save a payment when the classified ad is not active (e.g. already sold)', async () => {
    const classifiedPaymentRepository = repository();
    const classifiedsClient = createClassifiedsClient({
      id: 'classified-1',
      price: '100.00',
      userId: 'real-seller',
      status: 'sold',
    });

    const { service } = createService(
      undefined,
      { classifiedPaymentRepository },
      classifiedsClient
    );

    await expect(
      service.createClassifiedPayment(
        'buyer-1',
        'classified-1',
        'card',
        1,
        'attacker'
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(classifiedPaymentRepository.create).not.toHaveBeenCalled();
    expect(classifiedPaymentRepository.save).not.toHaveBeenCalled();
  });

  it.each(['0.00', '-25.00'])(
    'throws and does not save a payment when the ad price is non-positive (%s)',
    async (price) => {
      const classifiedPaymentRepository = repository();
      const classifiedsClient = createClassifiedsClient({
        id: 'classified-1',
        price,
        userId: 'real-seller',
        status: 'active',
      });

      const { service } = createService(
        undefined,
        { classifiedPaymentRepository },
        classifiedsClient
      );

      await expect(
        service.createClassifiedPayment('buyer-1', 'classified-1', 'card')
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(classifiedPaymentRepository.create).not.toHaveBeenCalled();
      expect(classifiedPaymentRepository.save).not.toHaveBeenCalled();
    }
  );
});

describe('PaymentService.releaseFunds atomic conditional transition', () => {
  it('credits the seller wallet when the conditional UPDATE reports exactly one affected row', async () => {
    const payment = buildClassifiedPayment({ status: 'confirmed' });
    const { service } = createServiceWithPayment(payment);
    const creditSpy = jest.spyOn(service, 'creditSellerWallet');

    const result = await service.releaseFunds('payment-1', 'buyer-1');

    expect(result.success).toBe(true);
    expect(
      (result as { alreadyReleased?: boolean }).alreadyReleased
    ).toBeUndefined();
    expect(payment.status).toBe('released');
    // The conditional UPDATE now runs on the transactional EntityManager
    // (manager.createQueryBuilder) rather than the base repository; the
    // transition landing (status 'released') and the single credit below are
    // what prove the atomic path executed.
    expect(creditSpy).toHaveBeenCalledTimes(1);
  });

  it('does not credit the seller wallet when the conditional UPDATE reports zero affected rows (lost a concurrent race)', async () => {
    const payment = buildClassifiedPayment({ status: 'confirmed' });
    const classifiedPaymentRepository = repository({
      // First read observes `confirmed`...
      findOne: jest
        .fn()
        .mockResolvedValueOnce(payment)
        // ...but by the time we re-read after a lost race, a concurrent
        // call has already transitioned the row to `released`.
        .mockResolvedValueOnce({ ...payment, status: 'released' }),
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
        // Simulates a concurrent releaseFunds call winning the race: this
        // UPDATE affects zero rows because the row is no longer `confirmed`.
        execute: jest.fn(async () => ({ affected: 0 })),
      })),
    });
    const sellerWalletRepository = repository();
    const transactionRepository = repository();

    const { service } = createService(undefined, {
      classifiedPaymentRepository,
      sellerWalletRepository,
      transactionRepository,
    });
    const creditSpy = jest.spyOn(service, 'creditSellerWallet');

    const result = await service.releaseFunds('payment-1', 'buyer-1');

    expect(result.success).toBe(true);
    expect((result as { alreadyReleased?: boolean }).alreadyReleased).toBe(
      true
    );
    expect(creditSpy).not.toHaveBeenCalled();
    expect(sellerWalletRepository.save).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });
});

describe('PaymentService.releaseFunds transactional credit failure', () => {
  it('rolls back the status transition when the wallet credit fails, leaving the payment confirmed and retryable', async () => {
    const payment = buildClassifiedPayment({ status: 'confirmed' });
    const { service, sellerWalletRepository, transactionRepository } =
      createServiceWithPayment(payment);

    // Pre-seed an existing wallet so getOrCreateSellerWallet returns it
    // without a creation-save — otherwise the empty-wallet insert (which a
    // real DB transaction would roll back, but a repository mock cannot)
    // would register a spurious sellerWalletRepository.save call and mask
    // whether the CREDIT save was correctly skipped on the failed attempt.
    const seededWallet = {
      sellerId: 'seller-1',
      availableBalance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      totalPaidOut: 0,
    };
    sellerWalletRepository.findOne = jest.fn(async () => seededWallet);

    // Simulate a transient failure while crediting the wallet (e.g. a
    // dropped connection or constraint violation) on the FIRST attempt
    // only. This happens inside the same transaction as the conditional
    // status UPDATE.
    transactionRepository.save = jest
      .fn()
      .mockRejectedValueOnce(new Error('db connection dropped'))
      .mockImplementation(async (input: object) => ({
        id: 'transaction-1',
        ...input,
      }));

    await expect(service.releaseFunds('payment-1', 'buyer-1')).rejects.toThrow(
      'db connection dropped'
    );

    // The credit failed mid-transaction, so the whole transaction --
    // including the status UPDATE -- must roll back: the payment is left
    // `confirmed`, not durably `released` with a lost credit.
    expect(payment.status).toBe('confirmed');
    expect(payment.releasedAt).toBeNull();
    expect(sellerWalletRepository.save).not.toHaveBeenCalled();

    // A retry after the transient failure clears must succeed. This is only
    // possible because the payment is still `confirmed` -- had it been left
    // `released`, the idempotency fast-path would have silently no-op'd the
    // retry and the credit would have been lost forever.
    const retry = await service.releaseFunds('payment-1', 'buyer-1');

    expect(retry.success).toBe(true);
    expect(
      (retry as { alreadyReleased?: boolean }).alreadyReleased
    ).toBeUndefined();
    expect(payment.status).toBe('released');
    expect(transactionRepository.save).toHaveBeenCalledTimes(2);
    expect(sellerWalletRepository.save).toHaveBeenCalledTimes(1);
  });
});

describe('PaymentService.createPayoutRequest atomic debit', () => {
  /**
   * Simulates the atomic `UPDATE seller_wallets SET availableBalance =
   * availableBalance - :amount WHERE sellerId = :id AND availableBalance >=
   * :amount` used by createPayoutRequest. Like
   * createAtomicUpdateQueryBuilder above, the affected-row outcome is
   * derived from the live in-memory wallet balance at the moment execute()
   * runs, so a debit that has already landed (simulating a concurrent
   * request) is faithfully reflected for the next call.
   */
  function createAtomicDebitQueryBuilder(wallet: { availableBalance: number }) {
    let amountParam: number | undefined;
    const qb = {
      update: jest.fn(() => qb),
      set: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn((_sql: string, params?: Record<string, unknown>) => {
        if (params && 'amount' in params) {
          amountParam = params.amount as number;
        }
        return qb;
      }),
      setParameter: jest.fn((key: string, value: unknown) => {
        if (key === 'amount') {
          amountParam = value as number;
        }
        return qb;
      }),
      execute: jest.fn(async () => {
        if (
          amountParam !== undefined &&
          wallet.availableBalance >= amountParam
        ) {
          wallet.availableBalance -= amountParam;
          return { affected: 1 };
        }
        return { affected: 0 };
      }),
    };
    return qb;
  }

  it('debits the wallet exactly once when the conditional UPDATE succeeds', async () => {
    const wallet = {
      availableBalance: 100,
      payoutEmail: null,
      bankAccountLast4: null,
      bankRoutingLast4: null,
    };
    const sellerWalletRepository = repository({
      findOne: jest.fn(async () => wallet),
      createQueryBuilder: jest.fn(() => createAtomicDebitQueryBuilder(wallet)),
    });
    const payoutRequestRepository = repository();

    const { service } = createService(undefined, {
      sellerWalletRepository,
      payoutRequestRepository,
    });

    const result = await service.createPayoutRequest('seller-1', 30, 'paypal');

    expect(wallet.availableBalance).toBe(70);
    expect(payoutRequestRepository.save).toHaveBeenCalledTimes(1);
    expect((result as PayoutRequest).amount).toBe(30);
  });

  it('rejects a payout request when a concurrent debit already brought the balance below the requested amount (no over-withdrawal)', async () => {
    // A concurrent payout request has already debited the wallet down to
    // 40; this request asks for 50, which the atomic conditional UPDATE
    // must refuse (affected: 0) rather than allowing two requests to both
    // succeed against the same pre-debit balance.
    const wallet = {
      availableBalance: 40,
      payoutEmail: null,
      bankAccountLast4: null,
      bankRoutingLast4: null,
    };
    const sellerWalletRepository = repository({
      findOne: jest.fn(async () => wallet),
      createQueryBuilder: jest.fn(() => createAtomicDebitQueryBuilder(wallet)),
    });
    const payoutRequestRepository = repository();

    const { service } = createService(undefined, {
      sellerWalletRepository,
      payoutRequestRepository,
    });

    await expect(
      service.createPayoutRequest('seller-1', 50, 'paypal')
    ).rejects.toThrow('Insufficient funds for payout');

    expect(payoutRequestRepository.create).not.toHaveBeenCalled();
    expect(payoutRequestRepository.save).not.toHaveBeenCalled();
    expect(wallet.availableBalance).toBe(40);
  });
});

describe('PaymentService.cancelPayoutRequest atomic status transition', () => {
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
      createdAt: new Date(),
      processedAt: null,
      ...overrides,
    } as PayoutRequest;
  }

  function createAtomicCancelQueryBuilder(payoutRequest: PayoutRequest) {
    let expectedStatus: string | undefined;
    const qb = {
      update: jest.fn(() => qb),
      set: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn((_sql: string, params?: Record<string, unknown>) => {
        if (params && 'expected' in params) {
          expectedStatus = params.expected as string;
        }
        return qb;
      }),
      execute: jest.fn(async () => {
        if (
          expectedStatus !== undefined &&
          payoutRequest.status === expectedStatus
        ) {
          payoutRequest.status = 'cancelled';
          return { affected: 1 };
        }
        return { affected: 0 };
      }),
    };
    return qb;
  }

  it('refunds the wallet exactly once when the conditional UPDATE succeeds', async () => {
    const payoutRequest = buildPayoutRequest();
    const wallet = { availableBalance: 10 };
    const payoutRequestRepository = repository({
      findOne: jest.fn(async () => payoutRequest),
      createQueryBuilder: jest.fn(() =>
        createAtomicCancelQueryBuilder(payoutRequest)
      ),
    });
    const sellerWalletRepository = repository({
      findOne: jest.fn(async () => wallet),
    });

    payoutRequestRepository.manager = {
      transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) =>
        cb({
          getRepository: (entity: unknown) =>
            entity === SellerWallet
              ? sellerWalletRepository
              : payoutRequestRepository,
        })
      ),
    };

    const { service } = createService(undefined, {
      sellerWalletRepository,
      payoutRequestRepository,
    });

    const result = await service.cancelPayoutRequest('payout-1', 'seller-1');

    expect(result.status).toBe('cancelled');
    expect(wallet.availableBalance).toBe(35);
    expect(sellerWalletRepository.save).toHaveBeenCalledTimes(1);
  });

  it('does not double-refund when a concurrent cancel already transitioned the payout request (lost race)', async () => {
    // Simulates two concurrent cancelPayoutRequest calls: the first read
    // observes `pending`, but by the time the conditional UPDATE runs, a
    // concurrent call has already flipped the row to `cancelled`.
    const payoutRequest = buildPayoutRequest();
    const sellerWalletRepository = repository();
    const payoutRequestRepository = repository({
      findOne: jest.fn(async () => payoutRequest),
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

    payoutRequestRepository.manager = {
      transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) =>
        cb({
          getRepository: (entity: unknown) =>
            entity === SellerWallet
              ? sellerWalletRepository
              : payoutRequestRepository,
        })
      ),
    };

    const { service } = createService(undefined, {
      sellerWalletRepository,
      payoutRequestRepository,
    });

    await expect(
      service.cancelPayoutRequest('payout-1', 'seller-1')
    ).rejects.toThrow('Only pending payouts can be cancelled');

    expect(sellerWalletRepository.save).not.toHaveBeenCalled();
  });
});
