import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { FlowDepositService } from './flow-deposit.service';

describe('FlowDepositService', () => {
  let service: FlowDepositService;
  let config: Record<string, string | undefined>;
  let leadClient: { send: jest.Mock };

  const booking = {
    id: 'booking-1',
    bookingId: 'booking-1',
    trackingCode: 'FLW-123456',
    status: 'scheduled',
    customerName: 'Marcus Bennett',
    customerPhone: '(912) 555-0142',
    customerEmail: 'marcus@example.com',
    serviceName: 'Standard Care',
    serviceAddress: '142 Bull St',
    scheduledDate: '2099-10-15',
    arrivalWindow: '8:00 AM - 10:00 AM',
    depositPaid: false,
    depositAmount: 50,
    totalAmount: 200,
    reviewPromptEligible: false,
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    config = {
      STRIPE_SECRET_KEY: 'test-stripe-secret-key',
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_PHONE_NUMBER: '+19125550100',
    };
    leadClient = { send: jest.fn().mockReturnValue(of({ ...booking })) };
    global.fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowDepositService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => config[key]) },
        },
        { provide: ServiceTokens.LEAD_SERVICE, useValue: leadClient },
      ],
    }).compile();

    service = module.get<FlowDepositService>(FlowDepositService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a Stripe intent from server booking state with idempotency', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pi_live_1',
          client_secret: 'secret_1',
          status: 'requires_payment_method',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'SM123' }),
      });

    const result = await service.processDeposit({
      tenantId: 'wirepro-electrical',
      bookingId: 'booking-1',
      idempotencyKey: 'deposit-key-1',
    });

    expect(leadClient.send).toHaveBeenCalledWith(
      'flow.get_status',
      expect.objectContaining({
        id: 'booking-1',
        tenantId: 'wirepro-electrical',
      })
    );
    const stripeCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(stripeCall[0]).toBe('https://api.stripe.com/v1/payment_intents');
    expect(stripeCall[1].headers['Idempotency-Key']).toBe('deposit-key-1');
    expect(stripeCall[1].body).toContain('amount=5000');
    expect(result.paymentIntentId).toBe('pi_live_1');
    expect(result.amount).toBe(50);
    expect(result.currency).toBe('usd');
    expect(result.smsConfirmation).toEqual(
      expect.objectContaining({ dispatched: true, sid: 'SM123' })
    );
  });

  it('rejects client-supplied amounts at validation', async () => {
    await expect(
      service.processDeposit({
        tenantId: 'wirepro-electrical',
        trackingCode: 'FLW-123456',
        idempotencyKey: 'deposit-key-2',
        amount: 1,
      } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fails closed when Stripe is not configured', async () => {
    delete config.STRIPE_SECRET_KEY;

    await expect(
      service.processDeposit({
        tenantId: 'wirepro-electrical',
        bookingId: 'booking-1',
        idempotencyKey: 'deposit-key-3',
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects deposits for already-paid bookings', async () => {
    leadClient.send.mockReturnValue(of({ ...booking, depositPaid: true }));

    await expect(
      service.processDeposit({
        tenantId: 'wirepro-electrical',
        bookingId: 'booking-1',
        idempotencyKey: 'deposit-key-4',
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps missing bookings to a bad request', async () => {
    leadClient.send.mockReturnValue(throwError(() => new Error('not found')));

    await expect(
      service.processDeposit({
        tenantId: 'wirepro-electrical',
        bookingId: 'missing',
        idempotencyKey: 'deposit-key-5',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports Twilio failures honestly without failing the payment', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pi_live_3',
          status: 'requires_payment_method',
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

    const result = await service.processDeposit({
      tenantId: 'wirepro-electrical',
      bookingId: 'booking-1',
      idempotencyKey: 'deposit-key-6',
    });

    expect(result.paymentIntentId).toBe('pi_live_3');
    expect(result.smsConfirmation.dispatched).toBe(false);
  });

  it('requires tenant context', async () => {
    await expect(
      service.processDeposit({
        bookingId: 'booking-1',
        idempotencyKey: 'k',
      } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
