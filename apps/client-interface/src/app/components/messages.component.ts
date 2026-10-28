import {
  Component,
  OnInit,
  signal,
  inject,
  OnDestroy,
  computed,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ChatUiComponent,
  ChatContact,
  ChatConversation,
  ChatMessage,
  ChatMessageSubmission,
  SocketChatService,
} from '@optimistic-tanuki/chat-ui';
import { ProfileService } from '../profile.service';
import {
  ChatService,
  ChatConversation as AppChatConversation,
} from '../chat.service';
import { PresenceService, ConversationPresence } from '../presence.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/profile-ui-data-access';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, ChatUiComponent],
  template: `
    <div class="messages-page">
      <div class="page-header">
        <div>
          <h1>Messages</h1>
          <p class="subtitle">Your conversations</p>
          @if (connectionStatus() === 'reconnecting') {
          <p class="connection-status" role="status">
            Reconnecting… saved messages will reload when you are back online.
          </p>
          } @else if (connectionStatus() === 'connecting') {
          <p class="connection-status" role="status">Connecting to chat…</p>
          }
        </div>
        <label class="start-conversation">
          <span>Start a conversation</span>
          <select (change)="startDirectConversation($any($event.target).value)">
            <option value="">Choose a person</option>
            @for (profile of availableProfiles(); track profile.id) {
            <option [value]="profile.id">{{ profile.profileName }}</option>
            }
          </select>
        </label>
        @if (chatContacts().length > 0) {
        <button class="clear-button" type="button" (click)="clearAll()">
          Clear all
        </button>
        }
      </div>

      @if (loading()) {
      <div class="loading">Loading conversations...</div>
      } @else if (error()) {
      <div class="error">{{ error() }}</div>
      } @else {
      <div class="messages-shell">
        <lib-chat-ui
          [contacts]="chatContacts()"
          [conversations]="chatConversations()"
          [currentUserId]="currentProfileId || ''"
          [layout]="'embedded'"
          (messageSubmission)="handleMessageSubmitted($event)"
        ></lib-chat-ui>
      </div>
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
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
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

      .clear-button {
        padding: 0.625rem 0.9rem;
        border-radius: var(--border-radius-md, 0.75rem);
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--surface) 92%, transparent);
        color: var(--foreground);
        cursor: pointer;
      }

      .start-conversation {
        display: grid;
        gap: 0.25rem;
        color: var(--muted);
        font-size: 0.875rem;

        select {
          min-height: 2.75rem;
          border: 1px solid var(--border);
          border-radius: var(--border-radius-md, 0.75rem);
          background: var(--surface);
          color: var(--foreground);
          padding: 0 0.75rem;
        }
      }

      .messages-shell {
        height: min(42rem, calc(100dvh - 20rem));
        min-height: 0;
        overflow: hidden;
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

      .connection-status {
        color: var(--muted);
        font-size: 0.875rem;
      }
    `,
  ],
})
export class MessagesComponent implements OnInit, OnDestroy {
  private profileService = inject(ProfileService);
  private chatService = inject(ChatService);
  private presenceService = inject(PresenceService);
  private http = inject(HttpClient);
  private profiles = inject(OptomisitcTanukiAPIService);
  private router = inject(Router);
  private socketChatService = inject(SocketChatService);

  chatContacts = signal<ChatContact[]>([]);
  chatConversations = signal<ChatConversation[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  connectionStatus = signal<'connecting' | 'connected' | 'reconnecting'>(
    'connecting'
  );
  availableProfiles = computed(() =>
    this.profileService.discoverableProfiles()
  );

  currentProfileId: string | null = null;
  private hasConnectedOnce = false;
  private socketListenerDisposers: Array<() => void> = [];
  private historyLoadVersion = 0;

  async ngOnInit() {
    this.socketListenerDisposers.push(
      this.socketChatService.onConversations((conversations) => {
        this.handleConversationsLoaded(
          conversations as unknown as AppChatConversation[]
        );
      }),
      this.socketChatService.onMessage((message) => {
        this.handleIncomingMessage(message);
      }),
      this.socketChatService.onConnectionState((connected) => {
        if (connected) {
          const reconnecting = this.hasConnectedOnce;
          this.hasConnectedOnce = true;
          this.connectionStatus.set('connected');
          if (reconnecting && this.currentProfileId) {
            this.socketChatService.getConversations(this.currentProfileId);
          }
        } else {
          this.connectionStatus.set(
            this.hasConnectedOnce ? 'reconnecting' : 'connecting'
          );
        }
      })
    );
    await this.loadConversations();
    await this.loadDiscoverableProfiles();
  }

  ngOnDestroy() {
    this.socketListenerDisposers.forEach((dispose) => dispose());
    this.socketListenerDisposers = [];
    this.clearSessionViews();
  }

  @HostListener('window:ot:session-reset')
  clearSessionViews() {
    this.historyLoadVersion++;
    this.currentProfileId = null;
    this.loading.set(false);
    this.error.set(null);
    this.clearAll();
    this.socketChatService.destroy();
  }

  clearAll() {
    this.chatContacts.set([]);
    this.chatConversations.set([]);
  }

  async handleMessageSubmitted(
    event: ChatMessageSubmission & {
      conversationId: string;
    }
  ) {
    const conversationId = event.conversationId;
    if (!this.currentProfileId) {
      event.settle(false);
      return;
    }

    const conversation = this.chatConversations().find(
      (item) => item.id === conversationId
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
        conversationId,
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

  async startDirectConversation(profileId: string): Promise<void> {
    if (
      !profileId ||
      !this.currentProfileId ||
      profileId === this.currentProfileId
    ) {
      return;
    }

    try {
      await this.chatService.getOrCreateDirectChat(profileId);
      this.socketChatService.getConversations(this.currentProfileId);
    } catch (err) {
      console.error('Failed to start direct conversation:', err);
      this.error.set('Could not start the conversation. Please try again.');
    }
  }

  handleIncomingMessage(message: ChatMessage) {
    this.appendMessageToConversation(message);
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

  private async loadDiscoverableProfiles() {
    try {
      await this.profileService.getDiscoverableProfiles();
    } catch (err) {
      console.error('Failed to load available conversation recipients:', err);
    }
  }

  private async handleConversationsLoaded(
    conversations: AppChatConversation[]
  ) {
    try {
      const profile = this.profileService.getCurrentUserProfile();
      if (!profile) return;
      const profileId = profile.id;
      const historyLoadVersion = ++this.historyLoadVersion;

      const allParticipantIds = new Set<string>();
      conversations.forEach((c) => {
        c.participants.forEach((p) => allParticipantIds.add(p));
      });

      const participantIds = Array.from(allParticipantIds);

      let profiles: ProfileDto[] = [];
      const presenceByConversationProfileId = new Map<
        string,
        ConversationPresence
      >();

      if (participantIds.length > 0) {
        profiles = await firstValueFrom(
          this.profiles.profileControllerGetProfilesByIds<ProfileDto[]>({
            ids: participantIds,
          })
        );
      }

      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      // Presence is optional metadata. Query each authorized conversation's
      // participant audience and keep chat/profile rendering independent of it.
      await Promise.all(
        conversations.map(async (conversation) => {
          const targetProfileIds = [
            ...new Set(
              conversation.participants.filter((id) => id !== profileId)
            ),
          ];
          for (let start = 0; start < targetProfileIds.length; start += 100) {
            try {
              const presence = await firstValueFrom(
                this.presenceService.getConversationPresence(
                  conversation.id,
                  targetProfileIds.slice(start, start + 100)
                )
              );
              presence.forEach((entry) =>
                presenceByConversationProfileId.set(
                  `${conversation.id}:${entry.profileId}`,
                  entry
                )
              );
            } catch (err) {
              console.warn(
                'Could not load conversation presence:',
                conversation.id,
                err
              );
            }
          }
        })
      );

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
      if (
        historyLoadVersion !== this.historyLoadVersion ||
        profileId !== this.currentProfileId ||
        profileId !== this.profileService.getCurrentUserProfile()?.id
      ) {
        return;
      }
      const latestVisibleMessages = new Map(
        this.chatConversations().map((conversation) => [
          conversation.id,
          conversation.messages,
        ])
      );
      for (const conversation of conversationMessages) {
        const merged = new Map(
          conversation.messages.map((message) => [message.id, message])
        );
        for (const message of latestVisibleMessages.get(conversation.id) ||
          []) {
          merged.set(message.id, message);
        }
        conversation.messages = [...merged.values()].sort(
          (left, right) => left.timestamp.getTime() - right.timestamp.getTime()
        );
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
          const presence = otherParticipantId
            ? presenceByConversationProfileId.get(
                `${conv.id}:${otherParticipantId}`
              )
            : null;

          return {
            id: conv.id,
            name: otherProfile?.profileName || conv.title || 'Unknown',
            profilePic: otherProfile?.profilePic,
            presence: presence?.status || 'offline',
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
          participantProfiles: c.participants
            .map((participantId) => profileMap.get(participantId))
            .filter((participant): participant is ProfileDto => !!participant)
            .map((participant) => ({
              id: participant.id,
              name: participant.profileName,
              profilePic: participant.profilePic,
            })),
        }))
      );

      this.loading.set(false);
    } catch (err) {
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

    this.chatContacts.update((contacts) =>
      contacts.map((contact) =>
        contact.id === message.conversationId
          ? {
              ...contact,
              lastMessage: message.content,
              lastMessageTime: message.timestamp.toISOString(),
            }
          : contact
      )
    );
  }
}
