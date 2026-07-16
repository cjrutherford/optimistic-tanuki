import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShoppingCartComponent, CartItem } from './shopping-cart.component';

describe('ShoppingCartComponent', () => {
  let component: ShoppingCartComponent;
  let fixture: ComponentFixture<ShoppingCartComponent>;

  const mockItems: CartItem[] = [
    { productId: '1', name: 'Product 1', priceCents: 9999, quantity: 2 },
    { productId: '2', name: 'Product 2', priceCents: 14999, quantity: 1 },
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

  it('should calculate total correctly in integer cents', () => {
    // 99.99 * 2 + 149.99 * 1 = 349.97 — asserted here in integer cents
    // (9999 * 2 + 14999 = 34997) to prove no float accumulation occurs.
    expect(component.totalCents).toBe(34997);
  });

  it('should compute a multi-item total immune to float drift', () => {
    component.items = [
      { productId: '1', name: 'Item A', priceCents: 1010, quantity: 3 },
      { productId: '2', name: 'Item B', priceCents: 2020, quantity: 1 },
    ];
    // 1010 * 3 + 2020 * 1 = 5050 exactly; float dollar math (10.10 * 3 + 20.20)
    // produces 50.500000000000004 in IEEE-754 double arithmetic.
    expect(component.totalCents).toBe(5050);
  });

  it('should emit updateQuantity event', () => {
    jest.spyOn(component.updateQuantity, 'emit');
    component.onQuantityChange('1', 3);
    expect(component.updateQuantity.emit).toHaveBeenCalledWith({
      productId: '1',
      quantity: 3,
    });
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
