import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { StoreService } from './store.service';

describe('StoreService', () => {
  let service: StoreService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [StoreService],
    });

    service = TestBed.inject(StoreService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const expectCall = (
    call: () => void,
    method: string,
    url: string,
    body?: unknown
  ) => {
    const emitted: unknown[] = [];
    call();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) {
      expect(req.request.body).toEqual(body);
    }
    return { req, emitted };
  };

  describe('products', () => {
    it('lists products', () => {
      let result: unknown;
      service.getProducts().subscribe((r) => (result = r));
      const req = httpMock.expectOne('/api/store/products');
      expect(req.request.method).toBe('GET');
      req.flush([{ id: 'p1' }]);
      expect(result).toEqual([{ id: 'p1' }]);
    });

    it('reads a single product', () => {
      let result: unknown;
      service.getProduct('p1').subscribe((r) => (result = r));
      const req = httpMock.expectOne('/api/store/products/p1');
      expect(req.request.method).toBe('GET');
      req.flush({ id: 'p1' });
      expect(result).toEqual({ id: 'p1' });
    });

    it('creates a product', () => {
      const dto = { name: 'Widget', priceCents: 100 } as never;
      const { req } = expectCall(
        () => service.createProduct(dto).subscribe(),
        'POST',
        '/api/store/products',
        dto
      );
      req.flush({ id: 'p2' });
    });

    it('updates a product', () => {
      const dto = { name: 'Widget v2' } as never;
      const { req } = expectCall(
        () => service.updateProduct('p1', dto).subscribe(),
        'PUT',
        '/api/store/products/p1',
        dto
      );
      req.flush({ id: 'p1' });
    });

    it('deletes a product', () => {
      const { req } = expectCall(
        () => service.deleteProduct('p1').subscribe(),
        'DELETE',
        '/api/store/products/p1'
      );
      req.flush(null);
    });
  });

  describe('orders', () => {
    it('lists all orders', () => {
      const { req } = expectCall(
        () => service.getOrders().subscribe(),
        'GET',
        '/api/store/orders'
      );
      req.flush([]);
    });

    it('lists orders for a user', () => {
      const { req } = expectCall(
        () => service.getUserOrders('u1').subscribe(),
        'GET',
        '/api/store/orders/user/u1'
      );
      req.flush([]);
    });

    it('reads a single order', () => {
      const { req } = expectCall(
        () => service.getOrder('o1').subscribe(),
        'GET',
        '/api/store/orders/o1'
      );
      req.flush({ id: 'o1' });
    });

    it('updates an order', () => {
      const dto = { status: 'shipped' } as never;
      const { req } = expectCall(
        () => service.updateOrder('o1', dto).subscribe(),
        'PUT',
        '/api/store/orders/o1',
        dto
      );
      req.flush({ id: 'o1' });
    });
  });

  describe('donations and subscriptions', () => {
    it('lists donations', () => {
      const { req } = expectCall(
        () => service.getDonations().subscribe(),
        'GET',
        '/api/store/donations'
      );
      req.flush([]);
    });

    it('lists subscriptions', () => {
      const { req } = expectCall(
        () => service.getSubscriptions().subscribe(),
        'GET',
        '/api/store/subscriptions'
      );
      req.flush([]);
    });

    it('lists subscriptions for a user', () => {
      const { req } = expectCall(
        () => service.getUserSubscriptions('u1').subscribe(),
        'GET',
        '/api/store/subscriptions/user/u1'
      );
      req.flush([]);
    });

    it('cancels a subscription with an empty body', () => {
      const { req } = expectCall(
        () => service.cancelSubscription('s1').subscribe(),
        'PUT',
        '/api/store/subscriptions/s1/cancel',
        {}
      );
      req.flush({ id: 's1' });
    });
  });

  describe('appointments', () => {
    it('lists appointments', () => {
      const { req } = expectCall(
        () => service.getAppointments().subscribe(),
        'GET',
        '/api/store/appointments'
      );
      req.flush([]);
    });

    it('lists appointments for a user', () => {
      const { req } = expectCall(
        () => service.getUserAppointments('u1').subscribe(),
        'GET',
        '/api/store/appointments/user/u1'
      );
      req.flush([]);
    });

    it('reads a single appointment', () => {
      const { req } = expectCall(
        () => service.getAppointment('a1').subscribe(),
        'GET',
        '/api/store/appointments/a1'
      );
      req.flush({ id: 'a1' });
    });

    it('creates an appointment', () => {
      const dto = { title: 'Consult' } as never;
      const { req } = expectCall(
        () => service.createAppointment(dto).subscribe(),
        'POST',
        '/api/store/appointments',
        dto
      );
      req.flush({ id: 'a2' });
    });

    it('updates an appointment', () => {
      const dto = { title: 'Consult v2' } as never;
      const { req } = expectCall(
        () => service.updateAppointment('a1', dto).subscribe(),
        'PUT',
        '/api/store/appointments/a1',
        dto
      );
      req.flush({ id: 'a1' });
    });

    it('approves an appointment', () => {
      const dto = { approvedBy: 'owner' } as never;
      const { req } = expectCall(
        () => service.approveAppointment('a1', dto).subscribe(),
        'PUT',
        '/api/store/appointments/a1/approve',
        dto
      );
      req.flush({ id: 'a1' });
    });

    it('denies an appointment', () => {
      const dto = { reason: 'unavailable' } as never;
      const { req } = expectCall(
        () => service.denyAppointment('a1', dto).subscribe(),
        'PUT',
        '/api/store/appointments/a1/deny',
        dto
      );
      req.flush({ id: 'a1' });
    });

    it('cancels an appointment with an empty body', () => {
      const { req } = expectCall(
        () => service.cancelAppointment('a1').subscribe(),
        'PUT',
        '/api/store/appointments/a1/cancel',
        {}
      );
      req.flush({ id: 'a1' });
    });

    it('completes an appointment with an empty body', () => {
      const { req } = expectCall(
        () => service.completeAppointment('a1').subscribe(),
        'PUT',
        '/api/store/appointments/a1/complete',
        {}
      );
      req.flush({ id: 'a1' });
    });

    it('generates an invoice for an appointment', () => {
      const { req } = expectCall(
        () => service.generateInvoice('a1').subscribe(),
        'POST',
        '/api/store/appointments/a1/invoice',
        {}
      );
      req.flush({ id: 'inv-1' });
    });
  });

  describe('availabilities', () => {
    it('lists availabilities', () => {
      const { req } = expectCall(
        () => service.getAvailabilities().subscribe(),
        'GET',
        '/api/store/availabilities'
      );
      req.flush([]);
    });

    it('lists availabilities for an owner', () => {
      const { req } = expectCall(
        () => service.getOwnerAvailabilities('own-1').subscribe(),
        'GET',
        '/api/store/availabilities/owner/own-1'
      );
      req.flush([]);
    });

    it('reads a single availability', () => {
      const { req } = expectCall(
        () => service.getAvailability('av1').subscribe(),
        'GET',
        '/api/store/availabilities/av1'
      );
      req.flush({ id: 'av1' });
    });

    it('creates an availability', () => {
      const dto = { dayOfWeek: 1 } as never;
      const { req } = expectCall(
        () => service.createAvailability(dto).subscribe(),
        'POST',
        '/api/store/availabilities',
        dto
      );
      req.flush({ id: 'av2' });
    });

    it('updates an availability', () => {
      const dto = { dayOfWeek: 2 } as never;
      const { req } = expectCall(
        () => service.updateAvailability('av1', dto).subscribe(),
        'PUT',
        '/api/store/availabilities/av1',
        dto
      );
      req.flush({ id: 'av1' });
    });

    it('deletes an availability', () => {
      const { req } = expectCall(
        () => service.deleteAvailability('av1').subscribe(),
        'DELETE',
        '/api/store/availabilities/av1'
      );
      req.flush(null);
    });
  });

  describe('resources', () => {
    it('lists resources', () => {
      const { req } = expectCall(
        () => service.getResources().subscribe(),
        'GET',
        '/api/store/resources'
      );
      req.flush([]);
    });

    it('lists resources filtered by type', () => {
      const { req } = expectCall(
        () => service.getResourcesByType('room').subscribe(),
        'GET',
        '/api/store/resources/type/room'
      );
      req.flush([]);
    });

    it('reads a single resource', () => {
      const { req } = expectCall(
        () => service.getResource('r1').subscribe(),
        'GET',
        '/api/store/resources/r1'
      );
      req.flush({ id: 'r1' });
    });

    it('creates a resource', () => {
      const dto = { name: 'Room A' } as never;
      const { req } = expectCall(
        () => service.createResource(dto).subscribe(),
        'POST',
        '/api/store/resources',
        dto
      );
      req.flush({ id: 'r2' });
    });

    it('updates a resource', () => {
      const dto = { name: 'Room B' } as never;
      const { req } = expectCall(
        () => service.updateResource('r1', dto).subscribe(),
        'PUT',
        '/api/store/resources/r1',
        dto
      );
      req.flush({ id: 'r1' });
    });

    it('deletes a resource', () => {
      const { req } = expectCall(
        () => service.deleteResource('r1').subscribe(),
        'DELETE',
        '/api/store/resources/r1'
      );
      req.flush(null);
    });

    it('checks resource availability with the requested window', () => {
      const startTime = new Date('2025-01-01T09:00:00.000Z');
      const endTime = new Date('2025-01-01T10:00:00.000Z');
      let result: boolean | undefined;

      service
        .checkResourceAvailability('r1', startTime, endTime)
        .subscribe((r) => (result = r));

      const req = httpMock.expectOne(
        '/api/store/resources/r1/check-availability'
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ startTime, endTime });
      req.flush(true);
      expect(result).toBe(true);
    });
  });
});
