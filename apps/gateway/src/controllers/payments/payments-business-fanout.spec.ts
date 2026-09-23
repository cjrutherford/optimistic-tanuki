import { of, throwError } from 'rxjs';
import { PaymentsController } from './payments.controller';

const buildController = () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'services.payments') {
        return { host: 'localhost', port: 3004 };
      }
      if (key === 'services.social') {
        return { host: 'localhost', port: 3003 };
      }
      return undefined;
    }),
  };
  const controller = new PaymentsController(configService as any);
  const paymentsClient = { send: jest.fn() };
  const socialClient = { send: jest.fn() };
  (controller as any).paymentsClient = paymentsClient;
  (controller as any).socialClient = socialClient;
  (controller as any).logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return { controller, paymentsClient, socialClient };
};

describe('PaymentsController business fan-out (O13)', () => {
  it('overlays social content on the payments business page', async () => {
    const { controller, paymentsClient, socialClient } = buildController();
    paymentsClient.send.mockReturnValue(
      of({ id: 'pay-1', communityId: 'c-1', tier: 'pro' })
    );
    socialClient.send.mockReturnValue(
      of({ id: 'soc-1', communityId: 'c-1', name: 'North Star' })
    );

    const result = await controller.getBusinessPage('c-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'pay-1',
        communityId: 'c-1',
        name: 'North Star',
      })
    );
  });

  it('falls back to the payments row when no social row exists', async () => {
    const { controller, paymentsClient, socialClient } = buildController();
    paymentsClient.send.mockReturnValue(
      of({ id: 'pay-1', communityId: 'c-1' })
    );
    socialClient.send.mockReturnValue(of(null));

    const result = await controller.getBusinessPage('c-1');

    expect(result).toEqual({ id: 'pay-1', communityId: 'c-1' });
  });

  it('dual-writes business checkout (payments first, social mirror best-effort)', async () => {
    const { controller, paymentsClient, socialClient } = buildController();
    paymentsClient.send.mockReturnValue(
      of({ checkoutUrl: 'https://pay/x', businessPageId: 'pay-1' })
    );
    socialClient.send.mockReturnValue(of({ id: 'soc-1' }));

    const result = await controller.createBusinessCheckout(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      { communityId: 'c-1', tier: 'pro' } as any,
      'local-hub'
    );

    expect(result).toEqual({
      checkoutUrl: 'https://pay/x',
      businessPageId: 'pay-1',
    });
    expect(socialClient.send).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: expect.any(String) }),
      expect.objectContaining({
        communityId: 'c-1',
        paymentsBusinessPageId: 'pay-1',
      })
    );
    expect(paymentsClient.send.mock.invocationCallOrder[0]).toBeLessThan(
      socialClient.send.mock.invocationCallOrder[0]
    );
  });

  it('still returns checkout when the social mirror fails', async () => {
    const { controller, paymentsClient, socialClient } = buildController();
    paymentsClient.send.mockReturnValue(
      of({ checkoutUrl: 'https://pay/x', businessPageId: 'pay-1' })
    );
    socialClient.send.mockReturnValue(
      throwError(() => new Error('social down'))
    );

    const result = await controller.createBusinessCheckout(
      { userId: 'user-1', profileId: 'profile-1' } as any,
      { communityId: 'c-1', tier: 'pro' } as any,
      'local-hub'
    );

    expect(result).toEqual({
      checkoutUrl: 'https://pay/x',
      businessPageId: 'pay-1',
    });
  });

  it('merges sponsorship reads by back-reference, passing through unmatched rows', async () => {
    const { controller, paymentsClient, socialClient } = buildController();
    paymentsClient.send.mockReturnValue(
      of([
        { id: 's-pay-1', type: 'banner' },
        { id: 's-pay-2', type: 'sticky-ad' },
      ])
    );
    socialClient.send.mockReturnValue(
      of([{ id: 's-soc-1', paymentsSponsorshipId: 's-pay-1', adContent: 'Hi' }])
    );

    const result = await controller.getActiveSponsorships('c-1');

    expect(result).toEqual([
      expect.objectContaining({ id: 's-pay-1', adContent: 'Hi' }),
      { id: 's-pay-2', type: 'sticky-ad' },
    ]);
  });
});
