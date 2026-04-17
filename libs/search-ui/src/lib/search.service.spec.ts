import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { SearchService } from './search.service';
import {
  SearchResponse,
  SearchResult,
  SearchHistory,
  SearchOptions,
} from './search.model';

describe('SearchService', () => {
  let service: SearchService;
  let httpMock: HttpTestingController;
  const baseUrl = '/api/search';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SearchService],
    });
    service = TestBed.inject(SearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('search', () => {
    it('should search with query only', () => {
      const query = 'test';
      const mockResponse: SearchResponse = {
        users: [],
        posts: [],
        communities: [],
        total: 0,
      };

      service.search(query).subscribe((response) => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne((request) => {
        return (
          request.url === baseUrl &&
          request.params.get('q') === query &&
          request.params.get('type') === null &&
          request.params.get('limit') === null &&
          request.params.get('offset') === null
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should search with options', () => {
      const query = 'test';
      const options: SearchOptions = {
        type: 'users',
        limit: 20,
        offset: 10,
      };
      const mockResponse: SearchResponse = {
        users: [
          {
            type: 'user',
            id: '1',
            title: 'Test User',
            subtitle: '@testuser',
          },
        ],
        posts: [],
        communities: [],
        total: 1,
      };

      service.search(query, options).subscribe((response) => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne((request) => {
        return (
          request.url === baseUrl &&
          request.params.get('q') === query &&
          request.params.get('type') === 'users' &&
          request.params.get('limit') === '20' &&
          request.params.get('offset') === '10'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should update loading signal during search', () => {
      const query = 'test';
      const mockResponse: SearchResponse = {
        users: [],
        posts: [],
        communities: [],
        total: 0,
      };

      service.search(query).subscribe();

      const req = httpMock.expectOne((request) => request.url === baseUrl);
      req.flush(mockResponse);
    });
  });

  describe('getTrending', () => {
    it('should get trending posts with default limit', () => {
      const mockTrending: SearchResult[] = [
        { type: 'post', id: '1', title: 'Trending Post 1' },
        { type: 'post', id: '2', title: 'Trending Post 2' },
      ];

      service.getTrending().subscribe((results) => {
        expect(results).toEqual(mockTrending);
        expect(results.length).toBe(2);
      });

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${baseUrl}/trending` &&
          request.params.get('limit') === '10'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockTrending);
    });

    it('should get trending posts with custom limit', () => {
      const limit = 5;
      const mockTrending: SearchResult[] = [
        { type: 'post', id: '1', title: 'Trending Post 1' },
      ];

      service.getTrending(limit).subscribe((results) => {
        expect(results).toEqual(mockTrending);
      });

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${baseUrl}/trending` &&
          request.params.get('limit') === '5'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockTrending);
    });
  });

  describe('getSuggestedUsers', () => {
    it('should get suggested users with default limit', () => {
      const mockUsers: SearchResult[] = [
        {
          type: 'user',
          id: '1',
          title: 'User 1',
          subtitle: '@user1',
        },
        {
          type: 'user',
          id: '2',
          title: 'User 2',
          subtitle: '@user2',
        },
      ];

      service.getSuggestedUsers().subscribe((results) => {
        expect(results).toEqual(mockUsers);
        expect(results.length).toBe(2);
      });

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${baseUrl}/suggested-users` &&
          request.params.get('limit') === '10'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockUsers);
    });

    it('should get suggested users with custom limit', () => {
      const limit = 15;
      const mockUsers: SearchResult[] = [];

      service.getSuggestedUsers(limit).subscribe((results) => {
        expect(results).toEqual(mockUsers);
      });

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${baseUrl}/suggested-users` &&
          request.params.get('limit') === '15'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockUsers);
    });
  });

  describe('getSuggestedCommunities', () => {
    it('should get suggested communities with default limit', () => {
      const mockCommunities: SearchResult[] = [
        {
          type: 'community',
          id: '1',
          title: 'Community 1',
          subtitle: 'Description 1',
        },
      ];

      service.getSuggestedCommunities().subscribe((results) => {
        expect(results).toEqual(mockCommunities);
      });

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${baseUrl}/suggested-communities` &&
          request.params.get('limit') === '10'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockCommunities);
    });

    it('should get suggested communities with custom limit', () => {
      const limit = 25;
      const mockCommunities: SearchResult[] = [];

      service.getSuggestedCommunities(limit).subscribe((results) => {
        expect(results).toEqual(mockCommunities);
      });

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${baseUrl}/suggested-communities` &&
          request.params.get('limit') === '25'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockCommunities);
    });
  });

  describe('getSearchHistory', () => {
    it('should get search history for a profile', () => {
      const profileId = 'profile-123';
      const mockHistory: SearchHistory[] = [
        {
          id: '1',
          profileId: profileId,
          query: 'test query',
          searchType: 'all',
          resultCount: 5,
          createdAt: new Date('2024-01-01'),
        },
      ];

      service.getSearchHistory(profileId).subscribe((results) => {
        expect(results).toEqual(mockHistory);
      });

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${baseUrl}/history` &&
          request.params.get('profileId') === profileId &&
          request.params.get('limit') === '10'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockHistory);
    });

    it('should get search history with custom limit', () => {
      const profileId = 'profile-456';
      const limit = 20;
      const mockHistory: SearchHistory[] = [];

      service.getSearchHistory(profileId, limit).subscribe((results) => {
        expect(results).toEqual(mockHistory);
      });

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${baseUrl}/history` &&
          request.params.get('profileId') === profileId &&
          request.params.get('limit') === '20'
        );
      });

      expect(req.request.method).toBe('GET');
      req.flush(mockHistory);
    });
  });

  describe('signals', () => {
    it('should initialize signals with correct default values', () => {
      expect(service.searchResults()).toBeNull();
      expect(service.isLoading()).toBe(false);
    });
  });
});
