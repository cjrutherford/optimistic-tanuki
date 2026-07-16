import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { StoreOverviewComponent } from './store-overview.component';
import { OperatorQueueService } from '../services/operator-queue.service';
import { StoreService } from '../services/store.service';
import { BusinessSiteAdminService } from '../services/business-site-admin.service';

describe('StoreOverviewComponent', () => {
  const storeService = {
    getDonations: jest.fn(),
    getSubscriptions: jest.fn(),
    getAppointments: jest.fn(),
    getOrders: jest.fn(),
    getProducts: jest.fn(),
    cancelSubscription: jest.fn(),
    updateOrder: jest.fn(),
    approveAppointment: jest.fn(),
    denyAppointment: jest.fn(),
    completeAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
  };
  const operatorQueueService = {
    getQueueByDomain: jest.fn(),
  };
  const businessSiteAdminService = {
    getSiteConfig: jest.fn(),
  };
  let storage: Record<string, string>;

  beforeEach(async () => {
    jest.clearAllMocks();
    storage = {};
    const storagePrototype = Object.getPrototypeOf(
      window.localStorage
    ) as Storage;
    jest
      .spyOn(storagePrototype, 'getItem')
      .mockImplementation((key: unknown) => storage[String(key)] ?? null);
    jest
      .spyOn(storagePrototype, 'setItem')
      .mockImplementation((key: unknown, value: unknown) => {
        storage[String(key)] = String(value);
      });
    storeService.getDonations.mockReturnValue(
      of([
        {
          id: 'don-1',
          amountCents: 2000,
          currency: 'USD',
          anonymous: false,
          status: 'completed',
          createdAt: new Date('2026-07-01T10:00:00.000Z'),
        },
      ])
    );
    storeService.getSubscriptions.mockReturnValue(
      of([
        {
          id: 'sub-1',
          userId: 'user-1',
          productId: 'prod-1',
          status: 'active',
          interval: 'monthly',
          startDate: new Date('2026-06-01T10:00:00.000Z'),
          nextBillingDate: new Date('2026-08-01T10:00:00.000Z'),
          createdAt: new Date('2026-06-01T10:00:00.000Z'),
          updatedAt: new Date('2026-07-01T10:00:00.000Z'),
          product: { name: 'Retainer' },
        },
      ])
    );
    storeService.getAppointments.mockReturnValue(
      of([
        {
          id: 'appt-1',
          userId: 'user-1',
          title: 'Discovery session',
          status: 'pending',
          isFreeConsultation: false,
          startTime: new Date('2026-07-05T10:00:00.000Z'),
          endTime: new Date('2026-07-05T11:00:00.000Z'),
          totalCost: 150,
        },
        {
          id: 'appt-2',
          userId: 'user-2',
          title: 'Strategy session',
          status: 'approved',
          isFreeConsultation: false,
          startTime: new Date('2026-07-06T10:00:00.000Z'),
          endTime: new Date('2026-07-06T11:30:00.000Z'),
          totalCost: 225,
        },
      ])
    );
    storeService.getOrders.mockReturnValue(
      of([
        {
          id: 'order-1',
          userId: 'user-3',
          status: 'pending',
          totalCents: 7500,
          currency: 'USD',
          items: [
            {
              id: 'item-1',
              orderId: 'order-1',
              productId: 'prod-1',
              quantity: 2,
              unitPriceCents: 3750,
            },
          ],
          createdAt: new Date('2026-07-02T10:00:00.000Z'),
          updatedAt: new Date('2026-07-02T10:00:00.000Z'),
        },
        {
          id: 'order-2',
          userId: 'user-4',
          status: 'processing',
          totalCents: 12500,
          currency: 'USD',
          items: [
            {
              id: 'item-2',
              orderId: 'order-2',
              productId: 'prod-2',
              quantity: 1,
              unitPriceCents: 12500,
            },
          ],
          createdAt: new Date('2026-07-03T10:00:00.000Z'),
          updatedAt: new Date('2026-07-03T10:00:00.000Z'),
        },
      ])
    );
    storeService.getProducts.mockReturnValue(
      of([
        {
          id: 'prod-1',
          name: 'Strategy Session',
          description: '',
          priceCents: 15000,
          type: 'service',
          stock: 0,
          active: true,
          createdAt: new Date('2026-06-01T10:00:00.000Z'),
          updatedAt: new Date('2026-07-01T10:00:00.000Z'),
        },
      ])
    );
    businessSiteAdminService.getSiteConfig.mockReturnValue(
      of({
        configId: 'cfg-1',
        config: {
          serviceCatalog: { source: 'store' },
          features: { store: { enabled: true } },
        },
      })
    );
    operatorQueueService.getQueueByDomain.mockReturnValue(
      of([
        {
          id: 'commerce-appointments-pending',
          domain: 'Commerce',
          kind: 'appointment-approval',
          severity: 'high',
          title: 'Appointments awaiting approval',
          detail: '1 appointment still needs approval.',
          route: '/dashboard/store/appointments',
          status: 'pending',
          sourceTimestamp: '2026-07-01T10:00:00.000Z',
          tags: ['commerce'],
        },
      ])
    );
    storeService.updateOrder.mockImplementation(
      (id: string, dto: { status: string }) =>
        of({
          id,
          userId: id === 'order-1' ? 'user-3' : 'user-4',
          status: dto.status,
          totalCents: id === 'order-1' ? 7500 : 12500,
          currency: 'USD',
          items:
            id === 'order-1'
              ? [
                  {
                    id: 'item-1',
                    orderId: 'order-1',
                    productId: 'prod-1',
                    quantity: 2,
                    unitPriceCents: 3750,
                  },
                ]
              : [
                  {
                    id: 'item-2',
                    orderId: 'order-2',
                    productId: 'prod-2',
                    quantity: 1,
                    unitPriceCents: 12500,
                  },
                ],
          createdAt: new Date('2026-07-02T10:00:00.000Z'),
          updatedAt: new Date('2026-07-04T10:00:00.000Z'),
        })
    );
    storeService.approveAppointment.mockImplementation((id: string) =>
      of({
        id,
        userId: id === 'appt-1' ? 'user-1' : 'user-2',
        title: id === 'appt-1' ? 'Discovery session' : 'Strategy session',
        status: 'approved',
        isFreeConsultation: false,
        startTime: new Date('2026-07-05T10:00:00.000Z'),
        endTime: new Date('2026-07-05T11:00:00.000Z'),
        totalCost: 150,
      })
    );
    storeService.cancelAppointment.mockImplementation((id: string) =>
      of({
        id,
        userId: id === 'appt-1' ? 'user-1' : 'user-2',
        title: id === 'appt-1' ? 'Discovery session' : 'Strategy session',
        status: 'cancelled',
        isFreeConsultation: false,
        startTime: new Date('2026-07-05T10:00:00.000Z'),
        endTime: new Date('2026-07-05T11:00:00.000Z'),
        totalCost: 150,
      })
    );

    await TestBed.configureTestingModule({
      imports: [StoreOverviewComponent, RouterTestingModule],
      providers: [
        { provide: StoreService, useValue: storeService },
        { provide: OperatorQueueService, useValue: operatorQueueService },
        {
          provide: BusinessSiteAdminService,
          useValue: businessSiteAdminService,
        },
      ],
    }).compileComponents();
  });

  it('renders the shared commerce queue on the store overview', () => {
    const fixture = TestBed.createComponent(StoreOverviewComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Commerce Queue');
    expect(fixture.nativeElement.textContent).toContain(
      'Appointments awaiting approval'
    );
  });

  it('renders unified commerce backlog metrics and triage sections', () => {
    const fixture = TestBed.createComponent(StoreOverviewComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Commerce Operations Workspace');
    expect(text).toContain('Pending appointments');
    expect(text).toContain('Fulfillment backlog');
    expect(text).toContain('Catalog readiness');
    expect(text).toContain('Discovery session');
    expect(text).toContain('order-1');
  });

  it('filters the backlog to a selected commerce lane', () => {
    const fixture = TestBed.createComponent(StoreOverviewComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.setBacklogFilter('orders');
    fixture.detectChanges();

    expect(component.filteredBacklogItems.map((item) => item.lane)).toEqual([
      'orders',
      'orders',
    ]);
  });

  it('applies a bulk status update to selected fulfillment orders', () => {
    const fixture = TestBed.createComponent(StoreOverviewComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.setBacklogFilter('orders');
    component.toggleOrderSelection('order-1', true);
    component.bulkOrderStatus = 'processing';
    component.applyBulkOrderStatus();

    expect(storeService.updateOrder).toHaveBeenCalledWith('order-1', {
      status: 'processing',
    });
    expect(
      component.orders.find((order) => order.id === 'order-1')?.status
    ).toBe('processing');
  });

  it('applies a bulk approve action to selected pending appointments', () => {
    const fixture = TestBed.createComponent(StoreOverviewComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.setBacklogFilter('appointments');
    component.toggleAppointmentSelection('appt-1', true);
    component.bulkAppointmentAction = 'approve';
    component.applyBulkAppointmentAction();

    expect(storeService.approveAppointment).toHaveBeenCalledWith('appt-1', {
      hourlyRate: undefined,
      notes: 'Approved from commerce workspace',
    });
    expect(
      component.appointments.find((appointment) => appointment.id === 'appt-1')
        ?.status
    ).toBe('approved');
  });

  it('restores a saved commerce view preset from local storage', () => {
    storage['owner-console.commerce-workspace.view'] = 'fulfillment';

    const fixture = TestBed.createComponent(StoreOverviewComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.activeViewPreset).toBe('fulfillment');
    expect(component.backlogFilter).toBe('orders');
  });

  it('applies and persists commerce workspace view presets', () => {
    const fixture = TestBed.createComponent(StoreOverviewComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.applyViewPreset('approval');

    expect(component.activeViewPreset).toBe('approval');
    expect(component.backlogFilter).toBe('appointments');
    expect(storage['owner-console.commerce-workspace.view']).toBe('approval');
  });

  it('builds an exception board for approval, fulfillment, and catalog blockers', () => {
    const fixture = TestBed.createComponent(StoreOverviewComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.exceptionBoard.map((item) => item.kind)).toEqual([
      'appointment-approval',
      'fulfillment-exception',
      'catalog-readiness',
    ]);
  });
});
