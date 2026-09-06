import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { FollowService } from './follow.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

const BASE = 'http://api.test/social/follow';

describe('FollowService', () => {
  let service: FollowService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        FollowService,
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    service = TestBed.inject(FollowService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('posts a follow to the base url', (done) => {
    const dto = { followerId: 'a', followedId: 'b' } as never;
    service.follow(dto).subscribe((res) => {
      expect(res).toEqual({ ok: true });
      done();
    });
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(dto);
    req.flush({ ok: true });
  });

  it('posts an unfollow to the unfollow url', (done) => {
    const dto = { followerId: 'a', followedId: 'b' } as never;
    service.unfollow(dto).subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/unfollow`);
    expect(req.request.method).toBe('POST');
    req.flush({ ok: true });
  });

  it('gets followers for an id', (done) => {
    service.getFollowers('a').subscribe((res) => {
      expect(res).toEqual(['b']);
      done();
    });
    const req = httpMock.expectOne(`${BASE}/a`);
    expect(req.request.method).toBe('GET');
    req.flush(['b']);
  });

  it('gets who an id is following', (done) => {
    service.getFollowing('a').subscribe((res) => {
      expect(res).toEqual(['c']);
      done();
    });
    const req = httpMock.expectOne(`${BASE}/following/a`);
    expect(req.request.method).toBe('GET');
    req.flush(['c']);
  });
});
