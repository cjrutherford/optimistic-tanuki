import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import { FeedService, DailyPostDto } from '../../services/feed.service';
import { ProfileService } from '../../services/profile.service';
import { MessageService } from '../../services/message.service';
import { TitlePipe } from '../../pipes/title.pipe';
import { firstValueFrom } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, DatePipe, CardComponent, TitlePipe],
  template: `
    <div class="feed-container">
      <h1 class="page-title">Community Feed</h1>
      <p class="feed-subtitle">
        See what others are sharing in their wellness journey
      </p>

      <div class="posts-grid">
        @for (post of posts(); track post.id) {
        <otui-card class="post-card">
          <div class="post-header">
            <img
              [src]="post.userAvatar || 'https://placehold.co/120x120'"
              [alt]="post.userName || 'User'"
              class="avatar"
            />
            <div class="post-meta">
              <h3 class="user-name">{{ post.userName || 'Unknown User' }}</h3>
              <span class="post-date">{{ post.createdAt | date : 'medium' }}</span>
            </div>
            @if (post.public) {
            <span class="public-badge">Public</span>
            }
          </div>

          <div class="post-content">
            @for (prompt of getPrompts(post); track prompt[0]) {
            <div class="prompt-section">
              <h4>{{ prompt[0] | title }}</h4>
              <p>{{ prompt[1] }}</p>
            </div>
            }
          </div>
        </otui-card>
        } @empty {
        <div class="empty-state">
          <p>No public posts yet. Be the first to share!</p>
        </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .feed-container {
      max-width: 800px;
      margin: 0 auto;
      padding: var(--spacing-lg, 24px);
    }

    .page-title {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: var(--spacing-sm, 8px);
      color: var(--foreground, #212121);
    }

    .feed-subtitle {
      color: var(--muted, #6b7280);
      margin-bottom: var(--spacing-xl, 32px);
    }

    .posts-grid {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-lg, 24px);
    }

    .post-card {
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .post-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
    }

    .post-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-md, 16px);
      margin-bottom: var(--spacing-lg, 24px);
      padding-bottom: var(--spacing-md, 16px);
      border-bottom: 1px solid var(--border, #e5e7eb);
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      object-fit: cover;
    }

    .post-meta {
      flex: 1;
    }

    .user-name {
      font-size: 1rem;
      font-weight: 600;
      color: var(--foreground, #1f2937);
      margin: 0;
    }

    .post-date {
      font-size: 0.875rem;
      color: var(--muted, #6b7280);
    }

    .public-badge {
      background: var(--success-light, #d1fae5);
      color: var(--success, #059669);
      padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
      border-radius: var(--border-radius-full, 9999px);
      font-size: 0.75rem;
      font-weight: 500;
    }

    .post-content {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md, 16px);
    }

    .prompt-section {
      padding: var(--spacing-md, 16px);
      background: var(--surface-alt, #f9fafb);
      border-radius: var(--border-radius-md, 8px);
    }

    .prompt-section h4 {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--primary, #4f46e5);
      margin: 0 0 var(--spacing-xs, 4px) 0;
      text-transform: capitalize;
    }

    .prompt-section p {
      margin: 0;
      color: var(--foreground, #374151);
      line-height: 1.6;
    }

    .empty-state {
      text-align: center;
      padding: var(--spacing-2xl, 48px);
      color: var(--muted, #6b7280);
    }

    .empty-state p {
      font-size: 1.125rem;
    }
  `],
})
export class FeedComponent implements OnInit {
  private readonly feedService = inject(FeedService);
  private readonly profileService = inject(ProfileService);
  private readonly messageService = inject(MessageService);

  posts = signal<DailyPostDto[]>([]);

  ngOnInit(): void {
    this.loadFeed();
  }

  getPrompts(post: DailyPostDto): [string, string][] {
    return Object.entries(post.prompts);
  }

  private loadFeed(): void {
    this.feedService.loadPosts().subscribe({
      next: (posts) => {
        this.loadUserDataForPosts(posts);
      },
      error: (error) => {
        console.error('Error loading feed:', error);
        this.messageService.error(
          'Failed to load community feed. Please try again later.'
        );
      },
    });
  }

  private async loadUserDataForPosts(posts: DailyPostDto[]): Promise<void> {
    const userIds = [...new Set(posts.map((p) => p.userId))];
    
    try {
      const userProfiles = await Promise.all(
        userIds.map(async (userId) => {
          try {
            const profile = await this.profileService.getProfileById(userId);
            return { userId, profile };
          } catch {
            return { userId, profile: null as ProfileDto | null };
          }
        })
      );

      const userMap = new Map<string, ProfileDto | null>();
      userProfiles.forEach((up) => {
        if (up.profile) {
          userMap.set(up.userId, up.profile);
        }
      });

      const enrichedPosts = posts.map((post) => {
        const profile = userMap.get(post.userId);
        return {
          ...post,
          userAvatar: profile?.profilePic || 'https://placehold.co/120x120',
          userName: profile?.profileName || 'Unknown User',
        };
      });

      this.posts.set(enrichedPosts);
    } catch (error) {
      console.error('Error loading user data:', error);
      this.posts.set(posts);
    }
  }
}
