import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  AppointmentCommands,
  AvailabilityCommands,
  CatalogCommands,
  DonationCommands,
  OrderCommands,
  ProductCommands,
  ResourceCommands,
  SubscriptionCommands,
} from '../index';
import {
  ApproveAppointmentDto,
  CreateAppointmentDto,
  CreateAvailabilityDto,
  CreateAvailabilityOverrideDto,
  CreateDonationDto,
  CreateOrderDto,
  CreateProductDto,
  CreateResourceDto,
  CreateStoreCatalogDto,
  CreateSubscriptionDto,
  DenyAppointmentDto,
  UpdateAppointmentDto,
  UpdateAvailabilityDto,
  UpdateOrderDto,
  UpdateProductDto,
  UpdateResourceDto,
  UpdateSubscriptionDto,
} from '../index';
import { CatalogProductsDto, ProductRefDto } from './catalog';
import { CheckResourceAvailabilityDto } from './queries';

type Cmd = { cmd: string };
const key = (c: Cmd) => c.cmd;

/**
 * Covered patterns with their contract DTO plus one valid and one invalid
 * sample. Mutation shapes are promoted from `models` (single source moved
 * here); `CatalogProductsDto`/`ProductRefDto` are new query shapes matching
 * verified gateway sends. Scalar (`id`, `userId`), empty (`{}`), and
 * workspace-scope-object sends are complete by definition and listed in
 * SCALAR_OR_EMPTY; E5 invoice and E7 entitlement shapes arrive with the
 * persistence moves (DEFERRED).
 */
const COVERED: Array<{
  pattern: string;
  dto: new () => object;
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
  invalidProps: string[];
}> = [
  {
    pattern: key(ProductCommands.CREATE_PRODUCT),
    dto: CreateProductDto,
    valid: { name: 'Mouse', priceCents: 2999, type: 'physical' },
    invalid: { name: '', priceCents: 2999, type: 'physical' },
    invalidProps: ['name'],
  },
  {
    pattern: key(ProductCommands.UPDATE_PRODUCT),
    dto: UpdateProductDto,
    valid: { name: 'Keyboard' },
    invalid: { priceCents: 'free' },
    invalidProps: ['priceCents'],
  },
  {
    pattern: key(ProductCommands.FIND_ALL_PRODUCTS),
    dto: CatalogProductsDto,
    valid: { catalogId: 'catalog-1', public: true },
    invalid: {},
    invalidProps: ['catalogId'],
  },
  {
    pattern: key(ProductCommands.FIND_ONE_PRODUCT),
    dto: ProductRefDto,
    valid: { id: 'product-1', catalogId: 'catalog-1', public: true },
    invalid: { catalogId: 'catalog-1' },
    invalidProps: ['id'],
  },
  {
    pattern: key(CatalogCommands.CREATE_STORE_CATALOG),
    dto: CreateStoreCatalogDto,
    valid: { name: 'Summer' },
    invalid: { name: '' },
    invalidProps: ['name'],
  },
  {
    pattern: key(SubscriptionCommands.CREATE_SUBSCRIPTION),
    dto: CreateSubscriptionDto,
    valid: { userId: 'user-1', productId: 'product-1', interval: 'monthly' },
    invalid: { userId: 'user-1' },
    invalidProps: ['productId', 'interval'],
  },
  {
    pattern: key(SubscriptionCommands.UPDATE_SUBSCRIPTION),
    dto: UpdateSubscriptionDto,
    valid: {},
    invalid: { status: 42 },
    invalidProps: ['status'],
  },
  {
    pattern: key(DonationCommands.CREATE_DONATION),
    dto: CreateDonationDto,
    valid: { amountCents: 1000 },
    invalid: { amountCents: -5 },
    invalidProps: ['amountCents'],
  },
  {
    pattern: key(OrderCommands.CREATE_ORDER),
    dto: CreateOrderDto,
    valid: {
      userId: 'user-1',
      items: [{ productId: 'product-1', quantity: 2 }],
    },
    invalid: { items: [{ productId: 'product-1', quantity: 2 }] },
    invalidProps: ['userId'],
  },
  {
    pattern: key(OrderCommands.UPDATE_ORDER),
    dto: UpdateOrderDto,
    valid: { status: 'paid' },
    invalid: { status: 42 },
    invalidProps: ['status'],
  },
  {
    pattern: key(AppointmentCommands.CREATE_APPOINTMENT),
    dto: CreateAppointmentDto,
    valid: {
      userId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
      title: 'Intro call',
      startTime: '2026-10-01T10:00:00.000Z',
      endTime: '2026-10-01T10:30:00.000Z',
    },
    invalid: { title: 'Intro call' },
    invalidProps: ['userId', 'startTime', 'endTime'],
  },
  {
    pattern: key(AppointmentCommands.UPDATE_APPOINTMENT),
    dto: UpdateAppointmentDto,
    valid: {},
    invalid: { title: '' },
    invalidProps: ['title'],
  },
  {
    pattern: key(AppointmentCommands.APPROVE_APPOINTMENT),
    dto: ApproveAppointmentDto,
    valid: {},
    invalid: { hourlyRate: 'free' },
    invalidProps: ['hourlyRate'],
  },
  {
    pattern: key(AppointmentCommands.DENY_APPOINTMENT),
    dto: DenyAppointmentDto,
    valid: { denialReason: 'Conflict' },
    invalid: {},
    invalidProps: ['denialReason'],
  },
  {
    pattern: key(AvailabilityCommands.CREATE_AVAILABILITY),
    dto: CreateAvailabilityDto,
    valid: {
      dayOfWeek: 1,
      startTime: '09:00:00',
      endTime: '17:00:00',
      hourlyRate: 50,
    },
    invalid: {
      dayOfWeek: 9,
      startTime: '09:00:00',
      endTime: '17:00:00',
      hourlyRate: 50,
    },
    invalidProps: ['dayOfWeek'],
  },
  {
    pattern: key(AvailabilityCommands.UPDATE_AVAILABILITY),
    dto: UpdateAvailabilityDto,
    valid: {},
    invalid: { dayOfWeek: 'monday' },
    invalidProps: ['dayOfWeek'],
  },
  {
    pattern: key(AvailabilityCommands.CREATE_AVAILABILITY_OVERRIDE),
    dto: CreateAvailabilityOverrideDto,
    valid: {
      startTime: '2026-12-24T00:00:00.000Z',
      endTime: '2026-12-26T00:00:00.000Z',
      mode: 'blocked',
    },
    invalid: {
      startTime: '2026-12-24T00:00:00.000Z',
      endTime: '2026-12-26T00:00:00.000Z',
      mode: 'maybe',
    },
    invalidProps: ['mode'],
  },
  {
    pattern: key(ResourceCommands.CREATE_RESOURCE),
    dto: CreateResourceDto,
    valid: { name: 'Room A', type: 'room' },
    invalid: { type: 'room' },
    invalidProps: ['name'],
  },
  {
    pattern: key(ResourceCommands.UPDATE_RESOURCE),
    dto: UpdateResourceDto,
    valid: {},
    invalid: { capacity: 0 },
    invalidProps: ['capacity'],
  },
  {
    pattern: key(ResourceCommands.CHECK_RESOURCE_AVAILABILITY),
    dto: CheckResourceAvailabilityDto,
    valid: {
      resourceId: 'resource-1',
      startTime: '2026-10-01T10:00:00.000Z',
      endTime: '2026-10-01T11:00:00.000Z',
    },
    invalid: { resourceId: 'resource-1' },
    invalidProps: ['startTime', 'endTime'],
  },
];

/** Verified scalar (`id`/`userId`/scope-object) or empty (`{}`) sends — complete by definition. */
const SCALAR_OR_EMPTY: string[] = [
  key(ProductCommands.REMOVE_PRODUCT),
  key(ProductCommands.FIND_OWNER_PRODUCTS),
  key(CatalogCommands.FIND_STORE_CATALOGS),
  key(SubscriptionCommands.FIND_ALL_SUBSCRIPTIONS),
  key(SubscriptionCommands.FIND_USER_SUBSCRIPTIONS),
  key(SubscriptionCommands.FIND_ONE_SUBSCRIPTION),
  key(SubscriptionCommands.CANCEL_SUBSCRIPTION),
  key(DonationCommands.FIND_ALL_DONATIONS),
  key(DonationCommands.FIND_USER_DONATIONS),
  key(DonationCommands.FIND_ONE_DONATION),
  key(OrderCommands.FIND_ALL_ORDERS),
  key(OrderCommands.FIND_USER_ORDERS),
  key(OrderCommands.FIND_ONE_ORDER),
  key(AppointmentCommands.FIND_ALL_APPOINTMENTS),
  key(AppointmentCommands.FIND_USER_APPOINTMENTS),
  key(AppointmentCommands.FIND_ONE_APPOINTMENT),
  key(AppointmentCommands.CANCEL_APPOINTMENT),
  key(AppointmentCommands.COMPLETE_APPOINTMENT),
  key(AvailabilityCommands.FIND_ALL_AVAILABILITIES),
  key(AvailabilityCommands.FIND_OWNER_AVAILABILITIES),
  key(AvailabilityCommands.FIND_ONE_AVAILABILITY),
  key(AvailabilityCommands.REMOVE_AVAILABILITY),
  key(AvailabilityCommands.FIND_ALL_AVAILABILITY_OVERRIDES),
  key(AvailabilityCommands.FIND_OWNER_AVAILABILITY_OVERRIDES),
  key(AvailabilityCommands.FIND_ONE_AVAILABILITY_OVERRIDE),
  key(AvailabilityCommands.UPDATE_AVAILABILITY_OVERRIDE),
  key(AvailabilityCommands.REMOVE_AVAILABILITY_OVERRIDE),
  key(ResourceCommands.FIND_ALL_RESOURCES),
  key(ResourceCommands.FIND_RESOURCES_BY_TYPE),
  key(ResourceCommands.FIND_ONE_RESOURCE),
  key(ResourceCommands.REMOVE_RESOURCE),
];

/** Shapes that arrive with the persistence moves, not before. */
const DEFERRED: string[] = [
  key(AppointmentCommands.GENERATE_INVOICE),
  key(AppointmentCommands.FIND_USER_INVOICES),
  key(AppointmentCommands.PAY_INVOICE),
];

const COMMAND_OBJECTS: Record<string, Record<string, Cmd>> = {
  ProductCommands: ProductCommands as Record<string, Cmd>,
  CatalogCommands: CatalogCommands as Record<string, Cmd>,
  SubscriptionCommands: SubscriptionCommands as unknown as Record<string, Cmd>,
  DonationCommands: DonationCommands as Record<string, Cmd>,
  OrderCommands: OrderCommands as Record<string, Cmd>,
  AppointmentCommands: AppointmentCommands as Record<string, Cmd>,
  AvailabilityCommands: AvailabilityCommands as Record<string, Cmd>,
  ResourceCommands: ResourceCommands as Record<string, Cmd>,
};

const propsOf = (errors: ValidationError[]) =>
  errors.map((e) => e.property).sort();

describe('store-contract-parity', () => {
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

  it('accounts for every key in the store command objects', () => {
    const coveredValues = new Set(COVERED.map((c) => c.pattern));
    const allowed = new Set([...SCALAR_OR_EMPTY, ...DEFERRED]);
    for (const commands of Object.values(COMMAND_OBJECTS)) {
      for (const value of Object.values(commands)) {
        const pattern = typeof value === 'string' ? value : value.cmd;
        expect(coveredValues.has(pattern) || allowed.has(pattern)).toBe(true);
      }
    }
    for (const pattern of DEFERRED) {
      expect(coveredValues.has(pattern)).toBe(false);
    }
  });
});
