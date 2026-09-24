import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  DEFAULT_HARDWARE_TIERS,
  HardwareCatalogService,
} from './hardware-catalog.service';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import { of } from 'rxjs';

describe('HardwareCatalogService', () => {
  let service: HardwareCatalogService;
  let httpMock: HttpTestingController;

  const appRegistryMock = {
    getApp: jest.fn().mockReturnValue(
      of({
        appId: 'system-configurator',
        name: 'HAI Computer',
        uiBaseUrl: 'http://localhost:8091',
      })
    ),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        HardwareCatalogService,
        { provide: AppRegistryService, useValue: appRegistryMock },
      ],
    });

    service = TestBed.inject(HardwareCatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('queries live tier catalog data from /api/hardware/tiers', (done) => {
    service.getTiers().subscribe((tiers) => {
      expect(tiers).toHaveLength(3);
      expect(tiers[0].name).toBe('Compact Edge Appliance');
      expect(tiers[0].targetUsers).toBe('10 to 50 users');
      expect(tiers[0].wholesaleCost).toBe(522.22);
      expect(tiers[0].marginRate).toBe(0.35);
      expect(tiers[0].retailPrice).toBe(705);
      expect(tiers[0].leaseMonthlyRate).toBe(99);
      expect(tiers[0].stockStatus).toBe('In stock');
      expect(tiers[0].portalUrl).toBe('http://localhost:8091?preset=tier1');
      done();
    });

    const req = httpMock.expectOne('/api/hardware/tiers');
    expect(req.request.method).toBe('GET');
    req.flush(DEFAULT_HARDWARE_TIERS);
  });

  it('falls back to default hardware tiers if the api call fails', (done) => {
    service.getTiers().subscribe((tiers) => {
      expect(tiers).toHaveLength(3);
      expect(tiers[1].name).toBe('Workstation Tower Appliance');
      expect(tiers[1].targetUsers).toBe('50 to 250 users');
      expect(tiers[1].retailPrice).toBe(2850);
      expect(tiers[1].leaseMonthlyRate).toBe(199);
      expect(tiers[1].portalUrl).toBe('http://localhost:8091?preset=tier2');
      done();
    });

    const req = httpMock.expectOne('/api/hardware/tiers');
    req.error(new ProgressEvent('Network error'));
  });

  it('constructs portal URL with preset query param', (done) => {
    service.getPortalUrl('tier1').subscribe((url) => {
      expect(url).toBe('http://localhost:8091?preset=tier1');
      done();
    });
  });
});
