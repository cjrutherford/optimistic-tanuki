import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { BillingCommands } from '../index';
import {
  BatchRecordUsageDto,
  BillingSubscriptionRefDto,
  ConsumeUsageBlockDto,
  CreateBillingSubscriptionDto,
  CreateSubscriptionFromProductDto,
  GrantUsageBlockDto,
  InvoicePreviewInput,
  PeriodInvoicePreviewInput,
  RecordUsageDto,
  UsageSummaryRequest,
} from '../index';

const SCOPE = { tenantId: 'tenant-1', appScope: 'finance' };

const METER = {
  id: 'meter-1',
  name: 'API calls',
  unit: 'call',
  includedQuantity: 1000,
  overageUnitPriceCents: 5,
};

/**
 * Covered live patterns (`apps/billing/src/app/app.controller.ts`) with their
 * contract DTO plus one valid and one invalid sample. `PREVIEW_INVOICE`
 * covers both dispatch branches (instant vs period). `CLOSE_BILLING_PERIOD`
 * and `GET_ENTITLEMENTS` are declared in `BillingCommands` with no sender and
 * no handler — named in KNOWN_UNIMPLEMENTED so the gap is explicit.
 */
const COVERED: Array<{
  pattern: string;
  dto: new () => object;
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
  invalidProps: string[];
}> = [
  {
    pattern: BillingCommands.RECORD_USAGE,
    dto: RecordUsageDto,
    valid: { ...SCOPE, meterId: 'meter-1', eventKey: 'api.call', quantity: 3 },
    invalid: { ...SCOPE, meterId: 'meter-1', eventKey: 'api.call' },
    invalidProps: ['quantity'],
  },
  {
    pattern: BillingCommands.BATCH_RECORD_USAGE,
    dto: BatchRecordUsageDto,
    valid: {
      events: [
        { ...SCOPE, meterId: 'meter-1', eventKey: 'api.call', quantity: 3 },
      ],
    },
    invalid: { events: [] },
    invalidProps: ['events'],
  },
  {
    pattern: BillingCommands.GET_USAGE_SUMMARY,
    dto: UsageSummaryRequest,
    valid: {
      ...SCOPE,
      meterId: 'meter-1',
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-30T00:00:00.000Z'),
    },
    invalid: {
      ...SCOPE,
      meterId: 'meter-1',
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
    },
    invalidProps: ['periodEnd'],
  },
  {
    pattern: BillingCommands.GRANT_USAGE_BLOCK,
    dto: GrantUsageBlockDto,
    valid: {
      ...SCOPE,
      accountId: 'account-1',
      meterId: 'meter-1',
      quantity: 100,
    },
    invalid: { ...SCOPE, accountId: 'account-1', meterId: 'meter-1' },
    invalidProps: ['quantity'],
  },
  {
    pattern: BillingCommands.CONSUME_USAGE_BLOCK,
    dto: ConsumeUsageBlockDto,
    valid: {
      ...SCOPE,
      accountId: 'account-1',
      meterId: 'meter-1',
      quantity: 10,
    },
    invalid: { ...SCOPE, meterId: 'meter-1', quantity: 10 },
    invalidProps: ['accountId'],
  },
  {
    pattern: `${BillingCommands.PREVIEW_INVOICE}:instant`,
    dto: InvoicePreviewInput,
    valid: {
      ...SCOPE,
      currency: 'USD',
      subscriptionPriceCents: 9900,
      meter: METER,
      usageQuantity: 1250,
      usageBlockBalance: 100,
    },
    invalid: {
      ...SCOPE,
      currency: 'USD',
      subscriptionPriceCents: 9900,
      meter: METER,
      usageBlockBalance: 100,
    },
    invalidProps: ['usageQuantity'],
  },
  {
    pattern: `${BillingCommands.PREVIEW_INVOICE}:period`,
    dto: PeriodInvoicePreviewInput,
    valid: {
      ...SCOPE,
      accountId: 'account-1',
      currency: 'USD',
      subscriptionPriceCents: 9900,
      meter: METER,
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-30T00:00:00.000Z'),
    },
    invalid: {
      ...SCOPE,
      accountId: 'account-1',
      currency: 'USD',
      subscriptionPriceCents: 9900,
      meter: METER,
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
    },
    invalidProps: ['periodEnd'],
  },
  {
    pattern: BillingCommands.SUBSCRIPTION_CREATE,
    dto: CreateBillingSubscriptionDto,
    valid: {
      ...SCOPE,
      accountId: 'account-1',
      planId: 'plan-pro',
      priceId: 'price-monthly',
    },
    invalid: { ...SCOPE, accountId: 'account-1', planId: 'plan-pro' },
    invalidProps: ['priceId'],
  },
  {
    pattern: BillingCommands.SUBSCRIPTION_CANCEL,
    dto: BillingSubscriptionRefDto,
    valid: { id: 'sub-1' },
    invalid: {},
    invalidProps: ['id'],
  },
  {
    pattern: BillingCommands.SUBSCRIPTION_GET,
    dto: BillingSubscriptionRefDto,
    valid: { id: 'sub-1' },
    invalid: {},
    invalidProps: ['id'],
  },
  {
    pattern: BillingCommands.SUBSCRIPTION_CREATE_FROM_PRODUCT,
    dto: CreateSubscriptionFromProductDto,
    valid: {
      ...SCOPE,
      accountId: 'account-1',
      productId: 'product-1',
    },
    invalid: { ...SCOPE, accountId: 'account-1' },
    invalidProps: ['productId'],
  },
];

const KNOWN_UNIMPLEMENTED = ['CLOSE_BILLING_PERIOD', 'GET_ENTITLEMENTS'];

const propsOf = (errors: ValidationError[]) =>
  errors.map((e) => e.property).sort();

/**
 * O16: the gateway (`apps/gateway/src/main.ts`) and the billing
 * microservice (`apps/billing/src/main.ts`) run the same pipe settings, so
 * extra properties must reject at both ends of the TCP hop. Gateway-side
 * validates the in-memory DTO; microservice-side validates the JSON
 * round-tripped payload exactly as it arrives over TCP (Dates as ISO
 * strings, restored by `@Type(() => Date)` under `transform: true`).
 */
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true } as const;
const EXTRA = 'billingParityProbe';

describe('billing-contract-parity', () => {
  it.each(COVERED.map((c) => [c.pattern, c]))(
    'pattern %s validates its DTO both ways',
    async (_pattern, entry) => {
      const valid = plainToInstance(entry.dto, entry.valid);
      expect(await validate(valid)).toEqual([]);
      const invalid = plainToInstance(entry.dto, entry.invalid);
      expect(propsOf(await validate(invalid))).toEqual(
        [...entry.invalidProps].sort()
      );
    }
  );

  it.each(COVERED.map((c) => [c.pattern, c]))(
    'pattern %s rejects extra props gateway-side',
    async (_pattern, entry) => {
      const withExtra = plainToInstance(entry.dto, {
        ...entry.valid,
        [EXTRA]: 'unexpected',
      });
      expect(propsOf(await validate(withExtra, PIPE_OPTIONS))).toEqual([EXTRA]);
    }
  );

  it.each(COVERED.map((c) => [c.pattern, c]))(
    'pattern %s rejects extra props microservice-side (after TCP round-trip)',
    async (_pattern, entry) => {
      const overTheWire = JSON.parse(
        JSON.stringify({ ...entry.valid, [EXTRA]: 'unexpected' })
      ) as Record<string, unknown>;
      const withExtra = plainToInstance(entry.dto, overTheWire, {
        enableImplicitConversion: true,
      });
      expect(propsOf(await validate(withExtra, PIPE_OPTIONS))).toEqual([EXTRA]);
    }
  );

  it('covers every live pattern and names the dead commands', () => {
    const commands = BillingCommands as unknown as Record<string, string>;
    const liveValues = new Set([
      commands['RECORD_USAGE'],
      commands['BATCH_RECORD_USAGE'],
      commands['GET_USAGE_SUMMARY'],
      commands['GRANT_USAGE_BLOCK'],
      commands['CONSUME_USAGE_BLOCK'],
      commands['PREVIEW_INVOICE'],
      commands['SUBSCRIPTION_CREATE'],
      commands['SUBSCRIPTION_CREATE_FROM_PRODUCT'],
      commands['SUBSCRIPTION_CANCEL'],
      commands['SUBSCRIPTION_GET'],
    ]);
    const coveredValues = new Set(COVERED.map((c) => c.pattern.split(':')[0]));
    expect(coveredValues).toEqual(liveValues);
    const expected = new Set([
      ...liveValues,
      ...KNOWN_UNIMPLEMENTED.map((k) => commands[k]),
    ]);
    expect(new Set(Object.values(commands))).toEqual(expected);
  });
});
