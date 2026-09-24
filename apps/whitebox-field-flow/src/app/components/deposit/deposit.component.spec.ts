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
    fixture.detectChanges();
  });

  it('renders Stripe Elements secure checkout container cleanly', () => {
    expect(component).toBeTruthy();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Stripe secure checkout');
    expect(element.textContent).toContain('256-bit SSL encrypted');
  });

  it('validates card inputs before submission', () => {
    component.cardholderName = '';
    component.processPayment();
    expect(component.formError).toContain('name printed on the card');

    component.cardholderName = 'John Miller';
    component.cardNumber = '123';
    component.processPayment();
    expect(component.formError).toContain('credit card number');
  });

  it('completes deposit and displays Twilio automated SMS confirmation', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    component.cardholderName = 'John Miller';
    component.cardNumber = '4242 4242 4242 4242';
    component.expiryDate = '12/28';
    component.cvc = '123';

    component.processPayment();

    const req = httpMock.expectOne('/api/v1/flow/payments/deposit');
    req.flush({
      paymentId: 'pi_test_123',
      status: 'succeeded',
      bookingId: 'FLW-7788',
      receiptNumber: 'REC-998877',
      smsNotificationSent: true,
      smsNotificationRecipient: '(912) 555-0184',
      amount: 50,
    });

    fixture.detectChanges();

    expect(component.paymentSuccess).toBe(true);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Automated dispatch SMS sent');
    expect(element.textContent).toContain('Track job status');
  });

  it('never uses slice or whitebox in client copy', () => {
    const text = fixture.nativeElement.textContent?.toLowerCase() || '';
    expect(text).not.toContain('slice');
    expect(text).not.toContain('whitebox');
  });
});
