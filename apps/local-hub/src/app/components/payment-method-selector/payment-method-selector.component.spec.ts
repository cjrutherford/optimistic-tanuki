import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  PaymentMethodSelectorComponent,
  PaymentRequest,
} from './payment-method-selector.component';
import { PaymentService } from '../../services/payment.service';

describe('PaymentMethodSelectorComponent', () => {
  let fixture: ComponentFixture<PaymentMethodSelectorComponent>;
  let component: PaymentMethodSelectorComponent;
  const paymentService = {
    createClassifiedPayment: jest.fn(),
    confirmOutOfPlatformPayment: jest.fn(),
  };
  const request: PaymentRequest = {
    classifiedId: 'classified-1',
    sellerId: 'seller-1',
    amount: 150,
    title: 'Vintage Bike',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [PaymentMethodSelectorComponent],
      providers: [{ provide: PaymentService, useValue: paymentService }],
    });
    fixture = TestBed.createComponent(PaymentMethodSelectorComponent);
    component = fixture.componentInstance;
    component.request = request;
    fixture.detectChanges();
  });

  it('maps every method to a human-readable name', () => {
    expect(component.getMethodName('card')).toBe('Card');
    expect(component.getMethodName('cash-app')).toBe('Cash App');
    expect(component.getMethodName('venmo')).toBe('Venmo');
    expect(component.getMethodName('zelle')).toBe('Zelle');
    expect(component.getMethodName('cash')).toBe('Cash');
  });

  it('selects a payment method', () => {
    component.selectMethod('venmo');
    expect(component.selectedMethod()).toBe('venmo');
  });

  it('does nothing when proceeding without a selected method', async () => {
    await component.proceed();
    expect(paymentService.createClassifiedPayment).not.toHaveBeenCalled();
  });

  it('redirects to checkout for card payments', async () => {
    delete (window as any).location;
    (window as any).location = { href: '' };
    paymentService.createClassifiedPayment.mockResolvedValue({
      id: 'payment-1',
      paymentMethod: 'card',
      checkoutUrl: 'https://pay.example.com/checkout',
    });

    component.selectMethod('card');
    await component.proceed();

    expect(window.location.href).toBe('https://pay.example.com/checkout');
    expect(component.processing()).toBe(false);
  });

  it('logs an error when card checkout is not configured', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    paymentService.createClassifiedPayment.mockResolvedValue({
      id: 'payment-1',
      paymentMethod: 'card',
      checkoutUrl: undefined,
    });

    component.selectMethod('card');
    await component.proceed();

    expect(consoleError).toHaveBeenCalled();
    expect(component.processing()).toBe(false);
    consoleError.mockRestore();
  });

  it('moves to the out-of-platform step for non-card methods', async () => {
    component.selectMethod('venmo');
    await component.proceed();
    expect(component.step()).toBe('out-of-platform');
  });

  it('reads a selected proof file as a data URL', async () => {
    const file = new File(['proof'], 'proof.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    const loaded = new Promise<void>((resolve) => {
      const check = () => {
        if (component.proofImage()) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });

    component.onProofSelected({ target: input } as unknown as Event);
    await loaded;

    expect(component.proofImage()).toContain('data:image/png;base64');
  });

  it('does nothing when the file input has no file', () => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [] });
    component.onProofSelected({ target: input } as unknown as Event);
    expect(component.proofImage()).toBeNull();
  });

  it('confirms an out-of-platform payment without proof and moves to success', async () => {
    const payment = { id: 'payment-2' };
    paymentService.createClassifiedPayment.mockResolvedValue(payment);
    component.selectMethod('cash');

    await component.confirmPayment();

    expect(paymentService.confirmOutOfPlatformPayment).not.toHaveBeenCalled();
    expect(component.step()).toBe('success');
    expect(component.payment()).toBe(payment);
    expect(component.processing()).toBe(false);
  });

  it('uploads proof when confirming payment if one was captured', async () => {
    const payment = { id: 'payment-3' };
    paymentService.createClassifiedPayment.mockResolvedValue(payment);
    component.selectMethod('zelle');
    component.proofImage.set('data:image/png;base64,AAA');

    await component.confirmPayment();

    expect(paymentService.confirmOutOfPlatformPayment).toHaveBeenCalledWith(
      'payment-3',
      'data:image/png;base64,AAA'
    );
    expect(component.step()).toBe('success');
  });

  it('does nothing when confirming without a request or method', async () => {
    component.request = null;
    await component.confirmPayment();
    expect(paymentService.createClassifiedPayment).not.toHaveBeenCalled();
  });

  it('logs an error and stops processing when confirmation fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    paymentService.createClassifiedPayment.mockRejectedValue(
      new Error('failed')
    );
    component.selectMethod('cash');

    await component.confirmPayment();

    expect(component.processing()).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('emits complete and cancel events', () => {
    const completeSpy = jest.spyOn(component.complete, 'emit');
    const cancelSpy = jest.spyOn(component.cancel, 'emit');
    const payment = { id: 'payment-4' } as any;

    component.payment.set(payment);
    component.complete.emit(payment);
    component.cancel.emit();

    expect(completeSpy).toHaveBeenCalledWith(payment);
    expect(cancelSpy).toHaveBeenCalled();
  });
});
