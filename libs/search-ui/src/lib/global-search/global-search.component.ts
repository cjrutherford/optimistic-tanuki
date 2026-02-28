import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  debounceTime,
  distinctUntilChanged,
  Subject,
  switchMap,
  of,
} from 'rxjs';
import { SearchService, SearchResult, SearchResponse } from '../search.service';

@Component({
  selector: 'search-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="search-container">
      <div class="search-input-wrapper">
        <svg
          class="search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          type="text"
          [ngModel]="searchQuery()"
          (ngModelChange)="onSearchChange($event)"
          [placeholder]="placeholder()"
          class="search-input"
        />
        @if (isLoading()) {
        <otui-spinner diameter="20"></otui-spinner>
        } @if (searchQuery()) {
        <button class="icon-button clear-btn" (click)="clearSearch()">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6 6 18M6 6l12 12"></path>
          </svg>
        </button>
        }
      </div>

      @if (results() && (results()!.users.length > 0 || results()!.posts.length
      > 0 || results()!.communities.length > 0)) {
      <div class="search-results">
        @if (results()!.users.length > 0) {
        <div class="result-section">
          <h4>People</h4>
          @for (user of results()!.users; track user.id) {
          <a
            [routerLink]="['/profile', user.id]"
            class="result-item"
            (click)="clearSearch()"
          >
            <img
              [src]="user.imageUrl || '/assets/default-avatar.png'"
              class="result-avatar"
              alt=""
            />
            <div class="result-info">
              <span class="result-title">{{ user.title }}</span>
              @if (user.subtitle) {
              <span class="result-subtitle">{{ user.subtitle }}</span>
              }
            </div>
          </a>
          }
        </div>
        } @if (results()!.communities.length > 0) {
        <div class="result-section">
          <h4>Communities</h4>
          @for (community of results()!.communities; track community.id) {
          <a
            [routerLink]="['/communities', community.id]"
            class="result-item"
            (click)="clearSearch()"
          >
            <img
              [src]="community.imageUrl || '/assets/default-community.png'"
              class="result-avatar"
              alt=""
            />
            <div class="result-info">
              <span class="result-title">{{ community.title }}</span>
              @if (community.subtitle) {
              <span class="result-subtitle">{{ community.subtitle }}</span>
              }
            </div>
          </a>
          }
        </div>
        } @if (results()!.posts.length > 0) {
        <div class="result-section">
          <h4>Posts</h4>
          @for (post of results()!.posts; track post.id) {
          <a
            [routerLink]="['/feed/post', post.id]"
            class="result-item"
            (click)="clearSearch()"
          >
            <svg
              class="result-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              ></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <div class="result-info">
              <span class="result-title">{{ post.title }}</span>
              @if (post.highlight) {
              <span class="result-subtitle">{{ post.highlight }}...</span>
              }
            </div>
          </a>
          }
        </div>
        }
      </div>
      }
    </div>
  `,
  styles: [
    `
      .search-container {
        position: relative;
        width: 100%;
        max-width: 600px;
      }
      .search-input-wrapper {
        display: flex;
        align-items: center;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 8px 16px;
        transition: border-color 0.2s, box-shadow 0.2s;

        &:focus-within {
          border-color: var(--search-primary, var(--primary));
          box-shadow: 0 0 0 2px
            color-mix(
              in srgb,
              var(--search-primary, var(--primary)) 20%,
              transparent
            );
        }
      }
      .search-icon {
        width: 20px;
        height: 20px;
        color: var(--muted);
        margin-right: 12px;
        flex-shrink: 0;
      }
      .search-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 14px;
        color: var(--foreground);
        outline: none;

        &::placeholder {
          color: var(--muted);
        }
      }
      .icon-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 50%;
        transition: background 0.2s;

        &:hover {
          background: var(--hover-bg);
        }
        svg {
          width: 16px;
          height: 16px;
        }
      }
      .clear-btn {
        margin-left: 8px;
      }
      .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        margin-top: 8px;
        max-height: 500px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      .result-section {
        padding: 12px 0;
        border-bottom: 1px solid var(--border);

        &:last-child {
          border-bottom: none;
        }

        h4 {
          margin: 0 16px 8px;
          font-size: 12px;
          text-transform: uppercase;
          color: var(--muted);
        }
      }
      .result-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        text-decoration: none;
        color: inherit;
        transition: background 0.2s;

        &:hover {
          background: var(--hover-bg);
        }
      }
      .result-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
      }
      .result-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--hover-bg);
        border-radius: 8px;
      }
      .result-info {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .result-title {
        font-weight: 500;
        font-size: 14px;
      }
      .result-subtitle {
        font-size: 12px;
        color: var(--muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class GlobalSearchComponent {
  @Input() placeholder = signal('Search for people, posts, communities...');
  @Output() searchResultClick = new EventEmitter<SearchResult>();

  protected searchService = inject(SearchService);
  protected router = inject(Router);
  private searchSubject = new Subject<string>();

  searchQuery = signal('');
  results = signal<SearchResponse | null>(null);
  isLoading = signal(false);

  constructor() {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.length < 2) {
            return of(null);
          }
          this.isLoading.set(true);
          return this.searchService.search(query);
        })
      )
      .subscribe({
        next: (results) => {
          this.results.set(results);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    if (query.length >= 2) {
      this.searchSubject.next(query);
    } else {
      this.results.set(null);
    }
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.results.set(null);
  }
}
