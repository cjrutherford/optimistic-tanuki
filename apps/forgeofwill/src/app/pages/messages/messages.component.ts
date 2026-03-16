import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  ChatUiComponent,
  ChatContact,
  ChatConversation,
  ChatMessage,
  SocketChatService,
} from '@optimistic-tanuki/chat-ui';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from '../../auth-state.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, ChatUiComponent, RouterModule],
  template: `
    <div class="messages-page">
      <div class="page-header">
        <div class="header-content">
          <h1>Messages</h1>
          <p class="subtitle">Your conversations</p>
        </div>
        <a routerLink="/messages/new" class="new-message-btn">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Message
        </a>
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
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 2rem;

        .header-content {
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
      }

      .new-message-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.875rem;
        cursor: pointer;
        text-decoration: none;
        transition: background 0.2s;

        svg {
          width: 18px;
          height: 18px;
        }

        &:hover {
          background: var(--primary-hover);
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
export class MessagesComponent implements OnInit, OnDestroy {
  private authStateService = inject(AuthStateService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private socketChatService = inject(SocketChatService);

  chatContacts = signal<ChatContact[]>([]);
  chatConversations = signal<ChatConversation[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  private currentProfileId: string | null = null;

  async ngOnInit() {
    this.socketChatService.onConversations((conversations) => {
      this.handleConversationsLoaded(
        conversations as unknown as ChatConversation[]
      );
    });
    await this.loadConversations();
  }

  ngOnDestroy() {
    this.socketChatService.destroy();
  }

  private async loadConversations() {
    const userData = this.authStateService.getDecodedTokenValue();
    if (!userData?.profileId) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentProfileId = userData.profileId;
    this.socketChatService.getConversations(userData.profileId);
  }

  private async handleConversationsLoaded(conversations: ChatConversation[]) {
    try {
      const userData = this.authStateService.getDecodedTokenValue();
      if (!userData?.profileId) return;

      const allParticipantIds = new Set<string>();
      conversations.forEach((c) => {
        c.participants.forEach((p) => allParticipantIds.add(p));
      });

      const participantIds = Array.from(allParticipantIds);

      let profiles: ProfileDto[] = [];

      if (participantIds.length > 0) {
        const profilesResponse = await firstValueFrom(
          this.http.post<ProfileDto[]>('/api/profile/by-ids', {
            ids: participantIds,
          })
        );
        profiles = profilesResponse;
      }

      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      const conversationMessagesPromises = conversations.map(async (conv) => {
        try {
          const messages = await this.getMessages(conv.id);
          const transformedMessages: ChatMessage[] = messages.map((m: any) => ({
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            content: m.content,
            type: (m.type as 'chat' | 'info' | 'warning' | 'system') || 'chat',
            recipientId: m.recipients || [],
            timestamp: new Date(m.createdAt),
          }));
          return { id: conv.id, messages: transformedMessages };
        } catch (err) {
          console.error(
            'Failed to load messages for conversation:',
            conv.id,
            err
          );
          return { id: conv.id, messages: [] as ChatMessage[] };
        }
      });

      const conversationMessages = await Promise.all(
        conversationMessagesPromises
      );
      const messagesMap = new Map(
        conversationMessages.map((cm) => [cm.id, cm.messages])
      );

      this.chatContacts.set(
        conversations.map((conv) => {
          const otherParticipantId = conv.participants.find(
            (p) => p !== this.currentProfileId
          );
          const otherProfile = otherParticipantId
            ? profileMap.get(otherParticipantId)
            : null;

          return {
            id: conv.id,
            name: otherProfile?.profileName || 'Unknown',
            profilePic: otherProfile?.profilePic,
            presence: 'offline' as const,
          };
        })
      );

      this.chatConversations.set(
        conversations.map((c) => ({
          id: c.id,
          participants: c.participants,
          messages: messagesMap.get(c.id) || [],
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }))
      );

      this.loading.set(false);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      this.error.set('Failed to load conversations. Please try again later.');
      this.loading.set(false);
    }
  }

  private async getMessages(conversationId: string): Promise<any[]> {
    return firstValueFrom(
      this.http.get<any[]>(`/api/chat/messages/${conversationId}`)
    ) as Promise<any[]>;
  }
}
