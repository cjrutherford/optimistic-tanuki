import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SearchService, SearchResult } from '../search.service';
import {
  SpinnerComponent,
  CardComponent,
  ButtonComponent,
  TabsComponent,
} from '@optimistic-tanuki/common-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'search-explore-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SpinnerComponent,
    CardComponent,
    ButtonComponent,
    TabsComponent,
  ],
  template: `
    <div class="explore-page">
      <header class="page-header">
        <h1>Explore</h1>
        <p>Discover new people, communities, and trending content</p>
      </header>

      @if (isLoading()) {
      <div class="loading-container">
        <otui-spinner></otui-spinner>
      </div>
      } @else {
      <otui-tabs
        [tabs]="tabOptions"
        [activeTab]="activeTab()"
        (tabChange)="onTabChange($event)"
      >
        <div class="content-grid">
          @for (post of trendingPosts(); track post.id) {
          <otui-card
            class="content-card"
            [clickable]="true"
            (click)="navigateTo(['/feed/post', post.id])"
          >
            <div class="card-content">
              <h3>{{ post.title }}</h3>
              <p>{{ post.highlight }}</p>
            </div>
          </otui-card>
          }
        </div>

        <div class="people-grid">
          @for (user of suggestedUsers(); track user.id) {
          <div class="user-card">
            <img
              [src]="user.imageUrl || '/assets/default-avatar.png'"
              class="user-avatar"
              alt=""
            />
            <h4>{{ user.title }}</h4>
            <p>{{ user.subtitle }}</p>
            <otui-button
              variant="outlined"
              (click)="navigateTo(['/profile', user.id])"
              >View Profile</otui-button
            >
          </div>
          }
        </div>

        <div class="communities-grid">
          @for (community of suggestedCommunities(); track community.id) {
          <otui-card
            class="community-card"
            [clickable]="true"
            (click)="navigateTo(['/communities', community.id])"
          >
            <img
              [src]="community.imageUrl || '/assets/default-community.png'"
              class="community-image"
              alt=""
            />
            <div class="card-content">
              <h3>{{ community.title }}</h3>
              <p>{{ community.subtitle }}</p>
            </div>
          </otui-card>
          }
        </div>
      </otui-tabs>
      }
    </div>
  `,
  styles: [
    `
      .explore-page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px;
      }
      .page-header {
        margin-bottom: 32px;
        h1 {
          font-size: 32px;
          margin-bottom: 8px;
        }
        p {
          color: var(--muted);
        }
      }
      .loading-container {
        display: flex;
        justify-content: center;
        padding: 48px;
      }
      .content-grid,
      .people-grid,
      .communities-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 24px;
        padding: 24px 0;
      }
      .content-card,
      .community-card {
        cursor: pointer;
        transition: transform 0.2s;
        &:hover {
          transform: translateY(-4px);
        }
      }
      .user-card {
        text-align: center;
        padding: 24px;
        background: var(--surface);
        border-radius: 12px;
        border: 1px solid var(--border);
      }
      .user-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        margin-bottom: 16px;
      }
      .community-image {
        width: 100%;
        height: 120px;
        object-fit: cover;
        border-radius: 12px 12px 0 0;
      }
      .card-content {
        padding: 16px;
        h3 {
          margin: 0 0 8px;
          font-size: 18px;
        }
        p {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
        }
      }
    `,
  ],
})
export class ExplorePageComponent implements OnInit {
  private searchService = inject(SearchService);
  private router = inject(Router);
  protected themeService = inject(ThemeService);

  isLoading = signal(true);
  activeTab = signal('trending');
  trendingPosts = signal<SearchResult[]>([]);
  suggestedUsers = signal<SearchResult[]>([]);
  suggestedCommunities = signal<SearchResult[]>([]);

  tabOptions = [
    { id: 'trending', label: 'Trending' },
    { id: 'people', label: 'Suggested People' },
    { id: 'communities', label: 'Suggested Communities' },
  ];

  ngOnInit(): void {
    this.loadContent();
  }

  onTabChange(tabId: string): void {
    this.activeTab.set(tabId);
  }

  navigateTo(path: string[]): void {
    this.router.navigate(path);
  }

  private loadContent(): void {
    this.searchService.getTrending(10).subscribe({
      next: (posts) => {
        this.trendingPosts.set(posts);
        this.checkLoadingComplete();
      },
    });

    this.searchService.getSuggestedUsers(10).subscribe({
      next: (users) => {
        this.suggestedUsers.set(users);
        this.checkLoadingComplete();
      },
    });

    this.searchService.getSuggestedCommunities(10).subscribe({
      next: (communities) => {
        this.suggestedCommunities.set(communities);
        this.checkLoadingComplete();
      },
    });
  }

  private checkLoadingComplete(): void {
    if (
      this.trendingPosts().length > 0 ||
      this.suggestedUsers().length > 0 ||
      this.suggestedCommunities().length > 0
    ) {
      this.isLoading.set(false);
    }
  }
}
