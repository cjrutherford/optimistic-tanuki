import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BookComponent } from './book.component';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';

describe('BookComponent', () => {
  const createAuthoritativeEstimate = (
    estimateId = 'estimate-availability'
  ) => ({
    estimateId,
    serviceId: 'standard',
    serviceName: 'Standard Care',
    subtotal: 100,
    taxAmount: 0,
    total: 100,
    depositAmount: 25,
    taxRate: 0,
    packageDetails: {
      id: 'standard',
      name: 'Standard Care',
      description: '',
      basePrice: 0,
      durationHours: 1,
      features: [],
    },
    currency: 'USD',
    expiresAt: '2099-10-01T00:00:00.000Z',
    isAuthoritative: true,
  });
  let component: BookComponent;
  let fixture: ComponentFixture<BookComponent>;
  let apiService: FieldFlowApiService;
  let httpMock: HttpTestingController;
  let navigateSpy: jest.SpyInstance;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        FieldFlowApiService,
        BrandConfigService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BookComponent);
    component = fixture.componentInstance;
    apiService = TestBed.inject(FieldFlowApiService);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('/api/authentication/session').flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('does not synthesize an estimate or availability before a server estimate', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(apiService.activeEstimate()).toBeNull();
    expect(component.arrivalWindows).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Loading availability');
    httpMock.expectNone('/api/v1/flow/availability');
  });

  it('rejects a missing authoritative estimate before creating a booking', () => {
    component.fullName = 'John Miller';
    component.mobilePhone = '+1 912 555 0144';
    component.streetAddress = '412 Bull Street';

    component.submitBooking();

    expect(component.formError).toContain('authoritative estimate');
    httpMock.expectNone('/api/v1/flow/bookings');
  });

  it('rejects an expired authoritative estimate before creating a booking', () => {
    apiService.activeEstimate.set({
      estimateId: 'expired-estimate',
      serviceId: 'standard',
      serviceName: 'Standard Care',
      subtotal: 100,
      taxAmount: 0,
      total: 100,
      depositAmount: 25,
      taxRate: 0,
      packageDetails: {
        id: 'standard',
        name: 'Standard Care',
        description: '',
        basePrice: 0,
        durationHours: 1,
        features: [],
      },
      currency: 'USD',
      expiresAt: '2020-01-01T00:00:00.000Z',
      isAuthoritative: true,
    });
    component.fullName = 'John Miller';
    component.mobilePhone = '+1 912 555 0144';
    component.streetAddress = '412 Bull Street';

    component.submitBooking();

    expect(component.formError).toContain('expired');
    httpMock.expectNone('/api/v1/flow/bookings');
  });

  it('loads availability and disables unavailable windows', () => {
    apiService.activeEstimate.set({
      estimateId: 'estimate-availability',
      serviceId: 'standard',
      serviceName: 'Standard Care',
      subtotal: 100,
      taxAmount: 0,
      total: 100,
      depositAmount: 25,
      taxRate: 0,
      packageDetails: {
        id: 'standard',
        name: 'Standard Care',
        description: '',
        basePrice: 0,
        durationHours: 1,
        features: [],
      },
      currency: 'USD',
      expiresAt: '2099-10-01T00:00:00.000Z',
      isAuthoritative: true,
    });
    component.selectedDate = '2099-10-01';
    const loadAvailability = (
      component as unknown as { loadAvailability: () => void }
    ).loadAvailability;

    loadAvailability.call(component);
    const request = httpMock.expectOne(
      '/api/v1/flow/availability?serviceId=standard&date=2099-10-01'
    );
    request.flush({
      date: '2099-10-01',
      windows: [
        { id: 'w1', timeSlot: '8:00 AM - 10:00 AM', available: true },
        { id: 'w2', timeSlot: '10:00 AM - 12:00 PM', available: false },
      ],
    });
    fixture.detectChanges();

    expect(component.arrivalWindows).toHaveLength(2);
    expect(component.arrivalWindows[1].available).toBe(false);
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.window-btn')
    ) as HTMLButtonElement[];
    expect(buttons[0].disabled).toBe(false);
    expect(buttons[1].disabled).toBe(true);
  });

  it('ignores an availability response for a date that is no longer selected', () => {
    apiService.activeEstimate.set(createAuthoritativeEstimate());
    component.selectedDate = '2099-10-01';
    component.loadAvailability();
    const firstRequest = httpMock.expectOne(
      '/api/v1/flow/availability?serviceId=standard&date=2099-10-01'
    );

    component.selectedDate = '2099-10-02';
    component.loadAvailability();
    const secondRequest = httpMock.expectOne(
      '/api/v1/flow/availability?serviceId=standard&date=2099-10-02'
    );

    secondRequest.flush({
      date: '2099-10-02',
      windows: [{ id: 'w2', timeSlot: '10:00 AM - 12:00 PM', available: true }],
    });
    fixture.detectChanges();
    firstRequest.flush({
      date: '2099-10-01',
      windows: [{ id: 'w1', timeSlot: '8:00 AM - 10:00 AM', available: true }],
    });
    fixture.detectChanges();

    expect(component.arrivalWindows).toEqual([
      { id: 'w2', timeSlot: '10:00 AM - 12:00 PM', available: true },
    ]);
    expect(component.selectedWindow).toBe('10:00 AM - 12:00 PM');
  });

  it('shows an explicit empty state when no arrival windows are available', () => {
    apiService.activeEstimate.set(createAuthoritativeEstimate());
    component.selectedDate = '2099-10-01';
    component.loadAvailability();
    const request = httpMock.expectOne(
      '/api/v1/flow/availability?serviceId=standard&date=2099-10-01'
    );

    request.flush({ date: '2099-10-01', windows: [] });
    fixture.detectChanges();

    expect(component.availabilityError).toBe('');
    expect(fixture.nativeElement.textContent).toContain(
      'No arrival windows are available for this date.'
    );
  });

  it('shows an explicit empty state when every arrival window is unavailable', () => {
    apiService.activeEstimate.set(createAuthoritativeEstimate());
    component.selectedDate = '2099-10-01';
    component.loadAvailability();
    const request = httpMock.expectOne(
      '/api/v1/flow/availability?serviceId=standard&date=2099-10-01'
    );

    request.flush({
      date: '2099-10-01',
      windows: [{ id: 'w1', timeSlot: '8:00 AM - 10:00 AM', available: false }],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No arrival windows are available for this date.'
    );
  });

  it('keeps the server booking reference and prevents duplicate submissions', () => {
    apiService.activeEstimate.set({
      estimateId: 'estimate-booking',
      serviceId: 'standard',
      serviceName: 'Standard Care',
      subtotal: 100,
      taxAmount: 0,
      total: 100,
      depositAmount: 25,
      taxRate: 0,
      packageDetails: {
        id: 'standard',
        name: 'Standard Care',
        description: '',
        basePrice: 0,
        durationHours: 1,
        features: [],
      },
      currency: 'USD',
      expiresAt: '2099-10-01T00:00:00.000Z',
      isAuthoritative: true,
    });
    component.fullName = 'John Miller';
    component.emailAddress = 'john@example.com';
    component.mobilePhone = '+1 912 555 0144';
    component.streetAddress = '412 Bull Street';
    component.selectedDate = '2099-10-01';
    component.selectedWindow = '8:00 AM - 10:00 AM';

    component.submitBooking();
    component.submitBooking();
    const request = httpMock.expectOne('/api/v1/flow/bookings');
    request.flush({
      bookingId: 'booking-server-1',
      trackingCode: 'TRACK-SERVER-1',
      status: 'scheduled',
    });

    expect(apiService.activeBooking()?.bookingId).toBe('booking-server-1');
    expect(apiService.activeBooking()?.trackingCode).toBe('TRACK-SERVER-1');
  });

  it('validates customer form input before advancing', () => {
    apiService.activeEstimate.set({
      estimateId: 'estimate-form-validation',
      serviceId: 'standard',
      serviceName: 'Standard Care',
      subtotal: 200,
      taxAmount: 0,
      total: 200,
      depositAmount: 50,
      taxRate: 0,
      packageDetails: {
        id: 'standard',
        name: 'Standard Care',
        description: '',
        basePrice: 0,
        durationHours: 1,
        features: [],
      },
      currency: 'USD',
      expiresAt: '2099-10-01T00:00:00.000Z',
      isAuthoritative: true,
    });
    component.selectedWindow = '8:00 AM - 10:00 AM';
    component.fullName = '';
    component.submitBooking();
    expect(component.formError).toContain('full name');

    component.fullName = 'John Miller';
    component.mobilePhone = '';
    component.submitBooking();
    expect(component.formError).toContain('mobile phone');
  });

  it('stays on the booking step and shows an error when booking fails', async () => {
    apiService.activeEstimate.set({
      estimateId: 'estimate-1',
      serviceId: 'standard',
      serviceName: 'Standard Care',
      subtotal: 200,
      taxAmount: 0,
      total: 200,
      depositAmount: 50,
      taxRate: 0,
      packageDetails: {
        id: 'standard',
        name: 'Standard Care',
        description: '',
        basePrice: 0,
        durationHours: 1,
        features: [],
      },
      currency: 'USD',
      expiresAt: '2026-10-01T00:00:00.000Z',
      isAuthoritative: true,
    });
    component.fullName = 'John Miller';
    component.emailAddress = 'john@example.com';
    component.mobilePhone = '+1 912 555 0144';
    component.streetAddress = '412 Bull Street';
    component.selectedWindow = '8:00 AM - 10:00 AM';

    component.submitBooking();
    const request = httpMock.expectOne('/api/v1/flow/bookings');

    request.flush('unavailable', {
      status: 503,
      statusText: 'Unavailable',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.formError).toContain('Unable to create booking');
    expect(fixture.nativeElement.textContent).toContain(
      'Unable to create booking'
    );
  });

  it('does not display non-authoritative estimate values in the booking summary', () => {
    apiService.activeEstimate.set({
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      depositAmount: 0,
      taxRate: 0,
      packageDetails: {
        id: 'standard',
        name: 'Standard Care',
        description: '',
        basePrice: 0,
        durationHours: 1,
        features: [],
      },
      isAuthoritative: false,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('$0.00');
  });

  it('never uses slice or whitebox in client copy', () => {
    const text = fixture.nativeElement.textContent?.toLowerCase() || '';
    expect(text).not.toContain('slice');
    expect(text).not.toContain('whitebox');
  });
});
