import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { FieldFlowApiService } from './field-flow-api.service';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';
import { BusinessApiService } from '@optimistic-tanuki/business-data-access';
import {
  DepositPaymentRequest,
  EstimateParameters,
  JobRecord,
} from '../models/field-flow.models';
import { FieldFlowSyncService } from './field-flow-sync.service';

const estimateParams: EstimateParameters = {
  servicePackage: 'standard',
  size: 'midsize',
  condition: 'moderate',
  squareFootage: 500,
  tradeType: 'Mobile Detailing',
};

const serverEstimate = {
  estimateId: 'estimate-server-1',
  serviceId: 'standard',
  serviceName: 'Standard Care',
  basePrice: 180,
  conditionMultiplier: 1.2,
  subtotal: 216,
  taxAmount: 15.12,
  depositRequired: 54,
  total: 231.12,
  currency: 'USD',
  expiresAt: '2099-10-01T00:00:00.000Z',
};

const bookingDetails = {
  fullName: 'Marcus Bennett',
  mobilePhone: '+1 912 555 0144',
  emailAddress: 'marcus@example.com',
  streetAddress: '412 Bull Street, Savannah, GA 31401',
  gateCode: '1234',
  serviceNotes: 'Call on arrival',
  selectedDate: '2026-10-01',
  selectedWindow: '8:00 AM - 10:00 AM',
  uploadedPhotoUrls: ['https://cdn.example.com/photo.jpg'],
};

const serverStatus = {
  id: 'status-server-1',
  bookingId: 'booking-server-1',
  trackingCode: 'TRACK-SERVER-1',
  status: 'in_progress',
  customerName: 'Marcus Bennett',
  customerPhone: '+1 912 555 0144',
  serviceName: 'Standard Care',
  serviceAddress: '412 Bull Street, Savannah, GA 31401',
  scheduledDate: '2026-10-01',
  arrivalWindow: '8:00 AM - 10:00 AM',
  depositPaid: true,
  depositAmount: 0,
  totalAmount: 0,
  notes: 'Server note',
  reviewPromptEligible: false,
  googleReviewUrl: 'https://example.com/review/server-1',
  updatedAt: '2026-09-24T12:00:00.000Z',
};

describe('FieldFlowApiService', () => {
  let service: FieldFlowApiService;
  let httpMock: HttpTestingController;
  let syncService: FieldFlowSyncService;
  let brandConfig: BrandConfigService;
  let businessApi: { createBooking: jest.Mock };

  beforeEach(() => {
    businessApi = { createBooking: jest.fn(() => of({ id: 'business-id' })) };

    TestBed.configureTestingModule({
      providers: [
        FieldFlowApiService,
        FieldFlowSyncService,
        BrandConfigService,
        { provide: BusinessApiService, useValue: businessApi },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(FieldFlowApiService);
    httpMock = TestBed.inject(HttpTestingController);
    syncService = TestBed.inject(FieldFlowSyncService);
    brandConfig = TestBed.inject(BrandConfigService);
    brandConfig.resolveBrandProfile('apex-detailing');
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('tenant resolution', () => {
    type TenantApi = {
      initializeTenant: () => {
        subscribe: (observer: {
          next?: (value: unknown) => void;
          error?: (value: unknown) => void;
        }) => void;
      };
      tenantResolutionState: () => string;
      tenantResolutionError: () => string | null;
    };

    it('loads the server-resolved profile before exposing services', () => {
      brandConfig.clearResolvedBrand();
      const resolveProfile = jest.spyOn(brandConfig, 'resolveBrandProfile');
      const tenantApi = service as unknown as TenantApi;
      let resolved: unknown;

      tenantApi.initializeTenant().subscribe((value) => (resolved = value));
      expect(tenantApi.tenantResolutionState()).toBe('loading');
      expect(service.getTenantServices()).toEqual([]);

      const request = httpMock.expectOne('/api/v1/flow/tenant');
      expect(request.request.withCredentials).toBe(true);
      request.flush({
        tenantId: 'coastal-pressure-wash',
        profileId: 'coastal-pressure-wash',
        matchedBy: 'host',
        matchedValue: 'coastal-pressure-wash.local',
      });

      expect(resolveProfile).toHaveBeenCalledWith('coastal-pressure-wash');
      expect(tenantApi.tenantResolutionState()).toBe('resolved');
      expect(tenantApi.tenantResolutionError()).toBeNull();
      expect(
        service.getTenantServices().map((service) => service.id)
      ).toContain('standard');
    });

    it('keeps services unresolved and exposes an error for an invalid tenant response', () => {
      brandConfig.clearResolvedBrand();
      const resolveProfile = jest.spyOn(brandConfig, 'resolveBrandProfile');
      const tenantApi = service as unknown as TenantApi;
      let error: unknown;

      tenantApi.initializeTenant().subscribe({
        error: (value: unknown) => (error = value),
      });
      httpMock
        .expectOne('/api/v1/flow/tenant')
        .flush({ tenantId: '', profileId: 'apex-detailing' });

      expect(error).toBeDefined();
      expect(resolveProfile).not.toHaveBeenCalled();
      expect(tenantApi.tenantResolutionState()).toBe('error');
      expect(tenantApi.tenantResolutionError()).toMatch(/tenant/i);
      expect(service.getTenantServices()).toEqual([]);
    });
  });

  it('requests an estimate without client-authoritative prices', () => {
    let response: typeof serverEstimate | undefined;
    service.dispatchEstimate(estimateParams).subscribe((result) => {
      response = result;
    });

    const request = httpMock.expectOne('/api/v1/flow/estimates');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      serviceId: 'standard',
      servicePackage: 'standard',
      size: 'midsize',
      condition: 'moderate',
      squareFootage: 500,
      tradeType: 'Mobile Detailing',
    });
    request.flush(serverEstimate);

    expect(response).toEqual(serverEstimate);
  });

  it('keeps the pending calculation safe for a missing trade type', () => {
    let calculation: ReturnType<FieldFlowApiService['calculateEstimate']>;
    expect(() => {
      calculation = service.calculateEstimate({
        ...estimateParams,
        tradeType: undefined as unknown as string,
      });
    }).not.toThrow();
    expect(calculation!.isAuthoritative).toBe(false);
  });

  it('does not reuse an estimate when any estimate parameter changes', () => {
    service.dispatchEstimate(estimateParams).subscribe();
    httpMock.expectOne('/api/v1/flow/estimates').flush(serverEstimate);

    expect(service.calculateEstimate(estimateParams).isAuthoritative).toBe(
      true
    );
    const changedParameters: EstimateParameters[] = [
      { ...estimateParams, size: 'large' },
      { ...estimateParams, condition: 'heavy' },
      { ...estimateParams, squareFootage: 900 },
      { ...estimateParams, tradeType: 'Pressure Washing' },
    ];

    for (const parameters of changedParameters) {
      expect(service.calculateEstimate(parameters).isAuthoritative).toBe(false);
    }
  });

  it('clears a stale active estimate before a changed request and on failure', async () => {
    service.dispatchEstimate(estimateParams).subscribe();
    httpMock.expectOne('/api/v1/flow/estimates').flush(serverEstimate);
    expect(service.activeEstimate()?.isAuthoritative).toBe(true);

    const changedParameters: EstimateParameters = {
      ...estimateParams,
      size: 'large',
    };
    let error: unknown;
    service.dispatchEstimate(changedParameters).subscribe({
      error: (value: unknown) => {
        error = value;
      },
    });

    expect(service.activeEstimate()).toBeNull();
    httpMock
      .expectOne('/api/v1/flow/estimates')
      .flush('unavailable', { status: 503, statusText: 'Unavailable' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(error).toBeDefined();
    expect(service.activeEstimate()).toBeNull();
  });

  it('propagates queue persistence errors instead of the original HTTP error', async () => {
    jest
      .spyOn(syncService, 'enqueueOfflineAction')
      .mockRejectedValue(new Error('queue persistence failed'));
    let error: unknown;
    service.dispatchEstimate(estimateParams).subscribe({
      error: (value: unknown) => {
        error = value;
      },
    });

    httpMock
      .expectOne('/api/v1/flow/estimates')
      .flush('unavailable', { status: 503, statusText: 'Unavailable' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('queue persistence failed');
  });

  it.each(['currency', 'expiresAt'] as const)(
    'rejects an estimate response missing %s',
    async (field) => {
      const incompleteResponse = {
        ...serverEstimate,
      } as Record<string, unknown>;
      delete incompleteResponse[field];
      let error: unknown;

      service.dispatchEstimate(estimateParams).subscribe({
        next: () => undefined,
        error: (value: unknown) => {
          error = value;
        },
      });
      httpMock.expectOne('/api/v1/flow/estimates').flush(incompleteResponse);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(error).toBeDefined();
    }
  );

  it.each([
    ['basePrice', undefined],
    ['basePrice', Number.NaN],
    ['conditionMultiplier', undefined],
    ['conditionMultiplier', Number.NaN],
  ] as const)(
    'rejects an estimate response with invalid %s (%p)',
    async (field, value) => {
      const incompleteResponse = {
        ...serverEstimate,
      } as Record<string, unknown>;
      if (value === undefined) {
        delete incompleteResponse[field];
      } else {
        incompleteResponse[field] = value;
      }
      let error: unknown;

      service.dispatchEstimate(estimateParams).subscribe({
        next: () => undefined,
        error: (value: unknown) => {
          error = value;
        },
      });
      httpMock.expectOne('/api/v1/flow/estimates').flush(incompleteResponse);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(error).toBeDefined();
    }
  );

  it.each([400, 401, 403, 409])(
    'does not enqueue estimate request for HTTP %s failures',
    async (status) => {
      let error: unknown;
      service.dispatchEstimate(estimateParams).subscribe({
        error: (value: unknown) => (error = value),
      });

      httpMock
        .expectOne('/api/v1/flow/estimates')
        .flush('rejected', { status, statusText: 'Rejected' });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(error).toBeDefined();
      expect(syncService.pendingSyncCount()).toBe(0);
    }
  );

  it('propagates estimate failures instead of returning a synthetic estimate', async () => {
    let error: unknown;
    service.dispatchEstimate(estimateParams).subscribe({
      next: () => undefined,
      error: (value: unknown) => {
        error = value;
      },
    });

    const request = httpMock.expectOne('/api/v1/flow/estimates');
    request.flush('unavailable', { status: 503, statusText: 'Unavailable' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).toBeDefined();
    expect(syncService.pendingSyncCount()).toBe(1);
  });

  it('does not enqueue malformed successful responses', async () => {
    let error: unknown;
    service.dispatchEstimate(estimateParams).subscribe({
      error: (value: unknown) => (error = value),
    });

    httpMock
      .expectOne('/api/v1/flow/estimates')
      .flush({ ...serverEstimate, total: 'not-a-number' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).toBeDefined();
    expect(syncService.pendingSyncCount()).toBe(0);
  });

  it('creates bookings through the Flow gateway and keeps authority fields out of the payload', () => {
    service.dispatchEstimate(estimateParams).subscribe();
    httpMock.expectOne('/api/v1/flow/estimates').flush(serverEstimate);

    let response: unknown;
    service.createBooking(bookingDetails).subscribe((result) => {
      response = result;
    });

    const request = httpMock.expectOne('/api/v1/flow/bookings');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      estimateId: 'estimate-server-1',
      serviceId: 'standard',
      servicePackage: 'standard',
      customerName: 'Marcus Bennett',
      customerPhone: '+1 912 555 0144',
      customerEmail: 'marcus@example.com',
      serviceAddress: '412 Bull Street, Savannah, GA 31401',
      gateCode: '1234',
      scheduledDate: '2026-10-01',
      arrivalWindow: '8:00 AM - 10:00 AM',
      notes: 'Call on arrival',
      photoUrls: ['https://cdn.example.com/photo.jpg'],
    });

    request.flush({
      bookingId: 'booking-server-1',
      trackingCode: 'TRACK-SERVER-1',
      status: 'scheduled',
      totalAmount: 231.12,
    });

    expect(response).toEqual({
      bookingId: 'booking-server-1',
      trackingCode: 'TRACK-SERVER-1',
      status: 'scheduled',
      totalAmount: 231.12,
    });
    expect(businessApi.createBooking).not.toHaveBeenCalled();
  });

  it('does not use BusinessApiService or synthesize a booking when Flow fails', async () => {
    service.dispatchEstimate(estimateParams).subscribe();
    httpMock.expectOne('/api/v1/flow/estimates').flush(serverEstimate);

    let error: unknown;
    service.createBooking(bookingDetails).subscribe({
      next: () => undefined,
      error: (value: unknown) => {
        error = value;
      },
    });

    httpMock
      .expectOne('/api/v1/flow/bookings')
      .flush('unavailable', { status: 503, statusText: 'Unavailable' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).toBeDefined();
    expect(businessApi.createBooking).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403])(
    'does not enqueue booking request for HTTP %s failures',
    async (status) => {
      service.dispatchEstimate(estimateParams).subscribe();
      httpMock.expectOne('/api/v1/flow/estimates').flush(serverEstimate);

      let error: unknown;
      service.createBooking(bookingDetails).subscribe({
        error: (value: unknown) => (error = value),
      });
      httpMock
        .expectOne('/api/v1/flow/bookings')
        .flush('rejected', { status, statusText: 'Rejected' });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(error).toBeDefined();
      expect(syncService.pendingSyncCount()).toBe(0);
    }
  );

  it('rejects an incomplete server booking response', async () => {
    service.dispatchEstimate(estimateParams).subscribe();
    httpMock.expectOne('/api/v1/flow/estimates').flush(serverEstimate);

    let error: unknown;
    service.createBooking(bookingDetails).subscribe({
      next: () => undefined,
      error: (value: unknown) => {
        error = value;
      },
    });
    httpMock.expectOne('/api/v1/flow/bookings').flush({
      bookingId: 'booking-server-1',
      totalAmount: 231.12,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).toBeDefined();
  });

  it('sends only booking identifiers and an idempotency key for deposits', () => {
    const requestBody = {
      bookingId: 'booking-server-1',
      idempotencyKey: 'deposit-key-1',
    } as DepositPaymentRequest;
    const safeRequestBody = {
      bookingId: 'booking-server-1',
      idempotencyKey: 'deposit-key-1',
    };
    const serverPayment = {
      paymentIntentId: 'pi_server_1',
      clientSecret: 'pi_server_1_secret_1',
      status: 'requires_action',
      amount: 54,
      currency: 'usd',
      bookingId: 'booking-server-1',
      trackingCode: 'TRACK-SERVER-1',
      smsConfirmation: { dispatched: false },
    };

    let response: unknown;
    service.submitDeposit(requestBody).subscribe((result) => {
      response = result;
    });

    const request = httpMock.expectOne('/api/v1/flow/payments/deposit');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(safeRequestBody);
    expect(Object.keys(request.request.body).sort()).toEqual(
      Object.keys(safeRequestBody).sort()
    );
    request.flush(serverPayment);

    expect(response).toEqual({
      paymentIntentId: 'pi_server_1',
      clientSecret: 'pi_server_1_secret_1',
      status: 'requires_action',
      amount: 54,
      currency: 'usd',
      bookingId: 'booking-server-1',
      trackingCode: 'TRACK-SERVER-1',
      smsConfirmation: { dispatched: false },
    });
  });

  it.each([400, 401, 403, 402])(
    'does not enqueue deposit request for HTTP %s failures',
    async (status) => {
      let error: unknown;
      service
        .submitDeposit({
          bookingId: 'booking-server-1',
          idempotencyKey: `deposit-key-${status}`,
        })
        .subscribe({ error: (value: unknown) => (error = value) });
      httpMock
        .expectOne('/api/v1/flow/payments/deposit')
        .flush('rejected', { status, statusText: 'Rejected' });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(error).toBeDefined();
      expect(syncService.pendingSyncCount()).toBe(0);
    }
  );

  it('rejects deposit requests that contain both booking references', () => {
    let error: unknown;
    service
      .submitDeposit({
        bookingId: 'booking-server-1',
        trackingCode: 'TRACK-SERVER-1',
        idempotencyKey: 'deposit-key-both',
      })
      .subscribe({ error: (value: unknown) => (error = value) });

    expect(error).toBeInstanceOf(Error);
    httpMock.expectNone('/api/v1/flow/payments/deposit');
  });

  it('propagates deposit failures without claiming payment or SMS success', async () => {
    let error: unknown;
    let response: unknown;
    const requestBody = {
      trackingCode: 'TRACK-SERVER-1',
      idempotencyKey: 'deposit-key-2',
    } as DepositPaymentRequest;

    service.submitDeposit(requestBody).subscribe({
      next: (value) => {
        response = value;
      },
      error: (value: unknown) => {
        error = value;
      },
    });

    httpMock
      .expectOne('/api/v1/flow/payments/deposit')
      .flush('declined', { status: 402, statusText: 'Payment Required' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).toBeDefined();
    expect(response).toBeUndefined();
  });

  it('maps server status values and preserves server zero amounts', () => {
    let response: JobRecord | undefined;
    service.getJobStatus('booking-server-1').subscribe((result) => {
      response = result;
    });

    const request = httpMock.expectOne('/api/v1/flow/status/booking-server-1');
    expect(request.request.method).toBe('GET');
    request.flush(serverStatus);

    expect(response?.id).toBe('status-server-1');
    expect(response?.trackingNumber).toBe('TRACK-SERVER-1');
    expect(response?.totalPrice).toBe(0);
    expect(response?.depositPaid).toBe(0);
    expect(response?.customerPhone).toBe('+1 912 555 0144');
    expect(response?.technicianNotes).toBe('Server note');
  });

  it('leaves trackingNumber unset instead of substituting the booking id', () => {
    const withoutTracking = { ...serverStatus };
    delete (withoutTracking as Record<string, unknown>)['trackingCode'];
    let response: JobRecord | undefined;
    service.getJobStatus('booking-server-1').subscribe((result) => {
      response = result;
    });

    const request = httpMock.expectOne('/api/v1/flow/status/booking-server-1');
    request.flush(withoutTracking);

    expect(response?.id).toBe('status-server-1');
    expect(response?.trackingNumber).toBeUndefined();
  });

  it('caches successful status and preserves review eligibility', async () => {
    let response: JobRecord | undefined;
    service.getJobStatus('booking-server-1').subscribe((result) => {
      response = result;
    });
    httpMock
      .expectOne('/api/v1/flow/status/booking-server-1')
      .flush(serverStatus);
    await Promise.resolve();

    expect(
      (response as unknown as { reviewPromptEligible?: boolean })
        ?.reviewPromptEligible
    ).toBe(false);
    await expect(
      syncService.getCachedAppointment('status-server-1')
    ).resolves.toEqual(response);
  });

  it.each([
    'id',
    'bookingId',
    'status',
    'customerName',
    'serviceName',
    'serviceAddress',
    'scheduledDate',
    'arrivalWindow',
    'depositPaid',
    'totalAmount',
    'reviewPromptEligible',
    'updatedAt',
  ] as const)('rejects a status response missing %s', async (field) => {
    const incompleteResponse = {
      ...serverStatus,
    } as Record<string, unknown>;
    delete incompleteResponse[field];
    let error: unknown;

    service.getJobStatus('booking-server-1').subscribe({
      next: () => undefined,
      error: (value: unknown) => {
        error = value;
      },
    });
    httpMock
      .expectOne('/api/v1/flow/status/booking-server-1')
      .flush(incompleteResponse);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).toBeDefined();
  });

  it('propagates status errors online and never fabricates a demo job', () => {
    let error: unknown;
    let response: unknown;
    service.getJobStatus('missing-server-job').subscribe({
      next: (value) => {
        response = value;
      },
      error: (value: unknown) => {
        error = value;
      },
    });

    httpMock
      .expectOne('/api/v1/flow/status/missing-server-job')
      .flush('not found', { status: 404, statusText: 'Not Found' });

    expect(error).toBeDefined();
    expect(response).toBeUndefined();
  });

  it('caches status under the requested booking ID for offline lookup', async () => {
    service.getJobStatus('booking-server-1').subscribe();
    httpMock
      .expectOne('/api/v1/flow/status/booking-server-1')
      .flush(serverStatus);
    await Promise.resolve();

    syncService.isOnline.set(false);
    let cachedResponse: JobRecord | undefined;
    service
      .getJobStatus('booking-server-1', { offline: true })
      .subscribe((result) => (cachedResponse = result));

    await Promise.resolve();
    expect(cachedResponse?.trackingNumber).toBe('TRACK-SERVER-1');
    httpMock.expectNone('/api/v1/flow/status/booking-server-1');
  });

  it('uses a cached appointment only when explicitly offline', async () => {
    const cached: JobRecord = {
      id: 'cached-job-1',
      trackingNumber: 'TRACK-CACHED-1',
      customerName: 'Cached Customer',
      customerPhone: '+1 912 555 0100',
      streetAddress: '1 Cached Way',
      servicePackageName: 'Standard Care',
      scheduledDate: '2026-10-02',
      arrivalWindow: '10:00 AM - 12:00 PM',
      totalPrice: 101,
      depositPaid: 0,
      balanceRemaining: 101,
      status: 'scheduled',
    };
    await syncService.cacheAppointment(cached);
    syncService.isOnline.set(false);

    let response: JobRecord | undefined;
    const getStatus = service.getJobStatus as unknown as (
      id: string,
      options: { offline: boolean }
    ) => ReturnType<FieldFlowApiService['getJobStatus']>;
    getStatus
      .call(service, 'cached-job-1', { offline: true })
      .subscribe((result) => {
        response = result;
      });

    await Promise.resolve();
    httpMock.expectNone('/api/v1/flow/status/cached-job-1');
    expect(response).toEqual(cached);
  });

  it('loads availability from the Flow endpoint', () => {
    const getAvailability = (
      service as unknown as {
        getAvailability: (query: Record<string, string>) => {
          subscribe: (observer: (value: unknown) => void) => void;
        };
      }
    ).getAvailability;
    let response: unknown;
    getAvailability
      .call(service, {
        serviceId: 'standard',
        date: '2026-10-01',
        size: 'midsize',
        condition: 'moderate',
      })
      .subscribe((value) => (response = value));

    const request = httpMock.expectOne(
      '/api/v1/flow/availability?serviceId=standard&date=2026-10-01&size=midsize&condition=moderate'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      date: '2026-10-01',
      windows: [
        { id: 'w1', timeSlot: '8:00 AM - 10:00 AM', available: true },
        { id: 'w2', timeSlot: '10:00 AM - 12:00 PM', available: false },
      ],
    });

    expect(response).toEqual({
      date: '2026-10-01',
      windows: [
        { id: 'w1', timeSlot: '8:00 AM - 10:00 AM', available: true },
        { id: 'w2', timeSlot: '10:00 AM - 12:00 PM', available: false },
      ],
    });
  });

  it('keeps the service catalog available without treating it as a quote', () => {
    expect(service.getTenantServices().map((service) => service.id)).toContain(
      'standard'
    );
  });
});
