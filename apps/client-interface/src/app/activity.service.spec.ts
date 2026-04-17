import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivityService, ActivityItem, SavedItem } from './activity.service';

describe('ActivityService', () => {
  let service: ActivityService;
  let httpMock: HttpTestingController;
  const baseUrl = '/api/activity';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ActivityService],
    });

    service = TestBed.inject(ActivityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getUserActivity', () => {
    it('should get user activities without options', (done) => {
      const profileId = 'profile-1';
      const mockActivities: ActivityItem[] = [
        {
          id: 'activity-1',
          profileId,
          type: 'post',
          description: 'Created a post',
          resourceId: 'post-1',
          resourceType: 'post',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'activity-2',
          profileId,
          type: 'like',
          description: 'Liked a post',
          resourceId: 'post-2',
          resourceType: 'post',
          createdAt: new Date('2024-01-02'),
        },
      ];

      service.getUserActivity(profileId).subscribe((activities) => {
        expect(activities).toEqual(mockActivities);
        expect(activities.length).toBe(2);
        done();
      });

      const req = httpMock.expectOne(`${baseUrl}/${profileId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockActivities);
    });

    it('should get user activities with type filter', (done) => {
      const profileId = 'profile-1';
      const options = { type: 'like' };
      const mockActivities: ActivityItem[] = [
        {
          id: 'activity-1',
          profileId,
          type: 'like',
          description: 'Liked a post',
          createdAt: new Date(),
        },
      ];

      service.getUserActivity(profileId, options).subscribe((activities) => {
        expect(activities).toEqual(mockActivities);
        done();
      });

      const req = httpMock.expectOne(`${baseUrl}/${profileId}?type=like`);
      expect(req.request.method).toBe('GET');
      req.flush(mockActivities);
    });

    it('should get user activities with pagination', (done) => {
      const profileId = 'profile-1';
      const options = { limit: 10, offset: 20 };

      service.getUserActivity(profileId, options).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/${profileId}?limit=10&offset=20`
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should get user activities with all options', (done) => {
      const profileId = 'profile-1';
      const options = { type: 'comment', limit: 15, offset: 5 };

      service.getUserActivity(profileId, options).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/${profileId}?type=comment&limit=15&offset=5`
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getSavedItems', () => {
    it('should get saved items for a profile', (done) => {
      const profileId = 'profile-1';
      const mockSavedItems: SavedItem[] = [
        {
          id: 'saved-1',
          profileId,
          itemType: 'post',
          itemId: 'post-1',
          itemTitle: 'Interesting Post',
          savedAt: new Date('2024-01-01'),
        },
        {
          id: 'saved-2',
          profileId,
          itemType: 'comment',
          itemId: 'comment-1',
          savedAt: new Date('2024-01-02'),
        },
      ];

      service.getSavedItems(profileId).subscribe((items) => {
        expect(items).toEqual(mockSavedItems);
        expect(items.length).toBe(2);
        done();
      });

      const req = httpMock.expectOne(`${baseUrl}/${profileId}/saved`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSavedItems);
    });

    it('should return empty array when no saved items', (done) => {
      const profileId = 'profile-1';

      service.getSavedItems(profileId).subscribe((items) => {
        expect(items).toEqual([]);
        done();
      });

      const req = httpMock.expectOne(`${baseUrl}/${profileId}/saved`);
      req.flush([]);
    });
  });

  describe('saveItem', () => {
    it('should save an item with title', (done) => {
      const profileId = 'profile-1';
      const itemType = 'post' as const;
      const itemId = 'post-1';
      const itemTitle = 'My Favorite Post';

      const mockResponse: SavedItem = {
        id: 'saved-1',
        profileId,
        itemType,
        itemId,
        itemTitle,
        savedAt: new Date('2024-01-01'),
      };

      service
        .saveItem(profileId, itemType, itemId, itemTitle)
        .subscribe((item) => {
          expect(item).toEqual(mockResponse);
          expect(item.itemTitle).toBe(itemTitle);
          done();
        });

      const req = httpMock.expectOne(`${baseUrl}/${profileId}/saved`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ itemType, itemId, itemTitle });
      req.flush(mockResponse);
    });

    it('should save an item without title', (done) => {
      const profileId = 'profile-1';
      const itemType = 'comment' as const;
      const itemId = 'comment-1';

      const mockResponse: SavedItem = {
        id: 'saved-2',
        profileId,
        itemType,
        itemId,
        savedAt: new Date(),
      };

      service.saveItem(profileId, itemType, itemId).subscribe((item) => {
        expect(item).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${baseUrl}/${profileId}/saved`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        itemType,
        itemId,
        itemTitle: undefined,
      });
      req.flush(mockResponse);
    });
  });

  describe('unsaveItem', () => {
    it('should unsave an item', (done) => {
      const profileId = 'profile-1';
      const itemId = 'post-1';

      service.unsaveItem(profileId, itemId).subscribe((response) => {
        expect(response.success).toBe(true);
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/${profileId}/saved/${itemId}`
      );
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true });
    });
  });

  describe('isSaved', () => {
    it('should return true when item is saved', (done) => {
      const profileId = 'profile-1';
      const itemId = 'post-1';

      service.isSaved(profileId, itemId).subscribe((response) => {
        expect(response.saved).toBe(true);
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/${profileId}/saved/${itemId}`
      );
      expect(req.request.method).toBe('GET');
      req.flush({ saved: true });
    });

    it('should return false when item is not saved', (done) => {
      const profileId = 'profile-1';
      const itemId = 'post-2';

      service.isSaved(profileId, itemId).subscribe((response) => {
        expect(response.saved).toBe(false);
        done();
      });

      const req = httpMock.expectOne(
        `${baseUrl}/${profileId}/saved/${itemId}`
      );
      req.flush({ saved: false });
    });
  });

  describe('error handling', () => {
    it('should handle HTTP errors gracefully', (done) => {
      const profileId = 'profile-1';

      service.getUserActivity(profileId).subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.status).toBe(500);
          done();
        },
      });

      const req = httpMock.expectOne(`${baseUrl}/${profileId}`);
      req.flush('Server error', { status: 500, statusText: 'Server Error' });
    });

    it('should handle 404 errors when getting saved items', (done) => {
      const profileId = 'non-existent';

      service.getSavedItems(profileId).subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.status).toBe(404);
          done();
        },
      });

      const req = httpMock.expectOne(`${baseUrl}/${profileId}/saved`);
      req.flush('Not found', { status: 404, statusText: 'Not Found' });
    });
  });
});
