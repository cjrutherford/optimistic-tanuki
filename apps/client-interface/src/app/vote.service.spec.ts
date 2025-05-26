import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { VoteService } from './vote.service';
import { VoteDto, CreateVoteDto } from '@optimistic-tanuki/social-ui';

describe('VoteService', () => {
  let service: VoteService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VoteService],
    });

    service = TestBed.inject(VoteService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a vote', () => {
    const mockVoteDto: VoteDto = { id: '1', value: 1, postId: '123', userId: '456' };
    const createVoteDto: CreateVoteDto = { value: 1, postId: '123' };

    service.createVote(createVoteDto).subscribe((response) => {
      expect(response).toEqual(mockVoteDto);
    });

    const req = httpMock.expectOne('/api/social/vote');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(createVoteDto);
    req.flush(mockVoteDto);
  });

  it('should get a vote by id', () => {
    const mockVoteDto: VoteDto = { id: '1', value: 1, postId: '123', userId: '456' };

    service.getVote('1').subscribe((response) => {
      expect(response).toEqual(mockVoteDto);
    });

    const req = httpMock.expectOne('/api/social/vote/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockVoteDto);
  });

  it('should delete a vote by id', () => {
    service.deleteVote('1').subscribe((response) => {
      expect(response).toBeUndefined();
    });

    const req = httpMock.expectOne('/api/social/vote/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});