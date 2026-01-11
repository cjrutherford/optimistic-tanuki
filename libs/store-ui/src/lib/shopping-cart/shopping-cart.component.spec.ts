import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShoppingCartComponent, CartItem } from './shopping-cart.component';

describe('ShoppingCartComponent', () => {
  let component: ShoppingCartComponent;
  let fixture: ComponentFixture<ShoppingCartComponent>;

  const mockItems: CartItem[] = [
    { productId: '1', name: 'Product 1', price: 99.99, quantity: 2 },
    { productId: '2', name: 'Product 2', price: 149.99, quantity: 1 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShoppingCartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ShoppingCartComponent);
    component = fixture.componentInstance;
    component.items = mockItems;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate total correctly', () => {
    expect(component.total).toBe(349.97);
  });

  it('should emit updateQuantity event', () => {
    jest.spyOn(component.updateQuantity, 'emit');
    component.onQuantityChange('1', 3);
    expect(component.updateQuantity.emit).toHaveBeenCalledWith({ productId: '1', quantity: 3 });
  });

  it('should emit removeItem event', () => {
    jest.spyOn(component.removeItem, 'emit');
    component.onRemoveItem('1');
    expect(component.removeItem.emit).toHaveBeenCalledWith('1');
  });

  it('should emit checkout event', () => {
    jest.spyOn(component.checkout, 'emit');
    component.onCheckout();
    expect(component.checkout.emit).toHaveBeenCalled();
  });
});
