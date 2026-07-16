import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  PaymentService,
  Payment,
  Offer,
  BusinessPage,
  Transaction,
} from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PaymentService, { provide: API_BASE_URL, useValue: '/api' }],
    });

    service = TestBed.inject(PaymentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ---------------------------------------------------------------------
  // Donations
  // ---------------------------------------------------------------------
  describe('donations', () => {
    it('fetches the donation goal with no query params when month/year are omitted', async () => {
      const promise = service.getDonationGoal();

      const req = httpMock.expectOne('/api/payments/donations/goal');
      expect(req.request.method).toBe('GET');

      req.flush({
        monthlyGoal: 1000,
        currentAmount: 250,
        donorCount: 5,
        month: 7,
        year: 2026,
      });

      await expect(promise).resolves.toEqual({
        monthlyGoal: 1000,
        currentAmount: 250,
        donorCount: 5,
        month: 7,
        year: 2026,
      });
    });

    it('builds query params for the donation goal when month/year are provided', async () => {
      const promise = service.getDonationGoal(3, 2026);

      const req = httpMock.expectOne(
        '/api/payments/donations/goal?month=3&year=2026'
      );
      expect(req.request.method).toBe('GET');
      req.flush({
        monthlyGoal: 500,
        currentAmount: 100,
        donorCount: 2,
        month: 3,
        year: 2026,
      });

      await promise;
    });

    it('builds a partial query string for monthly donations when only month is provided', async () => {
      const promise = service.getMonthlyDonations(5);

      const req = httpMock.expectOne('/api/payments/donations?month=5');
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await expect(promise).resolves.toEqual([]);
    });

    it('creates a donation checkout session with the correct URL, verb, and body', async () => {
      const promise = service.createDonationCheckout(25, true);

      const req = httpMock.expectOne('/api/payments/donations/checkout');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ amount: 25, isRecurring: true });

      req.flush({ checkoutUrl: 'https://checkout.example.com/session/abc' });

      await expect(promise).resolves.toEqual({
        checkoutUrl: 'https://checkout.example.com/session/abc',
      });
    });

    it('propagates an HttpErrorResponse and surfaces the server error message when donation checkout fails', async () => {
      const promise = service.createDonationCheckout(25, false);

      const req = httpMock.expectOne('/api/payments/donations/checkout');
      req.flush(
        { message: 'Lemon Squeezy is down' },
        { status: 502, statusText: 'Bad Gateway' }
      );

      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
      // HttpErrorResponse does not extend the native Error class; fail() reads
      // the server-provided message out of the response body (err.error.message)
      // rather than discarding it for a generic string.
      expect(service.error()).toBe('Lemon Squeezy is down');
      expect(service.loading()).toBe(false);
    });

    it('sets the loading signal for the duration of a request and clears it on success', async () => {
      expect(service.loading()).toBe(false);
      const promise = service.getUserDonations();
      expect(service.loading()).toBe(true);

      const req = httpMock.expectOne('/api/payments/donations/user');
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await promise;
      expect(service.loading()).toBe(false);
    });

    it('cancels a recurring donation subscription via DELETE', async () => {
      const promise = service.cancelRecurringDonation('sub-123');

      const req = httpMock.expectOne(
        '/api/payments/donations/subscription/sub-123'
      );
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      await expect(promise).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------
  // Classifieds payments
  // ---------------------------------------------------------------------
  describe('classifieds payments', () => {
    it('creates a classified payment with the correct URL, verb, and body', async () => {
      const promise = service.createClassifiedPayment(
        'classified-1',
        'cash-app'
      );

      const req = httpMock.expectOne('/api/payments/classifieds/payment');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        classifiedId: 'classified-1',
        paymentMethod: 'cash-app',
      });

      const payment: Payment = {
        id: 'pay-1',
        classifiedId: 'classified-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        amount: 100,
        platformFeeAmount: 5,
        sellerReceivesAmount: 95,
        currency: 'usd',
        paymentMethod: 'cash-app',
        status: 'pending',
        createdAt: '2026-07-14T00:00:00.000Z',
      };
      req.flush(payment);

      await expect(promise).resolves.toEqual(payment);
    });

    it('propagates an error and surfaces the server error message when classified payment creation fails', async () => {
      const promise = service.createClassifiedPayment('classified-1', 'card');

      const req = httpMock.expectOne('/api/payments/classifieds/payment');
      req.flush(
        { message: 'insufficient funds' },
        { status: 402, statusText: 'Payment Required' }
      );

      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(service.error()).toBe('insufficient funds');
    });

    it('confirms an out-of-platform payment with the proof image URL', async () => {
      const promise = service.confirmOutOfPlatformPayment(
        'pay-1',
        'https://example.com/proof.png'
      );

      const req = httpMock.expectOne(
        '/api/payments/classifieds/payment/pay-1/confirm'
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        proofImageUrl: 'https://example.com/proof.png',
      });
      req.flush({ id: 'pay-1', status: 'confirmed' });

      await expect(promise).resolves.toMatchObject({ status: 'confirmed' });
    });

    it('confirms payment received (release) with an empty body', async () => {
      const promise = service.confirmPaymentReceived('pay-1');

      const req = httpMock.expectOne(
        '/api/payments/classifieds/payment/pay-1/release'
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ id: 'pay-1', status: 'released' });

      await expect(promise).resolves.toMatchObject({ status: 'released' });
    });

    it('disputes a payment with the correct URL, verb, and reason body', async () => {
      const promise = service.disputePayment('pay-1', 'item not as described');

      const req = httpMock.expectOne(
        '/api/payments/classifieds/payment/pay-1/dispute'
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ reason: 'item not as described' });
      req.flush({ id: 'pay-1', status: 'disputed' });

      await expect(promise).resolves.toMatchObject({ status: 'disputed' });
    });

    it('propagates an error when disputing a payment fails', async () => {
      const promise = service.disputePayment('pay-1', 'reason');

      const req = httpMock.expectOne(
        '/api/payments/classifieds/payment/pay-1/dispute'
      );
      req.flush(
        { message: 'payment already resolved' },
        { status: 409, statusText: 'Conflict' }
      );

      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(service.error()).toBe('payment already resolved');
      expect(service.loading()).toBe(false);
    });

    it('fetches a single payment by id', async () => {
      const promise = service.getPayment('pay-1');

      const req = httpMock.expectOne('/api/payments/classifieds/payment/pay-1');
      expect(req.request.method).toBe('GET');
      req.flush({ id: 'pay-1' });

      await expect(promise).resolves.toMatchObject({ id: 'pay-1' });
    });

    it('fetches the current user payments', async () => {
      const promise = service.getUserPayments();

      const req = httpMock.expectOne('/api/payments/classifieds/payments/user');
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await expect(promise).resolves.toEqual([]);
    });
  });

  // ---------------------------------------------------------------------
  // Business pages
  // ---------------------------------------------------------------------
  describe('business pages', () => {
    it('starts business-page checkout, sending localityId as both localityId and communityId', async () => {
      const promise = service.createBusinessPage('locality-1', 'pro');

      const req = httpMock.expectOne('/api/payments/business/checkout');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        localityId: 'locality-1',
        communityId: 'locality-1',
        tier: 'pro',
      });
      req.flush({ checkoutUrl: 'https://checkout.example.com/biz' });

      await expect(promise).resolves.toEqual({
        checkoutUrl: 'https://checkout.example.com/biz',
      });
    });

    it('propagates an error when business-page checkout fails', async () => {
      const promise = service.createBusinessPage('locality-1', 'basic');

      const req = httpMock.expectOne('/api/payments/business/checkout');
      req.flush(
        { message: 'boom' },
        { status: 500, statusText: 'Server Error' }
      );

      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(service.error()).toBe('boom');
    });

    it('returns null from getBusinessPage when the API returns null', async () => {
      const promise = service.getBusinessPage('community-1');

      const req = httpMock.expectOne('/api/payments/business/community-1');
      expect(req.request.method).toBe('GET');
      req.flush(null);

      await expect(promise).resolves.toBeNull();
    });

    it('preserves an explicit status on the returned business page', async () => {
      const promise = service.getBusinessPage('community-1');

      const req = httpMock.expectOne('/api/payments/business/community-1');
      req.flush({
        id: 'bp-1',
        userId: 'user-1',
        communityId: 'community-1',
        name: 'Acme',
        tier: 'basic',
        status: 'past-due',
        locations: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      await expect(promise).resolves.toMatchObject({ status: 'past-due' });
    });

    it('derives userId from ownerId and status from subscriptionStatus when status is absent', async () => {
      const promise = service.getBusinessPage('community-1');

      const req = httpMock.expectOne('/api/payments/business/community-1');
      req.flush({
        id: 'bp-1',
        ownerId: 'owner-1',
        communityId: 'community-1',
        name: 'Acme',
        tier: 'basic',
        subscriptionStatus: 'cancelled',
        locations: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as unknown as BusinessPage);

      await expect(promise).resolves.toMatchObject({
        userId: 'owner-1',
        status: 'canceled',
      });
    });

    it('maps subscriptionStatus "inactive" to "trial" when status is absent', async () => {
      const promise = service.getBusinessPage('community-1');

      const req = httpMock.expectOne('/api/payments/business/community-1');
      req.flush({
        id: 'bp-1',
        ownerId: 'owner-1',
        communityId: 'community-1',
        name: 'Acme',
        tier: 'basic',
        subscriptionStatus: 'inactive',
        locations: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as unknown as BusinessPage);

      await expect(promise).resolves.toMatchObject({ status: 'trial' });
    });

    it('unwraps a { success, businessPage } response from updateBusinessPage', async () => {
      const promise = service.updateBusinessPage('community-1', {
        name: 'New Name',
      });

      const req = httpMock.expectOne('/api/payments/business/community-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ name: 'New Name' });

      req.flush({
        success: true,
        businessPage: {
          id: 'bp-1',
          userId: 'user-1',
          communityId: 'community-1',
          name: 'New Name',
          tier: 'basic',
          status: 'active',
          locations: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      });

      await expect(promise).resolves.toMatchObject({
        id: 'bp-1',
        name: 'New Name',
      });
    });

    it('accepts a bare BusinessPage response from updateBusinessPage', async () => {
      const promise = service.updateBusinessPage('community-1', {
        name: 'New Name',
      });

      const req = httpMock.expectOne('/api/payments/business/community-1');
      req.flush({
        id: 'bp-1',
        userId: 'user-1',
        communityId: 'community-1',
        name: 'New Name',
        tier: 'basic',
        status: 'active',
        locations: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      await expect(promise).resolves.toMatchObject({
        id: 'bp-1',
        name: 'New Name',
      });
    });

    it('cancels a business subscription via DELETE', async () => {
      const promise = service.cancelBusinessSubscription('community-1');

      const req = httpMock.expectOne(
        '/api/payments/business/community-1/subscription'
      );
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      await expect(promise).resolves.toBeUndefined();
    });

    it('fetches city businesses with no query string when communityIds is empty', async () => {
      const promise = service.getCityBusinesses('city-1');

      const req = httpMock.expectOne('/api/payments/business/city/city-1');
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await expect(promise).resolves.toEqual([]);
    });

    it('builds a comma-joined communityIds query param for getCityBusinesses', async () => {
      const promise = service.getCityBusinesses('city-1', ['a', 'b']);

      const req = httpMock.expectOne(
        '/api/payments/business/city/city-1?communityIds=a%2Cb'
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await promise;
    });
  });

  // ---------------------------------------------------------------------
  // Sponsorships
  // ---------------------------------------------------------------------
  describe('sponsorships', () => {
    it('creates a sponsorship checkout with the correct body', async () => {
      const promise = service.createSponsorship(
        'community-1',
        'banner',
        'ad copy'
      );

      const req = httpMock.expectOne('/api/payments/sponsorship/checkout');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        communityId: 'community-1',
        type: 'banner',
        adContent: 'ad copy',
      });
      req.flush({ checkoutUrl: 'https://checkout.example.com/spon' });

      await expect(promise).resolves.toEqual({
        checkoutUrl: 'https://checkout.example.com/spon',
      });
    });

    it('fetches active sponsorships for a community', async () => {
      const promise = service.getActiveSponsorships('community-1');

      const req = httpMock.expectOne(
        '/api/payments/sponsorship/community-1/active'
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await expect(promise).resolves.toEqual([]);
    });

    it('fetches the current user sponsorships', async () => {
      const promise = service.getUserSponsorships();

      const req = httpMock.expectOne('/api/payments/sponsorship/user');
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await expect(promise).resolves.toEqual([]);
    });
  });

  // ---------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------
  describe('transactions', () => {
    it('fetches the transaction history', async () => {
      const promise = service.getTransactions();

      const req = httpMock.expectOne('/api/payments/transactions');
      expect(req.request.method).toBe('GET');

      const transactions: Transaction[] = [
        {
          id: 'txn-1',
          type: 'donation',
          amount: 25,
          currency: 'usd',
          status: 'completed',
          description: 'Monthly donation',
          userId: 'user-1',
          createdAt: '2026-07-14T00:00:00.000Z',
        },
      ];
      req.flush(transactions);

      await expect(promise).resolves.toEqual(transactions);
    });

    it('propagates an error when fetching transactions fails', async () => {
      const promise = service.getTransactions();

      const req = httpMock.expectOne('/api/payments/transactions');
      req.flush(
        { message: 'db unavailable' },
        { status: 503, statusText: 'Service Unavailable' }
      );

      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(service.error()).toBe('db unavailable');
      expect(service.loading()).toBe(false);
    });

    it('falls back to the portalUrl field when url is absent', async () => {
      const promise = service.getLemonSqueezyPortalUrl();

      const req = httpMock.expectOne('/api/payments/portal');
      expect(req.request.method).toBe('GET');
      req.flush({ portalUrl: 'https://portal.example.com' });

      await expect(promise).resolves.toEqual({
        url: 'https://portal.example.com',
      });
    });

    it('prefers the url field over portalUrl when both are present', async () => {
      const promise = service.getLemonSqueezyPortalUrl();

      const req = httpMock.expectOne('/api/payments/portal');
      req.flush({
        url: 'https://url.example.com',
        portalUrl: 'https://portal.example.com',
      });

      await expect(promise).resolves.toEqual({
        url: 'https://url.example.com',
      });
    });
  });

  // ---------------------------------------------------------------------
  // Offers
  // ---------------------------------------------------------------------
  describe('offers', () => {
    it('creates an offer with the correct URL, verb, and body', async () => {
      const promise = service.createOffer(
        'classified-1',
        'seller-1',
        50,
        'would you take 50?'
      );

      const req = httpMock.expectOne('/api/payments/offers');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        classifiedId: 'classified-1',
        sellerId: 'seller-1',
        amount: 50,
        message: 'would you take 50?',
      });

      const offer: Offer = {
        id: 'offer-1',
        classifiedId: 'classified-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        offeredAmount: 50,
        status: 'pending',
        expiresAt: '2026-07-21T00:00:00.000Z',
        createdAt: '2026-07-14T00:00:00.000Z',
        updatedAt: '2026-07-14T00:00:00.000Z',
      };
      req.flush(offer);

      await expect(promise).resolves.toEqual(offer);
    });

    it('propagates an error when offer creation fails', async () => {
      const promise = service.createOffer('classified-1', 'seller-1', 50);

      const req = httpMock.expectOne('/api/payments/offers');
      req.flush(
        { message: 'classified no longer available' },
        { status: 410, statusText: 'Gone' }
      );

      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(service.error()).toBe('classified no longer available');
      expect(service.loading()).toBe(false);
    });

    it('accepts an offer via PATCH with an empty body and returns offer + payment', async () => {
      const promise = service.acceptOffer('offer-1');

      const req = httpMock.expectOne('/api/payments/offers/offer-1/accept');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});

      req.flush({
        offer: { id: 'offer-1', status: 'accepted' },
        payment: { id: 'pay-1', status: 'pending' },
      });

      await expect(promise).resolves.toMatchObject({
        offer: { status: 'accepted' },
        payment: { status: 'pending' },
      });
    });

    it('propagates an error when accepting an offer fails', async () => {
      const promise = service.acceptOffer('offer-1');

      const req = httpMock.expectOne('/api/payments/offers/offer-1/accept');
      req.flush(
        { message: 'offer expired' },
        { status: 409, statusText: 'Conflict' }
      );

      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(service.error()).toBe('offer expired');
    });

    it('rejects an offer via PATCH with an empty body', async () => {
      const promise = service.rejectOffer('offer-1');

      const req = httpMock.expectOne('/api/payments/offers/offer-1/reject');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush({ id: 'offer-1', status: 'rejected' });

      await expect(promise).resolves.toMatchObject({ status: 'rejected' });
    });

    it('counters an offer with the counterAmount and message body', async () => {
      const promise = service.counterOffer('offer-1', 75, 'best I can do');

      const req = httpMock.expectOne('/api/payments/offers/offer-1/counter');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({
        counterAmount: 75,
        message: 'best I can do',
      });
      req.flush({ id: 'offer-1', status: 'countered', counterOfferAmount: 75 });

      await expect(promise).resolves.toMatchObject({
        status: 'countered',
        counterOfferAmount: 75,
      });
    });

    it('propagates an error when countering an offer fails', async () => {
      const promise = service.counterOffer('offer-1', 75);

      const req = httpMock.expectOne('/api/payments/offers/offer-1/counter');
      req.flush(
        { message: 'boom' },
        { status: 500, statusText: 'Server Error' }
      );

      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(service.error()).toBe('boom');
    });

    it('withdraws an offer via PATCH with an empty body', async () => {
      const promise = service.withdrawOffer('offer-1');

      const req = httpMock.expectOne('/api/payments/offers/offer-1/withdraw');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush({ id: 'offer-1', status: 'withdrawn' });

      await expect(promise).resolves.toMatchObject({ status: 'withdrawn' });
    });

    it('fetches offers for a classified listing', async () => {
      const promise = service.getOffersForClassified('classified-1');

      const req = httpMock.expectOne(
        '/api/payments/offers/classified/classified-1'
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await expect(promise).resolves.toEqual([]);
    });

    it('fetches the current user offers as buyer and seller', async () => {
      const promise = service.getUserOffers();

      const req = httpMock.expectOne('/api/payments/offers/user');
      expect(req.request.method).toBe('GET');
      req.flush({ asBuyer: [], asSeller: [] });

      await expect(promise).resolves.toEqual({ asBuyer: [], asSeller: [] });
    });
  });

  // ---------------------------------------------------------------------
  // Seller wallet / payouts
  // ---------------------------------------------------------------------
  describe('seller wallet and payouts', () => {
    it('fetches the seller wallet', async () => {
      const promise = service.getSellerWallet();

      const req = httpMock.expectOne('/api/payments/seller/wallet');
      expect(req.request.method).toBe('GET');
      req.flush(null);

      await expect(promise).resolves.toBeNull();
    });

    it('updates seller payout info via PATCH with the correct body', async () => {
      const promise = service.updateSellerPayoutInfo(
        'paypal',
        'seller@example.com'
      );

      const req = httpMock.expectOne('/api/payments/seller/wallet/payout-info');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({
        payoutMethod: 'paypal',
        payoutEmail: 'seller@example.com',
        bankAccountLast4: undefined,
        bankRoutingLast4: undefined,
      });
      req.flush({ id: 'wallet-1', payoutMethod: 'paypal' });

      await expect(promise).resolves.toMatchObject({ payoutMethod: 'paypal' });
    });

    it('creates a payout request with the correct body', async () => {
      const promise = service.createPayoutRequest(
        100,
        'bank-transfer',
        undefined,
        '1234',
        '5678'
      );

      const req = httpMock.expectOne('/api/payments/seller/payout');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        amount: 100,
        payoutMethod: 'bank-transfer',
        payoutEmail: undefined,
        bankAccountLast4: '1234',
        bankRoutingLast4: '5678',
      });
      req.flush({ id: 'payout-1', amount: 100, status: 'pending' });

      await expect(promise).resolves.toMatchObject({ status: 'pending' });
    });

    it('fetches seller payout requests', async () => {
      const promise = service.getSellerPayoutRequests();

      const req = httpMock.expectOne('/api/payments/seller/payouts');
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await expect(promise).resolves.toEqual([]);
    });

    it('cancels a payout request via DELETE', async () => {
      const promise = service.cancelPayoutRequest('payout-1');

      const req = httpMock.expectOne('/api/payments/seller/payout/payout-1');
      expect(req.request.method).toBe('DELETE');
      req.flush({ id: 'payout-1', status: 'cancelled' });

      await expect(promise).resolves.toMatchObject({ status: 'cancelled' });
    });

    it('fetches the seller earnings summary', async () => {
      const promise = service.getSellerEarningsSummary();

      const req = httpMock.expectOne('/api/payments/seller/earnings');
      expect(req.request.method).toBe('GET');
      req.flush({
        availableBalance: 100,
        pendingBalance: 20,
        totalEarned: 500,
        totalPaidOut: 380,
        salesCount: 12,
        payoutMethod: 'paypal',
        payoutEmail: 'seller@example.com',
      });

      await expect(promise).resolves.toMatchObject({ salesCount: 12 });
    });
  });

  // ---------------------------------------------------------------------
  // Error-state recovery
  // ---------------------------------------------------------------------
  describe('error signal lifecycle', () => {
    it('clears a previous error when a subsequent request succeeds', async () => {
      const failedPromise = service.createDonationCheckout(10, false);
      httpMock
        .expectOne('/api/payments/donations/checkout')
        .flush(
          { message: 'boom' },
          { status: 500, statusText: 'Server Error' }
        );
      await expect(failedPromise).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(service.error()).toBe('boom');

      const okPromise = service.createDonationCheckout(10, false);
      // error should already be cleared by begin() before the response lands
      expect(service.error()).toBeNull();
      httpMock
        .expectOne('/api/payments/donations/checkout')
        .flush({ checkoutUrl: 'https://checkout.example.com' });

      await expect(okPromise).resolves.toEqual({
        checkoutUrl: 'https://checkout.example.com',
      });
      expect(service.error()).toBeNull();
    });
  });
});
