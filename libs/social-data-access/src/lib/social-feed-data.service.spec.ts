import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { SocialFeedDataService } from './social-feed-data.service';

describe('SocialFeedDataService', () => {
  let service: SocialFeedDataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SocialFeedDataService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    service = TestBed.inject(SocialFeedDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads a descending public feed through the shared social endpoint', () => {
    service.loadPublicFeed().subscribe();

    const request = httpMock.expectOne('/api/social/post/find');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      criteria: {},
      opts: { orderBy: 'createdAt', orderDirection: 'desc' },
    });
    request.flush([]);
  });

  it('loads only followed profiles through the feed endpoint', () => {
    service.loadFollowingFeed({ limit: 20, offset: 40 }).subscribe();

    const request = httpMock.expectOne(
      '/api/social/feed?includeFollowing=true&includePublic=false&limit=20&offset=40'
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('loads the current profile communities before requesting their posts', () => {
    service.loadUserCommunities().subscribe();
    const communitiesRequest = httpMock.expectOne(
      '/api/social/community/user/communities'
    );
    expect(communitiesRequest.request.method).toBe('GET');
    communitiesRequest.flush([]);

    service
      .loadCommunityFeed(['community-1'], { limit: 20, offset: 0 })
      .subscribe();
    const postsRequest = httpMock.expectOne('/api/social/post/find');
    expect(postsRequest.request.body).toEqual({
      criteria: { communityIds: ['community-1'] },
      opts: {
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit: 20,
        offset: 0,
      },
    });
    postsRequest.flush([]);
  });
});
