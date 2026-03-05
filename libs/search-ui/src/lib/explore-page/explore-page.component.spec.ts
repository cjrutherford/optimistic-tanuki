import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ExplorePageComponent } from './explore-page.component';
import { SearchService } from '../search.service';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SearchResult } from '../search.model';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ExplorePageComponent', () => {
  let component: ExplorePageComponent;
  let fixture: ComponentFixture<ExplorePageComponent>;
  let mockSearchService: jest.Mocked<Partial<SearchService>>;
  let mockRouter: jest.Mocked<Partial<Router>>;
  let mockThemeService: jest.Mocked<Partial<ThemeService>>;

  const mockTrendingPosts: SearchResult[] = [
    { type: 'post', id: '1', title: 'Trending 1', highlight: 'Highlight 1' },
    { type: 'post', id: '2', title: 'Trending 2', highlight: 'Highlight 2' },
  ];

  const mockSuggestedUsers: SearchResult[] = [
    {
      type: 'user',
      id: '1',
      title: 'User 1',
      subtitle: '@user1',
      imageUrl: '/avatar1.jpg',
    },
    {
      type: 'user',
      id: '2',
      title: 'User 2',
      subtitle: '@user2',
      imageUrl: '/avatar2.jpg',
    },
  ];

  const mockSuggestedCommunities: SearchResult[] = [
    {
      type: 'community',
      id: '1',
      title: 'Community 1',
      subtitle: 'Description 1',
      imageUrl: '/community1.jpg',
    },
  ];

  beforeEach(async () => {
    mockSearchService = {
      getTrending: jest.fn().mockReturnValue(of(mockTrendingPosts)),
      getSuggestedUsers: jest.fn().mockReturnValue(of(mockSuggestedUsers)),
      getSuggestedCommunities: jest
        .fn()
        .mockReturnValue(of(mockSuggestedCommunities)),
    };

    mockRouter = {
      navigate: jest.fn().mockResolvedValue(true),
    };

    mockThemeService = {
      themeColors$: of({
        background: '#ffffff',
        foreground: '#000000',
        accent: '#3f51b5',
        complementary: '#c0af4b',
        tertiary: '#7e57c2',
        success: '#4caf50',
        danger: '#f44336',
        warning: '#ff9800',
        theme: 'light' as const,
        complementaryGradients: {
          light: 'linear-gradient(135deg, #c0af4b, #3f51b5)',
          dark: 'linear-gradient(135deg, #7e57c2, #c0af4b)',
        },
      }),
      getTheme: jest.fn().mockReturnValue('light'),
      setTheme: jest.fn(),
    } as any;

    await TestBed.configureTestingModule({
      imports: [ExplorePageComponent],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
        { provide: Router, useValue: mockRouter },
        { provide: ThemeService, useValue: mockThemeService },
      ],
      schemas: [NO_ERRORS_SCHEMA], // Ignore unknown elements/components
    }).compileComponents();

    fixture = TestBed.createComponent(ExplorePageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with loading state', () => {
    expect(component.isLoading()).toBe(true);
  });

  it('should initialize with trending tab active', () => {
    expect(component.activeTab()).toBe('trending');
  });

  describe('ngOnInit', () => {
    it('should load all content on init', fakeAsync(() => {
      fixture.detectChanges(); // triggers ngOnInit
      tick(); // Process all pending async

      expect(mockSearchService.getTrending).toHaveBeenCalledWith(10);
      expect(mockSearchService.getSuggestedUsers).toHaveBeenCalledWith(10);
      expect(mockSearchService.getSuggestedCommunities).toHaveBeenCalledWith(
        10
      );
    }));

    it('should set trending posts', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      expect(component.trendingPosts()).toEqual(mockTrendingPosts);
    }));

    it('should set suggested users', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      expect(component.suggestedUsers()).toEqual(mockSuggestedUsers);
    }));

    it('should set suggested communities', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      expect(component.suggestedCommunities()).toEqual(
        mockSuggestedCommunities
      );
    }));

    it('should set isLoading to false after content loads', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      expect(component.isLoading()).toBe(false);
    }));
  });

  describe('onTabChange', () => {
    it('should update activeTab signal', () => {
      component.onTabChange('people');
      expect(component.activeTab()).toBe('people');
    });

    it('should switch to communities tab', () => {
      component.onTabChange('communities');
      expect(component.activeTab()).toBe('communities');
    });

    it('should switch back to trending tab', () => {
      component.onTabChange('people');
      component.onTabChange('trending');
      expect(component.activeTab()).toBe('trending');
    });
  });

  describe('navigateTo', () => {
    it('should navigate to profile', () => {
      component.navigateTo(['/profile', '123']);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile', '123']);
    });

    it('should navigate to community', () => {
      component.navigateTo(['/communities', 'abc']);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/communities', 'abc']);
    });

    it('should navigate to post', () => {
      component.navigateTo(['/feed/post', '456']);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/feed/post', '456']);
    });
  });

  describe('tabOptions', () => {
    it('should have 3 tab options', () => {
      expect(component.tabOptions.length).toBe(3);
    });

    it('should have trending tab', () => {
      const trendingTab = component.tabOptions.find(
        (tab) => tab.id === 'trending'
      );
      expect(trendingTab).toBeDefined();
      expect(trendingTab?.label).toBe('Trending');
    });

    it('should have people tab', () => {
      const peopleTab = component.tabOptions.find((tab) => tab.id === 'people');
      expect(peopleTab).toBeDefined();
      expect(peopleTab?.label).toBe('Suggested People');
    });

    it('should have communities tab', () => {
      const communitiesTab = component.tabOptions.find(
        (tab) => tab.id === 'communities'
      );
      expect(communitiesTab).toBeDefined();
      expect(communitiesTab?.label).toBe('Suggested Communities');
    });
  });

  describe('checkLoadingComplete', () => {
    it('should set loading to false when any content is available', fakeAsync(() => {
      // This test relies on the default mocks which return non-empty arrays
      fixture.detectChanges();
      tick();

      expect(component.isLoading()).toBe(false);
    }));
  });
});
