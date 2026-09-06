import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  HardwareService,
  ConfigurationDto,
  ShippingAddress,
} from './hardware.service';

describe('HardwareService', () => {
  let service: HardwareService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(HardwareService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getChassis fetches the chassis list', () => {
    const result: unknown[] = [];
    service.getChassis().subscribe((r) => result.push(...(r as [])));
    const req = httpMock.expectOne('/api/hardware/chassis');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'c1' }]);
    expect(result).toEqual([{ id: 'c1' }]);
  });

  it('getChassisById fetches a single chassis', () => {
    let result: unknown;
    service.getChassisById('c1').subscribe((r) => (result = r));
    const req = httpMock.expectOne('/api/hardware/chassis/c1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'c1' });
    expect(result).toEqual({ id: 'c1' });
  });

  it('getCompatibleComponents fetches compatible parts for a chassis', () => {
    let result: unknown;
    service.getCompatibleComponents('c1').subscribe((r) => (result = r));
    const req = httpMock.expectOne('/api/hardware/chassis/c1/compatible');
    expect(req.request.method).toBe('GET');
    req.flush({ cpu: [], ram: [], storage: [], gpu: [] });
    expect(result).toEqual({ cpu: [], ram: [], storage: [], gpu: [] });
  });

  it('calculatePrice posts the configuration and returns a price breakdown', () => {
    const config: ConfigurationDto = {
      chassisId: 'c1',
      chassisType: 'M',
      useCase: 'dev',
      cpuId: 'cpu1',
      ramId: 'ram1',
      storageIds: ['s1'],
    };
    let result: unknown;
    service.calculatePrice(config).subscribe((r) => (result = r));
    const req = httpMock.expectOne('/api/hardware/pricing/calculate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(config);
    req.flush({ totalPrice: 100 });
    expect(result).toEqual({ totalPrice: 100 });
  });

  it('createOrder posts configuration, shipping, email and payment method', () => {
    const config: ConfigurationDto = {
      chassisId: 'c1',
      chassisType: 'M',
      useCase: 'dev',
      cpuId: 'cpu1',
      ramId: 'ram1',
      storageIds: ['s1'],
    };
    const shipping: ShippingAddress = {
      name: 'Hai',
      street: '123 Main',
      city: 'Metropolis',
      state: 'NY',
      zip: '10001',
      country: 'USA',
    };

    let result: unknown;
    service
      .createOrder(config, shipping, 'hai@example.com', 'card')
      .subscribe((r) => (result = r));
    const req = httpMock.expectOne('/api/hardware/orders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      configuration: config,
      shippingAddress: shipping,
      customerEmail: 'hai@example.com',
      paymentMethod: 'card',
    });
    req.flush({ id: 'order-1' });
    expect(result).toEqual({ id: 'order-1' });
  });

  it('getOrder fetches an order by id', () => {
    let result: unknown;
    service.getOrder('order-1').subscribe((r) => (result = r));
    const req = httpMock.expectOne('/api/hardware/orders/order-1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'order-1' });
    expect(result).toEqual({ id: 'order-1' });
  });
});
