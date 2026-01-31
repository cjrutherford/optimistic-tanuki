import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { StoreService, Product, Order, DonationRequest } from './store.service';

describe('StoreService', () => {
  let service: StoreService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [StoreService],
    });

    service = TestBed.inject(StoreService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getProducts', () => {
    it('should fetch products from the API', () => {
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

      service.getProducts().subscribe((products) => {
        expect(products).toEqual(mockProducts);
        expect(products.length).toBe(1);
        expect(products[0].name).toBe('Test Product');
      });

      const req = httpMock.expectOne('/api/store/products');
      expect(req.request.method).toBe('GET');
      req.flush(mockProducts);
    });
  });

  describe('getProduct', () => {
    it('should fetch a single product by ID', () => {
      const mockProduct: Product = {
        id: '1',
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        type: 'physical',
        stock: 10,
        active: true,
      };

      service.getProduct('1').subscribe((product) => {
        expect(product).toEqual(mockProduct);
        expect(product.name).toBe('Test Product');
      });

      const req = httpMock.expectOne('/api/store/products/1');
      expect(req.request.method).toBe('GET');
      req.flush(mockProduct);
    });
  });

  describe('createOrder', () => {
    it('should create an order', () => {
      const mockOrder: Order = {
        userId: 'user123',
        items: [{ productId: '1', quantity: 2, price: 99.99 }],
        total: 199.98,
        currency: 'USD',
      };

      const mockResponse: Order = {
        ...mockOrder,
        id: 'order123',
        status: 'pending',
      };

      service.createOrder(mockOrder).subscribe((order) => {
        expect(order).toEqual(mockResponse);
        expect(order.id).toBe('order123');
      });

      const req = httpMock.expectOne('/api/store/orders');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockOrder);
      req.flush(mockResponse);
    });
  });

  describe('getUserOrders', () => {
    it('should fetch user orders', () => {
      const mockOrders: Order[] = [
        {
          id: 'order1',
          userId: 'user123',
          items: [],
          total: 99.99,
          currency: 'USD',
          status: 'completed',
        },
      ];

      service.getUserOrders('user123').subscribe((orders) => {
        expect(orders).toEqual(mockOrders);
        expect(orders.length).toBe(1);
      });

      const req = httpMock.expectOne('/api/store/orders/user/user123');
      expect(req.request.method).toBe('GET');
      req.flush(mockOrders);
    });
  });

  describe('createDonation', () => {
    it('should create a donation with USD currency by default', () => {
      const donationRequest: DonationRequest = {
        amount: 50,
        message: 'Test donation',
        anonymous: false,
      };

      service.createDonation(donationRequest).subscribe((response) => {
        expect(response).toBeTruthy();
      });

      const req = httpMock.expectOne('/api/store/donations');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        ...donationRequest,
        currency: 'USD',
      });
      req.flush({ success: true });
    });

    it('should use provided currency if specified', () => {
      const donationRequest: DonationRequest = {
        amount: 50,
        message: 'Test donation',
        anonymous: true,
        currency: 'EUR',
      };

      service.createDonation(donationRequest).subscribe((response) => {
        expect(response).toBeTruthy();
      });

      const req = httpMock.expectOne('/api/store/donations');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.currency).toBe('EUR');
      req.flush({ success: true });
    });
  });
});
