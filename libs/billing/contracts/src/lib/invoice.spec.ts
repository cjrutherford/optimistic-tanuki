import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InvoicePreviewInput, PeriodInvoicePreviewInput } from './invoice';
import { InvoicePreviewMeter } from './usage-meter';

const validMeter = {
  id: 'meter-1',
  name: 'API calls',
  unit: 'call',
  includedQuantity: 1000,
  overageUnitPriceCents: 5,
};

const validPreview = {
  tenantId: 'tenant-1',
  appScope: 'finance',
  currency: 'USD',
  subscriptionPriceCents: 9900,
  meter: validMeter,
  usageQuantity: 1250,
  usageBlockBalance: 100,
};

describe('InvoicePreviewMeter', () => {
  it('accepts a complete meter', async () => {
    const dto = plainToInstance(InvoicePreviewMeter, validMeter);
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects missing fields', async () => {
    const dto = plainToInstance(InvoicePreviewMeter, { id: 'meter-1' });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property).sort()).toEqual(
      ['name', 'unit', 'includedQuantity', 'overageUnitPriceCents'].sort()
    );
  });
});

describe('InvoicePreviewInput', () => {
  it('accepts a complete payload', async () => {
    const dto = plainToInstance(InvoicePreviewInput, validPreview);
    expect(await validate(dto)).toEqual([]);
    expect(dto.meter).toBeInstanceOf(InvoicePreviewMeter);
  });

  it('rejects missing fields', async () => {
    const dto = plainToInstance(InvoicePreviewInput, {
      tenantId: 'tenant-1',
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property).sort()).toEqual(
      [
        'appScope',
        'currency',
        'subscriptionPriceCents',
        'meter',
        'usageQuantity',
        'usageBlockBalance',
      ].sort()
    );
  });

  it('surfaces nested meter errors', async () => {
    const dto = plainToInstance(InvoicePreviewInput, {
      ...validPreview,
      meter: { id: 'meter-1' },
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('meter');
    expect(errors[0].children?.map((c) => c.property).sort()).toEqual(
      ['name', 'unit', 'includedQuantity', 'overageUnitPriceCents'].sort()
    );
  });
});

describe('PeriodInvoicePreviewInput', () => {
  const validPeriod = {
    tenantId: 'tenant-1',
    appScope: 'finance',
    accountId: 'account-1',
    currency: 'USD',
    subscriptionPriceCents: 9900,
    meter: validMeter,
    periodStart: '2026-09-01T00:00:00.000Z',
    periodEnd: '2026-09-30T00:00:00.000Z',
  };

  it('accepts a complete payload and transforms dates', async () => {
    const dto = plainToInstance(PeriodInvoicePreviewInput, validPeriod);
    expect(await validate(dto)).toEqual([]);
    expect(dto.periodStart).toBeInstanceOf(Date);
    expect(dto.periodEnd).toBeInstanceOf(Date);
    expect(dto.meter).toBeInstanceOf(InvoicePreviewMeter);
  });

  it('rejects invalid dates', async () => {
    const dto = plainToInstance(PeriodInvoicePreviewInput, {
      ...validPeriod,
      periodStart: 'not-a-date',
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toEqual(['periodStart']);
  });

  it('rejects a missing account', async () => {
    const dto = plainToInstance(PeriodInvoicePreviewInput, {
      ...validPeriod,
      accountId: undefined,
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toEqual(['accountId']);
  });
});
