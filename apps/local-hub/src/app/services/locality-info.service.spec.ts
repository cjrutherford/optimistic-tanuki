import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { LOCALITY_INFO_API_URL } from '@optimistic-tanuki/ui-models';
import { LocalityInfoService } from './locality-info.service';
import { LocalitySummary } from './community.service';

describe('LocalityInfoService', () => {
  let service: LocalityInfoService;
  let httpMock: HttpTestingController;

  const locality: LocalitySummary = {
    id: 'city-1',
    name: 'Savannah',
    slug: 'savannah-ga',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'GA',
    description: 'Fallback description',
    imageUrl: 'https://picsum.photos/seed/savannah-ga/1200/800',
    coordinates: { lat: 32.0809, lng: -81.0912 },
    label: {
      primary: 'Savannah',
      secondary: 'GA, US',
      formatted: 'Savannah, GA, US',
      city: 'Savannah',
      adminArea: 'GA',
      countryCode: 'US',
      source: 'community-metadata',
    },
    scope: {
      anchor: { lat: 32.0809, lng: -81.0912 },
      radiusMeters: 40234,
    },
    population: 1,
    timezone: 'America/New_York',
    highlights: [],
    communities: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        LocalityInfoService,
        {
          provide: LOCALITY_INFO_API_URL,
          useValue: 'https://en.wikipedia.org/api/rest_v1/page/summary',
        },
      ],
    });

    service = TestBed.inject(LocalityInfoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('enriches locality display data from the configured city info API', async () => {
    const resultPromise = service.enrichLocality(locality);

    const request = httpMock.expectOne(
      'https://en.wikipedia.org/api/rest_v1/page/summary/Savannah'
    );
    expect(request.request.method).toBe('GET');

    request.flush({
      extract: 'Savannah is a coastal Georgia city.',
      thumbnail: {
        source: 'https://upload.wikimedia.org/savannah.jpg',
      },
      content_urls: {
        desktop: {
          page: 'https://en.wikipedia.org/wiki/Savannah,_Georgia',
        },
      },
    });

    await expect(resultPromise).resolves.toMatchObject({
      description: 'Savannah is a coastal Georgia city.',
      imageUrl: 'https://upload.wikimedia.org/savannah.jpg',
      externalInfo: {
        source: 'api',
        articleUrl: 'https://en.wikipedia.org/wiki/Savannah,_Georgia',
      },
    });
  });

  it('falls back to the derived locality data when the city info API fails', async () => {
    const resultPromise = service.enrichLocality(locality);

    const request = httpMock.expectOne(
      'https://en.wikipedia.org/api/rest_v1/page/summary/Savannah'
    );
    request.flush('nope', { status: 500, statusText: 'Server Error' });

    await expect(resultPromise).resolves.toEqual(locality);
  });
});
