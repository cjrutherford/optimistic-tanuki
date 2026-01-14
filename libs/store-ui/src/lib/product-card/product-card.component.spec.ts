import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductCardComponent, Product } from './product-card.component';

describe('ProductCardComponent', () => {
  let component: ProductCardComponent;
  let fixture: ComponentFixture<ProductCardComponent>;

  const mockProduct: Product = {
    id: '1',
    name: 'Test Product',
    description: 'Test Description',
    price: 99.99,
    stock: 10,
    type: 'physical',
    imageUrl: 'test.jpg',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCardComponent);
    component = fixture.componentInstance;
    component.product = mockProduct;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display product information', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.product-name').textContent).toContain(
      'Test Product'
    );
    expect(
      compiled.querySelector('.product-description').textContent
    ).toContain('Test Description');
    expect(compiled.querySelector('.product-price').textContent).toContain(
      '99.99'
    );
  });

  it('should emit addToCart event when button is clicked', () => {
    jest.spyOn(component.addToCart, 'emit');
    const button = fixture.nativeElement.querySelector('.add-to-cart-btn');
    button.click();
    expect(component.addToCart.emit).toHaveBeenCalledWith(mockProduct);
  });

  it('should disable add to cart button when out of stock', () => {
    component.product = { ...mockProduct, stock: 0 };
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.add-to-cart-btn');
    expect(button.disabled).toBeTruthy();
  });
});
