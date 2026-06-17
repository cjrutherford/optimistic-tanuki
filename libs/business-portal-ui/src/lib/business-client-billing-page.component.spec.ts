import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessAuthService,
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
} from '@optimistic-tanuki/business-data-access';

import { BusinessClientBillingPageComponent } from './business-client-billing-page.component';

describe('BusinessClientBillingPageComponent', () => {
  async function render(allowOnlinePayment: boolean) {
    const payClientInvoice = jest
      .fn()
      .mockReturnValue(of({ id: 'invoice-1', status: 'paid' }));
    const api = {
      getClientBookings: jest.fn().mockReturnValue(of([])),
      getClientInvoices: jest.fn().mockReturnValue(
        of([
          {
            id: 'invoice-1',
            appointmentId: 'booking-1',
            userId: 'client-1',
            invoiceNumber: 'INV-100',
            amount: 180,
            currency: 'USD',
            status: 'unpaid',
            createdAt: '2026-05-07T00:00:00.000Z',
            updatedAt: '2026-05-07T00:00:00.000Z',
          },
        ])
      ),
      payClientInvoice,
    };

    await TestBed.configureTestingModule({
      imports: [BusinessClientBillingPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug: 'steady-hand-contracting',
              }),
            },
          },
        },
        {
          provide: BusinessApiService,
          useValue: api,
        },
        {
          provide: BusinessAuthService,
          useValue: {
            clientUser: signal({
              userId: 'client-1',
              profileId: 'profile-1',
              email: 'client@example.com',
            }).asReadonly(),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: signal({
              ...DEFAULT_BUSINESS_SITE_CONFIG,
              features: {
                ...DEFAULT_BUSINESS_SITE_CONFIG.features,
                invoices: { enabled: true },
                booking: {
                  ...DEFAULT_BUSINESS_SITE_CONFIG.features.booking,
                  allowOnlinePayment,
                },
              },
            }).asReadonly(),
            fetch: jest.fn().mockReturnValue(of(DEFAULT_BUSINESS_SITE_CONFIG)),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessClientBillingPageComponent);
    fixture.detectChanges();

    return { fixture, payClientInvoice, api };
  }

  it('shows a pay action only when online payment is enabled', async () => {
    const { fixture } = await render(true);
    expect(fixture.nativeElement.textContent).toContain('Pay now');
  });

  it('hides the pay action when online payment is disabled', async () => {
    const { fixture } = await render(false);
    expect(fixture.nativeElement.textContent).not.toContain('Pay now');
  });

  it('uses the hosted tenant slug for bookings, invoices, and payments', async () => {
    const { fixture, api, payClientInvoice } = await render(true);
    const component = fixture.componentInstance;

    component.payInvoice('invoice-1');

    expect(api.getClientBookings).toHaveBeenCalledWith(
      'steady-hand-contracting'
    );
    expect(api.getClientInvoices).toHaveBeenCalledWith(
      'steady-hand-contracting'
    );
    expect(payClientInvoice).toHaveBeenCalledWith(
      'invoice-1',
      'steady-hand-contracting'
    );
  });
});
