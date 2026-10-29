import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PrivacyReportService } from './privacy-report.service';

describe('PrivacyReportService', () => {
  let service: PrivacyReportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PrivacyReportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts only the existing report contract to the shared privacy endpoint', () => {
    const dto = {
      contentType: 'post' as const,
      contentId: 'post-1',
      reason: 'spam',
      description: 'Repeated unwanted content',
    };
    service.reportContent(dto).subscribe();

    const request = http.expectOne('/api/privacy/report');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(dto);
    expect(request.request.body).not.toHaveProperty('profileId');
    expect(request.request.body).not.toHaveProperty('appScope');
    request.flush({ id: 'report-1' });
  });
});
