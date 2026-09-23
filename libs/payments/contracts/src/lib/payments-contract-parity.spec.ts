import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentCommands } from '../index';
import {
  CancelPayoutRequestDto,
  CancelSubscriptionDto,
  CreateDonationCheckoutDto,
  CreatePayoutRequestDto,
  DonationDto,
  DonationGoalDto,
  DonationStatus,
  GetPaymentDto,
  PortalUrlDto,
  PayoutMethod,
  PayoutRequestDto,
  ProcessWebhookDto,
  RecordDonationDto,
  SellerEarningsSummaryDto,
  SellerPayoutRequestsDto,
  SellerWalletDto,
  SyncProductsDto,
  UpdateSellerPayoutInfoDto,
  UserDonationsDto,
  UserPaymentsDto,
  UserTransactionsDto,
} from '../index';

/**
 * Covered `PaymentCommands` with their contract DTO plus one valid and one
 * invalid sample. Classified payments, out-of-platform confirm/release/dispute,
 * interested-buyer markers, business checkout/page/theme, sponsorships, offers,
 * and business-pages-by-city are deferred (E14/E15 move content reads to social;
 * C3 decides the classified saga owner) and listed in DEFERRED below.
 */
const COVERED: Array<{
  pattern: string;
  dto: new () => object;
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
  invalidProps: string[];
}> = [
  {
    pattern: PaymentCommands.GET_DONATION_GOAL,
    dto: DonationGoalDto,
    valid: { month: 9, year: 2026 },
    invalid: { month: 13, year: 2026 },
    invalidProps: ['month'],
  },
  {
    pattern: PaymentCommands.LIST_DONATIONS,
    dto: DonationGoalDto,
    valid: { month: 9, year: 2026 },
    invalid: {},
    invalidProps: ['month', 'year'],
  },
  {
    pattern: PaymentCommands.RECORD_DONATION,
    dto: RecordDonationDto,
    valid: { amount: 25, message: 'For the cause', anonymous: true },
    invalid: { amount: 'lots' },
    invalidProps: ['amount'],
  },
  {
    pattern: PaymentCommands.CREATE_DONATION_CHECKOUT,
    dto: CreateDonationCheckoutDto,
    valid: {
      userId: 'user-1',
      profileId: 'profile-1',
      amount: 25,
      isRecurring: false,
      appScope: 'finance',
    },
    invalid: { userId: 'user-1' },
    invalidProps: ['profileId', 'amount', 'isRecurring', 'appScope'],
  },
  {
    pattern: PaymentCommands.GET_USER_DONATIONS,
    dto: UserDonationsDto,
    valid: { userId: 'user-1' },
    invalid: {},
    invalidProps: ['userId'],
  },
  {
    pattern: PaymentCommands.CANCEL_SUBSCRIPTION,
    dto: CancelSubscriptionDto,
    valid: { userId: 'user-1', subscriptionId: 'sub-1' },
    invalid: { userId: 'user-1' },
    invalidProps: ['subscriptionId'],
  },
  {
    pattern: PaymentCommands.GET_USER_TRANSACTIONS,
    dto: UserTransactionsDto,
    valid: { userId: 'user-1' },
    invalid: {},
    invalidProps: ['userId'],
  },
  {
    pattern: PaymentCommands.GET_PORTAL_URL,
    dto: PortalUrlDto,
    valid: { userId: 'user-1' },
    invalid: {},
    invalidProps: ['userId'],
  },
  {
    pattern: PaymentCommands.GET_PAYMENT,
    dto: GetPaymentDto,
    valid: { paymentId: 'pay-1', userId: 'user-1' },
    invalid: { paymentId: 'pay-1' },
    invalidProps: ['userId'],
  },
  {
    pattern: PaymentCommands.GET_USER_PAYMENTS,
    dto: UserPaymentsDto,
    valid: { userId: 'user-1' },
    invalid: {},
    invalidProps: ['userId'],
  },
  {
    pattern: PaymentCommands.UPDATE_SELLER_PAYOUT_INFO,
    dto: UpdateSellerPayoutInfoDto,
    valid: { sellerId: 'seller-1', payoutMethod: PayoutMethod.PAYPAL },
    invalid: { sellerId: 'seller-1', payoutMethod: 'cash' },
    invalidProps: ['payoutMethod'],
  },
  {
    pattern: PaymentCommands.CREATE_PAYOUT_REQUEST,
    dto: CreatePayoutRequestDto,
    valid: {
      sellerId: 'seller-1',
      amount: 100,
      payoutMethod: PayoutMethod.VENMO,
    },
    invalid: { sellerId: 'seller-1', amount: 100 },
    invalidProps: ['payoutMethod'],
  },
  {
    pattern: PaymentCommands.GET_SELLER_PAYOUT_REQUESTS,
    dto: SellerPayoutRequestsDto,
    valid: { sellerId: 'seller-1' },
    invalid: {},
    invalidProps: ['sellerId'],
  },
  {
    pattern: PaymentCommands.CANCEL_PAYOUT_REQUEST,
    dto: CancelPayoutRequestDto,
    valid: { payoutRequestId: 'payout-1', sellerId: 'seller-1' },
    invalid: { sellerId: 'seller-1' },
    invalidProps: ['payoutRequestId'],
  },
  {
    pattern: PaymentCommands.GET_SELLER_WALLET,
    dto: SellerWalletDto,
    valid: { sellerId: 'seller-1' },
    invalid: {},
    invalidProps: ['sellerId'],
  },
  {
    pattern: PaymentCommands.GET_SELLER_EARNINGS_SUMMARY,
    dto: SellerEarningsSummaryDto,
    valid: { sellerId: 'seller-1' },
    invalid: {},
    invalidProps: ['sellerId'],
  },
  {
    pattern: PaymentCommands.PROCESS_WEBHOOK,
    dto: ProcessWebhookDto,
    valid: { eventType: 'order.created', data: { id: 'ord-1' } },
    invalid: { eventType: 'order.created', data: 'ord-1' },
    invalidProps: ['data'],
  },
  {
    pattern: PaymentCommands.SYNC_LEMON_SQUEEZY_PRODUCTS,
    dto: SyncProductsDto,
    valid: {},
    invalid: { appScope: 42 },
    invalidProps: ['appScope'],
  },
];

const DEFERRED = [
  'CREATE_CLASSIFIED_PAYMENT',
  'CONFIRM_OUT_OF_PLATFORM_PAYMENT',
  'RELEASE_FUNDS',
  'DISPUTE_PAYMENT',
  'MARK_INTERESTED_BUYER',
  'MARK_PAID_OUTSIDE_PLATFORM',
  'CREATE_BUSINESS_CHECKOUT',
  'GET_BUSINESS_PAGE',
  'UPDATE_BUSINESS_PAGE',
  'CANCEL_BUSINESS_SUBSCRIPTION',
  'CREATE_BUSINESS_THEME',
  'GET_BUSINESS_THEME',
  'UPDATE_BUSINESS_THEME',
  'CREATE_SPONSORSHIP_CHECKOUT',
  'GET_ACTIVE_SPONSORSHIPS',
  'GET_USER_SPONSORSHIPS',
  'CREATE_OFFER',
  'ACCEPT_OFFER',
  'REJECT_OFFER',
  'COUNTER_OFFER',
  'WITHDRAW_OFFER',
  'GET_OFFERS_FOR_CLASSIFIED',
  'GET_USER_OFFERS',
  'GET_BUSINESS_PAGES_BY_CITY',
];

const propsOf = (errors: Array<{ property: string }>) =>
  errors.map((e) => e.property).sort();

describe('payments-contract-parity', () => {
  it.each(COVERED.map((c) => [c.pattern, c]))(
    'pattern %s validates its DTO both ways',
    async (_pattern, entry) => {
      const valid = plainToInstance(entry.dto, entry.valid);
      expect(await validate(valid)).toEqual([]);
      const invalid = plainToInstance(entry.dto, entry.invalid);
      expect(propsOf(await validate(invalid))).toEqual(
        [...entry.invalidProps].sort()
      );
    }
  );

  it('covers the money-in core and names every deferred key', () => {
    const commands = PaymentCommands as Record<string, string>;
    const coveredValues = new Set(COVERED.map((c) => c.pattern));
    const expected = new Set([
      ...coveredValues,
      ...DEFERRED.map((k) => commands[k]),
    ]);
    expect(new Set(Object.values(commands))).toEqual(expected);
    for (const key of DEFERRED) {
      expect(coveredValues.has(commands[key])).toBe(false);
    }
  });

  it('DonationDto accepts the canonical read shape', async () => {
    const dto = plainToInstance(DonationDto, {
      id: 'don-1',
      userId: 'user-1',
      amount: 25,
      isRecurring: false,
      status: DonationStatus.COMPLETED,
      currency: 'USD',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('PayoutRequestDto rejects an unknown payout method', async () => {
    const dto = plainToInstance(PayoutRequestDto, {
      sellerId: 'seller-1',
      amount: 100,
      status: 'pending',
      payoutMethod: 'cash',
    });
    expect(propsOf(await validate(dto))).toEqual(['payoutMethod']);
  });
});
