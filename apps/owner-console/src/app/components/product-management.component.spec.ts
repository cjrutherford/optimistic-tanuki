import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ProductManagementComponent } from './product-management.component';
import { Product, StoreService } from '../services/store.service';

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

  const create = () => {
    const fixture = TestBed.createComponent(ProductManagementComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  it('narrows the catalog for the active-service and inactive filters', () => {
    const component = create();

    component.setFilter('active-service');
    expect(component.filteredProducts.map((p) => p.id)).toEqual(['product-1']);

    component.setFilter('inactive');
    expect(component.filteredProducts.map((p) => p.id)).toEqual(['product-3']);

    component.setFilter('all');
    expect(component.filteredProducts).toHaveLength(3);
  });

  it('surfaces a load error instead of stale products', () => {
    storeService.getProducts.mockReturnValue(
      throwError(() => new Error('boom'))
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const component = create();

    expect(component.error).toBe('Failed to load products');
    expect(component.loading).toBe(false);
    expect(component.products).toEqual([]);
  });

  it('formats prices from cents, accepting numeric strings', () => {
    const component = create();

    expect(component.formatPrice(12000)).toBe('120.00');
    expect(component.formatPrice('3500')).toBe('35.00');
  });

  it('opens a blank create form', () => {
    const component = create();

    component.startEdit(component.products[0]);
    component.startCreate();

    expect(component.isCreating).toBe(true);
    expect(component.isEditing).toBe(false);
    expect(component.selectedProduct).toBeNull();
    expect(component.productForm).toEqual({
      name: '',
      description: '',
      price: 0,
      type: 'physical',
      imageUrl: '',
      stock: 0,
      active: true,
    });
  });

  it('seeds the edit form with the product converted back to dollars', () => {
    const component = create();

    component.startEdit(component.products[0]);

    expect(component.isEditing).toBe(true);
    expect(component.isCreating).toBe(false);
    expect(component.productForm.id).toBe('product-1');
    expect(component.productForm.price).toBe(120);
  });

  it('clears the form on cancel', () => {
    const component = create();

    component.startEdit(component.products[0]);
    component.cancelEdit();

    expect(component.isEditing).toBe(false);
    expect(component.selectedProduct).toBeNull();
    expect(component.productForm.name).toBe('');
  });

  it('converts the dollar price to cents when creating', () => {
    storeService.createProduct.mockReturnValue(of({ id: 'product-4' }));
    const component = create();

    component.startCreate();
    component.productForm.name = 'Retainer';
    component.productForm.price = 99.99;
    component.saveProduct();

    expect(storeService.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Retainer', priceCents: 9999 })
    );
    expect(component.isCreating).toBe(false);
  });

  it('reports a create failure without closing the form', () => {
    storeService.createProduct.mockReturnValue(
      throwError(() => new Error('nope'))
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const component = create();

    component.startCreate();
    component.saveProduct();

    expect(component.error).toBe('Failed to create product');
    expect(component.isCreating).toBe(true);
  });

  it('updates the selected product when editing', () => {
    storeService.updateProduct.mockReturnValue(of({ id: 'product-1' }));
    const component = create();

    component.startEdit(component.products[0]);
    component.productForm.name = 'Service Sprint v2';
    component.saveProduct();

    expect(storeService.updateProduct).toHaveBeenCalledWith(
      'product-1',
      expect.objectContaining({ name: 'Service Sprint v2', priceCents: 12000 })
    );
    expect(component.isEditing).toBe(false);
  });

  it('reports an update failure', () => {
    storeService.updateProduct.mockReturnValue(
      throwError(() => new Error('nope'))
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const component = create();

    component.startEdit(component.products[0]);
    component.saveProduct();

    expect(component.error).toBe('Failed to update product');
  });

  it('does nothing on save when neither creating nor editing', () => {
    const component = create();

    component.saveProduct();

    expect(storeService.createProduct).not.toHaveBeenCalled();
    expect(storeService.updateProduct).not.toHaveBeenCalled();
  });

  it('skips the update request when no product is selected', () => {
    const component = create();

    component.isEditing = true;
    component.selectedProduct = null;
    component.updateProduct();

    expect(storeService.updateProduct).not.toHaveBeenCalled();
  });

  it('asks for confirmation before deleting and aborts when declined', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const component = create();

    component.deleteProduct(component.products[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(storeService.deleteProduct).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('deletes and reloads once the operator confirms', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    storeService.deleteProduct.mockReturnValue(of(undefined));
    const component = create();
    const target = component.products[0] as Product;

    component.deleteProduct(target);

    expect(storeService.deleteProduct).toHaveBeenCalledWith('product-1');
    expect(storeService.getProducts).toHaveBeenCalledTimes(2);
    confirmSpy.mockRestore();
  });

  it('reports a delete failure', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    storeService.deleteProduct.mockReturnValue(
      throwError(() => new Error('nope'))
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const component = create();

    component.deleteProduct(component.products[0]);

    expect(component.error).toBe('Failed to delete product');
    confirmSpy.mockRestore();
  });
});
