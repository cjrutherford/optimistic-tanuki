import {
  Component,
  OnInit,
  signal,
  inject,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  ChatUiComponent,
  ChatContact,
  ChatConversation,
  ChatMessage,
  ChatMessageSubmission,
  SocketChatService,
} from '@optimistic-tanuki/chat-ui';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OptomisitcTanukiAPIService as ProfileAPIService } from '@optimistic-tanuki/profile-ui-data-access';
import { AuthStateService } from '../../services/auth-state.service';
import { ChatService } from '../../services/chat.service';

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
        [connectionStatus]="connectionStatus()"
        [currentUserId]="currentProfileId || ''"
        (messageSubmission)="handleMessageSubmission($event)"
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
        color: var(--error);
      }
    `,
  ],
})
export class MessagesComponent implements OnInit, OnDestroy {
  private authStateService = inject(AuthStateService);
  private chatService = inject(ChatService);
  private http = inject(HttpClient);
  private profiles = inject(ProfileAPIService);
  private router = inject(Router);
  private socketChatService = inject(SocketChatService);

  chatContacts = signal<ChatContact[]>([]);
  chatConversations = signal<ChatConversation[]>([]);
  connectionStatus = signal<'connecting' | 'connected' | 'reconnecting'>(
    'connecting'
  );
  private hasConnectedOnce = false;
  private disposeConnectionState?: () => void;
  loading = signal(true);
  error = signal<string | null>(null);

  currentProfileId: string | null = null;
  private viewGeneration = 0;
  @HostListener('window:ot:session-reset')
  clearSessionViews() {
    this.viewGeneration++;
    this.currentProfileId = null;
    this.chatContacts.set([]);
    this.chatConversations.set([]);
    this.loading.set(false);
    this.error.set(null);
    this.connectionStatus.set('connecting');
    this.hasConnectedOnce = false;
    this.socketChatService.destroy();
  }

  async ngOnInit() {
    this.disposeConnectionState = this.socketChatService.onConnectionState(
      (connected) => {
        if (connected) this.hasConnectedOnce = true;
        this.connectionStatus.set(
          connected
            ? 'connected'
            : this.hasConnectedOnce
            ? 'reconnecting'
            : 'connecting'
        );
      }
    );
    this.socketChatService.onConversations((conversations) => {
      this.handleConversationsLoaded(
        conversations as unknown as ChatConversation[]
      );
    });
    this.socketChatService.onMessage((message) => {
      this.handleIncomingMessage(message);
    });
    await this.loadConversations();
  }

  ngOnDestroy() {
    this.disposeConnectionState?.();
    this.clearSessionViews();
  }

  async handleMessageSubmission(
    event: ChatMessageSubmission & { conversationId: string }
  ) {
    if (!this.currentProfileId) {
      event.settle(false);
      return;
    }

    const conversation = this.chatConversations().find(
      (item) => item.id === event.conversationId
    );
    if (!conversation) {
      event.settle(false);
      return;
    }

    const recipientIds = conversation.participants.filter(
      (participantId) => participantId !== this.currentProfileId
    );

    try {
      await this.socketChatService.sendDraftMessage({
        conversationId: event.conversationId,
        content: event.content,
        senderId: this.currentProfileId,
        recipientId: recipientIds,
        type: 'chat',
      });
      event.settle(true);
    } catch {
      event.settle(false);
    }
  }

  handleIncomingMessage(message: ChatMessage) {
    this.appendMessageToConversation(message);
    void this.hydrateLiveAuthor(message);
  }

  private async loadConversations() {
    const userData = this.authStateService.getUserData();
    if (!userData?.profileId) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentProfileId = userData.profileId;
    this.socketChatService.getConversations(userData.profileId);
  }

  private readonly authorLookups = new Set<string>();

  private async hydrateLiveAuthor(message: ChatMessage) {
    const conversation = this.chatConversations().find(
      (c) => c.id === message.conversationId
    );
    if (
      !conversation ||
      !message.senderId ||
      conversation.participantProfiles?.some((p) => p.id === message.senderId)
    )
      return;
    const version = this.viewGeneration;
    const actor = this.currentProfileId;
    const key = `${version}:${actor}:${message.conversationId}:${message.senderId}`;
    if (this.authorLookups.has(key)) return;
    this.authorLookups.add(key);
    try {
      const profiles = await this.lookupProfiles([message.senderId]);
      if (
        version !== this.viewGeneration ||
        actor !== this.currentProfileId ||
        !profiles.length
      )
        return;
      const profile = profiles[0];
      this.chatConversations.update((conversations) =>
        conversations.map((c) => {
          if (
            c.id !== message.conversationId ||
            c.participantProfiles?.some((p) => p.id === message.senderId)
          )
            return c;
          return {
            ...c,
            participantProfiles: [
              ...(c.participantProfiles || []),
              {
                id: profile.id,
                name: profile.profileName,
                profilePic: profile.profilePic,
              },
            ],
          };
        })
      );
    } finally {
      this.authorLookups.delete(key);
    }
  }

  private async lookupProfiles(ids: string[]): Promise<ProfileDto[]> {
    const profiles: ProfileDto[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      try {
        profiles.push(
          ...(await firstValueFrom(
            this.profiles.profileControllerGetProfilesByIds<ProfileDto[]>({
              ids: ids.slice(i, i + 100),
            })
          ))
        );
      } catch {
        /* Missing profile metadata must not hide messages. */
      }
    }
    return profiles;
  }

  private async handleConversationsLoaded(conversations: ChatConversation[]) {
    const generation = this.viewGeneration;
    try {
      const userData = this.authStateService.getUserData();
      if (!userData?.profileId) return;
      const profileId = userData.profileId;

      const conversationMessagesPromises = conversations.map(async (conv) => {
        try {
          const messages = await this.chatService.getMessages(conv.id);
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
      if (generation !== this.viewGeneration) return;
      const ids = [
        ...new Set(
          [
            userData.profileId,
            ...conversations.flatMap((c) => c.participants),
            ...conversationMessages.flatMap((c) =>
              c.messages.map((m) => m.senderId)
            ),
          ].filter(Boolean)
        ),
      ];
      const profiles = await this.lookupProfiles(ids);
      if (
        generation !== this.viewGeneration ||
        userData.profileId !== this.currentProfileId
      )
        return;
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      for (const conversation of conversationMessages) {
        const existing = this.chatConversations().find(
          (c) => c.id === conversation.id
        );
        const merged = new Map(conversation.messages.map((m) => [m.id, m]));
        for (const message of existing?.messages || [])
          merged.set(message.id, message);
        conversation.messages = [...merged.values()];
      }
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
            name:
              conv.type && conv.type !== 'direct'
                ? conv.title || 'Group chat'
                : otherProfile?.profileName || conv.title || 'Unknown',
            profilePic: otherProfile?.profilePic,
          };
        })
      );

      this.chatConversations.set(
        conversations.map((c) => ({
          id: c.id,
          type: c.type,
          participants: c.participants,
          messages: messagesMap.get(c.id) || [],
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          participantProfiles: [
            ...new Set([
              ...c.participants,
              profileId,
              ...(messagesMap.get(c.id) || []).map((m) => m.senderId),
            ]),
          ]
            .map((id) => profileMap.get(id))
            .filter((p): p is ProfileDto => !!p)
            .map((p) => ({
              id: p.id,
              name: p.profileName,
              profilePic: p.profilePic,
            })),
        }))
      );

      for (const conversation of this.chatConversations()) {
        for (const message of conversation.messages)
          void this.hydrateLiveAuthor(message);
      }
      this.loading.set(false);
    } catch (err) {
      if (generation !== this.viewGeneration) return;
      console.error('Failed to load conversations:', err);
      this.error.set('Failed to load conversations. Please try again later.');
      this.loading.set(false);
    }
  }

  private appendMessageToConversation(message: ChatMessage) {
    this.chatConversations.update((conversations) =>
      conversations.map((conversation) => {
        if (conversation.id !== message.conversationId) {
          return conversation;
        }

        const alreadyPresent = conversation.messages.some(
          (existing) => existing.id === message.id
        );
        if (alreadyPresent) {
          return conversation;
        }

        return {
          ...conversation,
          messages: [...conversation.messages, message],
          updatedAt: message.timestamp,
        };
      })
    );
  }
}
