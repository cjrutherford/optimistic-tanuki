import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductListComponent } from './product-list.component';
import { Product } from '../product-card/product-card.component';

describe('ProductListComponent', () => {
  let component: ProductListComponent;
  let fixture: ComponentFixture<ProductListComponent>;

  const mockProducts: Product[] = [
    { id: '1', name: 'Product 1', price: 99.99, stock: 10, type: 'physical' },
    { id: '2', name: 'Product 2', price: 149.99, stock: 5, type: 'digital' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListComponent);
    component = fixture.componentInstance;
    component.products = mockProducts;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display all products', () => {
    const productCards =
      fixture.nativeElement.querySelectorAll('store-product-card');
    expect(productCards.length).toBe(2);
  });

  it('should show empty state when no products', () => {
    component.products = [];
    fixture.detectChanges();
    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
  });

  it('should emit addToCart event', () => {
    jest.spyOn(component.addToCart, 'emit');
    component.onAddToCart(mockProducts[0]);
    expect(component.addToCart.emit).toHaveBeenCalledWith(mockProducts[0]);
  });
});
