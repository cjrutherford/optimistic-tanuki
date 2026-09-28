import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CivicApiService } from './civic-api.service';

describe('CivicApiService', () => {
  let service: CivicApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CivicApiService],
    });
    service = TestBed.inject(CivicApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('searches agendas with filters', () => {
    service
      .getAgendas({ meetingBody: 'city-council', search: 'rezoning' })
      .subscribe((res) => {
        expect(res).toHaveLength(1);
      });

    const req = httpMock.expectOne(
      '/api/v1/civic/agendas?meetingBody=city-council&search=rezoning'
    );
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'agenda-1' }]);
  });

  it('queries TIP projects with an optional bbox', () => {
    service.getTipProjects('-81.5,31.5,-80.5,32.5').subscribe();

    const req = httpMock.expectOne(
      '/api/v1/civic/tip-projects?bbox=-81.5,31.5,-80.5,32.5'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('propagates backend failures', () => {
    const error = jest.fn();
    service.getAgendas().subscribe({ next: () => undefined, error });

    const req = httpMock.expectOne('/api/v1/civic/agendas');
    req.flush(
      { message: 'Service unavailable' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    expect(error).toHaveBeenCalled();
  });
});
