import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import { PaymentCommands } from '@optimistic-tanuki/constants';
import { PaymentsController } from './payments.controller';
import { verifyWebhookSignature } from './payments-webhook';

const WEBHOOK_SECRET = 'lemon-squeezy-signing-secret';

const buildController = (webhookSecret?: string) => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'services.payments') {
        return { host: 'localhost', port: 3020 };
      }
      if (key === 'payments.webhookSecret') {
        return webhookSecret;
      }
      return undefined;
    }),
  };

  const controller = new PaymentsController(configService as any);
  const paymentsClient = { send: jest.fn() };
  (controller as any).paymentsClient = paymentsClient;

  return { controller, paymentsClient };
};

const signPayload = (rawBody: Buffer, secret: string) =>
  createHmac('sha256', secret).update(rawBody).digest('hex');

describe('verifyWebhookSignature', () => {
  const rawBody = Buffer.from(
    JSON.stringify({ meta: { event_name: 'order_created' } })
  );

  it('accepts a signature computed over the raw body with the secret', () => {
    const signature = signPayload(rawBody, WEBHOOK_SECRET);
    expect(verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET)).toBe(
      true
    );
  });

  it('rejects a signature produced with the wrong secret', () => {
    const signature = signPayload(rawBody, 'not-the-secret');
    expect(verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET)).toBe(
      false
    );
  });

  it('rejects a tampered payload', () => {
    const signature = signPayload(rawBody, WEBHOOK_SECRET);
    const tampered = Buffer.from(
      JSON.stringify({ meta: { event_name: 'subscription_created' } })
    );
    expect(verifyWebhookSignature(tampered, signature, WEBHOOK_SECRET)).toBe(
      false
    );
  });

  it('rejects when the signature length does not match the digest length', () => {
    expect(verifyWebhookSignature(rawBody, 'abcd', WEBHOOK_SECRET)).toBe(false);
  });

  it('rejects when inputs are missing', () => {
    const signature = signPayload(rawBody, WEBHOOK_SECRET);
    expect(verifyWebhookSignature(undefined, signature, WEBHOOK_SECRET)).toBe(
      false
    );
    expect(verifyWebhookSignature(rawBody, undefined, WEBHOOK_SECRET)).toBe(
      false
    );
    expect(verifyWebhookSignature(rawBody, signature, undefined)).toBe(false);
  });
});

describe('PaymentsController webhook signature verification', () => {
  const payload = { meta: { event_name: 'order_created' } };
  const rawBody = Buffer.from(JSON.stringify(payload));

  it('forwards the webhook to the payments service when the signature is valid', async () => {
    const { controller, paymentsClient } = buildController(WEBHOOK_SECRET);
    paymentsClient.send.mockReturnValue(of({ received: true }));
    const signature = signPayload(rawBody, WEBHOOK_SECRET);

    const result = await (controller as any).handleWebhook(
      { rawBody },
      payload,
      signature
    );

    expect(result).toEqual({ received: true });
    expect(paymentsClient.send).toHaveBeenCalledWith(
      { cmd: PaymentCommands.PROCESS_WEBHOOK },
      { eventType: 'order_created', data: payload }
    );
  });

  it('rejects a webhook with an invalid signature and does not forward it', async () => {
    const { controller, paymentsClient } = buildController(WEBHOOK_SECRET);

    await expect(
      (controller as any).handleWebhook(
        { rawBody },
        payload,
        signPayload(rawBody, 'wrong-secret')
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(paymentsClient.send).not.toHaveBeenCalled();
  });

  it('rejects a webhook that is missing the signature header', async () => {
    const { controller, paymentsClient } = buildController(WEBHOOK_SECRET);

    await expect(
      (controller as any).handleWebhook({ rawBody }, payload, undefined)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(paymentsClient.send).not.toHaveBeenCalled();
  });

  it('fails closed when the signing secret is not configured', async () => {
    const { controller, paymentsClient } = buildController(undefined);
    const signature = signPayload(rawBody, WEBHOOK_SECRET);

    await expect(
      (controller as any).handleWebhook({ rawBody }, payload, signature)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(paymentsClient.send).not.toHaveBeenCalled();
  });
});

describe('PaymentsController classified payment identity forwarding', () => {
  const user = { userId: 'caller-1', profileId: 'profile-1' } as any;

  it('forwards the caller id as userId on the release route', async () => {
    const { controller, paymentsClient } = buildController();
    paymentsClient.send.mockReturnValue(of({ success: true }));

    await (controller as any).confirmPaymentReceived(user, 'payment-1');

    expect(paymentsClient.send).toHaveBeenCalledWith(
      { cmd: PaymentCommands.RELEASE_FUNDS },
      {
        paymentId: 'payment-1',
        userId: 'caller-1',
      }
    );
  });

  it('forwards the caller id as userId on the confirm route', async () => {
    const { controller, paymentsClient } = buildController();
    paymentsClient.send.mockReturnValue(of({ success: true }));

    await (controller as any).confirmOutOfPlatformPayment(user, 'payment-1', {
      proofImageUrl: 'proof.png',
    });

    expect(paymentsClient.send).toHaveBeenCalledWith(
      { cmd: PaymentCommands.CONFIRM_OUT_OF_PLATFORM_PAYMENT },
      {
        paymentId: 'payment-1',
        userId: 'caller-1',
        proofImageUrl: 'proof.png',
      }
    );
  });

  it('forwards the caller id as userId on the dispute route', async () => {
    const { controller, paymentsClient } = buildController();
    paymentsClient.send.mockReturnValue(of({ success: true }));

    await (controller as any).disputePayment(
      user,
      'payment-1',
      'not as described'
    );

    expect(paymentsClient.send).toHaveBeenCalledWith(
      { cmd: PaymentCommands.DISPUTE_PAYMENT },
      {
        paymentId: 'payment-1',
        userId: 'caller-1',
        reason: 'not as described',
      }
    );
  });
});
