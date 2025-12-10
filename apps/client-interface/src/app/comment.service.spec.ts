import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CommentService } from './comment.service';
import {
  CommentDto,
  UpdateCommentDto,
  CreateCommentDto,
  SearchCommentDto,
} from '@optimistic-tanuki/social-ui';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('CommentService', () => {
  let service: CommentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CommentService, { provide: API_BASE_URL, useValue: '' }],
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
    const mockRequest: CreateCommentDto = {
      content: 'Test comment',
      postId: '123',
      profileId: '456',
    };
    const mockResponse: CommentDto = {
      id: '789',
      ...mockRequest,
      userId: '456',
      parentId: undefined,
    };

    service.createComment(mockRequest).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/social/comment');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should get a comment by id', () => {
    const id = '789';
    const mockResponse: CommentDto = {
      id: '789',
      content: 'Test comment',
      postId: '123',
      userId: '456',
      profileId: '456',
      parentId: undefined,
    };

    service.getComment(id).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`/social/comment/${id}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should update a comment', () => {
    const id = '789';
    const mockRequest: UpdateCommentDto = { content: 'Updated comment' };
    const mockResponse: CommentDto = {
      id: '789',
      content: 'Updated comment',
      postId: '123',
      userId: '456',
      profileId: '456',
      parentId: undefined,
    };

    service.updateComment(id, mockRequest).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`/social/comment/update/${id}`);
    expect(req.request.method).toBe('PUT');
    req.flush(mockResponse);
  });

  it('should delete a comment', () => {
    const id = '789';

    service.deleteComment(id).subscribe((response) => {
      expect(response).toBeNull();
    });

    const req = httpMock.expectOne(`/social/comment/${id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should search comments', () => {
    const mockRequest: SearchCommentDto = { postId: '123' };
    const mockResponse: CommentDto[] = [
      {
        id: '789',
        content: 'Test comment',
        postId: '123',
        userId: '456',
        profileId: '456',
        parentId: undefined,
      },
    ];

    service.searchComments(mockRequest).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`/social/comment/find`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });
});
