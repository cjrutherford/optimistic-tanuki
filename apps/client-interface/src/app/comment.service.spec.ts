import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CommentService } from './comment.service';
import { CommentDto, UpdateCommentDto, CreateCommentDto, SearchCommentDto } from '@optimistic-tanuki/social-ui';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('CommentService', () => {
  let service: CommentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CommentService,
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ]
    });
    service = TestBed.inject(CommentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a comment', () => {
    const mockCommentDto: CreateCommentDto = {
      content: 'Test comment',
      profileId: '123',
      postId: '456'
    };
    const mockResponse: CommentDto = {
      id: '789',
      content: 'Test comment',
      profileId: '123',
      postId: '456',
      userId: '123',
    };

    service.createComment(mockCommentDto).subscribe(comment => {
      expect(comment).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/social/comment');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should get a comment by id', () => {
    const mockResponse: CommentDto = {
      id: '789',
      content: 'Test comment',
      profileId: '123',
      postId: '456',
      userId: '123',
    };
    const id = '789';

    service.getComment(id).subscribe(comment => {
      expect(comment).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`/api/social/comment/${id}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should update a comment', () => {
    const mockUpdateCommentDto: UpdateCommentDto = {
      content: 'Updated comment'
    };
    const mockResponse: CommentDto = {
      id: '789',
      content: 'Updated comment',
      profileId: '123',
      postId: '456',
      userId: '123',
    };
    const id = '789';

    service.updateComment(id, mockUpdateCommentDto).subscribe(comment => {
      expect(comment).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`/api/social/comment/update/${id}`);
    expect(req.request.method).toBe('PUT');
    req.flush(mockResponse);
  });

  it('should delete a comment', () => {
    const id = '789';

    service.deleteComment(id).subscribe(() => {
      expect(true).toBeTruthy(); // Just check that the subscribe is called
    });

    const req = httpMock.expectOne(`/api/social/comment/${id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should search comments', () => {
    const mockSearchCriteria: SearchCommentDto = {
      postId: '456'
    };
    const mockResponse: CommentDto[] = [{
      id: '789',
      content: 'Test comment',
      profileId: '123',
      postId: '456',
      userId: '123',
    }];

    service.searchComments(mockSearchCriteria).subscribe(comments => {
      expect(comments).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`/api/social/comment/find`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });
});