import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ReactionService } from './reaction.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

const BASE = 'http://api.test/social';

describe('ReactionService', () => {
  let service: ReactionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ReactionService,
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    service = TestBed.inject(ReactionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('adds a reaction', (done) => {
    const dto = { postId: 'p1', value: 1 } as never;
    service.addReaction(dto).subscribe((res) => {
      expect(res).toEqual({ id: 'r1' });
      done();
    });
    const req = httpMock.expectOne(`${BASE}/reaction`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(dto);
    req.flush({ id: 'r1' });
  });

  it('gets reactions for a post', (done) => {
    service.getReactionsByPost('p1').subscribe((res) => {
      expect(res).toHaveLength(1);
      done();
    });
    const req = httpMock.expectOne(`${BASE}/reactions/post/p1`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'r1' }]);
  });

  it('gets reaction counts for a post', (done) => {
    service.getReactionCounts('p1').subscribe((res) => {
      expect(res).toEqual({ 1: 3 });
      done();
    });
    const req = httpMock.expectOne(`${BASE}/reactions/post/p1/counts`);
    expect(req.request.method).toBe('GET');
    req.flush({ 1: 3 });
  });

  it('gets the current user reaction for a post', (done) => {
    service.getUserReaction('p1').subscribe((res) => {
      expect(res).toBeNull();
      done();
    });
    const req = httpMock.expectOne(`${BASE}/reaction/post/p1/user`);
    expect(req.request.method).toBe('GET');
    req.flush(null);
  });
});
