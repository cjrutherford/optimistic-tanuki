import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BatchRecordUsageDto, RecordUsageDto } from './usage-event';

const validPayload = {
  tenantId: 'tenant-1',
  appScope: 'finance',
  meterId: 'meter-1',
  eventKey: 'api.call',
  quantity: 3,
};

describe('RecordUsageDto', () => {
  it('accepts a complete payload', async () => {
    const dto = plainToInstance(RecordUsageDto, {
      ...validPayload,
      occurredAt: '2026-09-17T00:00:00.000Z',
      metadata: { source: 'test' },
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.occurredAt).toBeInstanceOf(Date);
  });

  it('accepts a minimal payload without optional fields', async () => {
    const dto = plainToInstance(RecordUsageDto, validPayload);
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects missing required fields', async () => {
    const dto = plainToInstance(RecordUsageDto, {
      tenantId: 'tenant-1',
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property).sort()).toEqual(
      ['appScope', 'eventKey', 'meterId', 'quantity'].sort()
    );
  });

  it('rejects wrong types', async () => {
    const dto = plainToInstance(RecordUsageDto, {
      ...validPayload,
      quantity: 'three',
      occurredAt: 'not-a-date',
      metadata: 'nope',
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property).sort()).toEqual(
      ['metadata', 'occurredAt', 'quantity'].sort()
    );
  });
});

describe('BatchRecordUsageDto', () => {
  it('accepts a batch of valid events', async () => {
    const dto = plainToInstance(BatchRecordUsageDto, {
      events: [
        validPayload,
        { ...validPayload, eventKey: 'api.other', quantity: 1 },
      ],
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.events[0]).toBeInstanceOf(RecordUsageDto);
  });

  it('rejects an empty batch', async () => {
    const dto = plainToInstance(BatchRecordUsageDto, { events: [] });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toEqual(['events']);
  });

  it('rejects a non-array payload', async () => {
    const dto = plainToInstance(BatchRecordUsageDto, { events: 'nope' });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toEqual(['events']);
  });

  it('surfaces nested item errors', async () => {
    const dto = plainToInstance(BatchRecordUsageDto, {
      events: [validPayload, { tenantId: 'tenant-1' }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('events');
    expect(
      errors[0].children?.[0].children?.map((c) => c.property).sort()
    ).toEqual(['appScope', 'eventKey', 'meterId', 'quantity'].sort());
  });
});
