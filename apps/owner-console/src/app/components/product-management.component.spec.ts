import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ProductManagementComponent } from './product-management.component';
import { StoreService } from '../services/store.service';

describe('ProductManagementComponent', () => {
  const storeService = {
    getProducts: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    storeService.getProducts.mockReturnValue(
      of([
        {
          id: 'product-1',
          name: 'Service Sprint',
          description: 'Store-backed service',
          priceCents: 12000,
          type: 'service',
          stock: 0,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'product-2',
          name: 'Workbook',
          description: 'Physical workbook',
          priceCents: 3500,
          type: 'physical',
          stock: 10,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'product-3',
          name: 'Inactive Audit',
          description: 'Inactive service',
          priceCents: 20000,
          type: 'service',
          stock: 0,
          active: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    );

    await TestBed.configureTestingModule({
      imports: [ProductManagementComponent],
      providers: [
        provideRouter([]),
        { provide: StoreService, useValue: storeService },
      ],
    }).compileComponents();
  });

  it('filters products by service type for store-backed business offers', () => {
    const fixture = TestBed.createComponent(ProductManagementComponent);
    const component = fixture.componentInstance;

    fixture.detectChanges();

    component.setFilter('service');

    expect(component.serviceProductCount).toBe(2);
    expect(component.filteredProducts.map((product) => product.id)).toEqual([
      'product-1',
      'product-3',
    ]);
  });

  it('counts active service products separately from the overall catalog', () => {
    const fixture = TestBed.createComponent(ProductManagementComponent);
    const component = fixture.componentInstance;

    fixture.detectChanges();

    expect(component.products.length).toBe(3);
    expect(component.serviceProductCount).toBe(2);
    expect(component.activeServiceProductCount).toBe(1);
  });
});
