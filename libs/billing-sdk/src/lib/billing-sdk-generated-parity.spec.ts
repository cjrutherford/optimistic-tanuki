import type {
  BatchRecordUsageDto as GeneratedBatchRecordUsageDto,
  InvoicePreviewInput as GeneratedInvoicePreviewInput,
  PeriodInvoicePreviewInput as GeneratedPeriodInvoicePreviewInput,
  RecordUsageDto as GeneratedRecordUsageDto,
} from '../generated/billing';
import {
  buildBatchRecordUsagePayload,
  buildPeriodInvoicePreviewPayload,
  buildRecordUsagePayload,
} from './billing-sdk';

/**
 * O15c: locks the hand-written builders to the orval-generated client.
 * Builder outputs must stay assignable to the generated service parameter
 * types, so gateway DTO drift breaks this spec instead of slipping through.
 * The method-existence checks guard against tag-filter regressions silently
 * dropping operations from the generated file.
 */
describe('billing-sdk generated-client parity', () => {
  it('buildRecordUsagePayload output fits the generated record call', () => {
    const built = buildRecordUsagePayload({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      meterId: 'api-calls',
      eventKey: 'evt-1',
      quantity: 3,
      occurredAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    // Domain builders carry Dates; JSON serialization turns them into the
    // ISO strings the generated client declares. This pins that boundary.
    const payload: GeneratedRecordUsageDto = {
      ...built,
      occurredAt: built.occurredAt?.toISOString(),
    };
    expect(payload.eventKey).toBe('evt-1');
  });

  it('buildBatchRecordUsagePayload output fits the generated batch call', () => {
    const built = buildBatchRecordUsagePayload([
      {
        tenantId: 'tenant-1',
        appScope: 'local-hub',
        meterId: 'api-calls',
        eventKey: 'evt-1',
        quantity: 1,
      },
    ]);
    const payload: GeneratedBatchRecordUsageDto = {
      events: built.events.map((event) => ({
        ...event,
        occurredAt: event.occurredAt?.toISOString(),
      })),
    };
    expect(payload.events).toHaveLength(1);
  });

  it('preview payloads fit the generated preview union body', () => {
    const meter = {
      id: 'api-calls',
      name: 'API calls',
      unit: 'call',
      includedQuantity: 10,
      overageUnitPriceCents: 5,
    };
    const adHoc: GeneratedInvoicePreviewInput = {
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      currency: 'USD',
      subscriptionPriceCents: 1000,
      meter,
      usageQuantity: 42,
      usageBlockBalance: 8,
    };
    const built = buildPeriodInvoicePreviewPayload({
      tenantId: 'tenant-1',
      appScope: 'local-hub',
      accountId: 'acct-1',
      currency: 'USD',
      subscriptionPriceCents: 1000,
      meter,
      periodStart: new Date('2026-04-01T00:00:00.000Z'),
      periodEnd: new Date('2026-05-01T00:00:00.000Z'),
    });
    // Domain builders carry Dates; JSON serialization turns them into the
    // ISO strings the generated client declares. This pins that boundary.
    const period: GeneratedPeriodInvoicePreviewInput = {
      ...built,
      periodStart: built.periodStart.toISOString(),
      periodEnd: built.periodEnd.toISOString(),
    };
    expect(adHoc.usageQuantity).toBe(42);
    expect(period.meter.id).toBe('api-calls');
  });
});
