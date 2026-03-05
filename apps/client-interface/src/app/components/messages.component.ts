import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ChatUiComponent,
  ChatContact,
  ChatConversation,
  ChatMessage,
  SocketChatService,
} from '@optimistic-tanuki/chat-ui';
import { ProfileService } from '../profile.service';
import {
  ChatService,
  ChatConversation as AppChatConversation,
} from '../chat.service';
import { PresenceService, UserPresence } from '../presence.service';
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
export class MessagesComponent implements OnInit, OnDestroy {
  private profileService = inject(ProfileService);
  private chatService = inject(ChatService);
  private presenceService = inject(PresenceService);
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
        conversations as unknown as AppChatConversation[]
      );
    });
    await this.loadConversations();
  }

  ngOnDestroy() {
    this.socketChatService.destroy();
  }

  private async loadConversations() {
    const profile = this.profileService.getCurrentUserProfile();
    if (!profile) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentProfileId = profile.id;
    this.socketChatService.getConversations(profile.id);
  }

  private async handleConversationsLoaded(
    conversations: AppChatConversation[]
  ) {
    try {
      const profile = this.profileService.getCurrentUserProfile();
      if (!profile) return;

      const allParticipantIds = new Set<string>();
      conversations.forEach((c) => {
        c.participants.forEach((p) => allParticipantIds.add(p));
      });

      const participantIds = Array.from(allParticipantIds);

      let profiles: ProfileDto[] = [];
      let presences: UserPresence[] = [];

      if (participantIds.length > 0) {
        const [profilesResponse, presencesResponse] = await Promise.all([
          firstValueFrom(
            this.http.post<ProfileDto[]>('/api/profile/by-ids', {
              ids: participantIds,
            })
          ),
          firstValueFrom(this.presenceService.getPresenceBatch(participantIds)),
        ]);
        profiles = profilesResponse;
        presences = presencesResponse;
      }

      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      const presenceMap = new Map(presences.map((p) => [p.userId, p]));

      const conversationMessagesPromises = conversations.map(async (conv) => {
        try {
          const messages = await this.chatService.getMessages(conv.id);
          const transformedMessages: ChatMessage[] = messages.map((m) => ({
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            content: m.content,
            type: m.type as 'chat' | 'info' | 'warning' | 'system',
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
          const presence = otherParticipantId
            ? presenceMap.get(otherParticipantId)
            : null;

          return {
            id: conv.id,
            name: otherProfile?.profileName || conv.title || 'Unknown',
            profilePic: otherProfile?.profilePic,
            presence: presence?.status || 'offline',
            lastSeen: presence?.lastSeen,
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
}
