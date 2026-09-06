import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PrivacyService } from './privacy.service';

describe('PrivacyService', () => {
  let service: PrivacyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PrivacyService],
    });
    service = TestBed.inject(PrivacyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('blocks a user', (done) => {
    const dto = { blockedId: 'u2', reason: 'spam' };
    service.blockUser(dto).subscribe(() => done());
    const req = httpMock.expectOne('/api/privacy/block');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(null);
  });

  it('unblocks a user', (done) => {
    service.unblockUser('u2').subscribe(() => done());
    const req = httpMock.expectOne('/api/privacy/block/u2');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('lists blocked users', (done) => {
    service.getBlockedUsers().subscribe((users) => {
      expect(users).toHaveLength(1);
      done();
    });
    const req = httpMock.expectOne('/api/privacy/blocked');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'b1' }]);
  });

  it('checks whether a user is blocked', (done) => {
    service.isUserBlocked('u2').subscribe((res) => {
      expect(res).toEqual({ blocked: true });
      done();
    });
    const req = httpMock.expectOne('/api/privacy/blocked/u2');
    expect(req.request.method).toBe('GET');
    req.flush({ blocked: true });
  });

  it('mutes a user', (done) => {
    service.muteUser({ mutedId: 'u3', duration: 60 }).subscribe(() => done());
    const req = httpMock.expectOne('/api/privacy/mute');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ mutedId: 'u3', duration: 60 });
    req.flush(null);
  });

  it('unmutes a user', (done) => {
    service.unmuteUser('u3').subscribe(() => done());
    const req = httpMock.expectOne('/api/privacy/mute/u3');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('lists muted users', (done) => {
    service.getMutedUsers().subscribe(() => done());
    const req = httpMock.expectOne('/api/privacy/muted');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('reports content', (done) => {
    const dto = {
      contentType: 'post' as const,
      contentId: 'p1',
      reason: 'abuse',
    };
    service.reportContent(dto).subscribe((res) => {
      expect(res.status).toBe('pending');
      done();
    });
    const req = httpMock.expectOne('/api/privacy/report');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({ id: 'r1', status: 'pending' });
  });

  it('lists my reports', (done) => {
    service.getMyReports().subscribe(() => done());
    const req = httpMock.expectOne('/api/privacy/reports');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
