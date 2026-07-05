import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { OrderManagementComponent } from './order-management.component';
import { StoreService } from '../services/store.service';

describe('OrderManagementComponent', () => {
  const storeService = {
    getOrders: jest.fn(),
    updateOrder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    storeService.getOrders.mockReturnValue(
      of([
        {
          id: 'order-1',
          userId: 'user-1',
          status: 'pending',
          total: 75,
          currency: 'USD',
          items: [
            {
              id: 'item-1',
              orderId: 'order-1',
              productId: 'product-1',
              quantity: 2,
              price: 37.5,
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    );
    storeService.updateOrder.mockReturnValue(of({ id: 'order-1' }));

    await TestBed.configureTestingModule({
      imports: [OrderManagementComponent],
      providers: [
        provideRouter([]),
        { provide: StoreService, useValue: storeService },
      ],
    }).compileComponents();
  });

  it('renders orders through the shared ag-grid table', () => {
    const fixture = TestBed.createComponent(OrderManagementComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('otui-ag-grid')).toBeTruthy();
  });
});
