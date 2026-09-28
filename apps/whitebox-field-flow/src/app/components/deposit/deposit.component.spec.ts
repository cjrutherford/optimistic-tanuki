import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { DepositComponent } from './deposit.component';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';

describe('DepositComponent', () => {
  let component: DepositComponent;
  let fixture: ComponentFixture<DepositComponent>;
  let apiService: FieldFlowApiService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepositComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        FieldFlowApiService,
        BrandConfigService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DepositComponent);
    component = fixture.componentInstance;
    apiService = TestBed.inject(FieldFlowApiService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('does not expose raw card fields', () => {
    expect(Object.prototype.hasOwnProperty.call(component, 'cardNumber')).toBe(
      false
    );
    expect(Object.prototype.hasOwnProperty.call(component, 'cvc')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(component, 'expiryDate')).toBe(
      false
    );
  });

  it('invokes the deposit API with one server booking reference and keeps Stripe unavailable', async () => {
    apiService.activeBooking.set({
      fullName: 'John Miller',
      mobilePhone: '+1 912 555 0144',
      streetAddress: '412 Bull Street',
      selectedDate: '2099-10-01',
      selectedWindow: '8:00 AM - 10:00 AM',
      uploadedPhotoUrls: [],
      bookingId: 'booking-server-1',
      trackingCode: 'TRACK-SERVER-1',
    });
    apiService.activeEstimate.set({
      estimateId: 'estimate-server-1',
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
    fixture.detectChanges();

    component.processPayment();
    const request = httpMock.expectOne('/api/v1/flow/payments/deposit');
    expect(request.request.body).toEqual({
      bookingId: 'booking-server-1',
      idempotencyKey: expect.any(String),
    });
    request.flush({
      paymentIntentId: 'pi-server-1',
      status: 'requires_payment_method',
      amount: 25,
      currency: 'USD',
      bookingId: 'booking-server-1',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(component.paymentSuccess).toBe(false);
    expect(component.formError).toContain('not available yet');
  });

  it('never uses slice or whitebox in client copy', () => {
    const text = fixture.nativeElement.textContent?.toLowerCase() || '';
    expect(text).not.toContain('slice');
    expect(text).not.toContain('whitebox');
  });
});
