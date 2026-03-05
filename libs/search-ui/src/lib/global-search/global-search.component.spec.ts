import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GlobalSearchComponent } from './global-search.component';
import { SearchService } from '../search.service';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SearchResponse } from '../search.model';
import { signal } from '@angular/core';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('GlobalSearchComponent', () => {
  let component: GlobalSearchComponent;
  let fixture: ComponentFixture<GlobalSearchComponent>;
  let mockSearchService: jest.Mocked<Partial<SearchService>>;
  let mockRouter: jest.Mocked<Partial<Router>>;

  const mockSearchResponse: SearchResponse = {
    users: [
      {
        type: 'user',
        id: '1',
        title: 'John Doe',
        subtitle: '@johndoe',
        imageUrl: '/avatar1.jpg',
      },
    ],
    posts: [
      {
        type: 'post',
        id: '1',
        title: 'Test Post',
        highlight: 'This is a test post...',
      },
    ],
    communities: [
      {
        type: 'community',
        id: '1',
        title: 'Test Community',
        subtitle: 'A test community',
        imageUrl: '/community1.jpg',
      },
    ],
    total: 3,
  };

  beforeEach(async () => {
    mockSearchService = {
      search: jest.fn().mockReturnValue(of(mockSearchResponse)),
      searchResults: signal(null),
      isLoading: signal(false),
    };

    mockRouter = {
      navigate: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [GlobalSearchComponent],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA], // Ignore unknown elements/components
    }).compileComponents();

    fixture = TestBed.createComponent(GlobalSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty search query and no results', () => {
    expect(component.searchQuery()).toBe('');
    expect(component.results()).toBeNull();
    expect(component.isLoading()).toBe(false);
  });

  it('should use default placeholder', () => {
    expect(component.placeholder()).toBe(
      'Search for people, posts, communities...'
    );
  });

  describe('onSearchChange', () => {
    it('should update searchQuery signal', () => {
      component.onSearchChange('test');
      expect(component.searchQuery()).toBe('test');
    });

    it('should clear results when query is less than 2 characters', () => {
      component.results.set(mockSearchResponse);
      component.onSearchChange('a');
      expect(component.results()).toBeNull();
    });

    it('should trigger search when query is 2 or more characters', (done) => {
      component.onSearchChange('te');

      // Wait for debounce
      setTimeout(() => {
        expect(mockSearchService.search).toHaveBeenCalledWith('te');
        done();
      }, 350); // 300ms debounce + buffer
    });

    it('should debounce multiple rapid searches', (done) => {
      component.onSearchChange('t');
      component.onSearchChange('te');
      component.onSearchChange('tes');
      component.onSearchChange('test');

      setTimeout(() => {
        // Should only call search once with the final value
        expect(mockSearchService.search).toHaveBeenCalledTimes(1);
        expect(mockSearchService.search).toHaveBeenCalledWith('test');
        done();
      }, 350);
    });

    it('should set loading state during search', (done) => {
      component.onSearchChange('test');

      setTimeout(() => {
        expect(component.isLoading()).toBe(false);
        done();
      }, 350);
    });

    it('should handle search errors gracefully', (done) => {
      mockSearchService.search = jest
        .fn()
        .mockReturnValue(throwError(() => new Error('Search failed')));

      component.onSearchChange('test');

      setTimeout(() => {
        expect(component.isLoading()).toBe(false);
        done();
      }, 350);
    });

    it('should set results on successful search', (done) => {
      component.onSearchChange('test');

      setTimeout(() => {
        expect(component.results()).toEqual(mockSearchResponse);
        done();
      }, 350);
    });
  });

  describe('clearSearch', () => {
    it('should clear search query', () => {
      component.searchQuery.set('test');
      component.clearSearch();
      expect(component.searchQuery()).toBe('');
    });

    it('should clear results', () => {
      component.results.set(mockSearchResponse);
      component.clearSearch();
      expect(component.results()).toBeNull();
    });
  });
});
