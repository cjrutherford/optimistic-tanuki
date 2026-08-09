import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { AppController } from './app.controller';

describe('AppController classified payment read handlers', () => {
  const paymentService = {
    getPayment: jest.fn(),
  };
  const offerService = {
    getOffersForClassified: jest.fn(),
    createOffer: jest.fn(),
    acceptOffer: jest.fn(),
    rejectOffer: jest.fn(),
    counterOffer: jest.fn(),
    withdrawOffer: jest.fn(),
  };
  const controller = new AppController(
    paymentService as never,
    {} as never,
    offerService as never
  );

  beforeEach(() => jest.clearAllMocks());

  it('forwards the authenticated reader to GET_PAYMENT authorization', async () => {
    await controller.getPayment({
      paymentId: 'payment-1',
      userId: 'reader-1',
    } as never);

    expect(paymentService.getPayment).toHaveBeenCalledWith(
      'payment-1',
      'reader-1'
    );
  });

  it('preserves a payment not-found status across the rpc boundary', async () => {
    paymentService.getPayment.mockRejectedValue(
      new NotFoundException('Payment not found')
    );

    try {
      await controller.getPayment({
        paymentId: 'payment-1',
        userId: 'unrelated-reader',
      });
      fail('Expected an RpcException');
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual({
        statusCode: 404,
        message: 'Payment not found',
      });
    }
  });

  it('forwards the authenticated reader to GET_OFFERS_FOR_CLASSIFIED authorization', async () => {
    await controller.getOffersForClassified({
      classifiedId: 'classified-1',
      userId: 'reader-1',
    } as never);

    expect(offerService.getOffersForClassified).toHaveBeenCalledWith(
      'classified-1',
      'reader-1'
    );
  });

  it('preserves a classified-offers not-found status across the rpc boundary', async () => {
    offerService.getOffersForClassified.mockRejectedValue(
      new NotFoundException('Classified offers not found')
    );

    try {
      await controller.getOffersForClassified({
        classifiedId: 'classified-1',
        userId: 'unrelated-reader',
      });
      fail('Expected an RpcException');
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual({
        statusCode: 404,
        message: 'Classified offers not found',
      });
    }
  });

  it('preserves an offer authorization bad request status across the rpc boundary', async () => {
    offerService.acceptOffer.mockRejectedValue(
      new BadRequestException('You can only accept offers on your own listings')
    );

    try {
      await controller.acceptOffer({
        offerId: 'offer-1',
        sellerId: 'unrelated-user',
      });
      fail('Expected an RpcException');
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual({
        statusCode: 400,
        message: 'You can only accept offers on your own listings',
      });
    }
  });

  it('does not forward a client-supplied seller to CREATE_OFFER', async () => {
    await controller.createOffer({
      classifiedId: 'classified-1',
      buyerId: 'buyer-1',
      sellerId: 'forged-seller',
      amount: 50,
      message: 'Interested',
    });

    expect(offerService.createOffer).toHaveBeenCalledWith({
      classifiedId: 'classified-1',
      buyerId: 'buyer-1',
      amount: 50,
      message: 'Interested',
    });
  });
});
