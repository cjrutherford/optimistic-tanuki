import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DonationsComponent } from './donations.component';
import { StoreService } from '../../services/store.service';
import type { DonationRequest } from '@optimistic-tanuki/store-ui';

describe('DonationsComponent', () => {
  let store: { createDonation: jest.Mock };

  const build = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: StoreService, useValue: store }],
    });

    return TestBed.runInInjectionContext(
      () => new DonationsComponent(store as unknown as StoreService)
    );
  };

  const donation = (overrides: Partial<DonationRequest> = {}) =>
    ({
      amount: 25,
      message: 'keep going',
      anonymous: false,
      ...overrides,
    } as DonationRequest);

  beforeEach(() => {
    store = { createDonation: jest.fn().mockReturnValue(of({ id: 'don-1' })) };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('converts the dollar amount to integer cents', () => {
    const component = build();

    component.onDonate(donation({ amount: 25 }));

    expect(store.createDonation).toHaveBeenCalledWith({
      amountCents: 2500,
      message: 'keep going',
      anonymous: false,
    });
  });

  it('rounds a fractional amount rather than truncating it', () => {
    const component = build();

    // 19.99 * 100 is 1998.9999... in binary floating point.
    component.onDonate(donation({ amount: 19.99 }));

    expect(store.createDonation).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 1999 })
    );
  });

  it('thanks the donor with the amount they entered', () => {
    const component = build();

    component.onDonate(donation({ amount: 5 }));

    expect(component.success).toBe('Thank you for your donation of $5.00!');
    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
  });

  it('passes an anonymous donation through as anonymous', () => {
    const component = build();

    component.onDonate(donation({ anonymous: true }));

    expect(store.createDonation).toHaveBeenCalledWith(
      expect.objectContaining({ anonymous: true })
    );
  });

  it('reports a failure without claiming success', () => {
    const component = build();
    store.createDonation.mockReturnValue(throwError(() => new Error('card')));

    component.onDonate(donation());

    expect(component.error).toBe(
      'Failed to process donation. Please try again.'
    );
    expect(component.success).toBeNull();
    expect(component.loading).toBe(false);
  });

  it('clears a previous error when a new donation starts', () => {
    const component = build();
    component.error = 'stale';
    component.success = 'stale';

    component.onDonate(donation());

    expect(component.error).toBeNull();
  });
});
