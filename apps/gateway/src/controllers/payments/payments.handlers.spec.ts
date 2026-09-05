import { of } from 'rxjs';
import { PaymentCommands } from '@optimistic-tanuki/constants';
import { PaymentsController } from './payments.controller';
import type { UserDetails } from '../../decorators/user.decorator';

/**
 * The controller builds its own ClientProxy from config in the constructor, so
 * these construct it with a stub ConfigService and then swap that client for a
 * mock. What is asserted is the message pattern and payload each handler sends.
 */
describe('Gateway PaymentsController handlers', () => {
  let controller: PaymentsController;
  let client: { send: jest.Mock };

  const user = { userId: 'user-1', profileId: 'profile-1' } as UserDetails;

  const lastPattern = () => client.send.mock.calls.at(-1)?.[0];
  const lastPayload = () => client.send.mock.calls.at(-1)?.[1];

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue({ host: '127.0.0.1', port: 3999 }),
    };

    controller = new PaymentsController(configService as never);

    client = { send: jest.fn().mockReturnValue(of({ ok: true })) };
    (
      controller as unknown as { paymentsClient: typeof client }
    ).paymentsClient = client;
  });

  describe('payments', () => {
    it('scopes a single payment read to the caller', async () => {
      await controller.getPayment(user, 'pay-1');

      expect(lastPattern()).toEqual({ cmd: PaymentCommands.GET_PAYMENT });
      expect(lastPayload()).toEqual({ paymentId: 'pay-1', userId: 'user-1' });
    });

    it('lists the caller’s payments', async () => {
      await controller.getUserPayments(user);

      expect(lastPattern()).toEqual({ cmd: PaymentCommands.GET_USER_PAYMENTS });
      expect(lastPayload()).toEqual({ userId: 'user-1' });
    });

    it('lists the caller’s transactions', async () => {
      await controller.getTransactions(user);

      expect(lastPayload()).toEqual({ userId: 'user-1' });
    });

    it('opens the billing portal for the caller', async () => {
      await controller.getPortal(user);

      expect(lastPayload()).toEqual({ userId: 'user-1' });
    });
  });

  describe('business pages', () => {
    it('creates a checkout carrying the community, tier and app scope', async () => {
      await controller.createBusinessCheckout(
        user,
        { communityId: 'c-1', tier: 'pro' } as never,
        'local-hub'
      );

      expect(lastPattern()).toEqual({
        cmd: PaymentCommands.CREATE_BUSINESS_CHECKOUT,
      });
      expect(lastPayload()).toEqual({
        userId: 'user-1',
        communityId: 'c-1',
        tier: 'pro',
        appScope: 'local-hub',
      });
    });

    it('reads a business page by community', async () => {
      await controller.getBusinessPage('c-1');

      expect(lastPattern()).toEqual({
        cmd: PaymentCommands.GET_BUSINESS_PAGE,
      });
      expect(lastPayload()).toEqual({ communityId: 'c-1' });
    });

    it('falls back to null when no business page is emitted', async () => {
      // The handler pipes defaultIfEmpty(null) so an empty reply is not a hang.
      client.send.mockReturnValue(of());

      await expect(controller.getBusinessPage('c-1')).resolves.toBeNull();
    });

    it('splits a comma-separated community list for a city lookup', async () => {
      await controller.getBusinessPagesByCity('city-1', 'c-1,c-2,c-3');

      expect(lastPattern()).toEqual({
        cmd: PaymentCommands.GET_BUSINESS_PAGES_BY_CITY,
      });
      expect(lastPayload()).toEqual({
        cityId: 'city-1',
        communityIds: ['c-1', 'c-2', 'c-3'],
      });
    });

    it('sends an empty list when no communities are named', async () => {
      await controller.getBusinessPagesByCity('city-1');

      expect(lastPayload()).toEqual({ cityId: 'city-1', communityIds: [] });
    });

    it('scopes a business page update to the caller and community', async () => {
      await controller.updateBusinessPage(user, 'c-1', {
        headline: 'New',
      } as never);

      expect(lastPattern()).toEqual({
        cmd: PaymentCommands.UPDATE_BUSINESS_PAGE,
      });
      expect(lastPayload()).toEqual(
        expect.objectContaining({ userId: 'user-1', communityId: 'c-1' })
      );
    });

    it('scopes a subscription cancellation to the caller and community', async () => {
      await controller.cancelBusinessSubscription(user, 'c-1');

      expect(lastPattern()).toEqual({
        cmd: PaymentCommands.CANCEL_BUSINESS_SUBSCRIPTION,
      });
      expect(lastPayload()).toEqual(
        expect.objectContaining({ userId: 'user-1', communityId: 'c-1' })
      );
    });
  });

  describe('sponsorships', () => {
    it('creates a checkout carrying the ad content and app scope', async () => {
      await controller.createSponsorshipCheckout(
        user,
        {
          communityId: 'c-1',
          type: 'banner',
          adContent: { headline: 'Hello' },
        } as never,
        'local-hub'
      );

      expect(lastPattern()).toEqual({
        cmd: PaymentCommands.CREATE_SPONSORSHIP_CHECKOUT,
      });
      expect(lastPayload()).toEqual({
        userId: 'user-1',
        communityId: 'c-1',
        type: 'banner',
        adContent: { headline: 'Hello' },
        appScope: 'local-hub',
      });
    });

    it('reads active sponsorships for a community', async () => {
      await controller.getActiveSponsorships('c-1');

      expect(lastPayload()).toEqual(
        expect.objectContaining({ communityId: 'c-1' })
      );
    });

    it('lists the caller’s sponsorships', async () => {
      await controller.getUserSponsorships(user);

      expect(lastPayload()).toEqual(
        expect.objectContaining({ userId: 'user-1' })
      );
    });
  });

  describe('offers', () => {
    it('lists the caller’s offers', async () => {
      await controller.getUserOffers(user);

      expect(lastPayload()).toEqual(
        expect.objectContaining({ userId: 'user-1' })
      );
    });

    it('reads offers for a classified', async () => {
      await controller.getOffersForClassified(user, 'classified-1');

      expect(lastPayload()).toEqual(
        expect.objectContaining({ userId: 'user-1' })
      );
    });

    it('creates an offer with the caller as buyer', async () => {
      await controller.createOffer(user, { amount: 100 } as never);

      expect(lastPattern()).toEqual({ cmd: PaymentCommands.CREATE_OFFER });
      expect(lastPayload()).toEqual(
        expect.objectContaining({ buyerId: 'user-1' })
      );
    });

    // Which side of the deal the caller is on differs per action: the seller
    // accepts, rejects and counters; only the buyer withdraws.
    it('accepts as the seller', async () => {
      await controller.acceptOffer(user, 'offer-1');

      expect(lastPattern()).toEqual({ cmd: PaymentCommands.ACCEPT_OFFER });
      expect(lastPayload()).toEqual({
        offerId: 'offer-1',
        sellerId: 'user-1',
      });
    });

    it('rejects as the seller', async () => {
      await controller.rejectOffer(user, 'offer-1');

      expect(lastPattern()).toEqual({ cmd: PaymentCommands.REJECT_OFFER });
      expect(lastPayload()).toEqual({
        offerId: 'offer-1',
        sellerId: 'user-1',
      });
    });

    it('counters as the seller', async () => {
      await controller.counterOffer(user, 'offer-1', {
        amount: 90,
      } as never);

      expect(lastPattern()).toEqual({ cmd: PaymentCommands.COUNTER_OFFER });
      expect(lastPayload()).toEqual(
        expect.objectContaining({ offerId: 'offer-1', sellerId: 'user-1' })
      );
    });

    it('withdraws as the buyer', async () => {
      await controller.withdrawOffer(user, 'offer-1');

      expect(lastPattern()).toEqual({ cmd: PaymentCommands.WITHDRAW_OFFER });
      expect(lastPayload()).toEqual({
        offerId: 'offer-1',
        buyerId: 'user-1',
      });
    });
  });

  // The seller endpoints key on sellerId rather than userId, even though the
  // value is the same caller id.
  describe('seller wallet', () => {
    it('reads the caller’s wallet by seller id', async () => {
      await controller.getSellerWallet(user);

      expect(lastPayload()).toEqual(
        expect.objectContaining({ sellerId: 'user-1' })
      );
    });

    it('lists the caller’s payout requests by seller id', async () => {
      await controller.getSellerPayoutRequests(user);

      expect(lastPayload()).toEqual(
        expect.objectContaining({ sellerId: 'user-1' })
      );
    });

    it('requests a payout as the seller', async () => {
      await controller.createPayoutRequest(user, { amount: 250 } as never);

      expect(lastPattern()).toEqual({
        cmd: PaymentCommands.CREATE_PAYOUT_REQUEST,
      });
      expect(lastPayload()).toEqual(
        expect.objectContaining({ sellerId: 'user-1' })
      );
    });

    it('cancels a payout request as the seller', async () => {
      await controller.cancelPayoutRequest(user, 'payout-1');

      expect(lastPattern()).toEqual({
        cmd: PaymentCommands.CANCEL_PAYOUT_REQUEST,
      });
      expect(lastPayload()).toEqual(
        expect.objectContaining({ sellerId: 'user-1' })
      );
    });

    it('reads the caller’s earnings summary by seller id', async () => {
      await controller.getSellerEarningsSummary(user);

      expect(lastPayload()).toEqual(
        expect.objectContaining({ sellerId: 'user-1' })
      );
    });
  });

  describe('business themes', () => {
    it('reads a theme by business page id', async () => {
      await controller.getBusinessTheme('page-1');

      expect(lastPayload()).toEqual(
        expect.objectContaining({ businessPageId: 'page-1' })
      );
    });
  });
});
