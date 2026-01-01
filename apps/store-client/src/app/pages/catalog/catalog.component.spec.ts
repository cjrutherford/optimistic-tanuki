import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CatalogComponent } from './catalog.component';
import { Router } from '@angular/router';
import { StoreService, Product } from '../../services/store.service';
import { of, throwError } from 'rxjs';

describe('CatalogComponent', () => {
  let component: CatalogComponent;
  let fixture: ComponentFixture<CatalogComponent>;
  let router: Router;
  let storeService: jasmine.SpyObj<StoreService>;

  const mockProducts: Product[] = [
    {
      id: '1',
      name: 'Test Product',
      description: 'Test Description',
      price: 99.99,
      type: 'physical',
      stock: 10,
      active: true,
    },
  ];

  beforeEach(async () => {
    const storeServiceSpy = jasmine.createSpyObj('StoreService', ['getProducts']);

    await TestBed.configureTestingModule({
      imports: [CatalogComponent],
      providers: [
        {
          provide: Router,
          useValue: { navigate: jest.fn() },
        },
        {
          provide: StoreService,
          useValue: storeServiceSpy,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CatalogComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    storeService = TestBed.inject(StoreService) as jasmine.SpyObj<StoreService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load products on init', () => {
    storeService.getProducts.and.returnValue(of(mockProducts));

    fixture.detectChanges();

    expect(storeService.getProducts).toHaveBeenCalled();
    expect(component.products).toEqual(mockProducts);
    expect(component.loading).toBe(false);
  });

  it('should handle error when loading products fails', () => {
    storeService.getProducts.and.returnValue(throwError(() => new Error('Test error')));

    fixture.detectChanges();

    expect(component.error).toBe('Failed to load products. Please try again later.');
    expect(component.loading).toBe(false);
  });

  it('should navigate to cart when product is added', () => {
    storeService.getProducts.and.returnValue(of(mockProducts));
    fixture.detectChanges();

    const product = mockProducts[0];
    component.onAddToCart(product);
    expect(router.navigate).toHaveBeenCalledWith(['/cart']);
  });
});
