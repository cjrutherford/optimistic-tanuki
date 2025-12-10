import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PostService } from './post.service';
import {
  CreatePostDto,
  PostDto,
  UpdatePostDto,
  SearchPostDto,
} from '@optimistic-tanuki/social-ui';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('PostService', () => {
  let service: PostService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PostService, { provide: API_BASE_URL, useValue: '' }],
    });
    service = TestBed.inject(PostService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a post', () => {
    const mockRequest: CreatePostDto = {
      title: 'Test Post',
      content: 'Test post',
      profileId: '1',
    };
    const mockResponse: PostDto = {
      id: '1',
      title: 'Test Post',
      content: 'Test post',
      userId: '1',
      profileId: '1',
      createdAt: new Date(),
    };

    service.createPost(mockRequest).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/social/post');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should get a post by id', () => {
    const mockResponse: PostDto = {
      id: '1',
      title: 'Test Post',
      content: 'Test post',
      userId: '1',
      profileId: '1',
      createdAt: new Date(),
    };

    service.getPost('1').subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/social/post/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should update a post', () => {
    const mockRequest: UpdatePostDto = { content: 'Updated post' };
    const mockResponse: PostDto = {
      id: '1',
      title: 'Test Post',
      content: 'Updated post',
      userId: '1',
      profileId: '1',
      createdAt: new Date(),
    };

    service.updatePost('1', mockRequest).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/social/post/update/1');
    expect(req.request.method).toBe('PUT');
    req.flush(mockResponse);
  });

  it('should delete a post', () => {
    service.deletePost('1').subscribe((response) => {
      expect(response).toBeNull();
    });

    const req = httpMock.expectOne('/social/post/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should search for posts', () => {
    const mockRequest: SearchPostDto = { profileId: '1' };
    const mockResponse: PostDto[] = [
      {
        id: '1',
        title: 'Test Post',
        content: 'Test post',
        userId: '1',
        profileId: '1',
        createdAt: new Date(),
      },
    ];

    service.searchPosts(mockRequest).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/social/post/find');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });
});
