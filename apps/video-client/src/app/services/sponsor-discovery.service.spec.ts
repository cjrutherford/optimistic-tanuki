import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { SponsorDiscoveryService } from './sponsor-discovery.service';

describe('SponsorDiscoveryService', () => {
  let service: SponsorDiscoveryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        SponsorDiscoveryService,
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });

    service = TestBed.inject(SponsorDiscoveryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests eligible on-page campaigns for a channel target', () => {
    service.discoverOnPage({ channelId: 'channel-1' }).subscribe();

    const request = httpMock.expectOne(
      (candidate) =>
        candidate.url ===
          '/api/payments/advertising-campaigns/eligible/on-page' &&
        candidate.params.get('channelId') === 'channel-1'
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });
});
