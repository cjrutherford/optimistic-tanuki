import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  DEFAULT_HARDWARE_TIERS,
  HardwareCatalogService,
} from './hardware-catalog.service';

const REGISTRY_URL = '/api/registry/apps';

function registryWith(uiBaseUrl: string, visibility = 'public') {
  return {
    success: true,
    data: {
      apps: [
        {
          appId: 'system-configurator',
          name: 'HAI Computer',
          uiBaseUrl,
          visibility,
        },
      ],
    },
  };
}

describe('HardwareCatalogService', () => {
  let service: HardwareCatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HardwareCatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('queries live tier catalog data from /api/hardware/tiers', (done) => {
    service.getTiers().subscribe((tiers) => {
      expect(tiers).toHaveLength(3);
      expect(tiers[0].name).toBe('Compact Edge Appliance');
      expect(tiers[0].targetUsers).toBe('10 to 50 users');
      expect(tiers[0].stockStatus).toBe('In stock');
      expect(tiers[0].portalUrl).toBe('http://dev.example:8091?preset=tier1');
      done();
    });

    const req = httpMock.expectOne('/api/hardware/tiers');
    expect(req.request.method).toBe('GET');
    req.flush(DEFAULT_HARDWARE_TIERS);
    httpMock
      .expectOne(REGISTRY_URL)
      .flush(registryWith('http://dev.example:8091'));
  });

  it('falls back to default hardware tiers if the api call fails', (done) => {
    service.getTiers().subscribe((tiers) => {
      expect(tiers).toHaveLength(3);
      expect(tiers[1].name).toBe('Workstation Tower Appliance');
      expect(tiers[1].targetUsers).toBe('50 to 250 users');
      expect(tiers[1].portalUrl).toBe(
        'https://hardware.example.com?preset=tier2'
      );
      done();
    });

    httpMock
      .expectOne('/api/hardware/tiers')
      .error(new ProgressEvent('Network error'));
    httpMock
      .expectOne(REGISTRY_URL)
      .flush(registryWith('https://hardware.example.com'));
  });

  it('takes the configurator URL from the registry for the environment', (done) => {
    service.getPortalUrl('tier1').subscribe((url) => {
      expect(url).toBe('https://hardware.example.com/build?preset=tier1');
      done();
    });
    httpMock
      .expectOne(REGISTRY_URL)
      .flush(registryWith('https://hardware.example.com/build'));
  });

  it('appends the preset with & when the registry URL already has a query', (done) => {
    service.getPortalUrl('tier2').subscribe((url) => {
      expect(url).toBe('https://hardware.example.com/?a=1&preset=tier2');
      done();
    });
    httpMock
      .expectOne(REGISTRY_URL)
      .flush(registryWith('https://hardware.example.com/?a=1'));
  });

  it('shares one registry request between the tiers and the portal URLs', (done) => {
    service.getPortalUrl('tier1').subscribe(() => {
      service.getPortalUrl('tier3').subscribe((url) => {
        expect(url).toBe('https://hardware.example.com?preset=tier3');
        done();
      });
    });
    httpMock
      .expectOne(REGISTRY_URL)
      .flush(registryWith('https://hardware.example.com'));
  });

  describe('when the registry does not give a usable URL', () => {
    const cases: [string, (req: ReturnType<typeof expectRegistry>) => void][] =
      [
        ['request fails', (req) => req.error(new ProgressEvent('offline'))],
        ['responds unsuccessfully', (req) => req.flush({ success: false })],
        [
          'omits the configurator',
          (req) => req.flush({ success: true, data: { apps: [] } }),
        ],
        [
          'lists it as internal',
          (req) => req.flush(registryWith('https://x.example.com', 'internal')),
        ],
        [
          'gives a URL that is not http(s)',
          (req) => req.flush(registryWith('javascript:alert(1)')),
        ],
        ['gives an empty URL', (req) => req.flush(registryWith(''))],
      ];

    function expectRegistry() {
      return httpMock.expectOne(REGISTRY_URL);
    }

    it.each(cases)(
      'has no portal URL and no localhost guess: %s',
      (_n, respond) => {
        const urls: (string | undefined)[] = [];
        service.getPortalUrl('tier1').subscribe((url) => urls.push(url));
        respond(expectRegistry());
        expect(urls).toEqual([undefined]);
      }
    );

    it('leaves the tiers without a portal URL', (done) => {
      service.getTiers().subscribe((tiers) => {
        expect(tiers).toHaveLength(3);
        expect(tiers.every((tier) => tier.portalUrl === undefined)).toBe(true);
        done();
      });
      httpMock.expectOne('/api/hardware/tiers').flush(DEFAULT_HARDWARE_TIERS);
      httpMock
        .expectOne(REGISTRY_URL)
        .flush({ success: true, data: { apps: [] } });
    });
  });
});
