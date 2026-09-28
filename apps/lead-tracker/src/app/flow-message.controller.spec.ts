import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FlowMessageController } from './flow-message.controller';
import { FlowService } from './flow.service';
import { FlowBooking } from './entities/flow-booking.entity';
import { FlowBookingUpdate } from './entities/flow-booking-update.entity';
import { FlowEstimate } from './entities/flow-estimate.entity';

describe('FlowMessageController & FlowService', () => {
  let controller: FlowMessageController;
  let stores: { estimates: any[]; bookings: any[]; updates: any[] };
  let dataSource: any;

  const matches = (record: any, where: any): boolean =>
    Object.entries(where).every(([key, value]) => record[key] === value);

  beforeEach(async () => {
    stores = { estimates: [], bookings: [], updates: [] };
    const queryRunner = {
      query: jest.fn(async () => []),
      isTransactionActive: true,
      isReleased: false,
    };
    const estimateRepo = {
      findOne: jest.fn(async ({ where }: any) =>
        stores.estimates.find((estimate) => matches(estimate, where))
      ),
      create: jest.fn((value: any) => ({ ...value })),
      save: jest.fn(async (value: any) => {
        const saved = {
          ...value,
          id: value.id ?? `estimate-${stores.estimates.length + 1}`,
          createdAt: value.createdAt ?? new Date(),
          updatedAt: new Date(),
        };
        stores.estimates.push(saved);
        return saved;
      }),
    };
    const bookingRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        const clauses = Array.isArray(where) ? where : [where];
        return stores.bookings.find((booking) =>
          clauses.some((clause) => matches(booking, clause))
        );
      }),
      find: jest.fn(async ({ where }: any) =>
        stores.bookings.filter((booking) => matches(booking, where))
      ),
      create: jest.fn((value: any) => ({ ...value })),
      save: jest.fn(async (value: any) => {
        const saved = {
          ...value,
          id: value.id ?? `booking-${stores.bookings.length + 1}`,
          createdAt: value.createdAt ?? new Date(),
          updatedAt: new Date(),
        };
        const index = stores.bookings.findIndex(
          (booking) => booking.bookingId === saved.bookingId
        );
        if (index >= 0) {
          stores.bookings[index] = saved;
        } else {
          stores.bookings.push(saved);
        }
        return saved;
      }),
    };
    const updateRepo = {
      create: jest.fn((value: any) => ({ ...value })),
      save: jest.fn(async (value: any) => {
        const saved = {
          ...value,
          id: `update-${stores.updates.length + 1}`,
          createdAt: new Date(),
        };
        stores.updates.push(saved);
        return saved;
      }),
    };
    const manager = {
      queryRunner,
      getRepository: jest.fn((entity: any) => {
        if (entity === FlowEstimate) return estimateRepo;
        if (entity === FlowBooking) return bookingRepo;
        return updateRepo;
      }),
    };
    dataSource = {
      transaction: jest.fn(async (callback: any) => callback(manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlowMessageController],
      providers: [
        FlowService,
        { provide: 'LEAD_TRACKER_CONNECTION', useValue: dataSource },
      ],
    }).compile();

    controller = module.get<FlowMessageController>(FlowMessageController);
  });

  const estimatePayload = (overrides: Record<string, unknown> = {}) => ({
    tenantId: 'wirepro-electrical',
    serviceId: 'standard',
    servicePackage: 'standard',
    size: 'midsize',
    condition: 'moderate',
    ...overrides,
  });

  it('persists a tenant-scoped authoritative estimate', async () => {
    const result = await controller.calculateEstimate(
      estimatePayload() as never
    );

    expect(result.serviceId).toBe('standard');
    expect(result.subtotal).toBeGreaterThan(0);
    expect(result.total).toBeCloseTo(result.subtotal + result.taxAmount, 2);
    expect(result.depositRequired).toBeLessThanOrEqual(50);
    expect(result.currency).toBe('USD');
    expect(Date.parse(result.expiresAt)).toBeGreaterThan(Date.now());
    expect(stores.estimates).toHaveLength(1);
    expect(stores.estimates[0].tenantId).toBe('wirepro-electrical');
  });

  it('requires tenant context for estimates', async () => {
    await expect(
      controller.calculateEstimate({
        serviceId: 'standard',
        servicePackage: 'standard',
        size: 'midsize',
        condition: 'moderate',
      } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a booking from an unexpired tenant estimate', async () => {
    const estimate = await controller.calculateEstimate(
      estimatePayload() as never
    );
    const booking = await controller.createBooking({
      tenantId: 'wirepro-electrical',
      estimateId: estimate.estimateId,
      serviceId: 'standard',
      customerName: 'Marcus Bennett',
      customerPhone: '(912) 555-0142',
      customerEmail: 'marcus@example.com',
      serviceAddress: '142 Bull St, Savannah, GA 31401',
      scheduledDate: '2099-10-15',
      arrivalWindow: '8:00 AM - 10:00 AM',
    } as never);

    expect(booking.bookingId).toBeDefined();
    expect(booking.trackingCode).toMatch(/^FLW-/);
    expect(booking.status).toBe('scheduled');
    expect(booking.totalAmount).toBe(estimate.total);
    expect(stores.bookings).toHaveLength(1);
    expect(stores.updates).toHaveLength(1);
  });

  it('returns the same booking for a repeated estimate booking', async () => {
    const estimate = await controller.calculateEstimate(
      estimatePayload() as never
    );
    const payload = {
      tenantId: 'wirepro-electrical',
      estimateId: estimate.estimateId,
      serviceId: 'standard',
      customerName: 'Marcus Bennett',
      customerPhone: '(912) 555-0142',
      customerEmail: 'marcus@example.com',
      serviceAddress: '142 Bull St, Savannah, GA 31401',
      scheduledDate: '2099-10-15',
      arrivalWindow: '8:00 AM - 10:00 AM',
    } as never;
    const first = await controller.createBooking(payload);
    const second = await controller.createBooking(payload);

    expect(second.bookingId).toBe(first.bookingId);
    expect(stores.bookings).toHaveLength(1);
  });

  it('rejects a booking for another tenant estimate', async () => {
    const estimate = await controller.calculateEstimate(
      estimatePayload() as never
    );

    await expect(
      controller.createBooking({
        tenantId: 'apex-detailing',
        estimateId: estimate.estimateId,
        serviceId: 'standard',
        customerName: 'Apex Client',
        customerPhone: '(912) 555-0100',
        customerEmail: 'apex@example.com',
        serviceAddress: '1 Main St',
        scheduledDate: '2099-10-15',
        arrivalWindow: '8:00 AM - 10:00 AM',
      } as never)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects double booking an arrival window', async () => {
    const firstEstimate = await controller.calculateEstimate(
      estimatePayload() as never
    );
    const secondEstimate = await controller.calculateEstimate(
      estimatePayload({ squareFootage: 600 }) as never
    );
    const bookingPayload = (estimateId: string) => ({
      tenantId: 'wirepro-electrical',
      estimateId,
      serviceId: 'standard',
      customerName: 'Marcus Bennett',
      customerPhone: '(912) 555-0142',
      customerEmail: 'marcus@example.com',
      serviceAddress: '142 Bull St, Savannah, GA 31401',
      scheduledDate: '2099-10-15',
      arrivalWindow: '8:00 AM - 10:00 AM',
    });
    await controller.createBooking(
      bookingPayload(firstEstimate.estimateId) as never
    );

    await expect(
      controller.createBooking(
        bookingPayload(secondEstimate.estimateId) as never
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns status by booking id and tracking code', async () => {
    const estimate = await controller.calculateEstimate(
      estimatePayload() as never
    );
    const booking = await controller.createBooking({
      tenantId: 'wirepro-electrical',
      estimateId: estimate.estimateId,
      serviceId: 'standard',
      customerName: 'Marcus Bennett',
      customerPhone: '(912) 555-0142',
      customerEmail: 'marcus@example.com',
      serviceAddress: '142 Bull St, Savannah, GA 31401',
      scheduledDate: '2099-10-15',
      arrivalWindow: '8:00 AM - 10:00 AM',
    } as never);

    const byId = await controller.getStatus({
      tenantId: 'wirepro-electrical',
      id: booking.bookingId,
    } as never);
    const byTracking = await controller.getStatus({
      tenantId: 'wirepro-electrical',
      id: booking.trackingCode as string,
    } as never);

    expect(byId.status).toBe('scheduled');
    expect(byTracking.bookingId).toBe(booking.bookingId);
    expect(byId.reviewPromptEligible).toBe(false);
  });

  it('does not leak bookings across tenants', async () => {
    const estimate = await controller.calculateEstimate(
      estimatePayload() as never
    );
    const booking = await controller.createBooking({
      tenantId: 'wirepro-electrical',
      estimateId: estimate.estimateId,
      serviceId: 'standard',
      customerName: 'Marcus Bennett',
      customerPhone: '(912) 555-0142',
      customerEmail: 'marcus@example.com',
      serviceAddress: '142 Bull St, Savannah, GA 31401',
      scheduledDate: '2099-10-15',
      arrivalWindow: '8:00 AM - 10:00 AM',
    } as never);

    await expect(
      controller.getStatus({
        tenantId: 'apex-detailing',
        id: booking.bookingId,
      } as never)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports availability from durable bookings', async () => {
    const estimate = await controller.calculateEstimate(
      estimatePayload() as never
    );
    await controller.createBooking({
      tenantId: 'wirepro-electrical',
      estimateId: estimate.estimateId,
      serviceId: 'standard',
      customerName: 'Marcus Bennett',
      customerPhone: '(912) 555-0142',
      customerEmail: 'marcus@example.com',
      serviceAddress: '142 Bull St, Savannah, GA 31401',
      scheduledDate: '2099-10-15',
      arrivalWindow: '8:00 AM - 10:00 AM',
    } as never);

    const availability = await controller.getAvailability({
      tenantId: 'wirepro-electrical',
      serviceId: 'standard',
      servicePackage: 'standard',
      date: '2099-10-15',
    } as never);

    expect(availability.date).toBe('2099-10-15');
    expect(
      availability.windows.find(
        (window) => window.timeSlot === '8:00 AM - 10:00 AM'
      )?.available
    ).toBe(false);
    expect(
      availability.windows.find(
        (window) => window.timeSlot === '10:00 AM - 12:00 PM'
      )?.available
    ).toBe(true);
  });

  it('synchronizes queued actions with per-item acknowledgements', async () => {
    const estimate = await controller.calculateEstimate(
      estimatePayload() as never
    );
    const response = await controller.syncFlow({
      tenantId: 'wirepro-electrical',
      items: [
        {
          id: 'sync-booking-1',
          type: 'booking',
          payload: {
            estimateId: estimate.estimateId,
            serviceId: 'standard',
            customerName: 'Marcus Bennett',
            customerPhone: '(912) 555-0142',
            customerEmail: 'marcus@example.com',
            serviceAddress: '142 Bull St, Savannah, GA 31401',
            scheduledDate: '2099-10-15',
            arrivalWindow: '10:00 AM - 12:00 PM',
          },
          timestamp: Date.now(),
          synced: false,
          attempts: 0,
          idempotencyKey: 'sync-booking-1',
        },
        {
          id: 'sync-bad-1',
          type: 'payment',
          payload: {},
          timestamp: Date.now(),
          synced: false,
          attempts: 0,
          idempotencyKey: 'sync-bad-1',
        },
      ],
    } as never);

    expect(response.results).toHaveLength(2);
    expect(response.results[0]).toEqual({
      id: 'sync-booking-1',
      acknowledged: true,
    });
    expect(response.results[1].acknowledged).toBe(false);
  });
});
