import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ChatUiComponent,
  ChatContact,
  ChatConversation,
} from '@optimistic-tanuki/chat-ui';
import { ProfileService } from '../profile.service';
import {
  ChatService,
  ChatConversation as AppChatConversation,
} from '../chat.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, ChatUiComponent],
  template: `
    <div class="messages-page">
      <div class="page-header">
        <h1>Messages</h1>
        <p class="subtitle">Your conversations</p>
      </div>

      @if (loading()) {
      <div class="loading">Loading conversations...</div>
      } @else if (error()) {
      <div class="error">{{ error() }}</div>
      } @else {
      <lib-chat-ui
        [contacts]="chatContacts()"
        [conversations]="chatConversations()"
      ></lib-chat-ui>
      }
    </div>
  `,
  styles: [
    `
      .messages-page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
      }

      .page-header {
        margin-bottom: 2rem;

        h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 0 0 0.5rem 0;
          color: var(--foreground);
        }

        .subtitle {
          color: var(--muted);
          margin: 0;
        }
      }

      .loading,
      .error {
        text-align: center;
        padding: 2rem;
        color: var(--muted);
      }

      .error {
        color: #dc3545;
      }
    `,
  ],
})
export class MessagesComponent implements OnInit {
  private profileService = inject(ProfileService);
  private chatService = inject(ChatService);
  private http = inject(HttpClient);
  private router = inject(Router);

  chatContacts = signal<ChatContact[]>([]);
  chatConversations = signal<ChatConversation[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  async ngOnInit() {
    await this.loadConversations();
  }

  private async loadConversations() {
    const profile = this.profileService.getCurrentUserProfile();
    if (!profile) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const conversations: AppChatConversation[] =
        await this.chatService.getConversations(profile.id);

      const allParticipantIds = new Set<string>();
      conversations.forEach((c) => {
        c.participants.forEach((p) => allParticipantIds.add(p));
      });

      const participantIds = Array.from(allParticipantIds);

      let profiles: ProfileDto[] = [];
      if (participantIds.length > 0) {
        profiles = await firstValueFrom(
          this.http.post<ProfileDto[]>('/api/profile/by-ids', {
            ids: participantIds,
          })
        );
      }

      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      this.chatContacts.set(
        conversations.map((conv) => {
          const otherParticipantId = conv.participants.find(
            (p) => p !== profile.id
          );
          const otherProfile = otherParticipantId
            ? profileMap.get(otherParticipantId)
            : null;

          return {
            id: conv.id,
            name: otherProfile?.profileName || conv.title || 'Unknown',
            profilePic: otherProfile?.profilePic,
          };
        })
      );

      this.chatConversations.set(
        conversations.map((c) => ({
          id: c.id,
          participants: c.participants,
          messages: [],
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }))
      );

      this.loading.set(false);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      this.error.set('Failed to load conversations');
      this.loading.set(false);
    }
  }
}
