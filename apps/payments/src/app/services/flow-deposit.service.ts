import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { firstValueFrom } from 'rxjs';
import { FLOW_GET_STATUS, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  CreateDepositDto,
  FlowPaymentIntentResponse,
  FlowTenantPayload,
  JobStatusDto,
} from '@optimistic-tanuki/models';

type StripeIntent = {
  id: string;
  client_secret?: string;
  status?: string;
};

type TwilioMessage = {
  sid?: string;
};

@Injectable()
export class FlowDepositService {
  private readonly logger = new Logger(FlowDepositService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(ServiceTokens.LEAD_SERVICE)
    private readonly leadTrackerClient: ClientProxy
  ) {}

  async processDeposit(
    payload: FlowTenantPayload<CreateDepositDto>
  ): Promise<FlowPaymentIntentResponse> {
    const tenantId = this.requireTenantId(payload);
    const {
      tenantId: _tenantId,
      tenantContext: _tenantContext,
      ...body
    } = payload;
    const dto = await this.validateDto(CreateDepositDto, body);
    const booking = await this.loadBooking(
      tenantId,
      dto.bookingId ?? dto.trackingCode!
    );
    if (booking.depositPaid) {
      throw new ConflictException(
        'Deposit has already been paid for this booking'
      );
    }
    if (
      !Number.isFinite(booking.depositAmount) ||
      (booking.depositAmount as number) <= 0
    ) {
      throw new BadRequestException(
        'Booking does not have a valid deposit amount'
      );
    }

    const amount = booking.depositAmount as number;
    const currency = 'usd';
    const intent = await this.createStripePaymentIntent({
      amountInCents: Math.round(amount * 100),
      currency,
      tenantId,
      bookingId: booking.bookingId,
      trackingCode: booking.trackingCode,
      idempotencyKey: dto.idempotencyKey,
    });
    const smsConfirmation = await this.dispatchArrivalSms(booking, amount);

    return {
      paymentIntentId: intent.id,
      ...(intent.client_secret ? { clientSecret: intent.client_secret } : {}),
      status: intent.status ?? 'requires_payment_method',
      amount,
      currency,
      bookingId: booking.bookingId,
      ...(booking.trackingCode ? { trackingCode: booking.trackingCode } : {}),
      smsConfirmation,
    };
  }

  private async loadBooking(
    tenantId: string,
    id: string
  ): Promise<JobStatusDto> {
    let booking: JobStatusDto;
    try {
      booking = await firstValueFrom(
        this.leadTrackerClient.send<JobStatusDto>(FLOW_GET_STATUS, {
          id,
          tenantId,
        })
      );
    } catch (error) {
      throw new BadRequestException('Booking not found for this tenant');
    }
    if (!booking || typeof booking !== 'object' || !booking.bookingId) {
      throw new BadRequestException('Booking not found for this tenant');
    }
    return booking;
  }

  private async createStripePaymentIntent(params: {
    amountInCents: number;
    currency: string;
    tenantId: string;
    bookingId: string;
    trackingCode?: string;
    idempotencyKey: string;
  }): Promise<StripeIntent> {
    const stripeKey =
      this.configService.get<string>('STRIPE_SECRET_KEY') ||
      process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new ServiceUnavailableException(
        'Stripe payments are not configured'
      );
    }

    const body = new URLSearchParams({
      amount: params.amountInCents.toString(),
      currency: params.currency,
      'automatic_payment_methods[enabled]': 'true',
      'metadata[tenantId]': params.tenantId,
      'metadata[bookingId]': params.bookingId,
    });
    if (params.trackingCode) {
      body.append('metadata[trackingCode]', params.trackingCode);
    }

    let res: Response;
    try {
      res = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': params.idempotencyKey,
        },
        body: body.toString(),
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        'Stripe payment service is unreachable'
      );
    }
    if (!res.ok) {
      const detail = await this.safeErrorDetail(res);
      throw new ServiceUnavailableException(
        `Stripe payment intent failed${detail ? `: ${detail}` : ''}`
      );
    }
    const data = (await res.json()) as StripeIntent;
    if (!data || typeof data.id !== 'string' || !data.id) {
      throw new ServiceUnavailableException(
        'Stripe returned an invalid payment intent'
      );
    }
    return data;
  }

  private async dispatchArrivalSms(
    booking: JobStatusDto,
    amount: number
  ): Promise<FlowPaymentIntentResponse['smsConfirmation']> {
    const to = booking.customerPhone;
    if (!to) {
      return {
        dispatched: false,
        message: 'No customer phone number on booking',
      };
    }
    const accountSid =
      this.configService.get<string>('TWILIO_ACCOUNT_SID') ||
      process.env.TWILIO_ACCOUNT_SID;
    const authToken =
      this.configService.get<string>('TWILIO_AUTH_TOKEN') ||
      process.env.TWILIO_AUTH_TOKEN;
    const fromPhone =
      this.configService.get<string>('TWILIO_PHONE_NUMBER') ||
      process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !fromPhone) {
      return { dispatched: false, to, message: 'Twilio SMS is not configured' };
    }

    const messageText =
      `Field Flow: your ${booking.serviceName} visit is scheduled for ` +
      `${booking.scheduledDate} (${booking.arrivalWindow}). ` +
      `A $${amount.toFixed(2)} deposit is due to hold booking #${
        booking.bookingId
      }.`;
    let res: Response;
    try {
      res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${accountSid}:${authToken}`
            ).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: to,
            From: fromPhone,
            Body: messageText,
          }).toString(),
        }
      );
    } catch {
      return { dispatched: false, to, message: 'Twilio SMS dispatch failed' };
    }
    if (!res.ok) {
      return {
        dispatched: false,
        to,
        message: `Twilio SMS failed with status ${res.status}`,
      };
    }
    const data = (await res.json()) as TwilioMessage;
    this.logger.log(`Dispatched arrival SMS for booking ${booking.bookingId}`);
    return { dispatched: true, to, sid: data?.sid, message: messageText };
  }

  private async safeErrorDetail(res: Response): Promise<string | null> {
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      return typeof data?.error?.message === 'string'
        ? data.error.message
        : null;
    } catch {
      return null;
    }
  }

  private requireTenantId(payload: { tenantId?: unknown }): string {
    if (typeof payload.tenantId !== 'string' || !payload.tenantId.trim()) {
      throw new BadRequestException('Tenant context is required');
    }
    return payload.tenantId;
  }

  private async validateDto<T extends object>(
    type: new () => T,
    value: unknown
  ): Promise<T> {
    const instance = plainToInstance(type, value);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new BadRequestException('Invalid deposit payload');
    }
    return instance;
  }
}
