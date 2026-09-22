import { PaymentService } from './payment.service';

describe('PaymentService.recordDonation (E2 dual-write target)', () => {
  const donationRepository = {
    create: jest.fn((input: object) => input),
    save: jest.fn(async (input: object) => ({
      id: 'pay-donation-1',
      ...input,
    })),
  };
  const service = new PaymentService(
    donationRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  it('inserts a pending canonical row with gateway-supplied fields', async () => {
    const saved = await service.recordDonation({
      userId: 'user-1',
      amount: 10,
      currency: 'USD',
      isRecurring: false,
    });

    expect(donationRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      profileId: undefined,
      amount: 10,
      isRecurring: false,
      status: 'pending',
      currency: 'USD',
      message: undefined,
      anonymous: false,
    });
    expect(saved).toEqual(
      expect.objectContaining({ id: 'pay-donation-1', status: 'pending' })
    );
  });

  it('defaults currency and recurrence for anonymous gifts', async () => {
    const saved = await service.recordDonation({
      amount: 5,
      message: 'Go',
      anonymous: true,
    });

    expect(saved).toEqual(
      expect.objectContaining({
        currency: 'USD',
        isRecurring: false,
        status: 'pending',
        message: 'Go',
        anonymous: true,
      })
    );
  });
});
