import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateBookingDto,
  CreateFlowAvailabilityDto,
  CreateEstimateDto,
  DepositPaymentDto,
  EstimateResultDto,
  FlowSyncItemDto,
  SyncFlowDto,
} from './index';

const validateRequest = async (
  Dto:
    | typeof CreateEstimateDto
    | typeof CreateBookingDto
    | typeof DepositPaymentDto,
  payload: Record<string, unknown>
) =>
  validate(plainToInstance(Dto as typeof CreateEstimateDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('Flow DTOs', () => {
  it('accepts validated service, package, size, and condition inputs', async () => {
    const errors = await validateRequest(CreateEstimateDto, {
      serviceId: 'standard',
      servicePackage: 'standard',
      size: 'midsize',
      condition: 'moderate',
      squareFootage: 500,
      tradeType: 'Mobile Detailing',
    });

    expect(errors).toHaveLength(0);
  });

  it('requires finite base price and condition multiplier in estimate responses', async () => {
    const validEstimate = {
      estimateId: 'estimate-1',
      serviceId: 'standard',
      serviceName: 'Standard Care',
      basePrice: 120,
      conditionMultiplier: 1.2,
      subtotal: 144,
      taxAmount: 10.08,
      depositRequired: 36,
      total: 154.08,
      currency: 'USD',
      expiresAt: '2026-10-01T00:00:00.000Z',
    };

    expect(
      await validate(plainToInstance(EstimateResultDto, validEstimate))
    ).toHaveLength(0);

    for (const [field, value] of [
      ['basePrice', undefined],
      ['basePrice', Number.NaN],
      ['conditionMultiplier', undefined],
      ['conditionMultiplier', Number.NaN],
    ] as const) {
      const response = { ...validEstimate } as Record<string, unknown>;
      if (value === undefined) {
        delete response[field];
      } else {
        response[field] = value;
      }
      const errors = await validate(
        plainToInstance(EstimateResultDto, response)
      );
      expect(errors.some((error) => error.property === field)).toBe(true);
    }
  });

  it('rejects invalid service, size, and condition values', async () => {
    const errors = await validateRequest(CreateEstimateDto, {
      serviceId: '',
      servicePackage: 'standard',
      size: 'gigantic',
      condition: 'unknown',
    });

    expect(errors.some((error) => error.property === 'serviceId')).toBe(true);
    expect(errors.some((error) => error.property === 'size')).toBe(true);
    expect(errors.some((error) => error.property === 'condition')).toBe(true);
  });

  it('rejects client-supplied tenant and pricing authority on booking requests', async () => {
    const errors = await validateRequest(CreateBookingDto, {
      estimateId: 'estimate-1',
      serviceId: 'standard',
      servicePackage: 'standard',
      serviceName: 'Client Controlled Service',
      customerName: 'Marcus Bennett',
      customerPhone: '+1 912 555 0144',
      customerEmail: 'marcus@example.com',
      serviceAddress: '412 Bull Street',
      scheduledDate: '2026-10-01',
      arrivalWindow: '8:00 AM - 10:00 AM',
      tenantId: 'tenant-client-controlled',
      totalAmount: 1,
      depositAmount: 1,
      taxAmount: 1,
    });

    expect(errors.some((error) => error.property === 'tenantId')).toBe(true);
    expect(errors.some((error) => error.property === 'totalAmount')).toBe(true);
    expect(errors.some((error) => error.property === 'depositAmount')).toBe(
      true
    );
    expect(errors.some((error) => error.property === 'serviceName')).toBe(true);
  });

  it('rejects null authority fields rather than treating them as empty', async () => {
    const errors = await validateRequest(CreateBookingDto, {
      serviceId: 'standard',
      customerName: 'Marcus Bennett',
      customerPhone: '+1 912 555 0144',
      customerEmail: 'marcus@example.com',
      serviceAddress: '412 Bull Street',
      scheduledDate: '2026-10-01',
      arrivalWindow: '8:00 AM - 10:00 AM',
      tenantId: null,
      totalAmount: null,
      depositAmount: null,
    });

    expect(errors.some((error) => error.property === 'tenantId')).toBe(true);
    expect(errors.some((error) => error.property === 'totalAmount')).toBe(true);
    expect(errors.some((error) => error.property === 'depositAmount')).toBe(
      true
    );
  });

  it.each([
    ['tenantId', ''],
    ['tenantId', 0],
    ['tenantId', false],
    ['tenantId', null],
    ['serviceName', ''],
    ['serviceName', 0],
    ['serviceName', false],
    ['serviceName', null],
    ['totalAmount', ''],
    ['totalAmount', 0],
    ['totalAmount', false],
    ['totalAmount', null],
    ['depositAmount', ''],
    ['depositAmount', 0],
    ['depositAmount', false],
    ['depositAmount', null],
  ] as const)(
    'rejects a present booking authority field %s with value %p',
    async (field, value) => {
      const errors = await validateRequest(CreateBookingDto, {
        serviceId: 'standard',
        customerName: 'Marcus Bennett',
        customerPhone: '+1 912 555 0144',
        customerEmail: 'marcus@example.com',
        serviceAddress: '412 Bull Street',
        scheduledDate: '2026-10-01',
        arrivalWindow: '8:00 AM - 10:00 AM',
        [field]: value,
      });
      expect(errors.some((error) => error.property === field)).toBe(true);
    }
  );

  it.each([
    ['amount', ''],
    ['amount', 0],
    ['amount', false],
    ['amount', null],
    ['currency', ''],
    ['currency', 0],
    ['currency', false],
    ['currency', null],
    ['customerEmail', ''],
    ['customerEmail', 0],
    ['customerEmail', false],
    ['customerEmail', null],
    ['customerPhone', ''],
    ['customerPhone', 0],
    ['customerPhone', false],
    ['customerPhone', null],
    ['paymentMethodId', ''],
    ['paymentMethodId', 0],
    ['paymentMethodId', false],
    ['paymentMethodId', null],
  ] as const)(
    'rejects a present deposit authority field %s with value %p',
    async (field, value) => {
      const errors = await validateRequest(DepositPaymentDto, {
        bookingId: 'booking-1',
        trackingCode: 'TRACK-1',
        idempotencyKey: 'deposit-key-1',
        [field]: value,
      });
      expect(errors.some((error) => error.property === field)).toBe(true);
    }
  );

  it.each([
    ['tenantId', ''],
    ['tenantId', 0],
    ['tenantId', false],
    ['tenantId', null],
  ] as const)(
    'rejects a present estimate authority field %s with value %p',
    async (field, value) => {
      const errors = await validateRequest(CreateEstimateDto, {
        serviceId: 'standard',
        servicePackage: 'standard',
        size: 'midsize',
        condition: 'moderate',
        tradeType: 'Mobile Detailing',
        [field]: value,
      });
      expect(errors.some((error) => error.property === field)).toBe(true);
    }
  );

  it('rejects tenant authority fields on sync and availability envelopes', async () => {
    const syncErrors = await validate(
      plainToInstance(SyncFlowDto, {
        tenantId: 'tenant-client-controlled',
        items: [],
      })
    );
    const availabilityErrors = await validate(
      plainToInstance(CreateFlowAvailabilityDto, {
        tenantId: 'tenant-client-controlled',
        serviceId: 'standard',
        date: '2099-10-01',
      })
    );

    expect(syncErrors.some((error) => error.property === 'tenantId')).toBe(
      true
    );
    expect(
      availabilityErrors.some((error) => error.property === 'tenantId')
    ).toBe(true);
  });

  it('validates booking and contact fields', async () => {
    const errors = await validateRequest(CreateBookingDto, {
      estimateId: 'estimate-1',
      serviceId: 'standard',
      servicePackage: 'standard',
      customerName: '',
      customerPhone: '',
      customerEmail: 'not-an-email',
      serviceAddress: '',
      scheduledDate: 'not-a-date',
      arrivalWindow: '',
    });

    expect(errors.some((error) => error.property === 'customerName')).toBe(
      true
    );
    expect(errors.some((error) => error.property === 'customerPhone')).toBe(
      true
    );
    expect(errors.some((error) => error.property === 'customerEmail')).toBe(
      true
    );
    expect(errors.some((error) => error.property === 'serviceAddress')).toBe(
      true
    );
    expect(errors.some((error) => error.property === 'scheduledDate')).toBe(
      true
    );
    expect(errors.some((error) => error.property === 'arrivalWindow')).toBe(
      true
    );
  });

  it('accepts only booking identifiers and an idempotency key for deposits', async () => {
    const errors = await validateRequest(DepositPaymentDto, {
      bookingId: 'booking-1',
      idempotencyKey: 'deposit-key-1',
    });

    expect(errors).toHaveLength(0);
  });

  it('requires exactly one non-empty booking identifier for deposits', async () => {
    const bookingOnly = await validateRequest(DepositPaymentDto, {
      bookingId: 'booking-1',
      idempotencyKey: 'deposit-key-1',
    });
    const trackingOnly = await validateRequest(DepositPaymentDto, {
      trackingCode: 'TRACK-1',
      idempotencyKey: 'deposit-key-1',
    });
    const both = await validateRequest(DepositPaymentDto, {
      bookingId: 'booking-1',
      trackingCode: 'TRACK-1',
      idempotencyKey: 'deposit-key-1',
    });
    const neither = await validateRequest(DepositPaymentDto, {
      idempotencyKey: 'deposit-key-1',
    });
    const empty = await validateRequest(DepositPaymentDto, {
      bookingId: '',
      trackingCode: 'TRACK-1',
      idempotencyKey: 'deposit-key-1',
    });

    expect(bookingOnly).toHaveLength(0);
    expect(trackingOnly).toHaveLength(0);
    expect(both.length).toBeGreaterThan(0);
    expect(neither.length).toBeGreaterThan(0);
    expect(empty.length).toBeGreaterThan(0);
  });

  it('rejects sensitive payment fields anywhere in a sync payload', async () => {
    const baseItem = {
      id: 'sync-1',
      type: 'payment',
      payload: { request: { lineItems: [{ details: {} }] } },
      timestamp: 1720000000000,
      synced: false,
      attempts: 0,
      idempotencyKey: 'payment-key-1',
    };

    for (const field of [
      'cardNumber',
      'cvc',
      'expiration',
      'cardNumberMasked',
      'paymentMethodId',
    ]) {
      const payload = {
        request: {
          lineItems: [{ details: { [field]: 'sensitive' } }],
        },
      };
      const errors = await validate(
        plainToInstance(FlowSyncItemDto, { ...baseItem, payload })
      );
      expect(errors.some((error) => error.property === 'payload')).toBe(true);
    }
  });

  it('rejects payment aliases recursively without banning ordinary number fields', async () => {
    const baseItem = {
      id: 'sync-payment-alias',
      type: 'payment',
      payload: { request: { details: {} } },
      timestamp: 1720000000000,
      synced: false,
      attempts: 0,
      idempotencyKey: 'payment-alias-key',
    };

    for (const field of ['pan', 'card', 'number']) {
      const errors = await validate(
        plainToInstance(FlowSyncItemDto, {
          ...baseItem,
          payload: { request: { details: { [field]: 'sensitive' } } },
        })
      );
      expect(errors.some((error) => error.property === 'payload')).toBe(true);
    }

    const legitimateNumber = await validate(
      plainToInstance(FlowSyncItemDto, {
        ...baseItem,
        type: 'booking',
        payload: { lineItems: [{ number: 42 }] },
      })
    );
    expect(legitimateNumber.some((error) => error.property === 'payload')).toBe(
      false
    );
  });

  it('validates the synced flag on sync wire items', async () => {
    const valid = await validate(
      plainToInstance(FlowSyncItemDto, {
        id: 'sync-1',
        type: 'booking',
        payload: { bookingId: 'booking-1' },
        timestamp: 1720000000000,
        synced: false,
        attempts: 0,
        idempotencyKey: 'booking-key-1',
      })
    );
    const missing = await validate(
      plainToInstance(FlowSyncItemDto, {
        id: 'sync-2',
        type: 'booking',
        payload: { bookingId: 'booking-2' },
        timestamp: 1720000000001,
        idempotencyKey: 'booking-key-2',
      })
    );

    expect(valid).toHaveLength(0);
    expect(missing.some((error) => error.property === 'synced')).toBe(true);
  });

  it('requires supported sync types and nonnegative integer attempts', async () => {
    const validItem = {
      id: 'sync-1',
      type: 'booking',
      payload: { bookingId: 'booking-1' },
      timestamp: 1720000000000,
      synced: false,
      attempts: 0,
      idempotencyKey: 'booking-key-1',
    };

    expect(
      await validate(plainToInstance(FlowSyncItemDto, validItem))
    ).toHaveLength(0);

    for (const [field, value] of [
      ['type', 'unsupported'],
      ['attempts', -1],
      ['attempts', 1.5],
    ] as const) {
      const errors = await validate(
        plainToInstance(FlowSyncItemDto, { ...validItem, [field]: value })
      );
      expect(errors.some((error) => error.property === field)).toBe(true);
    }

    const missingAttempts = { ...validItem } as Record<string, unknown>;
    delete missingAttempts['attempts'];
    const errors = await validate(
      plainToInstance(FlowSyncItemDto, missingAttempts)
    );
    expect(errors.some((error) => error.property === 'attempts')).toBe(true);
  });

  it('rejects incomplete nested sync items', async () => {
    const errors = await validate(
      plainToInstance(SyncFlowDto, { items: [{ id: 'x' }] }),
      { whitelist: true, forbidNonWhitelisted: true }
    );

    expect(errors.some((error) => error.property === 'items')).toBe(true);
  });

  it('rejects raw card data and client-supplied payment authority', async () => {
    const errors = await validateRequest(DepositPaymentDto, {
      bookingId: 'booking-1',
      idempotencyKey: 'deposit-key-1',
      amount: 50,
      cardNumber: '4242424242424242',
      cvc: '123',
      expiration: '12/28',
      cardNumberMasked: '•••• 4242',
    });

    expect(errors.some((error) => error.property === 'amount')).toBe(true);
    expect(errors.some((error) => error.property === 'cardNumber')).toBe(true);
    expect(errors.some((error) => error.property === 'cvc')).toBe(true);
    expect(errors.some((error) => error.property === 'expiration')).toBe(true);
    expect(errors.some((error) => error.property === 'cardNumberMasked')).toBe(
      true
    );
  });
});
