import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CartComponent } from './cart.component';

describe('CartComponent', () => {
  let router: { navigate: jest.Mock };

  const build = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }],
    });

    return TestBed.runInInjectionContext(
      () => new CartComponent(router as unknown as Router)
    );
  };

  beforeEach(() => {
    router = { navigate: jest.fn() };
  });

  it('updates the quantity of a line already in the cart', () => {
    const component = build();

    component.onUpdateQuantity({ productId: '1', quantity: 5 });

    expect(component.items.find((i) => i.productId === '1')?.quantity).toBe(5);
  });

  it('ignores an update for a product that is not in the cart', () => {
    const component = build();
    const before = component.items.map((i) => i.quantity);

    component.onUpdateQuantity({ productId: 'not-in-cart', quantity: 9 });

    expect(component.items.map((i) => i.quantity)).toEqual(before);
  });

  it('removes only the named line', () => {
    const component = build();

    component.onRemoveItem('1');

    expect(component.items.map((i) => i.productId)).toEqual(['4']);
  });

  it('leaves the cart alone when removing something absent', () => {
    const component = build();

    component.onRemoveItem('not-in-cart');

    expect(component.items).toHaveLength(2);
  });

  it('sends the shopper to checkout', () => {
    const component = build();

    component.onCheckout();

    expect(router.navigate).toHaveBeenCalledWith(['/checkout']);
  });
});
