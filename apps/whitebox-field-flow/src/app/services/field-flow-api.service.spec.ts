import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  FieldFlowApiService,
  SERVICE_PACKAGES,
} from './field-flow-api.service';
import { BrandConfigService } from './brand-config.service';
import { EstimateParameters } from '../models/field-flow.models';

describe('FieldFlowApiService', () => {
  let service: FieldFlowApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FieldFlowApiService,
        BrandConfigService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(FieldFlowApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('calculates real-time quote for standard package with midsize and moderate condition', () => {
    const params: EstimateParameters = {
      servicePackage: 'standard',
      size: 'midsize', // 120 * 1.25 = 150
      condition: 'moderate', // + 35 = 185
      squareFootage: 500, // + 0 = 185
      tradeType: 'Mobile Detailing',
    };

    const calc = service.calculateEstimate(params);
    expect(calc.subtotal).toBe(185);
    expect(calc.taxAmount).toBe(12.95); // 185 * 0.07 = 12.95
    expect(calc.total).toBe(197.95);
    expect(calc.depositAmount).toBe(50);
  });

  it('calculates real-time quote with square footage adder', () => {
    const params: EstimateParameters = {
      servicePackage: 'premium', // 220
      size: 'compact', // 220 * 1.0 = 220
      condition: 'light', // + 0 = 220
      squareFootage: 1000, // (1000 - 500) * 0.20 = 100 => 320
      tradeType: 'Pressure Washing',
    };

    const calc = service.calculateEstimate(params);
    expect(calc.subtotal).toBe(320);
    expect(calc.total).toBe(342.4); // 320 + 22.40
  });

  it('dispatches estimate to gateway /api/v1/flow/estimates', () => {
    const params: EstimateParameters = {
      servicePackage: 'standard',
      size: 'compact',
      condition: 'light',
      tradeType: 'General',
    };
    const calc = service.calculateEstimate(params);

    service.dispatchEstimate(params, calc).subscribe((res) => {
      expect(res.estimateId).toBe('est_123');
    });

    const req = httpMock.expectOne('/api/v1/flow/estimates');
    expect(req.request.method).toBe('POST');
    req.flush({ estimateId: 'est_123' });
  });

  it('creates booking dispatch to gateway /api/v1/flow/bookings', () => {
    service
      .createBooking({
        fullName: 'Marcus Bennett',
        mobilePhone: '(912) 555-0144',
        streetAddress: '412 Bull St, Savannah, GA',
        selectedDate: '2026-10-01',
        selectedWindow: '8:00 AM - 10:00 AM',
        uploadedPhotoUrls: [],
      })
      .subscribe((res) => {
        expect(res.bookingId).toBe('FLW-5555');
      });

    const req = httpMock.expectOne('/api/v1/flow/bookings');
    expect(req.request.method).toBe('POST');
    req.flush({ bookingId: 'FLW-5555' });
  });

  it('processes deposit and returns automated SMS confirmation', () => {
    service
      .submitDeposit({
        bookingId: 'FLW-7788',
        amount: 50,
        currency: 'USD',
        cardholderName: 'Marcus Bennett',
        cardNumberMasked: '•••• •••• •••• 4242',
        expiration: '12/28',
      })
      .subscribe((res) => {
        expect(res.status).toBe('succeeded');
        expect(res.smsNotificationSent).toBe(true);
        expect(res.bookingId).toBe('FLW-7788');
      });

    const req = httpMock.expectOne('/api/v1/flow/payments/deposit');
    expect(req.request.method).toBe('POST');
    req.flush({
      paymentId: 'pi_test_123',
      status: 'succeeded',
      bookingId: 'FLW-7788',
      receiptNumber: 'REC-998877',
      smsNotificationSent: true,
      smsNotificationRecipient: '(912) 555-0184',
      amount: 50,
    });
  });
});
