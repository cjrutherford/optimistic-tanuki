import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessAuthService,
} from '@optimistic-tanuki/business-data-access';

import { BusinessOwnerProductsPageComponent } from './business-owner-products-page.component';

describe('BusinessOwnerProductsPageComponent', () => {
  const getOwnerProducts = jest.fn();
  const getStoreProducts = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getOwnerProducts.mockReturnValue(
      of([
        {
          id: 'product-1',
          name: 'Discovery Session',
          description: 'Owner-scoped service product.',
          price: 125,
          type: 'service',
          active: true,
          stock: 0,
          ownerId: 'owner-user-1',
        },
      ])
    );
    getStoreProducts.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      imports: [BusinessOwnerProductsPageComponent],
      providers: [
        {
          provide: BusinessApiService,
          useValue: {
            getOwnerProducts,
            getStoreProducts,
          },
        },
        {
          provide: BusinessAuthService,
          useValue: {
            user: signal({ userId: 'owner-user-1', profileId: 'profile-1' }),
          },
        },
      ],
    });
  });

  it('loads owner-scoped products for the signed-in owner', () => {
    const fixture = TestBed.createComponent(BusinessOwnerProductsPageComponent);
    fixture.detectChanges();

    expect(getOwnerProducts).toHaveBeenCalledWith('owner-user-1');
    expect(getStoreProducts).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Discovery Session');
  });
});
