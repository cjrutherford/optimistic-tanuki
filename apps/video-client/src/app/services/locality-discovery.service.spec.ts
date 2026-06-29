import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { LocalityDiscoveryService } from './locality-discovery.service';

describe('LocalityDiscoveryService', () => {
  let service: LocalityDiscoveryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        LocalityDiscoveryService,
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });

    service = TestBed.inject(LocalityDiscoveryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests nearby locality discovery from the gateway', () => {
    let response: unknown;

    service
      .discoverNearby(
        {
          anchor: { lat: 32.0809, lng: -81.0912 },
          radiusMeters: 2500,
        },
        { scope: 'local-hub', limit: 6 }
      )
      .subscribe((value) => {
        response = value;
      });

    const request = httpMock.expectOne(
      (candidate) =>
        candidate.method === 'GET' &&
        candidate.url === '/api/locality/discovery' &&
        candidate.params.get('lat') === '32.0809' &&
        candidate.params.get('lng') === '-81.0912' &&
        candidate.params.get('radiusMeters') === '2500' &&
        candidate.params.get('scope') === 'local-hub' &&
        candidate.params.get('limit') === '6'
    );

    request.flush({
      anchor: { lat: 32.0809, lng: -81.0912 },
      radiusMeters: 2500,
      locality: {
        primary: 'Savannah',
        formatted: 'Savannah, GA, US',
        source: 'community-metadata',
      },
      communities: [],
      businesses: [],
      channels: [],
    });

    expect(response).toEqual(
      expect.objectContaining({
        radiusMeters: 2500,
        channels: [],
      })
    );
  });
});
