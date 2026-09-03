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

  describe('getPosts', () => {
    it('searches for public posts', (done) => {
      service.getPosts({ visibility: 'public' }).subscribe((posts) => {
        expect(posts).toEqual([]);
        done();
      });
      const req = httpMock.expectOne('/social/post/find');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ criteria: { visibility: 'public' } });
      req.flush([]);
    });

    it('resolves the following list before searching for followers posts', (done) => {
      service
        .getPosts({ visibility: 'followers', profileId: 'p1' })
        .subscribe((posts) => {
          expect(posts).toEqual([]);
          done();
        });

      const followReq = httpMock.expectOne('/social/follow/following/p1');
      expect(followReq.request.method).toBe('GET');
      followReq.flush(['u1', 'u2']);

      const findReq = httpMock.expectOne('/social/post/find');
      expect(findReq.request.body).toEqual({
        criteria: { visibility: 'followers', userIds: ['u1', 'u2'] },
      });
      findReq.flush([]);
    });

    it('throws when followers visibility is requested without a profile id', () => {
      expect(() => service.getPosts({ visibility: 'followers' })).toThrow(
        'Profile ID is required for followers visibility'
      );
    });
  });

  describe('getFeed', () => {
    it('requests the bare feed url when no options are given', (done) => {
      service.getFeed().subscribe(() => done());
      const req = httpMock.expectOne('/social/feed');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('serialises every supplied option into the query string', (done) => {
      service
        .getFeed({
          includePublic: true,
          includeFollowing: false,
          includeCommunities: true,
          limit: 10,
          offset: 20,
        })
        .subscribe(() => done());

      const req = httpMock.expectOne(
        '/social/feed?includePublic=true&includeFollowing=false&includeCommunities=true&limit=10&offset=20'
      );
      req.flush([]);
    });

    it('omits zero limit and offset values', (done) => {
      service.getFeed({ limit: 0, offset: 0 }).subscribe(() => done());
      const req = httpMock.expectOne('/social/feed');
      req.flush([]);
    });
  });

  describe('getPostsByCommunityIds', () => {
    it('searches with ordering options for the supplied communities', (done) => {
      service.getPostsByCommunityIds(['c1']).subscribe(() => done());
      const req = httpMock.expectOne('/social/post/find');
      expect(req.request.body).toEqual({
        criteria: { communityIds: ['c1'] },
        opts: { orderBy: 'createdAt', orderDirection: 'desc', limit: 50 },
      });
      req.flush([]);
    });

    it('emits an empty list without calling the api for an empty id list', (done) => {
      service.getPostsByCommunityIds([]).subscribe((posts) => {
        expect(posts).toEqual([]);
        done();
      });
      httpMock.verify();
    });

    it('emits an empty list without calling the api for a nullish id list', (done) => {
      service
        .getPostsByCommunityIds(undefined as unknown as string[])
        .subscribe((posts) => {
          expect(posts).toEqual([]);
          done();
        });
      httpMock.verify();
    });
  });
});
