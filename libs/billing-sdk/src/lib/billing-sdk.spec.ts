import {
  buildBatchRecordUsagePayload,
  buildPeriodInvoicePreviewPayload,
  buildRecordUsagePayload,
} from './billing-sdk';

describe('billing-sdk payload builders', () => {
  it('builds scoped usage payloads with stable event keys', () => {
    expect(
      buildRecordUsagePayload({
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        meterId: 'api-calls',
        eventKey: 'evt-1',
        quantity: 3,
      }),
    ).toEqual({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      meterId: 'api-calls',
      eventKey: 'evt-1',
      quantity: 3,
    });
  });

  it('builds batch usage payloads from multiple events', () => {
    expect(
      buildBatchRecordUsagePayload([
        {
          tenantId: 'tenant-1',
          appScope: 'local-hub',
          meterId: 'api-calls',
          eventKey: 'evt-1',
          quantity: 1,
        },
        {
          tenantId: 'tenant-1',
          appScope: 'local-hub',
          meterId: 'api-calls',
          eventKey: 'evt-2',
          quantity: 2,
        },
      ]),
    ).toEqual({
      events: [
        {
          tenantId: 'tenant-1',
          appScope: 'local-hub',
          meterId: 'api-calls',
          eventKey: 'evt-1',
          quantity: 1,
        },
        {
          tenantId: 'tenant-1',
          appScope: 'local-hub',
          meterId: 'api-calls',
          eventKey: 'evt-2',
          quantity: 2,
        },
      ],
    });
  });

  it('builds period invoice preview payloads without app internals', () => {
    expect(
      buildPeriodInvoicePreviewPayload({
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        accountId: 'acct-1',
        currency: 'USD',
        subscriptionPriceCents: 1000,
        meter: {
          id: 'api-calls',
          name: 'API calls',
          unit: 'call',
          includedQuantity: 10,
          overageUnitPriceCents: 5,
        },
        periodStart: new Date('2026-04-01T00:00:00.000Z'),
        periodEnd: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ).toMatchObject({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      accountId: 'acct-1',
      currency: 'USD',
      meter: {
        id: 'api-calls',
      },
    });
  });
});
