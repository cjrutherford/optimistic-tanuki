import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FinanceService } from './finance.service';

describe('FinanceService financial utilities', () => {
  let service: FinanceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FinanceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists business invoices through the finance API workspace query', async () => {
    const promise = service.getInvoices('business');

    const request = http.expectOne('/api/finance/invoices?workspace=business');
    expect(request.request.method).toBe('GET');
    request.flush([]);

    await expect(promise).resolves.toEqual([]);
  });

  it('creates checkout sessions through the finance API', async () => {
    const promise = service.createCheckoutSession({
      amount: 250,
      currency: 'USD',
      customerName: 'Acme Bakery',
      workspace: 'business',
    });

    const request = http.expectOne('/api/finance/checkout-sessions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(
      expect.objectContaining({
        amount: 250,
        customerName: 'Acme Bakery',
      })
    );
    request.flush({ id: 'checkout-1', status: 'pending_provider' });

    await expect(promise).resolves.toEqual(
      expect.objectContaining({ id: 'checkout-1' })
    );
  });
});
