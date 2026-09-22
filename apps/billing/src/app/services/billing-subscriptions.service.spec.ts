import { BillingSubscriptionsService } from './billing-subscriptions.service';

function createService() {
  const rows = new Map<string, any>();
  const subscriptions = {
    create: jest.fn((input: object) => input),
    save: jest.fn(async (input: any) => ({ id: 'sub-1', ...input })),
    findOne: jest.fn(async ({ where }: any) => rows.get(where.id) ?? null),
  };
  const planMap = {
    findOne: jest.fn(async () => null),
  };
  const dataSource = {
    getRepository: jest.fn((entity: any) =>
      entity.name === 'BillingSubscriptionEntity' ? subscriptions : planMap
    ),
  };
  const service = new BillingSubscriptionsService(dataSource as never);
  return { service, subscriptions, planMap, rows };
}

describe('BillingSubscriptionsService (E7 lifecycle)', () => {
  it('creates active subscriptions with a one-month period', async () => {
    const { service } = createService();

    const sub = await service.create({
      tenantId: 'tenant-1',
      appScope: 'store',
      accountId: 'account-1',
      planId: 'plan-pro',
      priceId: 'price-monthly',
    });

    expect(sub.status).toBe('active');
    expect(sub.planId).toBe('plan-pro');
    expect(sub.currentPeriodEnd > sub.currentPeriodStart).toBe(true);
  });

  it('resolves product plans from overrides, else derives ids', async () => {
    const { service, planMap } = createService();
    planMap.findOne.mockResolvedValueOnce({
      planId: 'plan-merch',
      priceId: 'price-merch',
      amountCents: 999,
      interval: 'month',
    });

    const fromProduct = await service.createFromProduct({
      tenantId: 'tenant-1',
      appScope: 'store',
      accountId: 'user-1',
      productId: 'product-1',
      interval: 'monthly',
    });
    expect(fromProduct.planId).toBe('plan-merch');
    expect(planMap.findOne).toHaveBeenCalledWith({
      where: { productId: 'product-1' },
    });

    const derived = await service.createFromProduct({
      tenantId: 'tenant-1',
      appScope: 'store',
      accountId: 'user-1',
      productId: 'product-9',
      interval: 'yearly',
    });
    expect(derived.planId).toBe('store:product-9');
    expect(derived.priceId).toBe('store:product-9:yearly');
  });

  it('cancels terminally and reports missing rows', async () => {
    const { service, subscriptions, rows } = createService();
    rows.set('sub-1', { id: 'sub-1', status: 'active' });

    const canceled: any = await service.cancel('sub-1');
    expect(canceled.status).toBe('canceled');
    expect(subscriptions.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'canceled',
        canceledAt: expect.any(Date),
      })
    );

    await expect(service.cancel('missing')).resolves.toEqual({
      success: false,
      message: 'Subscription not found',
    });
  });

  it('gets subscriptions by id', async () => {
    const { service, rows } = createService();
    rows.set('sub-1', {
      id: 'sub-1',
      tenantId: 'tenant-1',
      appScope: 'store',
      accountId: 'account-1',
      planId: 'plan-pro',
      priceId: 'price-monthly',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.get('sub-1')).resolves.toMatchObject({ id: 'sub-1' });
    await expect(service.get('missing')).resolves.toBeUndefined();
  });
});
