import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from '../../auth-state.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-new-message',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="new-message-page">
      <div class="page-header">
        <button class="back-btn" (click)="goBack()">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>New Message</h1>
      </div>

      <div class="search-section">
        <input
          type="text"
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearchChange($event)"
          placeholder="Search for people..."
          class="search-input"
        />
      </div>

      @if (searching()) {
      <div class="loading">Searching...</div>
      } @if (!searching() && searchResults().length > 0) {
      <div class="results">
        @for (user of searchResults(); track user.id) {
        <div class="user-result" (click)="startChat(user)">
          <img
            [src]="user.profilePic || '/assets/default-avatar.png'"
            class="avatar"
            alt=""
          />
          <div class="user-info">
            <span class="name">{{ user.profileName }}</span>
            @if (user.bio) {
            <span class="bio">{{ user.bio }}</span>
            }
          </div>
        </div>
        }
      </div>
      } @if (!searching() && searchQuery && searchResults().length === 0 &&
      searched()) {
      <div class="no-results">No users found</div>
      }
    </div>
  `,
  styles: [
    `
      .new-message-page {
        max-width: 600px;
        margin: 0 auto;
        padding: 1rem;
      }

      .page-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;

        h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }
      }

      .back-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border: none;
        background: var(--surface);
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.2s;

        svg {
          width: 20px;
          height: 20px;
        }

        &:hover {
          background: var(--hover-bg);
        }
      }

      .search-section {
        margin-bottom: 1.5rem;
      }

      .search-input {
        width: 100%;
        padding: 12px 16px;
        font-size: 1rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        color: var(--foreground);
        outline: none;

        &:focus {
          border-color: var(--primary);
        }

        &::placeholder {
          color: var(--muted);
        }
      }

      .loading,
      .no-results {
        text-align: center;
        padding: 2rem;
        color: var(--muted);
      }

      .user-result {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;

        &:hover {
          background: var(--hover-bg);
        }
      }

      .avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        object-fit: cover;
      }

      .user-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .name {
        font-weight: 600;
        font-size: 1rem;
      }

      .bio {
        font-size: 0.875rem;
        color: var(--muted);
        max-width: 300px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class NewMessageComponent implements OnInit {
  private authStateService = inject(AuthStateService);
  private http = inject(HttpClient);
  private router = inject(Router);

  searchQuery = '';
  searchResults = signal<ProfileDto[]>([]);
  searching = signal(false);
  searched = signal(false);

  private searchTimeout: any;

  ngOnInit() {}

  onSearchChange(query: string): void {
    this.searchQuery = query;

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (query.length < 2) {
      this.searchResults.set([]);
      this.searched.set(false);
      return;
    }

    this.searching.set(true);
    this.searchTimeout = setTimeout(async () => {
      try {
        const results = await firstValueFrom(
          this.http.get<ProfileDto[]>('/api/profile', {
            params: { search: query },
          })
        );
        const currentUserId =
          this.authStateService.getDecodedTokenValue()?.profileId;
        this.searchResults.set(results.filter((p) => p.id !== currentUserId));
      } catch (err) {
        console.error('Search failed:', err);
        this.searchResults.set([]);
      } finally {
        this.searching.set(false);
        this.searched.set(true);
      }
    }, 300);
  }

  async startChat(user: ProfileDto): Promise<void> {
    const currentProfileId =
      this.authStateService.getDecodedTokenValue()?.profileId;
    if (!currentProfileId) return;

    try {
      const conversation = await firstValueFrom(
        this.http.post<any>('/api/chat/conversations/direct/get-or-create', {
          participantIds: [currentProfileId, user.id],
        })
      );
      this.router.navigate(['/messages'], {
        queryParams: { conversation: conversation.id },
      });
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  }

  goBack(): void {
    this.router.navigate(['/messages']);
  }
}
