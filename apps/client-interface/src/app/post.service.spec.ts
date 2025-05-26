import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PostService } from './post.service';
import { CreatePostDto, PostDto, UpdatePostDto, SearchPostDto } from '@optimistic-tanuki/social-ui';

describe('PostService', () => {
  let service: PostService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PostService],
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
    const mockPostDto: CreatePostDto = { title: 'Test Post', content: 'Test Content', profileId: '1' };
    const mockResponse: PostDto = { id: '1', title: 'Test Post', content: 'Test Content', profileId: '1', userId: '123', createdAt: new Date() };

    service.createPost(mockPostDto).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/social/post');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should get a post by id', () => {
    const mockResponse: PostDto = { id: '1', title: 'Test Post', content: 'Test Content', profileId: '1', userId: '123', createdAt: new Date() };

    service.getPost('1').subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/social/post/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should update a post', () => {
    const mockUpdateDto: UpdatePostDto = { title: 'Updated Title', content: 'Updated Content' };
    const mockResponse: PostDto = { id: '1', title: 'Updated Title', content: 'Updated Content', profileId: '1', userId: '123', createdAt: new Date() };

    service.updatePost('1', mockUpdateDto).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/social/post/update/1');
    expect(req.request.method).toBe('PUT');
    req.flush(mockResponse);
  });

  it('should delete a post', () => {
    service.deletePost('1').subscribe((response) => {
      expect(response).toBeUndefined();
    });

    const req = httpMock.expectOne('/api/social/post/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should search for posts', () => {
    const mockSearchCriteria: SearchPostDto = { title: 'Test'  };
    const mockResponse: PostDto[] = [
      { id: '1', title: 'Test Post', content: 'Test Content', profileId: '1', userId: '123', createdAt: new Date() },
      { id: '2', title: 'Another Test Post', content: 'Another Test Content', profileId: '1', userId: '123', createdAt: new Date() },
    ];

    service.searchPosts(mockSearchCriteria).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/social/post/find');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });
});