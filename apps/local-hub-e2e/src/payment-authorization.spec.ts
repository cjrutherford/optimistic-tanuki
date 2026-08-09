import {
  APIResponse,
  expect,
  request as playwrightRequest,
  test,
} from '@playwright/test';
import {
  apiUrl,
  createAuthenticatedSession,
  findCommunity,
  getCommunities,
  AuthSession,
  localHubAuthHeaders,
} from './helpers/local-hub-api';

async function expectStatus(
  response: APIResponse,
  expected: number,
  operation: string
): Promise<any> {
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep the text in the failure message when the service returns plain text.
  }
  expect(
    response.status(),
    `${operation} returned ${response.status()} instead of ${expected}. Body: ${JSON.stringify(
      body
    )}`
  ).toBe(expected);
  return body;
}

async function expectDenied(
  response: APIResponse,
  operation: string
): Promise<void> {
  const body = await response.text();
  expect(
    [403, 404],
    `${operation} unexpectedly exposed protected data. Status: ${response.status()} Body: ${body}`
  ).toContain(response.status());
}

async function expectSellerMutationDenied(
  response: APIResponse,
  operation: string
): Promise<void> {
  const body = await response.text();
  expect(
    [400, 403, 404],
    `${operation} unexpectedly changed protected state. Status: ${response.status()} Body: ${body}`
  ).toContain(response.status());
}

function auth(session: AuthSession) {
  return localHubAuthHeaders(session.token);
}

test.describe('Classified offer and payment authorization', () => {
  test('limits offers and payment details to the buyer and canonical seller', async ({
    request,
  }) => {
    const community = findCommunity(await getCommunities(request));
    test.skip(
      !community?.id,
      'No seeded community is available for payment authorization'
    );

    const sellerApi = await playwrightRequest.newContext();
    const buyerApi = await playwrightRequest.newContext();
    const unrelatedApi = await playwrightRequest.newContext();
    try {
      const seller = await createAuthenticatedSession(sellerApi);
      const buyer = await createAuthenticatedSession(buyerApi);
      const unrelated = await createAuthenticatedSession(unrelatedApi);

      const classifiedResponse = await sellerApi.post(
        apiUrl('/api/classifieds'),
        {
          headers: auth(seller),
          data: {
            title: `Authorization classified ${Date.now()}`,
            description: 'A classified used only for authorization coverage',
            price: 125,
            category: 'for-sale',
            communityId: community!.id,
          },
        }
      );
      const classified = await expectStatus(
        classifiedResponse,
        201,
        'Create authorization classified'
      );
      expect(classified?.id).toEqual(expect.any(String));

      const createOffer = async (message: string) => {
        const response = await buyerApi.post(apiUrl('/api/payments/offers'), {
          headers: auth(buyer),
          data: { classifiedId: classified.id, amount: 100, message },
        });
        return expectStatus(response, 201, `Create ${message}`);
      };

      const offer = await createOffer('Buyer authorization offer');
      expect(offer?.id).toEqual(expect.any(String));
      expect(offer?.buyerId).toBe(buyer.userId);
      expect(offer?.sellerId).toBe(seller.userId);

      const sellerOffersResponse = await sellerApi.get(
        apiUrl(`/api/payments/offers/classified/${classified.id}`),
        { headers: auth(seller) }
      );
      const sellerOffers = await expectStatus(
        sellerOffersResponse,
        200,
        'Seller reads classified offers'
      );
      expect(sellerOffers).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: offer.id })])
      );

      const buyerOffersResponse = await buyerApi.get(
        apiUrl(`/api/payments/offers/classified/${classified.id}`),
        { headers: auth(buyer) }
      );
      const buyerOffers = await expectStatus(
        buyerOffersResponse,
        200,
        'Buyer reads own classified offers'
      );
      expect(buyerOffers).toEqual([
        expect.objectContaining({ id: offer.id, buyerId: buyer.userId }),
      ]);

      await expectDenied(
        await unrelatedApi.get(
          apiUrl(`/api/payments/offers/classified/${classified.id}`),
          {
            headers: auth(unrelated),
          }
        ),
        'Unrelated user reads classified offers'
      );

      for (const action of ['accept', 'reject'] as const) {
        const actionOffer = await createOffer(`Buyer cannot ${action}`);
        await expectSellerMutationDenied(
          await buyerApi.patch(
            apiUrl(`/api/payments/offers/${actionOffer.id}/${action}`),
            {
              headers: auth(buyer),
            }
          ),
          `Buyer ${action}s an offer as seller`
        );
        await expectSellerMutationDenied(
          await unrelatedApi.patch(
            apiUrl(`/api/payments/offers/${actionOffer.id}/${action}`),
            {
              headers: auth(unrelated),
            }
          ),
          `Unrelated user ${action}s an offer as seller`
        );
      }

      const counterOffer = await createOffer('Buyer cannot counter');
      await expectSellerMutationDenied(
        await buyerApi.patch(
          apiUrl(`/api/payments/offers/${counterOffer.id}/counter`),
          {
            headers: auth(buyer),
            data: { counterAmount: 110, message: 'Unauthorized counter' },
          }
        ),
        'Buyer counters an offer as seller'
      );
      await expectSellerMutationDenied(
        await unrelatedApi.patch(
          apiUrl(`/api/payments/offers/${counterOffer.id}/counter`),
          {
            headers: auth(unrelated),
            data: { counterAmount: 110, message: 'Unauthorized counter' },
          }
        ),
        'Unrelated user counters an offer as seller'
      );

      const sellerMutationOffer = await createOffer(
        'Canonical seller mutation'
      );
      const counterResponse = await sellerApi.patch(
        apiUrl(`/api/payments/offers/${sellerMutationOffer.id}/counter`),
        {
          headers: auth(seller),
          data: { counterAmount: 110, message: 'Canonical seller counter' },
        }
      );
      const countered = await expectStatus(
        counterResponse,
        200,
        'Canonical seller counters an offer'
      );
      expect(countered).toMatchObject({
        id: sellerMutationOffer.id,
        status: 'countered',
      });

      const acceptedResponse = await sellerApi.patch(
        apiUrl(`/api/payments/offers/${sellerMutationOffer.id}/accept`),
        { headers: auth(seller) }
      );
      const accepted = await expectStatus(
        acceptedResponse,
        200,
        'Canonical seller accepts buyer offer'
      );
      expect(accepted?.payment?.id).toEqual(expect.any(String));
      const paymentId = accepted.payment.id;

      const buyerPaymentResponse = await buyerApi.get(
        apiUrl(`/api/payments/classifieds/payment/${paymentId}`),
        { headers: auth(buyer) }
      );
      const buyerPayment = await expectStatus(
        buyerPaymentResponse,
        200,
        'Buyer reads own payment details'
      );
      expect(buyerPayment).toMatchObject({
        id: paymentId,
        buyerId: buyer.userId,
      });

      const sellerPaymentResponse = await sellerApi.get(
        apiUrl(`/api/payments/classifieds/payment/${paymentId}`),
        { headers: auth(seller) }
      );
      const sellerPayment = await expectStatus(
        sellerPaymentResponse,
        200,
        'Canonical seller reads payment details'
      );
      expect(sellerPayment).toMatchObject({
        id: paymentId,
        sellerId: seller.userId,
      });

      await expectDenied(
        await unrelatedApi.get(
          apiUrl(`/api/payments/classifieds/payment/${paymentId}`),
          {
            headers: auth(unrelated),
          }
        ),
        'Unrelated user reads payment details'
      );
    } finally {
      await Promise.all([
        sellerApi.dispose(),
        buyerApi.dispose(),
        unrelatedApi.dispose(),
      ]);
    }
  });
});
