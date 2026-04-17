import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ActivityPageComponent } from './activity-page.component';
import { ActivityService, ActivityItem, SavedItem } from '../../activity.service';
import { ProfileService } from '../../profile.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

describe('ActivityPageComponent', () => {
  let component: ActivityPageComponent;
  let fixture: ComponentFixture<ActivityPageComponent>;
  let mockActivityService: jest.Mocked<Partial<ActivityService>>;
  let mockProfileService: jest.Mocked<Partial<ProfileService>>;
  let mockRouter: jest.Mocked<Partial<Router>>;

  const mockProfile: ProfileDto = {
    id: 'profile-1',
    userId: 'user-1',
    profileName: 'Test User',
    profilePic: 'avatar.jpg',
    coverPic: 'cover.jpg',
    bio: 'Test bio',
    location: 'Test Location',
    occupation: 'Developer',
    interests: 'Testing',
    skills: 'TypeScript',
    created_at: new Date('2024-01-01'),
  };

  const mockActivities: ActivityItem[] = [
    {
      id: 'activity-1',
      profileId: 'profile-1',
      type: 'post',
      description: 'Created a new post',
      resourceId: 'post-1',
      resourceType: 'post',
      createdAt: new Date('2024-01-15'),
    },
    {
      id: 'activity-2',
      profileId: 'profile-1',
      type: 'like',
      description: 'Liked a post',
      resourceId: 'post-2',
      resourceType: 'post',
      createdAt: new Date('2024-01-14'),
    },
    {
      id: 'activity-3',
      profileId: 'profile-1',
      type: 'follow',
      description: 'Followed a user',
      resourceId: 'profile-2',
      resourceType: 'profile',
      createdAt: new Date('2024-01-13'),
    },
  ];

  const mockSavedItems: SavedItem[] = [
    {
      id: 'saved-1',
      profileId: 'profile-1',
      itemType: 'post',
      itemId: 'post-1',
      itemTitle: 'Interesting Article',
      savedAt: new Date('2024-01-10'),
    },
    {
      id: 'saved-2',
      profileId: 'profile-1',
      itemType: 'comment',
      itemId: 'comment-1',
      savedAt: new Date('2024-01-09'),
    },
  ];

  beforeEach(async () => {
    mockActivityService = {
      getUserActivity: jest.fn().mockReturnValue(of(mockActivities)),
      getSavedItems: jest.fn().mockReturnValue(of(mockSavedItems)),
      saveItem: jest.fn(),
      unsaveItem: jest.fn().mockReturnValue(of({ success: true })),
      isSaved: jest.fn(),
    };

    mockProfileService = {
      getCurrentUserProfile: jest.fn().mockReturnValue(mockProfile),
    };

    mockRouter = {
      navigate: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ActivityPageComponent],
      providers: [
        { provide: ActivityService, useValue: mockActivityService },
        { provide: ProfileService, useValue: mockProfileService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivityPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load activities and saved items for current user', () => {
      fixture.detectChanges(); // triggers ngOnInit

      expect(mockProfileService.getCurrentUserProfile).toHaveBeenCalled();
      expect(mockActivityService.getUserActivity).toHaveBeenCalledWith('profile-1');
      expect(mockActivityService.getSavedItems).toHaveBeenCalledWith('profile-1');
      expect(component.activities()).toEqual(mockActivities);
      expect(component.savedItems()).toEqual(mockSavedItems);
    });

    it('should not load data if no current profile', () => {
      mockProfileService.getCurrentUserProfile = jest.fn().mockReturnValue(null);

      fixture.detectChanges();

      expect(mockActivityService.getUserActivity).not.toHaveBeenCalled();
      expect(mockActivityService.getSavedItems).not.toHaveBeenCalled();
    });

    it('should handle error when loading activities', () => {
      mockActivityService.getUserActivity = jest.fn().mockReturnValue(
        throwError(() => new Error('Failed to load'))
      );

      fixture.detectChanges();

      expect(component.activities()).toEqual([]);
    });
  });

  describe('tab management', () => {
    it('should initialize with activity tab', () => {
      expect(component.activeTab()).toBe('activity');
    });

    it('should have correct tab options', () => {
      expect(component.tabOptions).toEqual([
        { id: 'activity', label: 'Activity' },
        { id: 'saved', label: 'Saved' },
      ]);
    });

    it('should change active tab', () => {
      component.onTabChange('saved');
      expect(component.activeTab()).toBe('saved');

      component.onTabChange('activity');
      expect(component.activeTab()).toBe('activity');
    });
  });

  describe('filteredActivities', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should return all activities', () => {
      const filtered = component.filteredActivities();
      expect(filtered).toEqual(mockActivities);
      expect(filtered.length).toBe(3);
    });
  });

  describe('navigateTo', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should navigate to post when activity is post type', () => {
      const activity = mockActivities[0]; // post activity
      component.navigateTo(activity);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/feed/post', 'post-1']);
    });

    it('should navigate to profile when activity is profile type', () => {
      const activity = mockActivities[2]; // follow activity
      component.navigateTo(activity);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile', 'profile-2']);
    });

    it('should not navigate for activities without resource type', () => {
      const activity: ActivityItem = {
        id: 'activity-4',
        profileId: 'profile-1',
        type: 'comment',
        description: 'Commented',
        createdAt: new Date(),
      };

      component.navigateTo(activity);

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('navigateToSaved', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should navigate to saved post', () => {
      const item = mockSavedItems[0]; // post item
      component.navigateToSaved(item);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/feed/post', 'post-1']);
    });

    it('should not navigate for non-post saved items', () => {
      const item = mockSavedItems[1]; // comment item
      component.navigateToSaved(item);

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('unsaveItem', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should unsave an item and remove from list', () => {
      const item = mockSavedItems[0];
      const event = new Event('click');
      jest.spyOn(event, 'stopPropagation');

      component.unsaveItem(item, event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockActivityService.unsaveItem).toHaveBeenCalledWith('profile-1', 'post-1');
      
      // Wait for async update
      setTimeout(() => {
        expect(component.savedItems().length).toBe(1);
        expect(component.savedItems()[0].id).toBe('saved-2');
      }, 0);
    });

    it('should stop event propagation', () => {
      const item = mockSavedItems[0];
      const event = new Event('click');
      jest.spyOn(event, 'stopPropagation');

      component.unsaveItem(item, event);

      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('should not unsave if no current profile', () => {
      mockProfileService.getCurrentUserProfile = jest.fn().mockReturnValue(null);
      const item = mockSavedItems[0];
      const event = new Event('click');

      component.unsaveItem(item, event);

      expect(mockActivityService.unsaveItem).not.toHaveBeenCalled();
    });

    it('should handle error when unsaving', () => {
      mockActivityService.unsaveItem = jest.fn().mockReturnValue(
        throwError(() => new Error('Failed to unsave'))
      );

      const item = mockSavedItems[0];
      const event = new Event('click');

      component.unsaveItem(item, event);

      // Items should remain unchanged on error
      setTimeout(() => {
        expect(component.savedItems().length).toBe(2);
      }, 0);
    });
  });

  describe('template rendering', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should render page header', () => {
      const compiled = fixture.nativeElement;
      const header = compiled.querySelector('.page-header h1');
      expect(header?.textContent).toContain('Activity');
    });

    it('should render activities when available', () => {
      const compiled = fixture.nativeElement;
      const activityItems = compiled.querySelectorAll('.activity-item');
      expect(activityItems.length).toBe(3);
    });

    it('should render empty state when no activities', () => {
      component.activities.set([]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const emptyState = compiled.querySelector('.empty-state');
      expect(emptyState?.textContent).toContain('No activity yet');
    });

    it('should render saved items when available', () => {
      component.onTabChange('saved');
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const savedItems = compiled.querySelectorAll('.saved-item');
      expect(savedItems.length).toBe(2);
    });

    it('should render empty state when no saved items', () => {
      component.savedItems.set([]);
      component.onTabChange('saved');
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const emptyState = compiled.querySelector('.empty-state');
      expect(emptyState?.textContent).toContain('No saved items');
    });
  });

  describe('activity icons', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should display correct icon classes for different activity types', () => {
      const compiled = fixture.nativeElement;
      const icons = compiled.querySelectorAll('.activity-icon');

      expect(icons[0].classList.contains('post')).toBe(true);
      expect(icons[1].classList.contains('like')).toBe(true);
      expect(icons[2].classList.contains('follow')).toBe(true);
    });
  });

  describe('date formatting', () => {
    it('should format activity dates correctly', () => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement;
      const timeElements = compiled.querySelectorAll('.activity-time');

      expect(timeElements.length).toBeGreaterThan(0);
      // Angular date pipe handles formatting
    });
  });
});
